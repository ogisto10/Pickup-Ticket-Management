using Microsoft.EntityFrameworkCore;
using PickupManagement.Application.AxIntegration;
using PickupManagement.Application.Common.Exceptions;
using PickupManagement.Application.Common.Interfaces;
using PickupManagement.Application.Notifications;
using PickupManagement.Application.Warehouse;
using PickupManagement.Domain.Entities;
using PickupManagement.Domain.Enums;
using PickupManagement.Infrastructure.Persistence;

namespace PickupManagement.Infrastructure.Warehouse;

public class WarehouseService : IWarehouseService
{
    private readonly PickupManagementDbContext _db;
    private readonly IAxPickupService _axService;
    private readonly ICurrentUserService _currentUser;
    private readonly IDateTimeProvider _clock;
    private readonly IPickupRealtimeNotifier _notifier;

    public WarehouseService(
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

    public async Task<OrderPreparationResultDto> StartPreparationAsync(
        Guid ticketId,
        Guid orderId,
        PreparationUpdateRequest? request,
        CancellationToken cancellationToken = default)
    {
        var ticket = await LoadTicketWithOrdersAsync(ticketId, cancellationToken);
        var order = ticket.Orders.FirstOrDefault(o => o.Id == orderId)
            ?? throw new ResourceNotFoundException($"Order '{orderId}' was not found on ticket '{ticket.TicketNumber}'.");

        if (order.Status != PickupTicketOrderStatus.RELEASED && order.Status != PickupTicketOrderStatus.IN_PREPARATION)
        {
            throw new ConflictException(
                $"Order '{order.SalesId}' cannot start warehouse preparation in status '{order.Status}'. AX release confirmation is required first.");
        }

        // Verify order was not cancelled in AX before starting preparation.
        var axStatuses = await _axService.GetSalesOrderPickupStatusAsync([order.SalesId], order.DataAreaId, cancellationToken);
        var axStatus = axStatuses.FirstOrDefault();
        var now = _clock.UtcNow;
        var correlationId = Guid.NewGuid();
        order.LastAxSyncAt = now;

        if (axStatus is { IsCancelled: true })
        {
            var prevBlocked = order.Status;
            order.Status = PickupTicketOrderStatus.BLOCKED;
            _db.OrderWorkflowHistories.Add(new OrderWorkflowHistory
            {
                TicketOrderId = order.Id,
                OldStatus = prevBlocked.ToString(),
                NewStatus = order.Status.ToString(),
                Action = "AX_ORDER_CANCELLED",
                Comment = "Order was cancelled in AX.",
                UserId = _currentUser.UserName,
                OccurredAt = now,
                CorrelationId = correlationId
            });
            await _db.SaveChangesAsync(cancellationToken);
            throw new ConflictException($"Sales order '{order.SalesId}' has been cancelled in AX and cannot be prepared.");
        }

        var oldOrderStatus = order.Status;
        order.Status = PickupTicketOrderStatus.IN_PREPARATION;
        order.WarehouseStatus = OrderWarehouseStatus.PREPARING;

        _db.OrderWorkflowHistories.Add(new OrderWorkflowHistory
        {
            TicketOrderId = order.Id,
            OldStatus = oldOrderStatus.ToString(),
            NewStatus = order.Status.ToString(),
            Action = "PREPARATION_STARTED",
            Comment = request?.Comment?.Trim(),
            UserId = _currentUser.UserName,
            OccurredAt = now,
            CorrelationId = correlationId
        });

        if (ticket.Status != PickupTicketStatus.IN_PREPARATION)
        {
            var oldTicketStatus = ticket.Status;
            ticket.Status = PickupTicketStatus.IN_PREPARATION;
            _db.PickupWorkflowHistories.Add(new PickupWorkflowHistory
            {
                TicketId = ticket.Id,
                OldStatus = oldTicketStatus.ToString(),
                NewStatus = ticket.Status.ToString(),
                Action = "IN_PREPARATION",
                Comment = $"Preparation started on order {order.SalesId}.",
                UserId = _currentUser.UserName,
                OccurredAt = now,
                CorrelationId = correlationId
            });
        }

        await _db.SaveChangesAsync(cancellationToken);
        await _notifier.NotifyQueueUpdatedAsync(ticket.Id, "PREPARATION_STARTED", cancellationToken);

        return ToPrepResult(ticket, order);
    }

    public async Task<OrderPreparationResultDto> MarkOrderReadyAsync(
        Guid ticketId,
        Guid orderId,
        PreparationUpdateRequest? request,
        CancellationToken cancellationToken = default)
    {
        var ticket = await LoadTicketWithOrdersAsync(ticketId, cancellationToken);
        var order = ticket.Orders.FirstOrDefault(o => o.Id == orderId)
            ?? throw new ResourceNotFoundException($"Order '{orderId}' was not found on ticket '{ticket.TicketNumber}'.");

        if (order.Status is not (PickupTicketOrderStatus.RELEASED or PickupTicketOrderStatus.IN_PREPARATION or PickupTicketOrderStatus.READY))
        {
            throw new ConflictException(
                $"Order '{order.SalesId}' cannot be marked READY in status '{order.Status}'.");
        }

        var axStatuses = await _axService.GetSalesOrderPickupStatusAsync([order.SalesId], order.DataAreaId, cancellationToken);
        var axStatus = axStatuses.FirstOrDefault();
        var now = _clock.UtcNow;
        var correlationId = Guid.NewGuid();
        order.LastAxSyncAt = now;

        if (axStatus is { IsCancelled: true })
        {
            var prevBlocked = order.Status;
            order.Status = PickupTicketOrderStatus.BLOCKED;
            _db.OrderWorkflowHistories.Add(new OrderWorkflowHistory
            {
                TicketOrderId = order.Id,
                OldStatus = prevBlocked.ToString(),
                NewStatus = order.Status.ToString(),
                Action = "AX_ORDER_CANCELLED",
                Comment = "Order was cancelled in AX.",
                UserId = _currentUser.UserName,
                OccurredAt = now,
                CorrelationId = correlationId
            });
            await _db.SaveChangesAsync(cancellationToken);
            throw new ConflictException($"Sales order '{order.SalesId}' has been cancelled in AX.");
        }

        if (order.Status != PickupTicketOrderStatus.READY)
        {
            var oldOrderStatus = order.Status;
            order.Status = PickupTicketOrderStatus.READY;
            order.WarehouseStatus = OrderWarehouseStatus.READY;

            _db.OrderWorkflowHistories.Add(new OrderWorkflowHistory
            {
                TicketOrderId = order.Id,
                OldStatus = oldOrderStatus.ToString(),
                NewStatus = order.Status.ToString(),
                Action = "ORDER_READY",
                Comment = request?.Comment?.Trim(),
                UserId = _currentUser.UserName,
                OccurredAt = now,
                CorrelationId = correlationId
            });
        }

        var becameTicketReady = await EvaluateTicketReadinessAsync(ticket, correlationId, now, cancellationToken);

        await _db.SaveChangesAsync(cancellationToken);
        await _notifier.NotifyQueueUpdatedAsync(ticket.Id, becameTicketReady ? "TICKET_READY" : "ORDER_READY", cancellationToken);
        if (becameTicketReady)
        {
            await _notifier.NotifyPublicDisplayUpdatedAsync(cancellationToken);
        }

        return ToPrepResult(ticket, order);
    }

    public async Task<OrderPreparationResultDto> RemoveBlockedOrderAsync(
        Guid ticketId,
        Guid orderId,
        RemoveBlockedOrderRequest request,
        CancellationToken cancellationToken = default)
    {
        if (string.IsNullOrWhiteSpace(request.Reason))
        {
            throw new DomainValidationException("A reason is mandatory when removing a blocked order.");
        }

        var ticket = await LoadTicketWithOrdersAsync(ticketId, cancellationToken);
        var settings = await _db.PickupSettings
            .AsNoTracking()
            .FirstOrDefaultAsync(s => s.WarehouseId == ticket.PickupPlan.WarehouseId, cancellationToken);

        if (settings?.PartialOrderPolicy != PartialOrderPolicy.ALLOW_REMOVAL_BY_SUPERVISOR)
        {
            throw new ConflictException(
                "Configured partial-order policy does not permit removing blocked orders from an active ticket.");
        }

        var order = ticket.Orders.FirstOrDefault(o => o.Id == orderId)
            ?? throw new ResourceNotFoundException($"Order '{orderId}' was not found on ticket '{ticket.TicketNumber}'.");

        if (order.Status != PickupTicketOrderStatus.BLOCKED)
        {
            throw new ConflictException($"Only BLOCKED orders can be removed (current status: '{order.Status}').");
        }

        var activeRemaining = ticket.Orders.Count(o => o.Id != order.Id && o.Status != PickupTicketOrderStatus.CANCELLED);
        if (activeRemaining == 0)
        {
            throw new DomainValidationException("Cannot remove the last active order from a ticket; cancel or reject the ticket instead.");
        }

        var now = _clock.UtcNow;
        var correlationId = Guid.NewGuid();
        var oldStatus = order.Status;

        order.Status = PickupTicketOrderStatus.CANCELLED;
        order.PickupPlanOrder.IsActive = false;

        _db.OrderWorkflowHistories.Add(new OrderWorkflowHistory
        {
            TicketOrderId = order.Id,
            OldStatus = oldStatus.ToString(),
            NewStatus = order.Status.ToString(),
            Action = "BLOCKED_ORDER_REMOVED",
            Comment = request.Reason.Trim(),
            UserId = _currentUser.UserName,
            OccurredAt = now,
            CorrelationId = correlationId
        });

        var becameTicketReady = await EvaluateTicketReadinessAsync(ticket, correlationId, now, cancellationToken);

        await _db.SaveChangesAsync(cancellationToken);
        await _notifier.NotifyQueueUpdatedAsync(ticket.Id, "BLOCKED_ORDER_REMOVED", cancellationToken);
        if (becameTicketReady)
        {
            await _notifier.NotifyPublicDisplayUpdatedAsync(cancellationToken);
        }

        return ToPrepResult(ticket, order);
    }

    public async Task<CollectionResultDto> ConfirmCollectionAsync(
        Guid ticketId,
        CollectionConfirmRequest? request,
        CancellationToken cancellationToken = default)
    {
        var ticket = await LoadTicketWithOrdersAsync(ticketId, cancellationToken);

        if (ticket.Status == PickupTicketStatus.COLLECTED)
        {
            return new CollectionResultDto(
                ticket.Id,
                ticket.TicketNumber,
                ticket.Status,
                ticket.CollectedAt ?? _clock.UtcNow,
                _currentUser.UserName);
        }

        if (ticket.Status != PickupTicketStatus.READY)
        {
            throw new ConflictException(
                $"Ticket '{ticket.TicketNumber}' cannot be collected in status '{ticket.Status}'. All active orders must be READY first.");
        }

        var now = _clock.UtcNow;
        var correlationId = Guid.NewGuid();
        var oldTicketStatus = ticket.Status;

        foreach (var order in ticket.Orders.Where(o => o.Status != PickupTicketOrderStatus.CANCELLED))
        {
            var oldOrderStatus = order.Status;
            order.Status = PickupTicketOrderStatus.COLLECTED;
            order.WarehouseStatus = OrderWarehouseStatus.COLLECTED;
            order.PickupPlanOrder.IsActive = false;

            _db.OrderWorkflowHistories.Add(new OrderWorkflowHistory
            {
                TicketOrderId = order.Id,
                OldStatus = oldOrderStatus.ToString(),
                NewStatus = order.Status.ToString(),
                Action = "COLLECTED",
                Comment = request?.Comment?.Trim(),
                UserId = _currentUser.UserName,
                OccurredAt = now,
                CorrelationId = correlationId
            });
        }

        foreach (var planOrder in ticket.PickupPlan.Orders)
        {
            planOrder.IsActive = false;
        }

        ticket.Status = PickupTicketStatus.COLLECTED;
        ticket.CollectedAt = now;
        ticket.PickupPlan.Status = PickupPlanStatus.COMPLETED;
        ticket.PickupPlan.UpdatedAt = now;

        _db.PickupWorkflowHistories.Add(new PickupWorkflowHistory
        {
            TicketId = ticket.Id,
            OldStatus = oldTicketStatus.ToString(),
            NewStatus = ticket.Status.ToString(),
            Action = "COLLECTED",
            Comment = request?.Comment?.Trim() ?? "Client pickup confirmed.",
            UserId = _currentUser.UserName,
            OccurredAt = now,
            CorrelationId = correlationId
        });

        _db.PickupNotifications.Add(new PickupNotification
        {
            Id = Guid.NewGuid(),
            TicketId = ticket.Id,
            TicketNumber = ticket.TicketNumber,
            DisplayEventType = DisplayEventType.COLLECTED,
            CreatedAt = now,
            PublishedAt = now,
            Status = NotificationStatus.PUBLISHED
        });

        await _db.SaveChangesAsync(cancellationToken);
        await _notifier.NotifyQueueUpdatedAsync(ticket.Id, "COLLECTED", cancellationToken);
        await _notifier.NotifyPublicDisplayUpdatedAsync(cancellationToken);

        return new CollectionResultDto(
            ticket.Id,
            ticket.TicketNumber,
            ticket.Status,
            now,
            _currentUser.UserName);
    }

    private async Task<PickupTicket> LoadTicketWithOrdersAsync(Guid ticketId, CancellationToken cancellationToken)
    {
        return await _db.PickupTickets
            .Include(t => t.PickupPlan)
                .ThenInclude(p => p.Orders)
            .Include(t => t.Orders)
                .ThenInclude(o => o.PickupPlanOrder)
            .FirstOrDefaultAsync(t => t.Id == ticketId, cancellationToken)
            ?? throw new ResourceNotFoundException($"Ticket '{ticketId}' was not found.");
    }

    private Task<bool> EvaluateTicketReadinessAsync(
        PickupTicket ticket,
        Guid correlationId,
        DateTime now,
        CancellationToken cancellationToken)
    {
        var activeOrders = ticket.Orders
            .Where(o => o.Status != PickupTicketOrderStatus.CANCELLED)
            .ToList();

        if (activeOrders.Count == 0 || activeOrders.Any(o => o.Status != PickupTicketOrderStatus.READY))
        {
            return Task.FromResult(false);
        }

        if (ticket.Status == PickupTicketStatus.READY)
        {
            return Task.FromResult(false);
        }

        var oldStatus = ticket.Status;
        ticket.Status = PickupTicketStatus.READY;
        ticket.ReadyAt = now;

        _db.PickupWorkflowHistories.Add(new PickupWorkflowHistory
        {
            TicketId = ticket.Id,
            OldStatus = oldStatus.ToString(),
            NewStatus = PickupTicketStatus.READY.ToString(),
            Action = "READY",
            Comment = "All active sales orders on the ticket are ready for collection.",
            UserId = _currentUser.UserName,
            OccurredAt = now,
            CorrelationId = correlationId
        });

        _db.PickupNotifications.Add(new PickupNotification
        {
            Id = Guid.NewGuid(),
            TicketId = ticket.Id,
            TicketNumber = ticket.TicketNumber,
            DisplayEventType = DisplayEventType.ORDER_READY,
            CreatedAt = now,
            PublishedAt = now,
            Status = NotificationStatus.PUBLISHED
        });

        return Task.FromResult(true);
    }

    private static OrderPreparationResultDto ToPrepResult(PickupTicket ticket, PickupTicketOrder order) =>
        new(
            ticket.Id,
            ticket.TicketNumber,
            ticket.Status,
            order.Id,
            order.SalesId,
            order.Status,
            order.WarehouseStatus,
            ticket.Status == PickupTicketStatus.READY,
            ticket.ReadyAt);
}
