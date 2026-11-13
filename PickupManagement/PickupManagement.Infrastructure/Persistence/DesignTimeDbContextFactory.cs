using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Design;
using Microsoft.Extensions.Configuration;

namespace PickupManagement.Infrastructure.Persistence;

public class DesignTimeDbContextFactory : IDesignTimeDbContextFactory<PickupManagementDbContext>
{
    public PickupManagementDbContext CreateDbContext(string[] args)
    {
        var basePath = Directory.GetCurrentDirectory();
        var apiPath = Path.GetFullPath(Path.Combine(basePath, "..", "PickupManagement.Api"));

        var configuration = new ConfigurationBuilder()
            .SetBasePath(Directory.Exists(apiPath) ? apiPath : basePath)
            .AddJsonFile("appsettings.json", optional: true)
            .AddJsonFile("appsettings.Development.json", optional: true)
            .AddEnvironmentVariables()
            .Build();

        var connectionString = configuration.GetConnectionString("DefaultConnection")
            ?? "Server=localhost;Database=PickupManagementDB;Trusted_Connection=True;TrustServerCertificate=True;MultipleActiveResultSets=True";

        var optionsBuilder = new DbContextOptionsBuilder<PickupManagementDbContext>();
        optionsBuilder.UseSqlServer(connectionString, sql =>
        {
            sql.MigrationsAssembly(typeof(PickupManagementDbContext).Assembly.FullName);
        });

        return new PickupManagementDbContext(optionsBuilder.Options);
    }
}
