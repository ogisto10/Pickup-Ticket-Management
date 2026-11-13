using Microsoft.EntityFrameworkCore;
using PickupManagement.Application.AxIntegration;
using PickupManagement.Application.Common.Exceptions;
using PickupManagement.Application.Common.Interfaces;
using PickupManagement.Application.Credit;
using PickupManagement.Application.Notifications;
using PickupManagement.Application.Reception;
using PickupManagement.Domain.Entities;
using PickupManagement.Domain.Enums;
using PickupManagement.Infrastructure.Persistence;

namespace PickupManagement.Infrastructure.Credit;

public class CreditService : ICreditService
{
    private readonly PickupManagementDbContext _db;
    private readonly IAxPickupService _axService;
    private readonly ICurrentUserService _currentUser;
    private readonly IDateTimeProvider _clock;
    private readonly IPickupRealtimeNotifier _notifier;

    public CreditService(
        PickupManagementDbContext db,
        IAxPickupService axService,
        ICurrentUserService currentUser,
        IDateTimeProvider clock,
        IPickupRealtimeNotifier notifier)
    {
        _db = db;
        _axService = axService;
        _currentUser = currentUser;
        _clock = clock;
        _notifier = notifier;
    }

    public async Task<TicketCreditContextDto> GetCreditContextAsync(
        Guid ticketId,
        CancellationToken cancellationToken = default)
    {
        var ticket = await _db.PickupTickets
            .AsNoTracking()
            .Include(t => t.PickupPlan)
            .Include(t => t.Orders)
            .FirstOrDefaultAsync(t => t.Id == ticketId, cancellationToken)
            ?? throw new ResourceNotFoundException($"Ticket '{ticketId}' was not found.");

        var primaryDataArea = ticket.Orders.FirstOrDefault()?.DataAreaId ?? "DAT";
        var creditInfo = await _axService.GetCustomerCreditInfoAsync(
            ticket.PickupPlan.CustomerAccount,
            primaryDataArea,
            cancellationToken);

        var orderContexts = new List<CreditOrderContextDto>();
        foreach (var order in ticket.Orders.OrderBy(o => o.SalesId))
        {
            var axCheck = await _axService.ValidateOrderForReleaseAsync(
                order.SalesId,
                order.DataAreaId,
                cancellationToken);

            orderContexts.Add(new CreditOrderContextDto(
                order.Id,
                order.DataAreaId,
                order.SalesId,
                order.Status,
                order.CreditStatus,
                axCheck.IsEligible,
                axCheck.IsAlreadyReleased,
                axCheck.IsCancelled,
                axCheck.AxStatus,
                axCheck.EligibilityLabel,
                axCheck.BlockingReason,
                order.LastAxSyncAt));
        }

        var detailDto = new TicketDetailDto(
            ticket.Id,
            ticket.PickupPlanId,
            ticket.TicketDate,
            ticket.DailySequence,
            ticket.TicketNumber,
            ticket.QueueNumber,
            ticket.ArrivalTime,
            ticket.PickupPlan.CustomerAccount,
            ticket.PickupPlan.CustomerNameSnapshot,
            ticket.PickupPlan.WarehouseId,
            ticket.Status,
            ticket.CreditDecisionBy,
            ticket.CreditDecisionAt,
            ticket.CreditComment,
            ticket.ReadyAt,
            ticket.CollectedAt,
            ticket.Orders
                .OrderBy(o => o.SalesId)
                .Select(o => new TicketOrderDetailDto(
                    o.Id,
                    o.PickupPlanOrderId,
                    o.DataAreaId,
                    o.SalesId,
                    o.Status,
                    o.CreditStatus,
                    o.WarehouseStatus,
                    o.LastAxSyncAt))
                .ToArray());

        return new TicketCreditContextDto(detailDto, creditInfo, orderContexts);
    }

