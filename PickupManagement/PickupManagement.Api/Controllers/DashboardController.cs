using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using PickupManagement.Domain.Enums;
using PickupManagement.Infrastructure.Persistence;

namespace PickupManagement.Api.Controllers;

[ApiController]
[Route("api/dashboard")]
[Authorize(Roles = $"{AppRoles.Commercial},{AppRoles.Reception},{AppRoles.CreditManager},{AppRoles.WarehouseOperator},{AppRoles.Supervisor},{AppRoles.Administrator}")]
public class DashboardController : ControllerBase
{
    private readonly PickupManagementDbContext _db;

    public DashboardController(PickupManagementDbContext db)
    {
        _db = db;
    }

    [HttpGet("stats")]
    [ProducesResponseType(typeof(DashboardStatsDto), StatusCodes.Status200OK)]
    public async Task<ActionResult<DashboardStatsDto>> GetStats(
        [FromQuery] DateOnly? date,
        CancellationToken cancellationToken)
    {
        var settings = await _db.PickupSettings.AsNoTracking().FirstOrDefaultAsync(cancellationToken);
        var targetDate = date ?? ResolveLocalBusinessDate(DateTime.UtcNow, settings?.BusinessTimeZone ?? "UTC");

        var plans = await _db.PickupPlans
            .AsNoTracking()
            .Where(p => p.PickupDate == targetDate)
            .Select(p => p.Status)
            .ToListAsync(cancellationToken);

        var tickets = await _db.PickupTickets
            .AsNoTracking()
            .Where(t => t.TicketDate == targetDate)
            .Select(t => t.Status)
            .ToListAsync(cancellationToken);

        var reconcilingCount = await _db.IntegrationRequests
            .AsNoTracking()
            .CountAsync(r => r.Status == IntegrationRequestStatus.RECONCILING
                || r.Status == IntegrationRequestStatus.FAILED_TECHNICAL,
                cancellationToken);

        return Ok(new DashboardStatsDto(
            targetDate,
            plans.Count(s => s == PickupPlanStatus.PLANNED),
            tickets.Count(s => s == PickupTicketStatus.ARRIVED || s == PickupTicketStatus.APPROVED),
            tickets.Count(s => s == PickupTicketStatus.ON_HOLD || s == PickupTicketStatus.REJECTED),
            tickets.Count(s => s == PickupTicketStatus.IN_PREPARATION),
            tickets.Count(s => s == PickupTicketStatus.READY),
            tickets.Count(s => s == PickupTicketStatus.COLLECTED),
            plans.Count(s => s == PickupPlanStatus.ABSENT),
            reconcilingCount));
    }

    private static DateOnly ResolveLocalBusinessDate(DateTime utcNow, string timeZoneId)
    {
        try
        {
            var tz = TimeZoneInfo.FindSystemTimeZoneById(timeZoneId);
            return DateOnly.FromDateTime(TimeZoneInfo.ConvertTimeFromUtc(utcNow, tz));
        }
        catch (TimeZoneNotFoundException)
        {
            return DateOnly.FromDateTime(utcNow);
        }
    }
}

public record DashboardStatsDto(
    DateOnly Date,
    int PlannedCount,
    int AwaitingCreditCount,
    int OnHoldOrRejectedCount,
    int InPreparationCount,
    int ReadyCount,
    int CollectedCount,
    int AbsentCount,
    int IntegrationAttentionCount);
