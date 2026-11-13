using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Hosting;
using Microsoft.Extensions.Logging;
using PickupManagement.Application.AxIntegration;
using PickupManagement.Application.Notifications;
using PickupManagement.Domain.Entities;
using PickupManagement.Domain.Enums;
using PickupManagement.Infrastructure.Persistence;

namespace PickupManagement.Infrastructure.BackgroundJobs;

/// <summary>
/// Section 6.4 & 6.5 background worker: reconciles uncertain/timed-out AX AIF release calls
/// by querying AX first before safely retrying, and flags orders cancelled in AX.
/// </summary>
public class IntegrationReconciliationWorker : BackgroundService
{
    private const int MaxAttempts = 5;
    private static readonly TimeSpan PollInterval = TimeSpan.FromSeconds(30);

    private readonly IServiceScopeFactory _scopeFactory;
    private readonly ILogger<IntegrationReconciliationWorker> _logger;

    public IntegrationReconciliationWorker(
        IServiceScopeFactory scopeFactory,
        ILogger<IntegrationReconciliationWorker> logger)
    {
        _scopeFactory = scopeFactory;
        _logger = logger;
    }

    protected override async Task ExecuteAsync(CancellationToken stoppingToken)
    {
        while (!stoppingToken.IsCancellationRequested)
        {
            try
            {
                await ReconcilePendingRequestsAsync(stoppingToken);
            }
            catch (Exception ex) when (!stoppingToken.IsCancellationRequested)
            {
                _logger.LogError(ex, "Unhandled error in IntegrationReconciliationWorker cycle.");
            }

            await Task.Delay(PollInterval, stoppingToken);
        }
    }