    public async Task<CreditDecisionResponse> RecordCreditDecisionAsync(
        Guid ticketId,
        CreditDecisionRequest request,
        CancellationToken cancellationToken = default)
    {
        if (request.Decision is OrderCreditStatus.PENDING)
        {
            throw new DomainValidationException("Credit decision must be APPROVED, ON_HOLD, or REJECTED.");
        }

        if ((request.Decision == OrderCreditStatus.ON_HOLD || request.Decision == OrderCreditStatus.REJECTED)
            && string.IsNullOrWhiteSpace(request.Comment))
        {
            throw new DomainValidationException("A reason comment is mandatory when placing a ticket on hold or rejecting it.");
        }

        var ticket = await _db.PickupTickets
            .Include(t => t.PickupPlan)
            .Include(t => t.Orders)
            .FirstOrDefaultAsync(t => t.Id == ticketId, cancellationToken)
            ?? throw new ResourceNotFoundException($"Ticket '{ticketId}' was not found.");

        if (ticket.Status is PickupTicketStatus.COLLECTED or PickupTicketStatus.CANCELLED or PickupTicketStatus.READY)
        {
            throw new ConflictException($"Ticket '{ticket.TicketNumber}' cannot receive a credit decision in status '{ticket.Status}'.");
        }

        var now = _clock.UtcNow;
        var correlationId = Guid.NewGuid();
        var oldTicketStatus = ticket.Status;

        ticket.CreditDecisionBy = _currentUser.UserName;
        ticket.CreditDecisionAt = now;
        ticket.CreditComment = request.Comment?.Trim();

        var orderResults = new List<CreditOrderResultDto>();

        if (request.Decision is OrderCreditStatus.ON_HOLD or OrderCreditStatus.REJECTED)
        {
            var nextTicketStatus = request.Decision == OrderCreditStatus.ON_HOLD
                ? PickupTicketStatus.ON_HOLD
                : PickupTicketStatus.REJECTED;

            foreach (var order in ticket.Orders.Where(o => o.Status != PickupTicketOrderStatus.CANCELLED && o.Status != PickupTicketOrderStatus.COLLECTED))
            {
                var oldOrderStatus = order.Status;
                order.CreditStatus = request.Decision;
                if (order.Status == PickupTicketOrderStatus.PENDING_CREDIT)
                {
                    order.Status = PickupTicketOrderStatus.BLOCKED;
                }

                _db.OrderWorkflowHistories.Add(new OrderWorkflowHistory
                {
                    TicketOrderId = order.Id,
                    OldStatus = oldOrderStatus.ToString(),
                    NewStatus = order.Status.ToString(),
                    Action = request.Decision == OrderCreditStatus.ON_HOLD ? "CREDIT_HOLD" : "CREDIT_REJECTED",
                    Comment = ticket.CreditComment,
                    UserId = _currentUser.UserName,
                    OccurredAt = now,
                    CorrelationId = correlationId
                });

                orderResults.Add(new CreditOrderResultDto(
                    order.Id,
                    order.SalesId,
                    order.CreditStatus,
                    order.Status,
                    request.Decision.ToString(),
                    null,
                    ticket.CreditComment));
            }

            ticket.Status = nextTicketStatus;
            _db.PickupWorkflowHistories.Add(new PickupWorkflowHistory
            {
                TicketId = ticket.Id,
                OldStatus = oldTicketStatus.ToString(),
                NewStatus = ticket.Status.ToString(),
                Action = request.Decision == OrderCreditStatus.ON_HOLD ? "CREDIT_HOLD" : "CREDIT_REJECTED",
                Comment = ticket.CreditComment,
                UserId = _currentUser.UserName,
                OccurredAt = now,
                CorrelationId = correlationId
            });

            await _db.SaveChangesAsync(cancellationToken);
            await _notifier.NotifyQueueUpdatedAsync(ticket.Id, "CREDIT_DECISION", cancellationToken);

            return new CreditDecisionResponse(
                ticket.Id,
                ticket.TicketNumber,
                ticket.Status,
                request.Decision,
                ticket.CreditComment,
                orderResults);
        }

        // APPROVED decision: evaluate each order against AX eligibility and release approved eligible orders.
        var decisionLookup = (request.Orders ?? Array.Empty<CreditOrderDecisionInput>())
            .ToDictionary(x => x.SalesId.Trim(), x => x.ApproveForRelease, StringComparer.OrdinalIgnoreCase);

        foreach (var order in ticket.Orders.OrderBy(o => o.SalesId))
        {
            if (order.Status is PickupTicketOrderStatus.CANCELLED or PickupTicketOrderStatus.COLLECTED)
            {
                continue;
            }

            if (order.Status is PickupTicketOrderStatus.RELEASED or PickupTicketOrderStatus.IN_PREPARATION or PickupTicketOrderStatus.READY)
            {
                orderResults.Add(new CreditOrderResultDto(
                    order.Id, order.SalesId, order.CreditStatus, order.Status, "RELEASED", null, null));
                continue;
            }

            var approveForRelease = decisionLookup.Count == 0
                || (decisionLookup.TryGetValue(order.SalesId, out var flag) && flag);

            if (!approveForRelease)
            {
                var prev = order.Status;
                order.CreditStatus = OrderCreditStatus.ON_HOLD;
                order.Status = PickupTicketOrderStatus.BLOCKED;
                _db.OrderWorkflowHistories.Add(new OrderWorkflowHistory
                {
                    TicketOrderId = order.Id,
                    OldStatus = prev.ToString(),
                    NewStatus = order.Status.ToString(),
                    Action = "CREDIT_ORDER_HELD",
                    Comment = ticket.CreditComment ?? "Excluded from release by credit manager.",
                    UserId = _currentUser.UserName,
                    OccurredAt = now,
                    CorrelationId = correlationId
                });

                orderResults.Add(new CreditOrderResultDto(
                    order.Id, order.SalesId, order.CreditStatus, order.Status, "ON_HOLD", null, "Not approved for release."));
                continue;
            }

            var eligibility = await _axService.ValidateOrderForReleaseAsync(order.SalesId, order.DataAreaId, cancellationToken);
            order.LastAxSyncAt = now;

            if (eligibility.IsCancelled)
            {
                var prev = order.Status;
                order.CreditStatus = OrderCreditStatus.REJECTED;
                order.Status = PickupTicketOrderStatus.BLOCKED;
                _db.OrderWorkflowHistories.Add(new OrderWorkflowHistory
                {
                    TicketOrderId = order.Id,
                    OldStatus = prev.ToString(),
                    NewStatus = order.Status.ToString(),
                    Action = "AX_ORDER_CANCELLED",
                    Comment = eligibility.BlockingReason ?? "Sales order is cancelled in AX.",
                    UserId = _currentUser.UserName,
                    OccurredAt = now,
                    CorrelationId = correlationId
                });

                orderResults.Add(new CreditOrderResultDto(
                    order.Id, order.SalesId, order.CreditStatus, order.Status, "BLOCKED", null,
                    eligibility.BlockingReason ?? "Sales order is cancelled in AX."));
                continue;
            }

            if (!eligibility.IsEligible && !eligibility.IsAlreadyReleased)
            {
                var prev = order.Status;
                order.CreditStatus = OrderCreditStatus.ON_HOLD;
                order.Status = PickupTicketOrderStatus.BLOCKED;
                _db.OrderWorkflowHistories.Add(new OrderWorkflowHistory
                {
                    TicketOrderId = order.Id,
                    OldStatus = prev.ToString(),
                    NewStatus = order.Status.ToString(),
                    Action = "AX_ELIGIBILITY_BLOCKED",
                    Comment = eligibility.BlockingReason ?? "Order failed AX eligibility check.",
                    UserId = _currentUser.UserName,
                    OccurredAt = now,
                    CorrelationId = correlationId
                });

                orderResults.Add(new CreditOrderResultDto(
                    order.Id, order.SalesId, order.CreditStatus, order.Status, "BLOCKED", null,
                    eligibility.BlockingReason ?? "Order failed AX eligibility check."));
                continue;
            }

            order.CreditStatus = OrderCreditStatus.APPROVED;

            if (eligibility.IsAlreadyReleased)
            {
                var prev = order.Status;
                order.Status = PickupTicketOrderStatus.RELEASED;
                _db.OrderWorkflowHistories.Add(new OrderWorkflowHistory
                {
                    TicketOrderId = order.Id,
                    OldStatus = prev.ToString(),
                    NewStatus = order.Status.ToString(),
                    Action = "AX_ALREADY_RELEASED",
                    Comment = "Confirmed already released in AX.",
                    UserId = _currentUser.UserName,
                    OccurredAt = now,
                    CorrelationId = correlationId
                });

                orderResults.Add(new CreditOrderResultDto(
                    order.Id, order.SalesId, order.CreditStatus, order.Status, "RELEASED", null, null));
                continue;
            }

            var releaseResult = await ExecuteAxReleaseWithOutboxAsync(order, correlationId, cancellationToken);
            orderResults.Add(releaseResult);
        }

        UpdateTicketStatusAfterCredit(ticket, oldTicketStatus, correlationId, now);
        await _db.SaveChangesAsync(cancellationToken);
        await _notifier.NotifyQueueUpdatedAsync(ticket.Id, "CREDIT_DECISION", cancellationToken);

        return new CreditDecisionResponse(
            ticket.Id,
            ticket.TicketNumber,
            ticket.Status,
            request.Decision,
            ticket.CreditComment,
            orderResults);
    }

