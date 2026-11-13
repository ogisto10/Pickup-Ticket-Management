using Microsoft.AspNetCore.Identity;
using Microsoft.AspNetCore.Identity.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore;
using PickupManagement.Domain.Entities;

namespace PickupManagement.Infrastructure.Persistence;

public class PickupManagementDbContext
    : IdentityDbContext<ApplicationUser, IdentityRole<Guid>, Guid>
{
    public PickupManagementDbContext(DbContextOptions<PickupManagementDbContext> options)
        : base(options)
    {
    }

    public DbSet<PickupPlan> PickupPlans => Set<PickupPlan>();
    public DbSet<PickupPlanOrder> PickupPlanOrders => Set<PickupPlanOrder>();
    public DbSet<PickupTicket> PickupTickets => Set<PickupTicket>();
    public DbSet<PickupTicketOrder> PickupTicketOrders => Set<PickupTicketOrder>();
    public DbSet<PickupWorkflowHistory> PickupWorkflowHistories => Set<PickupWorkflowHistory>();
    public DbSet<OrderWorkflowHistory> OrderWorkflowHistories => Set<OrderWorkflowHistory>();
    public DbSet<IntegrationRequest> IntegrationRequests => Set<IntegrationRequest>();
    public DbSet<IntegrationAttempt> IntegrationAttempts => Set<IntegrationAttempt>();
    public DbSet<PickupNotification> PickupNotifications => Set<PickupNotification>();
    public DbSet<PickupSettings> PickupSettings => Set<PickupSettings>();
    public DbSet<IdempotencyRecord> IdempotencyRecords => Set<IdempotencyRecord>();

    protected override void OnModelCreating(ModelBuilder builder)
    {
        base.OnModelCreating(builder);
        builder.ApplyConfigurationsFromAssembly(typeof(PickupManagementDbContext).Assembly);
    }
}
