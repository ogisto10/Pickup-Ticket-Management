using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using PickupManagement.Domain.Enums;
using PickupManagement.Infrastructure.Persistence;

namespace PickupManagement.Api.Controllers;

[ApiController]
[Route("api/history")]
[Authorize(Policy = "SupervisorAccess")]
public class HistoryController : ControllerBase
{
    private readonly PickupManagementDbContext _db;

    public HistoryController(PickupManagementDbContext db)
    {
        _db = db;
    }

    [HttpGet]
    [ProducesResponseType(typeof(IReadOnlyList<TicketHistorySummaryDto>), StatusCodes.Status200OK)]
    public async Task<ActionResult<IReadOnlyList<TicketHistorySummaryDto>>> Search(
        [FromQuery] DateOnly? dateFrom,
        [FromQuery] DateOnly? dateTo,
        [FromQuery] string? search,
        CancellationToken cancellationToken)
    {
        var query = _db.PickupTickets
            .AsNoTracking()
            .Include(t => t.PickupPlan)
            .Include(t => t.Orders)
            .AsQueryable();

        if (dateFrom.HasValue)
        {
            query = query.Where(t => t.TicketDate >= dateFrom.Value);
        }

        if (dateTo.HasValue)
        {
            query = query.Where(t => t.TicketDate <= dateTo.Value);
        }

        if (!string.IsNullOrWhiteSpace(search))
        {
            var term = search.Trim();
            query = query.Where(t =>
                t.TicketNumber.Contains(term) ||
                t.PickupPlan.CustomerAccount.Contains(term) ||
                t.PickupPlan.CustomerNameSnapshot.Contains(term) ||
                t.Orders.Any(o => o.SalesId.Contains(term)));
        }

        var items = await query
            .OrderByDescending(t => t.TicketDate)
            .ThenByDescending(t => t.QueueNumber)
            .Take(100)
            .Select(t => new TicketHistorySummaryDto(
                t.Id,
                t.TicketDate,
                t.TicketNumber,
                t.QueueNumber,
                t.PickupPlan.CustomerAccount,
                t.PickupPlan.CustomerNameSnapshot,
                t.PickupPlan.WarehouseId,
                t.Status,
                t.ArrivalTime,
                t.ReadyAt,
                t.CollectedAt,
                t.CreditDecisionBy,
                t.CreditComment,
                t.Orders.Count))
            .ToListAsync(cancellationToken);

        return Ok(items);
    }

    [HttpGet("{ticketId:guid}/audit")]
    [ProducesResponseType(typeof(TicketAuditDetailDto), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<ActionResult<TicketAuditDetailDto>> GetAudit(
        Guid ticketId,
        CancellationToken cancellationToken)
    {
        var ticket = await _db.PickupTickets
            .AsNoTracking()
            .Include(t => t.PickupPlan)
            .Include(t => t.Orders)
            .FirstOrDefaultAsync(t => t.Id == ticketId, cancellationToken);

        if (ticket is null)
        {
            return NotFound();
        }

        var ticketEvents = await _db.PickupWorkflowHistories
            .AsNoTracking()
            .Where(h => h.TicketId == ticketId)
            .OrderBy(h => h.OccurredAt)
            .Select(h => new WorkflowEventDto(
                h.OldStatus,
                h.NewStatus,
                h.Action,
                h.Comment,
                h.UserId,
                h.OccurredAt,
                h.CorrelationId,
                null))
            .ToListAsync(cancellationToken);

        var orderIds = ticket.Orders.Select(o => o.Id).ToList();
        var orderMap = ticket.Orders.ToDictionary(o => o.Id, o => o.SalesId);

        var orderEventsRaw = await _db.OrderWorkflowHistories
            .AsNoTracking()
            .Where(h => orderIds.Contains(h.TicketOrderId))
            .OrderBy(h => h.OccurredAt)
            .ToListAsync(cancellationToken);

        var orderEvents = orderEventsRaw
            .Select(h => new WorkflowEventDto(
                h.OldStatus,
                h.NewStatus,
                h.Action,
                h.Comment,
                h.UserId,
                h.OccurredAt,
                h.CorrelationId,
                orderMap.GetValueOrDefault(h.TicketOrderId)))
            .ToList();

        return Ok(new TicketAuditDetailDto(
            ticket.Id,
            ticket.TicketNumber,
            ticket.TicketDate,
            ticket.PickupPlan.CustomerAccount,
            ticket.PickupPlan.CustomerNameSnapshot,
            ticket.Status,
            ticketEvents,
            orderEvents));
    }
}

public record TicketHistorySummaryDto(
    Guid TicketId,
    DateOnly TicketDate,
    string TicketNumber,
    int QueueNumber,
    string CustomerAccount,
    string CustomerName,
    string WarehouseId,
    PickupTicketStatus Status,
    DateTime ArrivalTime,
    DateTime? ReadyAt,
    DateTime? CollectedAt,
    string? CreditDecisionBy,
    string? CreditComment,
    int OrderCount);

public record WorkflowEventDto(
    string? OldStatus,
    string NewStatus,
    string Action,
    string? Comment,
    string UserId,
    DateTime OccurredAt,
    Guid CorrelationId,
    string? SalesId);

public record TicketAuditDetailDto(
    Guid TicketId,
    string TicketNumber,
    DateOnly TicketDate,
    string CustomerAccount,
    string CustomerName,
    PickupTicketStatus Status,
    IReadOnlyList<WorkflowEventDto> TicketEvents,
    IReadOnlyList<WorkflowEventDto> OrderEvents);