    public async Task<CreditOrderResultDto> ReleaseOrderAsync(
        Guid ticketId,
        Guid orderId,
        CancellationToken cancellationToken = default)
    {
        var ticket = await _db.PickupTickets
            .Include(t => t.Orders)
            .FirstOrDefaultAsync(t => t.Id == ticketId, cancellationToken)
            ?? throw new ResourceNotFoundException($"Ticket '{ticketId}' was not found.");

        var order = ticket.Orders.FirstOrDefault(o => o.Id == orderId)
            ?? throw new ResourceNotFoundException($"Order '{orderId}' was not found on ticket '{ticket.TicketNumber}'.");

        if (order.Status is PickupTicketOrderStatus.CANCELLED or PickupTicketOrderStatus.COLLECTED)
        {
            throw new ConflictException($"Order '{order.SalesId}' cannot be released in status '{order.Status}'.");
        }

        if (order.Status is PickupTicketOrderStatus.RELEASED or PickupTicketOrderStatus.IN_PREPARATION or PickupTicketOrderStatus.READY)
        {
            return new CreditOrderResultDto(
                order.Id, order.SalesId, order.CreditStatus, order.Status, "RELEASED", null, null);
        }

        var now = _clock.UtcNow;
        var correlationId = Guid.NewGuid();
        var oldTicketStatus = ticket.Status;

        var eligibility = await _axService.ValidateOrderForReleaseAsync(order.SalesId, order.DataAreaId, cancellationToken);
        order.LastAxSyncAt = now;

        if (eligibility.IsCancelled || !eligibility.IsEligible && !eligibility.IsAlreadyReleased)
        {
            var prev = order.Status;
            order.Status = PickupTicketOrderStatus.BLOCKED;
            order.CreditStatus = eligibility.IsCancelled ? OrderCreditStatus.REJECTED : OrderCreditStatus.ON_HOLD;
            _db.OrderWorkflowHistories.Add(new OrderWorkflowHistory
            {
                TicketOrderId = order.Id,
                OldStatus = prev.ToString(),
                NewStatus = order.Status.ToString(),
                Action = "AX_RELEASE_BLOCKED",
                Comment = eligibility.BlockingReason ?? "Order failed AX eligibility check.",
                UserId = _currentUser.UserName,
                OccurredAt = now,
                CorrelationId = correlationId
            });

            await _db.SaveChangesAsync(cancellationToken);
            return new CreditOrderResultDto(
                order.Id, order.SalesId, order.CreditStatus, order.Status, "BLOCKED", null,
                eligibility.BlockingReason ?? "Order failed AX eligibility check.");
        }

        order.CreditStatus = OrderCreditStatus.APPROVED;

        CreditOrderResultDto result;
        if (eligibility.IsAlreadyReleased)
        {
            var prev = order.Status;
            order.Status = PickupTicketOrderStatus.RELEASED;
            _db.OrderWorkflowHistories.Add(new OrderWorkflowHistory
            {
                TicketOrderId = order.Id,
                OldStatus = prev.ToString(),
                NewStatus = order.Status.ToString(),
                Action = "AX_ALREADY_RELEASED",
                Comment = "Confirmed already released in AX.",
                UserId = _currentUser.UserName,
                OccurredAt = now,
                CorrelationId = correlationId
            });
            result = new CreditOrderResultDto(order.Id, order.SalesId, order.CreditStatus, order.Status, "RELEASED", null, null);
        }
        else
        {
            result = await ExecuteAxReleaseWithOutboxAsync(order, correlationId, cancellationToken);
        }

        UpdateTicketStatusAfterCredit(ticket, oldTicketStatus, correlationId, now);
        await _db.SaveChangesAsync(cancellationToken);
        await _notifier.NotifyQueueUpdatedAsync(ticket.Id, "ORDER_RELEASE", cancellationToken);

        return result;
    }

