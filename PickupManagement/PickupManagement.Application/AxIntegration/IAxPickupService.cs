namespace PickupManagement.Application.AxIntegration;

public interface IAxPickupService
{
    Task<IReadOnlyList<AxCustomerDto>> SearchCustomersAsync(
        string search,
        string dataAreaId,
        CancellationToken cancellationToken = default);

    Task<AxCustomerDto?> GetCustomerForPickupAsync(
        string customerAccount,
        string dataAreaId,
        CancellationToken cancellationToken = default);

    Task<IReadOnlyList<AxSalesOrderDto>> GetEligibleSalesOrdersAsync(
        string customerAccount,
        string warehouseId,
        string dataAreaId,
        CancellationToken cancellationToken = default);

    Task<AxCustomerCreditInfoDto?> GetCustomerCreditInfoAsync(
        string customerAccount,
        string dataAreaId,
        CancellationToken cancellationToken = default);

    Task<AxOrderReleaseEligibilityDto> ValidateOrderForReleaseAsync(
        string salesId,
        string dataAreaId,
        CancellationToken cancellationToken = default);

    Task<AxReleaseResultDto> ReleaseSalesOrderForPickupAsync(
        string salesId,
        string operationKey,
        string dataAreaId,
        CancellationToken cancellationToken = default);

    Task<IReadOnlyList<AxOrderPickupStatusDto>> GetSalesOrderPickupStatusAsync(
        IReadOnlyCollection<string> salesIds,
        string dataAreaId,
        CancellationToken cancellationToken = default);

    Task<AxIntegrationStatusDto?> GetPickupIntegrationStatusAsync(
        string operationKey,
        CancellationToken cancellationToken = default);
}

public record AxCustomerDto(
    string AccountNum,
    string Name,
    string DataAreaId,
    bool IsActive,
    string? BlockedStatus);

public record AxSalesOrderDto(
    string SalesId,
    string DataAreaId,
    string CustomerAccount,
    string WarehouseId,
    DateOnly OrderDate,
    string AxStatus,
    bool IsEligible,
    string EligibilityStatus,
    string? IneligibilityReason,
    decimal TotalAmount,
    string CurrencyCode);

public record AxCustomerCreditInfoDto(
    string CustomerAccount,
    string DataAreaId,
    decimal Balance,
    decimal CreditLimit,
    decimal OpenOrdersAmount,
    string CurrencyCode,
    bool HasCreditBlock,
    string? BlockReason);

public record AxOrderReleaseEligibilityDto(
    string SalesId,
    string DataAreaId,
    bool IsEligible,
    bool IsAlreadyReleased,
    bool IsCancelled,
    string AxStatus,
    string EligibilityLabel,
    string? BlockingReason);

public record AxReleaseResultDto(
    bool Succeeded,
    bool IsTransientTimeout,
    bool IsBusinessRejection,
    string? AxReference,
    string? ErrorCode,
    string? ErrorMessage);

public record AxOrderPickupStatusDto(
    string SalesId,
    string DataAreaId,
    string AxStatus,
    string WarehouseProgress,
    bool IsCancelled);

public record AxIntegrationStatusDto(
    string OperationKey,
    string SalesId,
    bool CompletedInAx,
    string? AxReference,
    string? ErrorMessage);
