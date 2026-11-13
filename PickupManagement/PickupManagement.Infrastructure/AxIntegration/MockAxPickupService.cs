using System.Collections.Concurrent;
using PickupManagement.Application.AxIntegration;

namespace PickupManagement.Infrastructure.AxIntegration;

/// <summary>
/// Development mock implementation of AX 2012 R3 DOSI_PickupManagementServiceGroup.
/// </summary>
public class MockAxPickupService : IAxPickupService
{
    private sealed record MockCustomerSeed(
        string AccountNum,
        string Name,
        string DataAreaId,
        bool IsActive,
        string? BlockedStatus,
        decimal Balance,
        decimal CreditLimit,
        decimal OpenOrdersAmount,
        bool HasCreditBlock,
        string? BlockReason);

    private sealed class MockOrderState
    {
        public string SalesId { get; init; } = string.Empty;
        public string DataAreaId { get; init; } = string.Empty;
        public string CustomerAccount { get; init; } = string.Empty;
        public string WarehouseId { get; init; } = string.Empty;
        public DateOnly OrderDate { get; init; }
        public string AxStatus { get; set; } = "Open order";
        public bool IsEligible { get; set; } = true;
        public string EligibilityStatus { get; set; } = "Eligible";
        public string? IneligibilityReason { get; set; }
        public decimal TotalAmount { get; init; }
        public string CurrencyCode { get; init; } = "USD";
        public bool IsReleased { get; set; }
        public bool IsCancelled { get; set; }
        public string WarehouseProgress { get; set; } = "Pending";
    }

    private readonly List<MockCustomerSeed> _customers =
    [
        new("411-021", "Atlas Building Supplies", "DAT", true, null, 18500m, 50000m, 14200m, false, null),
        new("411-035", "Horizon Industrial Group", "DAT", true, null, 48200m, 50000m, 9600m, false, "Near credit limit - review required"),
        new("411-048", "Meridian Logistics Co.", "DAT", true, null, 62400m, 60000m, 7800m, true, "Credit limit exceeded in AX"),
        new("411-090", "Northstar Retail Partners", "DAT", true, null, 4200m, 35000m, 5100m, false, null),
        new("411-999", "Inactive Account Demo", "DAT", false, "All", 0m, 0m, 0m, true, "Customer stopped for invoicing and delivery")
    ];

    private readonly ConcurrentDictionary<string, MockOrderState> _orders = new(StringComparer.OrdinalIgnoreCase);
    private readonly ConcurrentDictionary<string, AxIntegrationStatusDto> _operations = new(StringComparer.OrdinalIgnoreCase);

    public MockAxPickupService()
    {
        var today = DateOnly.FromDateTime(DateTime.UtcNow);
        SeedOrder(new MockOrderState
        {
            SalesId = "SO-001258",
            DataAreaId = "DAT",
            CustomerAccount = "411-021",
            WarehouseId = "MAIN",
            OrderDate = today.AddDays(-2),
            AxStatus = "Open order",
            IsEligible = true,
            EligibilityStatus = "Eligible",
            TotalAmount = 4800m
        });
        SeedOrder(new MockOrderState
        {
            SalesId = "SO-001264",
            DataAreaId = "DAT",
            CustomerAccount = "411-021",
            WarehouseId = "MAIN",
            OrderDate = today.AddDays(-1),
            AxStatus = "Open order",
            IsEligible = true,
            EligibilityStatus = "Review required",
            IneligibilityReason = null,
            TotalAmount = 5200m
        });
        SeedOrder(new MockOrderState
        {
            SalesId = "SO-001275",
            DataAreaId = "DAT",
            CustomerAccount = "411-021",
            WarehouseId = "MAIN",
            OrderDate = today,
            AxStatus = "Open order",
            IsEligible = true,
            EligibilityStatus = "Eligible",
            TotalAmount = 4200m
        });
        SeedOrder(new MockOrderState
        {
            SalesId = "SO-001281",
            DataAreaId = "DAT",
            CustomerAccount = "411-021",
            WarehouseId = "MAIN",
            OrderDate = today,
            AxStatus = "Canceled",
            IsEligible = false,
            EligibilityStatus = "Ineligible",
            IneligibilityReason = "Sales order is cancelled in AX",
            TotalAmount = 1900m,
            IsCancelled = true
        });
        SeedOrder(new MockOrderState
        {
            SalesId = "SO-001301",
            DataAreaId = "DAT",
            CustomerAccount = "411-035",
            WarehouseId = "MAIN",
            OrderDate = today.AddDays(-1),
            AxStatus = "Open order",
            IsEligible = true,
            EligibilityStatus = "Eligible",
            TotalAmount = 6100m
        });
        SeedOrder(new MockOrderState
        {
            SalesId = "SO-001304",
            DataAreaId = "DAT",
            CustomerAccount = "411-035",
            WarehouseId = "MAIN",
            OrderDate = today,
            AxStatus = "Open order",
            IsEligible = true,
            EligibilityStatus = "Review required",
            TotalAmount = 3500m
        });
        SeedOrder(new MockOrderState
        {
            SalesId = "SO-001410",
            DataAreaId = "DAT",
            CustomerAccount = "411-048",
            WarehouseId = "MAIN",
            OrderDate = today,
            AxStatus = "Open order",
            IsEligible = true,
            EligibilityStatus = "Review required",
            TotalAmount = 7800m
        });
        SeedOrder(new MockOrderState
        {
            SalesId = "SO-001502",
            DataAreaId = "DAT",
            CustomerAccount = "411-090",
            WarehouseId = "MAIN",
            OrderDate = today,
            AxStatus = "Open order",
            IsEligible = true,
            EligibilityStatus = "Eligible",
            TotalAmount = 5100m
        });
    }

