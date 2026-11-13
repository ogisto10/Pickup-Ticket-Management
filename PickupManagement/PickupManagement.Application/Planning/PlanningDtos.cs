using PickupManagement.Domain.Enums;

namespace PickupManagement.Application.Planning;

public record CreatePickupPlanRequest(
    string CustomerAccount,
    DateOnly PickupDate,
    string WarehouseId,
    IReadOnlyList<string> SalesOrders,
    string? Notes);

public record UpdatePickupPlanRequest(
    DateOnly PickupDate,
    string WarehouseId,
    IReadOnlyList<string> SalesOrders,
    string? Notes);

public record PickupPlanResponse(
    Guid Id,
    string CustomerAccount,
    string CustomerNameSnapshot,
    DateOnly PickupDate,
    string WarehouseId,
    PickupPlanStatus Status,
    IReadOnlyList<string> SalesOrders,
    string? Notes,
    string CreatedBy,
    DateTime CreatedAt,
    DateTime UpdatedAt);

public record PickupPlanListItemDto(
    Guid Id,
    string CustomerAccount,
    string CustomerNameSnapshot,
    DateOnly PickupDate,
    string WarehouseId,
    PickupPlanStatus Status,
    int OrderCount,
    IReadOnlyList<PickupPlanOrderItemDto> Orders,
    string? Notes,
    string CreatedBy,
    DateTime UpdatedAt);

public record PickupPlanOrderItemDto(
    Guid Id,
    string DataAreaId,
    string SalesId,
    string? OrderStatusSnapshot);

public record CustomerOrderLookupDto(
    string SalesId,
    string DataAreaId,
    string WarehouseId,
    DateOnly OrderDate,
    string AxStatus,
    bool IsEligible,
    string EligibilityStatus,
    string? IneligibilityReason,
    decimal TotalAmount,
    string CurrencyCode,
    bool IsAlreadyPlanned,
    Guid? ExistingPlanId);

public record CustomerOrdersResponseDto(
    string CustomerAccount,
    string CustomerName,
    bool AlreadyPlannedForSelectedDate,
    IReadOnlyList<CustomerOrderLookupDto> Orders);
