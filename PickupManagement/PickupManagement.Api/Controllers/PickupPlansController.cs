using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using PickupManagement.Application.Planning;
using PickupManagement.Application.Reception;
using PickupManagement.Domain.Enums;

namespace PickupManagement.Api.Controllers;

[ApiController]
[Route("api/pickup-plans")]
public class PickupPlansController : ControllerBase
{
    private readonly IPickupPlanService _planService;
    private readonly IReceptionService _receptionService;

    public PickupPlansController(
        IPickupPlanService planService,
        IReceptionService receptionService)
    {
        _planService = planService;
        _receptionService = receptionService;
    }

    [HttpPost]
    [Authorize(Policy = "PlanningAccess")]
    [ProducesResponseType(typeof(PickupPlanResponse), StatusCodes.Status201Created)]
    [ProducesResponseType(StatusCodes.Status400BadRequest)]
    [ProducesResponseType(StatusCodes.Status409Conflict)]
    public async Task<ActionResult<PickupPlanResponse>> Create(
        [FromBody] CreatePickupPlanRequest request,
        CancellationToken cancellationToken)
    {
        var created = await _planService.CreateAsync(request, cancellationToken);
        return CreatedAtAction(nameof(GetById), new { id = created.Id }, created);
    }

    [HttpGet]
    [Authorize(Roles = $"{AppRoles.Commercial},{AppRoles.Reception},{AppRoles.Supervisor},{AppRoles.Administrator}")]
    [ProducesResponseType(typeof(IReadOnlyList<PickupPlanListItemDto>), StatusCodes.Status200OK)]
    public async Task<ActionResult<IReadOnlyList<PickupPlanListItemDto>>> ListByDate(
        [FromQuery] DateOnly? date,
        CancellationToken cancellationToken)
    {
        var targetDate = date ?? DateOnly.FromDateTime(DateTime.UtcNow);
        var plans = await _planService.ListByDateAsync(targetDate, cancellationToken);
        return Ok(plans);
    }

    [HttpGet("{id:guid}")]
    [Authorize(Roles = $"{AppRoles.Commercial},{AppRoles.Reception},{AppRoles.Supervisor},{AppRoles.Administrator}")]
    [ProducesResponseType(typeof(PickupPlanListItemDto), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<ActionResult<PickupPlanListItemDto>> GetById(
        Guid id,
        CancellationToken cancellationToken)
    {
        var plan = await _planService.GetByIdAsync(id, cancellationToken);
        return Ok(plan);
    }

    [HttpPut("{id:guid}")]
    [Authorize(Policy = "PlanningAccess")]
    [ProducesResponseType(typeof(PickupPlanResponse), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status400BadRequest)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    [ProducesResponseType(StatusCodes.Status409Conflict)]
    public async Task<ActionResult<PickupPlanResponse>> Update(
        Guid id,
        [FromBody] UpdatePickupPlanRequest request,
        CancellationToken cancellationToken)
    {
        var updated = await _planService.UpdateAsync(id, request, cancellationToken);
        return Ok(updated);
    }

    [HttpPost("{id:guid}/arrival")]
    [Authorize(Policy = "ReceptionAccess")]
    [ProducesResponseType(typeof(ArrivalTicketResponse), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status400BadRequest)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    [ProducesResponseType(StatusCodes.Status409Conflict)]
    public async Task<ActionResult<ArrivalTicketResponse>> ConfirmArrival(
        Guid id,
        CancellationToken cancellationToken)
    {
        var ticket = await _receptionService.ConfirmArrivalAsync(id, cancellationToken);
        return Ok(ticket);
    }
}