    private void SeedOrder(MockOrderState order) => _orders[order.SalesId] = order;

    public Task<IReadOnlyList<AxCustomerDto>> SearchCustomersAsync(
        string search,
        string dataAreaId,
        CancellationToken cancellationToken = default)
    {
        var term = (search ?? string.Empty).Trim();
        var results = _customers
            .Where(c => string.Equals(c.DataAreaId, dataAreaId, StringComparison.OrdinalIgnoreCase))
            .Where(c => string.IsNullOrEmpty(term)
                || c.AccountNum.Contains(term, StringComparison.OrdinalIgnoreCase)
                || c.Name.Contains(term, StringComparison.OrdinalIgnoreCase))
            .Select(c => new AxCustomerDto(c.AccountNum, c.Name, c.DataAreaId, c.IsActive, c.BlockedStatus))
            .ToArray();

        return Task.FromResult<IReadOnlyList<AxCustomerDto>>(results);
    }

    public Task<AxCustomerDto?> GetCustomerForPickupAsync(
        string customerAccount,
        string dataAreaId,
        CancellationToken cancellationToken = default)
    {
        var customer = _customers.FirstOrDefault(c =>
            string.Equals(c.AccountNum, customerAccount, StringComparison.OrdinalIgnoreCase) &&
            string.Equals(c.DataAreaId, dataAreaId, StringComparison.OrdinalIgnoreCase));

        return Task.FromResult(customer is null
            ? null
            : new AxCustomerDto(customer.AccountNum, customer.Name, customer.DataAreaId, customer.IsActive, customer.BlockedStatus));
    }

    public Task<IReadOnlyList<AxSalesOrderDto>> GetEligibleSalesOrdersAsync(
        string customerAccount,
        string warehouseId,
        string dataAreaId,
        CancellationToken cancellationToken = default)
    {
        var results = _orders.Values
            .Where(o => string.Equals(o.CustomerAccount, customerAccount, StringComparison.OrdinalIgnoreCase)
                && string.Equals(o.DataAreaId, dataAreaId, StringComparison.OrdinalIgnoreCase)
                && (string.IsNullOrWhiteSpace(warehouseId) || string.Equals(o.WarehouseId, warehouseId, StringComparison.OrdinalIgnoreCase)))
            .OrderBy(o => o.SalesId)
            .Select(o => new AxSalesOrderDto(
                o.SalesId,
                o.DataAreaId,
                o.CustomerAccount,
                o.WarehouseId,
                o.OrderDate,
                o.AxStatus,
                o.IsEligible,
                o.EligibilityStatus,
                o.IneligibilityReason,
                o.TotalAmount,
                o.CurrencyCode))
            .ToArray();

        return Task.FromResult<IReadOnlyList<AxSalesOrderDto>>(results);
    }

    public Task<AxCustomerCreditInfoDto?> GetCustomerCreditInfoAsync(
        string customerAccount,
        string dataAreaId,
        CancellationToken cancellationToken = default)
    {
        var customer = _customers.FirstOrDefault(c =>
            string.Equals(c.AccountNum, customerAccount, StringComparison.OrdinalIgnoreCase) &&
            string.Equals(c.DataAreaId, dataAreaId, StringComparison.OrdinalIgnoreCase));

        return Task.FromResult(customer is null
            ? null
            : new AxCustomerCreditInfoDto(
                customer.AccountNum,
                customer.DataAreaId,
                customer.Balance,
                customer.CreditLimit,
                customer.OpenOrdersAmount,
                "USD",
                customer.HasCreditBlock,
                customer.BlockReason));
    }

