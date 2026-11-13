using System.Data;
using Microsoft.EntityFrameworkCore;
using PickupManagement.Application.AxIntegration;
using PickupManagement.Application.Common.Exceptions;
using PickupManagement.Application.Common.Interfaces;
using PickupManagement.Application.Notifications;
using PickupManagement.Application.Reception;
using PickupManagement.Domain.Entities;
using PickupManagement.Domain.Enums;
using PickupManagement.Infrastructure.Persistence;

namespace PickupManagement.Infrastructure.Reception;

public class ReceptionService : IReceptionService
{
    private readonly PickupManagementDbContext _db;
    private readonly IAxPickupService _axService;
    private readonly ICurrentUserService _currentUser;
    private readonly IDateTimeProvider _clock;
    private readonly IPickupRealtimeNotifier _notifier;

    public ReceptionService(
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

    public async Task<ArrivalTicketResponse> ConfirmArrivalAsync(
        Guid pickupPlanId,
        CancellationToken cancellationToken = default)
    {
        var strategy = _db.Database.CreateExecutionStrategy();
        var result = await strategy.ExecuteAsync(async () =>
        {
            await using var transaction = await _db.Database.BeginTransactionAsync(
                IsolationLevel.Serializable,
                cancellationToken);

            var plan = await _db.PickupPlans
                .Include(p => p.Orders)
                .Include(p => p.Ticket)
                .FirstOrDefaultAsync(p => p.Id == pickupPlanId, cancellationToken)
                ?? throw new ResourceNotFoundException($"Pickup plan '{pickupPlanId}' was not found.");

            // Section 8: Client arrives twice -> return existing active ticket.
            if (plan.Ticket is not null)
            {
                await transaction.CommitAsync(cancellationToken);
                return (Created: false, Response: new ArrivalTicketResponse(
                    plan.Ticket.Id,
                    plan.Ticket.TicketNumber,
                    plan.Ticket.QueueNumber,
                    plan.Ticket.Status,
                    plan.Ticket.ArrivalTime,
                    plan.CustomerAccount,
                    plan.CustomerNameSnapshot,
                    plan.Orders.Count));
            }

            if (plan.Status != PickupPlanStatus.PLANNED)
            {
                throw new ConflictException(
                    $"Cannot confirm arrival for plan '{pickupPlanId}' because its status is '{plan.Status}'.");
            }

            if (plan.Orders.Count == 0)
            {
                throw new DomainValidationException("Cannot issue a ticket for a pickup plan with no sales orders.");
            }

            var ticket = await IssueTicketForPlanInternalAsync(plan, cancellationToken);
            await _db.SaveChangesAsync(cancellationToken);
            await transaction.CommitAsync(cancellationToken);

            return (Created: true, Response: new ArrivalTicketResponse(
                ticket.Id,
                ticket.TicketNumber,
                ticket.QueueNumber,
                ticket.Status,
                ticket.ArrivalTime,
                plan.CustomerAccount,
                plan.CustomerNameSnapshot,
                plan.Orders.Count));
        });

        if (result.Created)
        {
            await _notifier.NotifyQueueUpdatedAsync(result.Response.TicketId, "ARRIVAL", cancellationToken);
        }

        return result.Response;
    }

    public async Task<ArrivalTicketResponse> RegisterWalkInArrivalAsync(
        WalkInArrivalRequest request,
        CancellationToken cancellationToken = default)
    {
        if (string.IsNullOrWhiteSpace(request.CustomerAccount))
        {
            throw new DomainValidationException("Customer account is required.");
        }

        if (request.SalesOrders is null || request.SalesOrders.Count == 0)
        {
            throw new DomainValidationException("At least one eligible AX sales order is required.");
        }

        var warehouseId = request.WarehouseId.Trim();
        var settingsLookup = await _db.PickupSettings
            .AsNoTracking()
            .FirstOrDefaultAsync(s => s.WarehouseId == warehouseId, cancellationToken)
            ?? throw new DomainValidationException($"Warehouse '{warehouseId}' is not configured.");

        var dataAreaId = settingsLookup.AxDataAreaId;
        var customer = await _axService.GetCustomerForPickupAsync(request.CustomerAccount.Trim(), dataAreaId, cancellationToken)
            ?? throw new DomainValidationException($"Customer '{request.CustomerAccount}' was not found in AX.");

        if (!customer.IsActive)
        {
            throw new DomainValidationException($"Customer '{customer.AccountNum}' is inactive or blocked in AX.");
        }

        var normalizedSalesIds = request.SalesOrders
            .Select(s => s.Trim())
            .Where(s => !string.IsNullOrEmpty(s))
            .Distinct(StringComparer.OrdinalIgnoreCase)
            .ToArray();

        var axOrders = await _axService.GetEligibleSalesOrdersAsync(customer.AccountNum, warehouseId, dataAreaId, cancellationToken);
        var axOrderMap = axOrders.ToDictionary(o => o.SalesId, StringComparer.OrdinalIgnoreCase);

        foreach (var salesId in normalizedSalesIds)
        {
            if (!axOrderMap.TryGetValue(salesId, out var axOrder) || !axOrder.IsEligible)
            {
                throw new DomainValidationException($"Sales order '{salesId}' is not eligible for pickup.");
            }
        }

        var strategy = _db.Database.CreateExecutionStrategy();
        var response = await strategy.ExecuteAsync(async () =>
        {
            await using var transaction = await _db.Database.BeginTransactionAsync(
                IsolationLevel.Serializable,
                cancellationToken);

            var existingActiveOrders = await _db.PickupPlanOrders
                .AsNoTracking()
                .Where(o => o.DataAreaId == dataAreaId && o.IsActive && normalizedSalesIds.Contains(o.SalesId))
                .Select(o => o.SalesId)
                .ToListAsync(cancellationToken);

            if (existingActiveOrders.Count > 0)
            {
                throw new ConflictException(
                    $"Sales orders already assigned to an active pickup plan: {string.Join(", ", existingActiveOrders)}.");
            }

            var now = _clock.UtcNow;
            var localToday = ResolveLocalBusinessDate(now, settingsLookup.BusinessTimeZone);

            var plan = new PickupPlan
            {
                Id = Guid.NewGuid(),
                CustomerAccount = customer.AccountNum,
                CustomerNameSnapshot = customer.Name,
                PickupDate = localToday,
                WarehouseId = warehouseId,
                Status = PickupPlanStatus.PLANNED,
                Notes = string.IsNullOrWhiteSpace(request.Notes) ? "Walk-in arrival" : request.Notes.Trim(),
                CreatedBy = _currentUser.UserName,
                CreatedAt = now,
                UpdatedAt = now
            };

            foreach (var salesId in normalizedSalesIds)
            {
                var axOrder = axOrderMap[salesId];
                plan.Orders.Add(new PickupPlanOrder
                {
                    Id = Guid.NewGuid(),
                    PickupPlanId = plan.Id,
                    DataAreaId = dataAreaId,
                    SalesId = axOrder.SalesId,
                    OrderStatusSnapshot = axOrder.AxStatus,
                    AddedAt = now,
                    AddedBy = _currentUser.UserName,
                    IsActive = true
                });
            }

            _db.PickupPlans.Add(plan);
            await _db.SaveChangesAsync(cancellationToken);

            var ticket = await IssueTicketForPlanInternalAsync(plan, cancellationToken);
            await _db.SaveChangesAsync(cancellationToken);
            await transaction.CommitAsync(cancellationToken);

            return new ArrivalTicketResponse(
                ticket.Id,
                ticket.TicketNumber,
                ticket.QueueNumber,
                ticket.Status,
                ticket.ArrivalTime,
                plan.CustomerAccount,
                plan.CustomerNameSnapshot,
                plan.Orders.Count);
        });

        await _notifier.NotifyQueueUpdatedAsync(response.TicketId, "WALK_IN_ARRIVAL", cancellationToken);
        return response;
    }

    public async Task<IReadOnlyList<TicketQueueItemDto>> GetQueueAsync(
        DateOnly date,
        CancellationToken cancellationToken = default)
    {
        return await _db.PickupTickets
            .AsNoTracking()
            .Where(t => t.TicketDate == date)
            .OrderBy(t => t.QueueNumber)
            .Select(t => new TicketQueueItemDto(
                t.Id,
                t.PickupPlanId,
                t.TicketDate,
                t.TicketNumber,
                t.QueueNumber,
                t.ArrivalTime,
                t.PickupPlan.CustomerAccount,
                t.PickupPlan.CustomerNameSnapshot,
                t.PickupPlan.WarehouseId,
                t.Status,
                t.Orders.Count(o => o.Status != PickupTicketOrderStatus.CANCELLED),
                t.Orders.Count(o => o.Status == PickupTicketOrderStatus.READY || o.Status == PickupTicketOrderStatus.COLLECTED),
                t.CreditComment))
            .ToListAsync(cancellationToken);
    }

    public async Task<TicketDetailDto> GetTicketDetailAsync(
        Guid ticketId,
        CancellationToken cancellationToken = default)
    {
        var ticket = await _db.PickupTickets
            .AsNoTracking()
            .Include(t => t.PickupPlan)
            .Include(t => t.Orders)
            .FirstOrDefaultAsync(t => t.Id == ticketId, cancellationToken)
            ?? throw new ResourceNotFoundException($"Ticket '{ticketId}' was not found.");

        return new TicketDetailDto(
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
    }

    private async Task<PickupTicket> IssueTicketForPlanInternalAsync(
        PickupPlan plan,
        CancellationToken cancellationToken)
    {
        // Lock the PickupSettings row with UPDLOCK, HOLDLOCK so concurrent workstations
        // cannot allocate the same DailySequence / TicketNumber.
        var settings = await _db.PickupSettings
            .FromSqlInterpolated($"SELECT * FROM dbo.PickupSettings WITH (UPDLOCK, HOLDLOCK) WHERE WarehouseId = {plan.WarehouseId}")
            .FirstOrDefaultAsync(cancellationToken)
            ?? throw new DomainValidationException($"PickupSettings for warehouse '{plan.WarehouseId}' not found.");

        var now = _clock.UtcNow;
        var ticketDate = ResolveLocalBusinessDate(now, settings.BusinessTimeZone);

        if (settings.CurrentSequenceDate != ticketDate)
        {
            settings.CurrentSequenceDate = ticketDate;
            settings.NextDailySequence = 1;
        }

        var dailySequence = settings.NextDailySequence;
        settings.NextDailySequence = dailySequence + 1;

        var ticketNumber = $"{settings.TicketPrefix}{dailySequence:D3}";
        var correlationId = Guid.NewGuid();

        var ticket = new PickupTicket
        {
            Id = Guid.NewGuid(),
            PickupPlanId = plan.Id,
            TicketDate = ticketDate,
            DailySequence = dailySequence,
            TicketNumber = ticketNumber,
            ArrivalTime = now,
            QueueNumber = dailySequence,
            Status = PickupTicketStatus.ARRIVED
        };

        foreach (var planOrder in plan.Orders.OrderBy(o => o.SalesId))
        {
            var ticketOrder = new PickupTicketOrder
            {
                Id = Guid.NewGuid(),
                TicketId = ticket.Id,
                PickupPlanOrderId = planOrder.Id,
                DataAreaId = planOrder.DataAreaId,
                SalesId = planOrder.SalesId,
                Status = PickupTicketOrderStatus.PENDING_CREDIT,
                CreditStatus = OrderCreditStatus.PENDING,
                WarehouseStatus = OrderWarehouseStatus.PENDING
            };
            ticket.Orders.Add(ticketOrder);

            _db.OrderWorkflowHistories.Add(new OrderWorkflowHistory
            {
                TicketOrderId = ticketOrder.Id,
                OldStatus = null,
                NewStatus = PickupTicketOrderStatus.PENDING_CREDIT.ToString(),
                Action = "ARRIVAL",
                Comment = $"Ticket {ticketNumber} issued at reception.",
                UserId = _currentUser.UserName,
                OccurredAt = now,
                CorrelationId = correlationId
            });
        }

        plan.Status = PickupPlanStatus.ARRIVED;
        plan.UpdatedAt = now;

        _db.PickupTickets.Add(ticket);
        _db.PickupWorkflowHistories.Add(new PickupWorkflowHistory
        {
            TicketId = ticket.Id,
            OldStatus = null,
            NewStatus = PickupTicketStatus.ARRIVED.ToString(),
            Action = "ARRIVAL",
            Comment = $"Ticket {ticketNumber} issued (Queue #{dailySequence}).",
            UserId = _currentUser.UserName,
            OccurredAt = now,
            CorrelationId = correlationId
        });

        return ticket;
    }

    private static DateOnly ResolveLocalBusinessDate(DateTime utcNow, string timeZoneId)
    {
        try
        {
            var tz = TimeZoneInfo.FindSystemTimeZoneById(timeZoneId);
            var local = TimeZoneInfo.ConvertTimeFromUtc(utcNow, tz);
            return DateOnly.FromDateTime(local);
        }
        catch (TimeZoneNotFoundException)
        {
            return DateOnly.FromDateTime(utcNow);
        }
    }
}
