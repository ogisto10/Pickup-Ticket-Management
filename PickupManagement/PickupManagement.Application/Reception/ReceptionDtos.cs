using PickupManagement.Domain.Enums;

namespace PickupManagement.Application.Reception;

public record ArrivalTicketResponse(
    Guid TicketId,
    string TicketNumber,
    int QueueNumber,
    PickupTicketStatus Status,
    DateTime ArrivalTime,
    string CustomerAccount,
    string CustomerName,
    int OrderCount);

public record WalkInArrivalRequest(
    string CustomerAccount,
    string WarehouseId,
    IReadOnlyList<string> SalesOrders,
    string? Notes);

public record TicketQueueItemDto(
    Guid TicketId,
    Guid PickupPlanId,
    DateOnly TicketDate,
    string TicketNumber,
    int QueueNumber,
    DateTime ArrivalTime,
    string CustomerAccount,
    string CustomerName,
    string WarehouseId,
    PickupTicketStatus Status,
    int OrderCount,
    int ReadyOrderCount,
    string? CreditComment);

public record TicketOrderDetailDto(
    Guid Id,
    Guid PickupPlanOrderId,
    string DataAreaId,
    string SalesId,
    PickupTicketOrderStatus Status,
    OrderCreditStatus CreditStatus,
    OrderWarehouseStatus WarehouseStatus,
    DateTime? LastAxSyncAt);

public record TicketDetailDto(
    Guid TicketId,
    Guid PickupPlanId,
    DateOnly TicketDate,
    int DailySequence,
    string TicketNumber,
    int QueueNumber,
    DateTime ArrivalTime,
    string CustomerAccount,
    string CustomerName,
    string WarehouseId,
    PickupTicketStatus Status,
    string? CreditDecisionBy,
    DateTime? CreditDecisionAt,
    string? CreditComment,
    DateTime? ReadyAt,
    DateTime? CollectedAt,
    IReadOnlyList<TicketOrderDetailDto> Orders);
