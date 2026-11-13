using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;
using PickupManagement.Domain.Entities;

namespace PickupManagement.Infrastructure.Persistence.Configurations;

public class PickupPlanConfiguration : IEntityTypeConfiguration<PickupPlan>
{
    public void Configure(EntityTypeBuilder<PickupPlan> builder)
    {
        builder.ToTable("PickupPlan");

        builder.HasKey(x => x.Id);

        builder.Property(x => x.Id)
            .HasColumnType("uniqueidentifier")
            .ValueGeneratedNever();

        builder.Property(x => x.CustomerAccount)
            .HasColumnType("nvarchar(20)")
            .HasMaxLength(20)
            .IsRequired();

        builder.Property(x => x.CustomerNameSnapshot)
            .HasColumnType("nvarchar(150)")
            .HasMaxLength(150)
            .IsRequired();

        builder.Property(x => x.PickupDate)
            .HasColumnType("date")
            .IsRequired();

        builder.Property(x => x.WarehouseId)
            .HasColumnType("nvarchar(20)")
            .HasMaxLength(20)
            .IsRequired();

        builder.Property(x => x.Status)
            .HasColumnType("varchar(20)")
            .HasMaxLength(20)
            .HasConversion<string>()
            .IsRequired();

        builder.Property(x => x.Notes)
            .HasColumnType("nvarchar(500)")
            .HasMaxLength(500);

        builder.Property(x => x.CreatedBy)
            .HasColumnType("nvarchar(100)")
            .HasMaxLength(100)
            .IsRequired();

        builder.Property(x => x.CreatedAt)
            .HasColumnType("datetime2")
            .IsRequired();

        builder.Property(x => x.UpdatedAt)
            .HasColumnType("datetime2")
            .IsRequired();

        builder.HasIndex(x => new { x.PickupDate, x.Status })
            .HasDatabaseName("IX_PickupPlan_PickupDate_Status");
    }
}
