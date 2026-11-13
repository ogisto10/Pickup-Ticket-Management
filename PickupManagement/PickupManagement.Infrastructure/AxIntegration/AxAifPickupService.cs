using Microsoft.Extensions.Options;
using PickupManagement.Application.AxIntegration;

namespace PickupManagement.Infrastructure.AxIntegration;

/// <summary>
/// Production Dynamics AX 2012 R3 AIF client adapter for DOSI_PickupManagementServiceGroup.
/// Wired once the WSDL/WCF service reference and confirmed AX release class are deployed.
/// </summary>
public class AxAifPickupService : IAxPickupService
{
    private readonly AxAifOptions _options;

    public AxAifPickupService(IOptions<AxAifOptions> options)
    {
        _options = options.Value;
    }

    public Task<IReadOnlyList<AxCustomerDto>> SearchCustomersAsync(string search, string dataAreaId, CancellationToken cancellationToken = default)
        => throw BuildNotConfiguredException(nameof(SearchCustomersAsync));

    public Task<AxCustomerDto?> GetCustomerForPickupAsync(string customerAccount, string dataAreaId, CancellationToken cancellationToken = default)
        => throw BuildNotConfiguredException(nameof(GetCustomerForPickupAsync));

    public Task<IReadOnlyList<AxSalesOrderDto>> GetEligibleSalesOrdersAsync(string customerAccount, string warehouseId, string dataAreaId, CancellationToken cancellationToken = default)
        => throw BuildNotConfiguredException(nameof(GetEligibleSalesOrdersAsync));

    public Task<AxCustomerCreditInfoDto?> GetCustomerCreditInfoAsync(string customerAccount, string dataAreaId, CancellationToken cancellationToken = default)
        => throw BuildNotConfiguredException(nameof(GetCustomerCreditInfoAsync));

    public Task<AxOrderReleaseEligibilityDto> ValidateOrderForReleaseAsync(string salesId, string dataAreaId, CancellationToken cancellationToken = default)
        => throw BuildNotConfiguredException(nameof(ValidateOrderForReleaseAsync));

    public Task<AxReleaseResultDto> ReleaseSalesOrderForPickupAsync(string salesId, string operationKey, string dataAreaId, CancellationToken cancellationToken = default)
        => throw BuildNotConfiguredException(nameof(ReleaseSalesOrderForPickupAsync));

    public Task<IReadOnlyList<AxOrderPickupStatusDto>> GetSalesOrderPickupStatusAsync(IReadOnlyCollection<string> salesIds, string dataAreaId, CancellationToken cancellationToken = default)
        => throw BuildNotConfiguredException(nameof(GetSalesOrderPickupStatusAsync));

    public Task<AxIntegrationStatusDto?> GetPickupIntegrationStatusAsync(string operationKey, CancellationToken cancellationToken = default)
        => throw BuildNotConfiguredException(nameof(GetPickupIntegrationStatusAsync));

    private NotSupportedException BuildNotConfiguredException(string operation) =>
        new($"AX 2012 R3 AIF service '{_options.ServiceGroupName}.{operation}' at '{_options.EndpointUrl}' is not connected. Enable 'UseMockAxAdapter: true' for development or bind the generated WCF AIF client.");
}