    private async Task<CreditOrderResultDto> ExecuteAxReleaseWithOutboxAsync(
        PickupTicketOrder order,
        Guid correlationId,
        CancellationToken cancellationToken)
    {
        var now = _clock.UtcNow;
        var operationKey = $"RELEASE:{order.Id}";

        // Section 6.4: Persist the integration request before sending it to AX.
        var integrationRequest = await _db.IntegrationRequests
            .FirstOrDefaultAsync(r => r.OperationKey == operationKey, cancellationToken);

        if (integrationRequest is null)
        {
            integrationRequest = new IntegrationRequest
            {
                Id = Guid.NewGuid(),
                OperationKey = operationKey,
                OperationType = "RELEASE_SALES_ORDER",
                EntityId = order.Id,
                Status = IntegrationRequestStatus.PENDING,
                AttemptCount = 0,
                CreatedAt = now
            };
            _db.IntegrationRequests.Add(integrationRequest);
        }

        var prevOrderStatus = order.Status;
        order.Status = PickupTicketOrderStatus.RELEASE_PENDING;
        await _db.SaveChangesAsync(cancellationToken);

        var attempt = new IntegrationAttempt
        {
            Id = Guid.NewGuid(),
            IntegrationRequestId = integrationRequest.Id,
            StartedAt = _clock.UtcNow
        };
        integrationRequest.AttemptCount += 1;
        integrationRequest.Status = IntegrationRequestStatus.IN_PROGRESS;

        try
        {
            var axResult = await _axService.ReleaseSalesOrderForPickupAsync(
                order.SalesId,
                operationKey,
                order.DataAreaId,
                cancellationToken);

            attempt.FinishedAt = _clock.UtcNow;
            order.LastAxSyncAt = attempt.FinishedAt;

            if (axResult.Succeeded)
            {
                attempt.Outcome = IntegrationAttemptOutcome.SUCCEEDED;
                integrationRequest.Status = IntegrationRequestStatus.SUCCEEDED;
                integrationRequest.CompletedAt = attempt.FinishedAt;
                integrationRequest.LastError = null;
                order.Status = PickupTicketOrderStatus.RELEASED;

                _db.OrderWorkflowHistories.Add(new OrderWorkflowHistory
                {
                    TicketOrderId = order.Id,
                    OldStatus = prevOrderStatus.ToString(),
                    NewStatus = order.Status.ToString(),
                    Action = "AX_RELEASED",
                    Comment = $"Released in AX ({axResult.AxReference}).",
                    UserId = _currentUser.UserName,
                    OccurredAt = attempt.FinishedAt.Value,
                    CorrelationId = correlationId
                });

                _db.IntegrationAttempts.Add(attempt);
                return new CreditOrderResultDto(
                    order.Id, order.SalesId, order.CreditStatus, order.Status, "RELEASED", axResult.AxReference, null);
            }

            if (axResult.IsTransientTimeout)
            {
                attempt.Outcome = IntegrationAttemptOutcome.TIMEOUT;
                attempt.ErrorCode = axResult.ErrorCode ?? "AX_TIMEOUT";
                attempt.ErrorMessage = axResult.ErrorMessage ?? "AX AIF call timed out.";
                integrationRequest.Status = IntegrationRequestStatus.RECONCILING;
                integrationRequest.LastError = attempt.ErrorMessage;
                order.Status = PickupTicketOrderStatus.RECONCILING;

                _db.OrderWorkflowHistories.Add(new OrderWorkflowHistory
                {
                    TicketOrderId = order.Id,
                    OldStatus = prevOrderStatus.ToString(),
                    NewStatus = order.Status.ToString(),
                    Action = "AX_RELEASE_RECONCILING",
                    Comment = attempt.ErrorMessage,
                    UserId = _currentUser.UserName,
                    OccurredAt = attempt.FinishedAt.Value,
                    CorrelationId = correlationId
                });

                _db.IntegrationAttempts.Add(attempt);
                return new CreditOrderResultDto(
                    order.Id, order.SalesId, order.CreditStatus, order.Status, "RECONCILING", null, attempt.ErrorMessage);
            }

            attempt.Outcome = IntegrationAttemptOutcome.BUSINESS_ERROR;
            attempt.ErrorCode = axResult.ErrorCode ?? "AX_BUSINESS_ERROR";
            attempt.ErrorMessage = axResult.ErrorMessage ?? "AX rejected sales order release.";
            integrationRequest.Status = IntegrationRequestStatus.FAILED_BUSINESS;
            integrationRequest.CompletedAt = attempt.FinishedAt;
            integrationRequest.LastError = attempt.ErrorMessage;
            order.Status = PickupTicketOrderStatus.BLOCKED;

            _db.OrderWorkflowHistories.Add(new OrderWorkflowHistory
            {
                TicketOrderId = order.Id,
                OldStatus = prevOrderStatus.ToString(),
                NewStatus = order.Status.ToString(),
                Action = "AX_RELEASE_REJECTED",
                Comment = attempt.ErrorMessage,
                UserId = _currentUser.UserName,
                OccurredAt = attempt.FinishedAt.Value,
                CorrelationId = correlationId
            });

            _db.IntegrationAttempts.Add(attempt);
            return new CreditOrderResultDto(
                order.Id, order.SalesId, order.CreditStatus, order.Status, "BLOCKED", null, attempt.ErrorMessage);
        }
        catch (Exception ex)
        {
            attempt.FinishedAt = _clock.UtcNow;
            attempt.Outcome = IntegrationAttemptOutcome.TECHNICAL_ERROR;
            attempt.ErrorCode = "AX_TECHNICAL_ERROR";
            attempt.ErrorMessage = ex.Message.Length > 950 ? ex.Message[..950] : ex.Message;

            integrationRequest.Status = IntegrationRequestStatus.RECONCILING;
            integrationRequest.LastError = attempt.ErrorMessage;
            order.Status = PickupTicketOrderStatus.RECONCILING;

            _db.OrderWorkflowHistories.Add(new OrderWorkflowHistory
            {
                TicketOrderId = order.Id,
                OldStatus = prevOrderStatus.ToString(),
                NewStatus = order.Status.ToString(),
                Action = "AX_RELEASE_RECONCILING",
                Comment = attempt.ErrorMessage,
                UserId = _currentUser.UserName,
                OccurredAt = attempt.FinishedAt.Value,
                CorrelationId = correlationId
            });

            _db.IntegrationAttempts.Add(attempt);
            return new CreditOrderResultDto(
                order.Id, order.SalesId, order.CreditStatus, order.Status, "RELEASE_PENDING", null, attempt.ErrorMessage);
        }
    }

