using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;
using PickupManagement.Domain.Entities;

namespace PickupManagement.Infrastructure.Persistence.Configurations;

public class PickupPlanOrderConfiguration : IEntityTypeConfiguration<PickupPlanOrder>
{
    public void Configure(EntityTypeBuilder<PickupPlanOrder> builder)
    {
        builder.ToTable("PickupPlanOrder");

        builder.HasKey(x => x.Id);

        builder.Property(x => x.Id)
            .HasColumnType("uniqueidentifier")
            .ValueGeneratedNever();

        builder.Property(x => x.PickupPlanId)
            .HasColumnType("uniqueidentifier")
            .IsRequired();

        builder.Property(x => x.DataAreaId)
            .HasColumnType("nvarchar(4)")
            .HasMaxLength(4)
            .IsRequired();

        builder.Property(x => x.SalesId)
            .HasColumnType("nvarchar(20)")
            .HasMaxLength(20)
            .IsRequired();

        builder.Property(x => x.OrderStatusSnapshot)
            .HasColumnType("nvarchar(30)")
            .HasMaxLength(30);

        builder.Property(x => x.AddedAt)
            .HasColumnType("datetime2")
            .IsRequired();

        builder.Property(x => x.AddedBy)
            .HasColumnType("nvarchar(100)")
            .HasMaxLength(100)
            .IsRequired();

        builder.Property(x => x.IsActive)
            .HasColumnType("bit")
            .HasDefaultValue(true)
            .IsRequired();

        builder.HasOne(x => x.PickupPlan)
            .WithMany(p => p.Orders)
            .HasForeignKey(x => x.PickupPlanId)
            .OnDelete(DeleteBehavior.Cascade);

        builder.HasIndex(x => new { x.PickupPlanId, x.DataAreaId, x.SalesId })
            .IsUnique()
            .HasDatabaseName("UQ_PickupPlanOrder_PickupPlanId_DataAreaId_SalesId");

        // Enforces section 3.3 planning rule at DB level:
        // a sales order cannot be assigned to two active pickup plans for the same company.
        builder.HasIndex(x => new { x.DataAreaId, x.SalesId })
            .IsUnique()
            .HasFilter("[IsActive] = 1")
            .HasDatabaseName("UX_PickupPlanOrder_ActiveSalesOrder");
    }
}
