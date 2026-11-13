using Microsoft.EntityFrameworkCore;
using PickupManagement.Application.AxIntegration;
using PickupManagement.Application.Common.Exceptions;
using PickupManagement.Application.Common.Interfaces;
using PickupManagement.Application.Planning;
using PickupManagement.Domain.Entities;
using PickupManagement.Domain.Enums;
using PickupManagement.Infrastructure.Persistence;

namespace PickupManagement.Infrastructure.Planning;

public class PickupPlanService : IPickupPlanService
{
    private readonly PickupManagementDbContext _db;
    private readonly IAxPickupService _axService;
    private readonly ICurrentUserService _currentUser;
    private readonly IDateTimeProvider _clock;

    public PickupPlanService(
        PickupManagementDbContext db,
        IAxPickupService axService,
        ICurrentUserService currentUser,
        IDateTimeProvider clock)
    {
        _db = db;
        _axService = axService;
        _currentUser = currentUser;
        _clock = clock;
    }

    public async Task<PickupPlanResponse> CreateAsync(
        CreatePickupPlanRequest request,
        CancellationToken cancellationToken = default)
    {
        if (string.IsNullOrWhiteSpace(request.CustomerAccount))
        {
            throw new DomainValidationException("Customer account is required.");
        }

        if (request.SalesOrders is null || request.SalesOrders.Count == 0)
        {
            throw new DomainValidationException("At least one eligible AX sales order must be selected.");
        }

        var warehouseId = request.WarehouseId.Trim();
        var settings = await _db.PickupSettings
            .AsNoTracking()
            .FirstOrDefaultAsync(s => s.WarehouseId == warehouseId, cancellationToken)
            ?? throw new DomainValidationException($"Warehouse '{warehouseId}' is not configured in PickupSettings.");

        var dataAreaId = settings.AxDataAreaId;
        var customer = await _axService.GetCustomerForPickupAsync(request.CustomerAccount.Trim(), dataAreaId, cancellationToken)
            ?? throw new DomainValidationException($"Customer '{request.CustomerAccount}' was not found in AX company '{dataAreaId}'.");

        if (!customer.IsActive)
        {
            throw new DomainValidationException($"Customer '{customer.AccountNum}' is inactive or blocked in AX ({customer.BlockedStatus}).");
        }

        var normalizedSalesIds = request.SalesOrders
            .Select(s => s.Trim())
            .Where(s => !string.IsNullOrEmpty(s))
            .Distinct(StringComparer.OrdinalIgnoreCase)
            .ToArray();

        if (normalizedSalesIds.Length == 0)
        {
            throw new DomainValidationException("At least one valid sales order ID is required.");
        }

        var axOrders = await _axService.GetEligibleSalesOrdersAsync(customer.AccountNum, warehouseId, dataAreaId, cancellationToken);
        var axOrderMap = axOrders.ToDictionary(o => o.SalesId, StringComparer.OrdinalIgnoreCase);

        foreach (var salesId in normalizedSalesIds)
        {
            if (!axOrderMap.TryGetValue(salesId, out var axOrder))
            {
                throw new DomainValidationException($"Sales order '{salesId}' does not belong to customer '{customer.AccountNum}' in warehouse '{warehouseId}'.");
            }

            if (!axOrder.IsEligible)
            {
                throw new DomainValidationException(
                    $"Sales order '{salesId}' is not eligible for pickup planning: {axOrder.IneligibilityReason ?? axOrder.EligibilityStatus}.");
            }
        }

        var alreadyPlanned = await _db.PickupPlanOrders
            .AsNoTracking()
            .Where(o => o.DataAreaId == dataAreaId && o.IsActive && normalizedSalesIds.Contains(o.SalesId))
            .Select(o => o.SalesId)
            .ToListAsync(cancellationToken);

        if (alreadyPlanned.Count > 0)
        {
            throw new ConflictException(
                $"The following sales orders are already assigned to an active pickup plan: {string.Join(", ", alreadyPlanned)}.");
        }

        var now = _clock.UtcNow;
        var plan = new PickupPlan
        {
            Id = Guid.NewGuid(),
            CustomerAccount = customer.AccountNum,
            CustomerNameSnapshot = customer.Name,
            PickupDate = request.PickupDate,
            WarehouseId = warehouseId,
            Status = PickupPlanStatus.PLANNED,
            Notes = request.Notes?.Trim(),
            CreatedBy = _currentUser.UserName,
            CreatedAt = now,
            UpdatedAt = now
        };

        foreach (var salesId in normalizedSalesIds)
        {
            var axOrder = axOrderMap[salesId];
            plan.Orders.Add(new PickupPlanOrder
            {
                Id = Guid.NewGuid(),
                PickupPlanId = plan.Id,
                DataAreaId = dataAreaId,
                SalesId = axOrder.SalesId,
                OrderStatusSnapshot = axOrder.AxStatus,
                AddedAt = now,
                AddedBy = _currentUser.UserName,
                IsActive = true
            });
        }

        _db.PickupPlans.Add(plan);

        try
        {
            await _db.SaveChangesAsync(cancellationToken);
        }
        catch (DbUpdateException)
        {
            throw new ConflictException("One or more selected sales orders were concurrently assigned to another active pickup plan.");
        }

        return ToResponse(plan);
    }

    public async Task<IReadOnlyList<PickupPlanListItemDto>> ListByDateAsync(
        DateOnly date,
        CancellationToken cancellationToken = default)
    {
        var plans = await _db.PickupPlans
            .AsNoTracking()
            .Include(p => p.Orders)
            .Where(p => p.PickupDate == date)
            .OrderBy(p => p.CustomerNameSnapshot)
            .ToListAsync(cancellationToken);

        return plans.Select(ToListItem).ToArray();
    }

