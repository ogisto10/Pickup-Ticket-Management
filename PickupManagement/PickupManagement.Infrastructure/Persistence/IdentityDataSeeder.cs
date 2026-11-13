using Microsoft.AspNetCore.Identity;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;
using PickupManagement.Domain.Entities;
using PickupManagement.Domain.Enums;

namespace PickupManagement.Infrastructure.Persistence;

public static class IdentityDataSeeder
{
    public static async Task SeedAsync(
        IServiceProvider services,
        bool seedDevelopmentUsers,
        IConfiguration configuration)
    {
        using var scope = services.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<PickupManagementDbContext>();
        var roleManager = scope.ServiceProvider.GetRequiredService<RoleManager<IdentityRole<Guid>>>();
        var userManager = scope.ServiceProvider.GetRequiredService<UserManager<ApplicationUser>>();

        await db.Database.MigrateAsync();

        foreach (var roleName in AppRoles.All)
        {
            if (!await roleManager.RoleExistsAsync(roleName))
            {
                await roleManager.CreateAsync(new IdentityRole<Guid>(roleName)
                {
                    Id = Guid.NewGuid(),
                    NormalizedName = roleName.ToUpperInvariant()
                });
            }
        }

        var defaultWarehouse = configuration["PickupDefaults:WarehouseId"] ?? "MAIN";
        if (!await db.PickupSettings.AnyAsync(s => s.WarehouseId == defaultWarehouse))
        {
            db.PickupSettings.Add(new PickupSettings
            {
                Id = Guid.NewGuid(),
                WarehouseId = defaultWarehouse,
                TicketPrefix = configuration["PickupDefaults:TicketPrefix"] ?? "A-",
                NextDailySequence = 1,
                BusinessTimeZone = configuration["PickupDefaults:BusinessTimeZone"] ?? "UTC",
                QueuePolicy = Enum.TryParse<QueuePolicy>(configuration["PickupDefaults:QueuePolicy"], out var qp)
                    ? qp
                    : QueuePolicy.FIFO,
                AxDataAreaId = configuration["PickupDefaults:AxDataAreaId"] ?? "DAT",
                PartialOrderPolicy = Enum.TryParse<PartialOrderPolicy>(configuration["PickupDefaults:PartialOrderPolicy"], out var pop)
                    ? pop
                    : PartialOrderPolicy.BLOCK_TICKET,
                CurrentSequenceDate = DateOnly.FromDateTime(DateTime.UtcNow),
                ArrivalCutoffTime = new TimeOnly(17, 0)
            });
            await db.SaveChangesAsync();
        }

        if (!seedDevelopmentUsers)
        {
            return;
        }

        var devUsers = new[]
        {
            ("commercial", "Commercial Operator", AppRoles.Commercial),
            ("reception", "Reception Operator", AppRoles.Reception),
            ("credit", "Credit Manager", AppRoles.CreditManager),
            ("warehouse", "Warehouse Operator", AppRoles.WarehouseOperator),
            ("supervisor", "Operations Supervisor", AppRoles.Supervisor),
            ("admin", "System Administrator", AppRoles.Administrator),
            ("display", "Reception Display Terminal", AppRoles.DisplayDevice)
        };

        var defaultDevPassword = configuration["DevelopmentSeedPassword"] ?? "PickupDev!2026";

        foreach (var (userName, fullName, role) in devUsers)
        {
            var existing = await userManager.FindByNameAsync(userName);
            if (existing is not null)
            {
                continue;
            }

            var user = new ApplicationUser
            {
                Id = Guid.NewGuid(),
                UserName = userName,
                Email = $"{userName}@pickup.local",
                FullName = fullName,
                WarehouseId = defaultWarehouse,
                IsActive = true,
                EmailConfirmed = true,
                CreatedAt = DateTime.UtcNow
            };

            var result = await userManager.CreateAsync(user, defaultDevPassword);
            if (result.Succeeded)
            {
                await userManager.AddToRoleAsync(user, role);
            }
        }
    }
}
