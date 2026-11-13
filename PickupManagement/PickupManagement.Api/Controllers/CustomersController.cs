using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using PickupManagement.Application.AxIntegration;
using PickupManagement.Application.Planning;
using PickupManagement.Domain.Enums;
using PickupManagement.Infrastructure.Persistence;

namespace PickupManagement.Api.Controllers;

[ApiController]
[Route("api/customers")]
[Authorize(Roles = $"{AppRoles.Commercial},{AppRoles.Reception},{AppRoles.Supervisor},{AppRoles.Administrator}")]
public class CustomersController : ControllerBase
{
    private readonly IAxPickupService _axService;
    private readonly PickupManagementDbContext _db;

    public CustomersController(IAxPickupService axService, PickupManagementDbContext db)
    {
        _axService = axService;
        _db = db;
    }

    [HttpGet]
    [ProducesResponseType(typeof(IReadOnlyList<AxCustomerDto>), StatusCodes.Status200OK)]
    public async Task<ActionResult<IReadOnlyList<AxCustomerDto>>> SearchCustomers(
        [FromQuery] string? search,
        [FromQuery] string? warehouseId,
        CancellationToken cancellationToken)
    {
        var dataAreaId = await ResolveDataAreaIdAsync(warehouseId, cancellationToken);
        var customers = await _axService.SearchCustomersAsync(search ?? string.Empty, dataAreaId, cancellationToken);
        return Ok(customers);
    }

    [HttpGet("{account}/sales-orders")]
    [ProducesResponseType(typeof(CustomerOrdersResponseDto), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<ActionResult<CustomerOrdersResponseDto>> GetSalesOrders(
        string account,
        [FromQuery] string? warehouseId,
        [FromQuery] DateOnly? pickupDate,
        CancellationToken cancellationToken)
    {
        var settings = await ResolveSettingsAsync(warehouseId, cancellationToken);
        var effectiveWarehouse = settings?.WarehouseId ?? warehouseId ?? "MAIN";
        var dataAreaId = settings?.AxDataAreaId ?? "DAT";

        var customer = await _axService.GetCustomerForPickupAsync(account, dataAreaId, cancellationToken);
        if (customer is null)
        {
            return NotFound(new { message = $"Customer '{account}' was not found in AX company '{dataAreaId}'." });
        }

        var axOrders = await _axService.GetEligibleSalesOrdersAsync(customer.AccountNum, effectiveWarehouse, dataAreaId, cancellationToken);

        var activeOrderMap = await _db.PickupPlanOrders
            .AsNoTracking()
            .Where(o => o.DataAreaId == dataAreaId && o.IsActive)
            .Select(o => new { o.SalesId, o.PickupPlanId })
            .ToDictionaryAsync(x => x.SalesId, x => x.PickupPlanId, StringComparer.OrdinalIgnoreCase, cancellationToken);

        var targetDate = pickupDate ?? DateOnly.FromDateTime(DateTime.UtcNow.AddDays(1));
        var alreadyPlannedForDate = await _db.PickupPlans
            .AsNoTracking()
            .AnyAsync(p => p.CustomerAccount == customer.AccountNum
                && p.PickupDate == targetDate
                && (p.Status == PickupPlanStatus.PLANNED || p.Status == PickupPlanStatus.ARRIVED),
                cancellationToken);

        var orders = axOrders
            .Select(o =>
            {
                var isPlanned = activeOrderMap.TryGetValue(o.SalesId, out var existingPlanId);
                return new CustomerOrderLookupDto(
                    o.SalesId,
                    o.DataAreaId,
                    o.WarehouseId,
                    o.OrderDate,
                    o.AxStatus,
                    o.IsEligible,
                    o.EligibilityStatus,
                    o.IneligibilityReason,
                    o.TotalAmount,
                    o.CurrencyCode,
                    isPlanned,
                    isPlanned ? existingPlanId : null);
            })
            .ToArray();

        return Ok(new CustomerOrdersResponseDto(
            customer.AccountNum,
            customer.Name,
            alreadyPlannedForDate,
            orders));
    }

    private async Task<string> ResolveDataAreaIdAsync(string? warehouseId, CancellationToken cancellationToken)
    {
        var settings = await ResolveSettingsAsync(warehouseId, cancellationToken);
        return settings?.AxDataAreaId ?? "DAT";
    }

    private async Task<Domain.Entities.PickupSettings?> ResolveSettingsAsync(string? warehouseId, CancellationToken cancellationToken)
    {
        if (!string.IsNullOrWhiteSpace(warehouseId))
        {
            return await _db.PickupSettings.AsNoTracking()
                .FirstOrDefaultAsync(s => s.WarehouseId == warehouseId.Trim(), cancellationToken);
        }

        return await _db.PickupSettings.AsNoTracking().FirstOrDefaultAsync(cancellationToken);
    }
}