    public async Task<PickupPlanListItemDto> GetByIdAsync(
        Guid id,
        CancellationToken cancellationToken = default)
    {
        var plan = await _db.PickupPlans
            .AsNoTracking()
            .Include(p => p.Orders)
            .FirstOrDefaultAsync(p => p.Id == id, cancellationToken)
            ?? throw new ResourceNotFoundException($"Pickup plan '{id}' was not found.");

        return ToListItem(plan);
    }

    public async Task<PickupPlanResponse> UpdateAsync(
        Guid id,
        UpdatePickupPlanRequest request,
        CancellationToken cancellationToken = default)
    {
        var plan = await _db.PickupPlans
            .Include(p => p.Orders)
            .FirstOrDefaultAsync(p => p.Id == id, cancellationToken)
            ?? throw new ResourceNotFoundException($"Pickup plan '{id}' was not found.");

        if (plan.Status != PickupPlanStatus.PLANNED)
        {
            throw new ConflictException($"Pickup plan '{id}' cannot be edited because its status is '{plan.Status}'.");
        }

        if (request.SalesOrders is null || request.SalesOrders.Count == 0)
        {
            throw new DomainValidationException("At least one eligible AX sales order must be selected.");
        }

        var warehouseId = request.WarehouseId.Trim();
        var settings = await _db.PickupSettings
            .AsNoTracking()
            .FirstOrDefaultAsync(s => s.WarehouseId == warehouseId, cancellationToken)
            ?? throw new DomainValidationException($"Warehouse '{warehouseId}' is not configured in PickupSettings.");

        var dataAreaId = settings.AxDataAreaId;
        var normalizedSalesIds = request.SalesOrders
            .Select(s => s.Trim())
            .Where(s => !string.IsNullOrEmpty(s))
            .Distinct(StringComparer.OrdinalIgnoreCase)
            .ToArray();

        var axOrders = await _axService.GetEligibleSalesOrdersAsync(plan.CustomerAccount, warehouseId, dataAreaId, cancellationToken);
        var axOrderMap = axOrders.ToDictionary(o => o.SalesId, StringComparer.OrdinalIgnoreCase);

        foreach (var salesId in normalizedSalesIds)
        {
            if (!axOrderMap.TryGetValue(salesId, out var axOrder) || !axOrder.IsEligible)
            {
                throw new DomainValidationException(
                    $"Sales order '{salesId}' is not eligible for pickup planning.");
            }
        }

        var conflicts = await _db.PickupPlanOrders
            .AsNoTracking()
            .Where(o => o.DataAreaId == dataAreaId
                && o.IsActive
                && o.PickupPlanId != plan.Id
                && normalizedSalesIds.Contains(o.SalesId))
            .Select(o => o.SalesId)
            .ToListAsync(cancellationToken);

        if (conflicts.Count > 0)
        {
            throw new ConflictException(
                $"The following sales orders are already assigned to another active pickup plan: {string.Join(", ", conflicts)}.");
        }

        var now = _clock.UtcNow;
        plan.PickupDate = request.PickupDate;
        plan.WarehouseId = warehouseId;
        plan.Notes = request.Notes?.Trim();
        plan.UpdatedAt = now;

        var requestedSet = new HashSet<string>(normalizedSalesIds, StringComparer.OrdinalIgnoreCase);
        var toRemove = plan.Orders.Where(o => !requestedSet.Contains(o.SalesId)).ToList();
        foreach (var removed in toRemove)
        {
            _db.PickupPlanOrders.Remove(removed);
        }

        var existingSet = new HashSet<string>(plan.Orders.Select(o => o.SalesId), StringComparer.OrdinalIgnoreCase);
        foreach (var salesId in normalizedSalesIds)
        {
            if (existingSet.Contains(salesId))
            {
                continue;
            }

            var axOrder = axOrderMap[salesId];
            plan.Orders.Add(new PickupPlanOrder
            {
                Id = Guid.NewGuid(),
                PickupPlanId = plan.Id,
                DataAreaId = dataAreaId,
                SalesId = axOrder.SalesId,
                OrderStatusSnapshot = axOrder.AxStatus,
                AddedAt = now,
                AddedBy = _currentUser.UserName,
                IsActive = true
            });
        }

        try
        {
            await _db.SaveChangesAsync(cancellationToken);
        }
        catch (DbUpdateException)
        {
            throw new ConflictException("One or more selected sales orders were concurrently assigned to another active pickup plan.");
        }

        return ToResponse(plan);
    }

    private static PickupPlanResponse ToResponse(PickupPlan plan) =>
        new(
            plan.Id,
            plan.CustomerAccount,
            plan.CustomerNameSnapshot,
            plan.PickupDate,
            plan.WarehouseId,
            plan.Status,
            plan.Orders.Select(o => o.SalesId).OrderBy(s => s).ToArray(),
            plan.Notes,
            plan.CreatedBy,
            plan.CreatedAt,
            plan.UpdatedAt);

    private static PickupPlanListItemDto ToListItem(PickupPlan plan) =>
        new(
            plan.Id,
            plan.CustomerAccount,
            plan.CustomerNameSnapshot,
            plan.PickupDate,
            plan.WarehouseId,
            plan.Status,
            plan.Orders.Count,
            plan.Orders
                .OrderBy(o => o.SalesId)
                .Select(o => new PickupPlanOrderItemDto(o.Id, o.DataAreaId, o.SalesId, o.OrderStatusSnapshot))
                .ToArray(),
            plan.Notes,
            plan.CreatedBy,
            plan.UpdatedAt);
}
