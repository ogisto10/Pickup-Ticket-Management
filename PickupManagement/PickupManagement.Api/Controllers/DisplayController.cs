using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using PickupManagement.Domain.Enums;
using PickupManagement.Infrastructure.Persistence;

namespace PickupManagement.Api.Controllers;

[ApiController]
[Route("api/display")]
public class DisplayController : ControllerBase
{
    private readonly PickupManagementDbContext _db;

    public DisplayController(PickupManagementDbContext db)
    {
        _db = db;
    }

    /// <summary>
    /// Returns strictly sanitized public display state.
    /// Never exposes customer names, account numbers, financial balances, or sales order details.
    /// </summary>
    [HttpGet("state")]
    [Authorize(Policy = "DisplayAccess")]
    [ProducesResponseType(typeof(PublicDisplayStateDto), StatusCodes.Status200OK)]
    public async Task<ActionResult<PublicDisplayStateDto>> GetState(
        [FromQuery] string? warehouseId,
        CancellationToken cancellationToken)
    {
        var settings = string.IsNullOrWhiteSpace(warehouseId)
            ? await _db.PickupSettings.AsNoTracking().FirstOrDefaultAsync(cancellationToken)
            : await _db.PickupSettings.AsNoTracking().FirstOrDefaultAsync(s => s.WarehouseId == warehouseId.Trim(), cancellationToken);

        var businessDate = ResolveLocalBusinessDate(DateTime.UtcNow, settings?.BusinessTimeZone ?? "UTC");

        var readyTickets = await _db.PickupTickets
            .AsNoTracking()
            .Where(t => t.TicketDate == businessDate && t.Status == PickupTicketStatus.READY)
            .OrderByDescending(t => t.ReadyAt)
            .ThenBy(t => t.QueueNumber)
            .Select(t => new PublicDisplayTicketDto(t.TicketNumber, t.ReadyAt))
            .ToListAsync(cancellationToken);

        var preparingCount = await _db.PickupTickets
            .AsNoTracking()
            .CountAsync(t => t.TicketDate == businessDate
                && (t.Status == PickupTicketStatus.IN_PREPARATION || t.Status == PickupTicketStatus.APPROVED),
                cancellationToken);

        var nowServing = readyTickets.FirstOrDefault()?.TicketNumber;

        return Ok(new PublicDisplayStateDto(
            businessDate,
            nowServing,
            readyTickets,
            preparingCount,
            DateTime.UtcNow));
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

public record PublicDisplayTicketDto(string TicketNumber, DateTime? ReadyAt);

public record PublicDisplayStateDto(
    DateOnly BusinessDate,
    string? NowServingTicketNumber,
    IReadOnlyList<PublicDisplayTicketDto> ReadyTickets,
    int InPreparationCount,
    DateTime GeneratedAtUtc);
