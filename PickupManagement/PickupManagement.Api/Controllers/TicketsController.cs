using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using PickupManagement.Application.Credit;
using PickupManagement.Application.Reception;
using PickupManagement.Application.Warehouse;
using PickupManagement.Domain.Enums;

namespace PickupManagement.Api.Controllers;

[ApiController]
[Route("api/tickets")]
public class TicketsController : ControllerBase
{
    private readonly IReceptionService _receptionService;
    private readonly ICreditService _creditService;
    private readonly IWarehouseService _warehouseService;

    public TicketsController(
        IReceptionService receptionService,
        ICreditService creditService,
        IWarehouseService warehouseService)
    {
        _receptionService = receptionService;
        _creditService = creditService;
        _warehouseService = warehouseService;
    }

    [HttpGet("queue")]
    [Authorize(Policy = "QueueAccess")]
    [ProducesResponseType(typeof(IReadOnlyList<TicketQueueItemDto>), StatusCodes.Status200OK)]
    public async Task<ActionResult<IReadOnlyList<TicketQueueItemDto>>> GetQueue(
        [FromQuery] DateOnly? date,
        CancellationToken cancellationToken)
    {
        var targetDate = date ?? DateOnly.FromDateTime(DateTime.UtcNow);
        var queue = await _receptionService.GetQueueAsync(targetDate, cancellationToken);
        return Ok(queue);
    }

    [HttpGet("{id:guid}")]
    [Authorize(Roles = $"{AppRoles.Reception},{AppRoles.CreditManager},{AppRoles.WarehouseOperator},{AppRoles.Supervisor},{AppRoles.Administrator}")]
    [ProducesResponseType(typeof(TicketDetailDto), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<ActionResult<TicketDetailDto>> GetById(
        Guid id,
        CancellationToken cancellationToken)
    {
        var ticket = await _receptionService.GetTicketDetailAsync(id, cancellationToken);
        return Ok(ticket);
    }

    [HttpPost("walk-in")]
    [Authorize(Policy = "ReceptionAccess")]
    [ProducesResponseType(typeof(ArrivalTicketResponse), StatusCodes.Status201Created)]
    [ProducesResponseType(StatusCodes.Status400BadRequest)]
    [ProducesResponseType(StatusCodes.Status409Conflict)]
    public async Task<ActionResult<ArrivalTicketResponse>> WalkInArrival(
        [FromBody] WalkInArrivalRequest request,
        CancellationToken cancellationToken)
    {
        var ticket = await _receptionService.RegisterWalkInArrivalAsync(request, cancellationToken);
        return CreatedAtAction(nameof(GetById), new { id = ticket.TicketId }, ticket);
    }

    [HttpGet("{id:guid}/credit-context")]
    [Authorize(Policy = "CreditAccess")]
    [ProducesResponseType(typeof(TicketCreditContextDto), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<ActionResult<TicketCreditContextDto>> GetCreditContext(
        Guid id,
        CancellationToken cancellationToken)
    {
        var context = await _creditService.GetCreditContextAsync(id, cancellationToken);
        return Ok(context);
    }

    [HttpPost("{id:guid}/credit-decision")]
    [Authorize(Policy = "CreditAccess")]
    [ProducesResponseType(typeof(CreditDecisionResponse), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status400BadRequest)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    [ProducesResponseType(StatusCodes.Status409Conflict)]
    public async Task<ActionResult<CreditDecisionResponse>> RecordCreditDecision(
        Guid id,
        [FromBody] CreditDecisionRequest request,
        CancellationToken cancellationToken)
    {
        var response = await _creditService.RecordCreditDecisionAsync(id, request, cancellationToken);
        return Ok(response);
    }

    [HttpPost("{id:guid}/orders/{orderId:guid}/release")]
    [Authorize(Policy = "CreditAccess")]
    [ProducesResponseType(typeof(CreditOrderResultDto), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    [ProducesResponseType(StatusCodes.Status409Conflict)]
    public async Task<ActionResult<CreditOrderResultDto>> ReleaseOrder(
        Guid id,
        Guid orderId,
        CancellationToken cancellationToken)
    {
        var result = await _creditService.ReleaseOrderAsync(id, orderId, cancellationToken);
        return Ok(result);
    }

    [HttpPost("{id:guid}/orders/{orderId:guid}/preparation")]
    [Authorize(Policy = "WarehouseAccess")]
    [ProducesResponseType(typeof(OrderPreparationResultDto), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    [ProducesResponseType(StatusCodes.Status409Conflict)]
    public async Task<ActionResult<OrderPreparationResultDto>> StartPreparation(
        Guid id,
        Guid orderId,
        [FromBody] PreparationUpdateRequest? request,
        CancellationToken cancellationToken)
    {
        var result = await _warehouseService.StartPreparationAsync(id, orderId, request, cancellationToken);
        return Ok(result);
    }

    [HttpPost("{id:guid}/orders/{orderId:guid}/ready")]
    [Authorize(Policy = "WarehouseAccess")]
    [ProducesResponseType(typeof(OrderPreparationResultDto), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    [ProducesResponseType(StatusCodes.Status409Conflict)]
    public async Task<ActionResult<OrderPreparationResultDto>> MarkOrderReady(
        Guid id,
        Guid orderId,
        [FromBody] PreparationUpdateRequest? request,
        CancellationToken cancellationToken)
    {
        var result = await _warehouseService.MarkOrderReadyAsync(id, orderId, request, cancellationToken);
        return Ok(result);
    }

    [HttpPost("{id:guid}/orders/{orderId:guid}/remove-blocked")]
    [Authorize(Policy = "SupervisorAccess")]
    [ProducesResponseType(typeof(OrderPreparationResultDto), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status400BadRequest)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    [ProducesResponseType(StatusCodes.Status409Conflict)]
    public async Task<ActionResult<OrderPreparationResultDto>> RemoveBlockedOrder(
        Guid id,
        Guid orderId,
        [FromBody] RemoveBlockedOrderRequest request,
        CancellationToken cancellationToken)
    {
        var result = await _warehouseService.RemoveBlockedOrderAsync(id, orderId, request, cancellationToken);
        return Ok(result);
    }

    [HttpPost("{id:guid}/collection")]
    [Authorize(Roles = $"{AppRoles.Reception},{AppRoles.WarehouseOperator},{AppRoles.Supervisor},{AppRoles.Administrator}")]
    [ProducesResponseType(typeof(CollectionResultDto), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    [ProducesResponseType(StatusCodes.Status409Conflict)]
    public async Task<ActionResult<CollectionResultDto>> ConfirmCollection(
        Guid id,
        [FromBody] CollectionConfirmRequest? request,
        CancellationToken cancellationToken)
    {
        var result = await _warehouseService.ConfirmCollectionAsync(id, request, cancellationToken);
        return Ok(result);
    }
}