    private async Task ReconcilePendingRequestsAsync(CancellationToken cancellationToken)
    {
        using var scope = _scopeFactory.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<PickupManagementDbContext>();
        var axService = scope.ServiceProvider.GetRequiredService<IAxPickupService>();
        var notifier = scope.ServiceProvider.GetRequiredService<IPickupRealtimeNotifier>();

        var pendingRequests = await db.IntegrationRequests
            .Where(r => r.OperationType == "RELEASE_SALES_ORDER"
                && (r.Status == IntegrationRequestStatus.RECONCILING || r.Status == IntegrationRequestStatus.PENDING))
            .OrderBy(r => r.CreatedAt)
            .Take(25)
            .ToListAsync(cancellationToken);

        foreach (var req in pendingRequests)
        {
            var order = await db.PickupTicketOrders
                .Include(o => o.Ticket)
                .FirstOrDefaultAsync(o => o.Id == req.EntityId, cancellationToken);

            if (order is null)
            {
                req.Status = IntegrationRequestStatus.FAILED_TECHNICAL;
                req.LastError = "Target PickupTicketOrder no longer exists.";
                req.CompletedAt = DateTime.UtcNow;
                continue;
            }

            if (req.AttemptCount >= MaxAttempts)
            {
                req.Status = IntegrationRequestStatus.FAILED_TECHNICAL;
                req.CompletedAt = DateTime.UtcNow;
                req.LastError = $"Max reconciliation attempts ({MaxAttempts}) reached. Administrator intervention required.";
                _logger.LogError(
                    "ALERT: Integration reconciliation failed after {MaxAttempts} attempts. OperationKey={OperationKey}, SalesId={SalesId}",
                    MaxAttempts, req.OperationKey, order.SalesId);
                continue;
            }

            var now = DateTime.UtcNow;
            var correlationId = Guid.NewGuid();

            // Section 6.4: Query AX using OperationKey before resubmitting a release.
            var axStatus = await axService.GetPickupIntegrationStatusAsync(req.OperationKey, cancellationToken);
            if (axStatus is { CompletedInAx: true })
            {
                var prev = order.Status;
                req.Status = IntegrationRequestStatus.SUCCEEDED;
                req.CompletedAt = now;
                req.LastError = null;
                order.Status = PickupTicketOrderStatus.RELEASED;
                order.LastAxSyncAt = now;

                db.OrderWorkflowHistories.Add(new OrderWorkflowHistory
                {
                    TicketOrderId = order.Id,
                    OldStatus = prev.ToString(),
                    NewStatus = order.Status.ToString(),
                    Action = "AX_RECONCILED_RELEASED",
                    Comment = $"Reconciled release from AX ({axStatus.AxReference}).",
                    UserId = "system-reconciler",
                    OccurredAt = now,
                    CorrelationId = correlationId
                });

                if (order.Ticket.Status is PickupTicketStatus.ARRIVED or PickupTicketStatus.APPROVED)
                {
                    var prevTicket = order.Ticket.Status;
                    order.Ticket.Status = PickupTicketStatus.IN_PREPARATION;
                    db.PickupWorkflowHistories.Add(new PickupWorkflowHistory
                    {
                        TicketId = order.Ticket.Id,
                        OldStatus = prevTicket.ToString(),
                        NewStatus = PickupTicketStatus.IN_PREPARATION.ToString(),
                        Action = "RECONCILED_IN_PREPARATION",
                        Comment = $"Order {order.SalesId} confirmed released in AX.",
                        UserId = "system-reconciler",
                        OccurredAt = now,
                        CorrelationId = correlationId
                    });
                }

                await db.SaveChangesAsync(cancellationToken);
                await notifier.NotifyQueueUpdatedAsync(order.TicketId, "ORDER_RECONCILED", cancellationToken);
                continue;
            }

            // Not completed in AX yet: retry safely using the exact same OperationKey.
            var attempt = new IntegrationAttempt
            {
                Id = Guid.NewGuid(),
                IntegrationRequestId = req.Id,
                StartedAt = now
            };
            req.AttemptCount += 1;

            try
            {
                var retryResult = await axService.ReleaseSalesOrderForPickupAsync(
                    order.SalesId,
                    req.OperationKey,
                    order.DataAreaId,
                    cancellationToken);

                attempt.FinishedAt = DateTime.UtcNow;
                order.LastAxSyncAt = attempt.FinishedAt;

                if (retryResult.Succeeded)
                {
                    attempt.Outcome = IntegrationAttemptOutcome.SUCCEEDED;
                    req.Status = IntegrationRequestStatus.SUCCEEDED;
                    req.CompletedAt = attempt.FinishedAt;
                    req.LastError = null;
                    order.Status = PickupTicketOrderStatus.RELEASED;

                    db.OrderWorkflowHistories.Add(new OrderWorkflowHistory
                    {
                        TicketOrderId = order.Id,
                        OldStatus = PickupTicketOrderStatus.RECONCILING.ToString(),
                        NewStatus = order.Status.ToString(),
                        Action = "AX_RETRY_RELEASED",
                        Comment = $"Retry succeeded in AX ({retryResult.AxReference}).",
                        UserId = "system-reconciler",
                        OccurredAt = attempt.FinishedAt.Value,
                        CorrelationId = correlationId
                    });
                }
                else if (retryResult.IsBusinessRejection)
                {
                    attempt.Outcome = IntegrationAttemptOutcome.BUSINESS_ERROR;
                    attempt.ErrorCode = retryResult.ErrorCode;
                    attempt.ErrorMessage = retryResult.ErrorMessage;
                    req.Status = IntegrationRequestStatus.FAILED_BUSINESS;
                    req.CompletedAt = attempt.FinishedAt;
                    req.LastError = retryResult.ErrorMessage;
                    order.Status = PickupTicketOrderStatus.BLOCKED;
                }
                else
                {
                    attempt.Outcome = IntegrationAttemptOutcome.TIMEOUT;
                    attempt.ErrorCode = retryResult.ErrorCode;
                    attempt.ErrorMessage = retryResult.ErrorMessage;
                    req.Status = IntegrationRequestStatus.RECONCILING;
                    req.LastError = retryResult.ErrorMessage;
                }
            }
            catch (Exception ex)
            {
                attempt.FinishedAt = DateTime.UtcNow;
                attempt.Outcome = IntegrationAttemptOutcome.TECHNICAL_ERROR;
                attempt.ErrorCode = "AX_RETRY_EXCEPTION";
                attempt.ErrorMessage = ex.Message.Length > 950 ? ex.Message[..950] : ex.Message;
                req.Status = IntegrationRequestStatus.RECONCILING;
                req.LastError = attempt.ErrorMessage;
            }

            db.IntegrationAttempts.Add(attempt);
            await db.SaveChangesAsync(cancellationToken);
            await notifier.NotifyQueueUpdatedAsync(order.TicketId, "INTEGRATION_RECONCILED", cancellationToken);
        }
    }
}
