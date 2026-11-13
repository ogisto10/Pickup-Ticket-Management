using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;
using PickupManagement.Domain.Entities;

namespace PickupManagement.Infrastructure.Persistence.Configurations;

public class PickupTicketOrderConfiguration : IEntityTypeConfiguration<PickupTicketOrder>
{
    public void Configure(EntityTypeBuilder<PickupTicketOrder> builder)
    {
        builder.ToTable("PickupTicketOrder");

        builder.HasKey(x => x.Id);

        builder.Property(x => x.Id)
            .HasColumnType("uniqueidentifier")
            .ValueGeneratedNever();

        builder.Property(x => x.TicketId)
            .HasColumnType("uniqueidentifier")
            .IsRequired();

        builder.Property(x => x.PickupPlanOrderId)
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

        builder.Property(x => x.Status)
            .HasColumnType("varchar(30)")
            .HasMaxLength(30)
            .HasConversion<string>()
            .IsRequired();

        builder.Property(x => x.CreditStatus)
            .HasColumnType("varchar(20)")
            .HasMaxLength(20)
            .HasConversion<string>()
            .IsRequired();

        builder.Property(x => x.WarehouseStatus)
            .HasColumnType("varchar(20)")
            .HasMaxLength(20)
            .HasConversion<string>()
            .IsRequired();

        builder.Property(x => x.LastAxSyncAt)
            .HasColumnType("datetime2");

        builder.Property(x => x.RowVersion)
            .IsRowVersion()
            .IsConcurrencyToken();

        builder.HasOne(x => x.Ticket)
            .WithMany(t => t.Orders)
            .HasForeignKey(x => x.TicketId)
            .OnDelete(DeleteBehavior.Cascade);

        builder.HasOne(x => x.PickupPlanOrder)
            .WithOne(po => po.TicketOrder)
            .HasForeignKey<PickupTicketOrder>(x => x.PickupPlanOrderId)
            .OnDelete(DeleteBehavior.Restrict);

        builder.HasIndex(x => x.PickupPlanOrderId)
            .IsUnique()
            .HasDatabaseName("UQ_PickupTicketOrder_PickupPlanOrderId");

        builder.HasIndex(x => new { x.TicketId, x.DataAreaId, x.SalesId })
            .IsUnique()
            .HasDatabaseName("UQ_PickupTicketOrder_TicketId_DataAreaId_SalesId");

        builder.HasIndex(x => new { x.TicketId, x.Status })
            .HasDatabaseName("IX_PickupTicketOrder_TicketId_Status");
    }
}