    private void UpdateTicketStatusAfterCredit(
        PickupTicket ticket,
        PickupTicketStatus oldTicketStatus,
        Guid correlationId,
        DateTime now)
    {
        var activeOrders = ticket.Orders
            .Where(o => o.Status != PickupTicketOrderStatus.CANCELLED)
            .ToList();

        PickupTicketStatus nextStatus;
        if (activeOrders.Any(o => o.Status is PickupTicketOrderStatus.RELEASED or PickupTicketOrderStatus.IN_PREPARATION or PickupTicketOrderStatus.READY))
        {
            nextStatus = PickupTicketStatus.IN_PREPARATION;
        }
        else if (activeOrders.Any(o => o.Status is PickupTicketOrderStatus.RELEASE_PENDING or PickupTicketOrderStatus.RECONCILING))
        {
            nextStatus = PickupTicketStatus.APPROVED;
        }
        else
        {
            nextStatus = PickupTicketStatus.ON_HOLD;
        }

        ticket.Status = nextStatus;

        if (nextStatus != oldTicketStatus)
        {
            _db.PickupWorkflowHistories.Add(new PickupWorkflowHistory
            {
                TicketId = ticket.Id,
                OldStatus = oldTicketStatus.ToString(),
                NewStatus = nextStatus.ToString(),
                Action = "CREDIT_APPROVED",
                Comment = ticket.CreditComment,
                UserId = _currentUser.UserName,
                OccurredAt = now,
                CorrelationId = correlationId
            });
        }
    }
}
