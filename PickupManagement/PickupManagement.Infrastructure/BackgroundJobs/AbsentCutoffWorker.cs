using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Hosting;
using Microsoft.Extensions.Logging;
using PickupManagement.Domain.Enums;
using PickupManagement.Infrastructure.Persistence;

namespace PickupManagement.Infrastructure.BackgroundJobs;

/// <summary>
/// Section 8: Marks unarrived PLANNED visits as ABSENT after the warehouse's configured
/// ArrivalCutoffTime and deactivates their PickupPlanOrder rows so sales orders can be replanned.
/// </summary>
public class AbsentCutoffWorker : BackgroundService
{
    private static readonly TimeSpan PollInterval = TimeSpan.FromMinutes(5);
    private readonly IServiceScopeFactory _scopeFactory;
    private readonly ILogger<AbsentCutoffWorker> _logger;

    public AbsentCutoffWorker(
        IServiceScopeFactory scopeFactory,
        ILogger<AbsentCutoffWorker> logger)
    {
        _scopeFactory = scopeFactory;
        _logger = logger;
    }

    protected override async Task ExecuteAsync(CancellationToken stoppingToken)
    {
        while (!stoppingToken.IsCancellationRequested)
        {
            try
            {
                await MarkOverduePlansAbsentAsync(stoppingToken);
            }
            catch (Exception ex) when (!stoppingToken.IsCancellationRequested)
            {
                _logger.LogError(ex, "Unhandled error in AbsentCutoffWorker.");
            }

            await Task.Delay(PollInterval, stoppingToken);
        }
    }

    private async Task MarkOverduePlansAbsentAsync(CancellationToken cancellationToken)
    {
        using var scope = _scopeFactory.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<PickupManagementDbContext>();
        var utcNow = DateTime.UtcNow;

        var allSettings = await db.PickupSettings.AsNoTracking().ToListAsync(cancellationToken);
        foreach (var settings in allSettings)
        {
            var (localDate, localTime) = ResolveLocalDateTime(utcNow, settings.BusinessTimeZone);
            var cutoffPassedToday = settings.ArrivalCutoffTime.HasValue && localTime >= settings.ArrivalCutoffTime.Value;

            var overduePlans = await db.PickupPlans
                .Include(p => p.Orders)
                .Where(p => p.WarehouseId == settings.WarehouseId
                    && p.Status == PickupPlanStatus.PLANNED
                    && (p.PickupDate < localDate || (cutoffPassedToday && p.PickupDate == localDate)))
                .ToListAsync(cancellationToken);

            if (overduePlans.Count == 0)
            {
                continue;
            }

            foreach (var plan in overduePlans)
            {
                plan.Status = PickupPlanStatus.ABSENT;
                plan.UpdatedAt = utcNow;
                foreach (var order in plan.Orders)
                {
                    order.IsActive = false;
                }
            }

            await db.SaveChangesAsync(cancellationToken);
            _logger.LogInformation(
                "Marked {Count} overdue pickup plans as ABSENT for warehouse {WarehouseId}.",
                overduePlans.Count, settings.WarehouseId);
        }
    }

    private static (DateOnly Date, TimeOnly Time) ResolveLocalDateTime(DateTime utcNow, string timeZoneId)
    {
        try
        {
            var tz = TimeZoneInfo.FindSystemTimeZoneById(timeZoneId);
            var local = TimeZoneInfo.ConvertTimeFromUtc(utcNow, tz);
            return (DateOnly.FromDateTime(local), TimeOnly.FromDateTime(local));
        }
        catch (TimeZoneNotFoundException)
        {
            return (DateOnly.FromDateTime(utcNow), TimeOnly.FromDateTime(utcNow));
        }
    }
}
