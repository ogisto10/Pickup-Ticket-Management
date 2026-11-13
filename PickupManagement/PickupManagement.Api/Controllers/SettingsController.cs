using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using PickupManagement.Domain.Entities;
using PickupManagement.Domain.Enums;
using PickupManagement.Infrastructure.Persistence;

namespace PickupManagement.Api.Controllers;

[ApiController]
[Route("api/settings")]
[Authorize(Policy = "AdminAccess")]
public class SettingsController : ControllerBase
{
    private readonly PickupManagementDbContext _db;

    public SettingsController(PickupManagementDbContext db)
    {
        _db = db;
    }

    [HttpGet]
    [ProducesResponseType(typeof(IReadOnlyList<PickupSettingsDto>), StatusCodes.Status200OK)]
    public async Task<ActionResult<IReadOnlyList<PickupSettingsDto>>> List(CancellationToken cancellationToken)
    {
        var list = await _db.PickupSettings
            .AsNoTracking()
            .OrderBy(s => s.WarehouseId)
            .Select(s => ToDto(s))
            .ToListAsync(cancellationToken);

        return Ok(list);
    }

    [HttpPut("{warehouseId}")]
    [ProducesResponseType(typeof(PickupSettingsDto), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<ActionResult<PickupSettingsDto>> Update(
        string warehouseId,
        [FromBody] UpdatePickupSettingsRequest request,
        CancellationToken cancellationToken)
    {
        var settings = await _db.PickupSettings
            .FirstOrDefaultAsync(s => s.WarehouseId == warehouseId.Trim(), cancellationToken);

        if (settings is null)
        {
            return NotFound(new { message = $"Settings for warehouse '{warehouseId}' not found." });
        }

        settings.TicketPrefix = request.TicketPrefix.Trim();
        settings.BusinessTimeZone = request.BusinessTimeZone.Trim();
        settings.QueuePolicy = request.QueuePolicy;
        settings.AxDataAreaId = request.AxDataAreaId.Trim().ToUpperInvariant();
        settings.PartialOrderPolicy = request.PartialOrderPolicy;
        settings.ArrivalCutoffTime = request.ArrivalCutoffTime;

        await _db.SaveChangesAsync(cancellationToken);
        return Ok(ToDto(settings));
    }

    private static PickupSettingsDto ToDto(PickupSettings s) =>
        new(
            s.Id,
            s.WarehouseId,
            s.TicketPrefix,
            s.NextDailySequence,
            s.BusinessTimeZone,
            s.QueuePolicy,
            s.AxDataAreaId,
            s.PartialOrderPolicy,
            s.CurrentSequenceDate,
            s.ArrivalCutoffTime);
}

public record PickupSettingsDto(
    Guid Id,
    string WarehouseId,
    string TicketPrefix,
    int NextDailySequence,
    string BusinessTimeZone,
    QueuePolicy QueuePolicy,
    string AxDataAreaId,
    PartialOrderPolicy PartialOrderPolicy,
    DateOnly? CurrentSequenceDate,
    TimeOnly? ArrivalCutoffTime);

public record UpdatePickupSettingsRequest(
    string TicketPrefix,
    string BusinessTimeZone,
    QueuePolicy QueuePolicy,
    string AxDataAreaId,
    PartialOrderPolicy PartialOrderPolicy,
    TimeOnly? ArrivalCutoffTime);