    public Task<AxOrderReleaseEligibilityDto> ValidateOrderForReleaseAsync(
        string salesId,
        string dataAreaId,
        CancellationToken cancellationToken = default)
    {
        if (!_orders.TryGetValue(salesId, out var order) ||
            !string.Equals(order.DataAreaId, dataAreaId, StringComparison.OrdinalIgnoreCase))
        {
            return Task.FromResult(new AxOrderReleaseEligibilityDto(
                salesId, dataAreaId, false, false, false, "Unknown", "Ineligible",
                "Sales order not found in AX."));
        }

        if (order.IsCancelled)
        {
            return Task.FromResult(new AxOrderReleaseEligibilityDto(
                order.SalesId, order.DataAreaId, false, false, true, order.AxStatus, "Ineligible",
                "Sales order is cancelled in AX."));
        }

        var customer = _customers.FirstOrDefault(c =>
            string.Equals(c.AccountNum, order.CustomerAccount, StringComparison.OrdinalIgnoreCase));
        if (customer is null || !customer.IsActive)
        {
            return Task.FromResult(new AxOrderReleaseEligibilityDto(
                order.SalesId, order.DataAreaId, false, order.IsReleased, false, order.AxStatus, "Blocked",
                "Customer account is inactive or blocked in AX."));
        }

        if (customer.HasCreditBlock)
        {
            return Task.FromResult(new AxOrderReleaseEligibilityDto(
                order.SalesId, order.DataAreaId, false, order.IsReleased, false, order.AxStatus, "Review required",
                customer.BlockReason ?? "Customer has a credit block in AX."));
        }

        return Task.FromResult(new AxOrderReleaseEligibilityDto(
            order.SalesId,
            order.DataAreaId,
            order.IsEligible,
            order.IsReleased,
            order.IsCancelled,
            order.AxStatus,
            order.EligibilityStatus,
            order.IneligibilityReason));
    }

    public Task<AxReleaseResultDto> ReleaseSalesOrderForPickupAsync(
        string salesId,
        string operationKey,
        string dataAreaId,
        CancellationToken cancellationToken = default)
    {
        if (_operations.TryGetValue(operationKey, out var existingOp))
        {
            return Task.FromResult(new AxReleaseResultDto(
                existingOp.CompletedInAx,
                false,
                !existingOp.CompletedInAx,
                existingOp.AxReference,
                existingOp.CompletedInAx ? null : "AX_BUSINESS_ERROR",
                existingOp.ErrorMessage));
        }

        if (!_orders.TryGetValue(salesId, out var order))
        {
            return Task.FromResult(new AxReleaseResultDto(
                false, false, true, null, "ORDER_NOT_FOUND", $"Sales order '{salesId}' was not found in AX."));
        }

        if (order.IsCancelled)
        {
            return Task.FromResult(new AxReleaseResultDto(
                false, false, true, null, "ORDER_CANCELLED", $"Sales order '{salesId}' is cancelled in AX."));
        }

        order.IsReleased = true;
        order.AxStatus = "Released for pickup";
        order.WarehouseProgress = "Released";

        var axRef = $"AX-REL-{DateTime.UtcNow:yyyyMMdd}-{order.SalesId}";
        _operations[operationKey] = new AxIntegrationStatusDto(operationKey, salesId, true, axRef, null);

        return Task.FromResult(new AxReleaseResultDto(
            true, false, false, axRef, null, null));
    }

    public Task<IReadOnlyList<AxOrderPickupStatusDto>> GetSalesOrderPickupStatusAsync(
        IReadOnlyCollection<string> salesIds,
        string dataAreaId,
        CancellationToken cancellationToken = default)
    {
        var results = salesIds
            .Select(id => _orders.TryGetValue(id, out var o)
                ? new AxOrderPickupStatusDto(o.SalesId, o.DataAreaId, o.AxStatus, o.WarehouseProgress, o.IsCancelled)
                : new AxOrderPickupStatusDto(id, dataAreaId, "Unknown", "Unknown", false))
            .ToArray();

        return Task.FromResult<IReadOnlyList<AxOrderPickupStatusDto>>(results);
    }

    public Task<AxIntegrationStatusDto?> GetPickupIntegrationStatusAsync(
        string operationKey,
        CancellationToken cancellationToken = default)
    {
        _operations.TryGetValue(operationKey, out var status);
        return Task.FromResult(status);
    }
}
