using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;
using PickupManagement.Domain.Entities;

namespace PickupManagement.Infrastructure.Persistence.Configurations;

public class OrderWorkflowHistoryConfiguration : IEntityTypeConfiguration<OrderWorkflowHistory>
{
    public void Configure(EntityTypeBuilder<OrderWorkflowHistory> builder)
    {
        builder.ToTable("OrderWorkflowHistory");

        builder.HasKey(x => x.Id);

        builder.Property(x => x.Id)
            .HasColumnType("bigint")
            .UseIdentityColumn();

        builder.Property(x => x.TicketOrderId)
            .HasColumnType("uniqueidentifier")
            .IsRequired();

        builder.Property(x => x.OldStatus)
            .HasColumnType("varchar(30)")
            .HasMaxLength(30);

        builder.Property(x => x.NewStatus)
            .HasColumnType("varchar(30)")
            .HasMaxLength(30)
            .IsRequired();

        builder.Property(x => x.Action)
            .HasColumnType("varchar(50)")
            .HasMaxLength(50)
            .IsRequired();

        builder.Property(x => x.Comment)
            .HasColumnType("nvarchar(500)")
            .HasMaxLength(500);

        builder.Property(x => x.UserId)
            .HasColumnType("nvarchar(100)")
            .HasMaxLength(100)
            .IsRequired();

        builder.Property(x => x.OccurredAt)
            .HasColumnType("datetime2")
            .IsRequired();

        builder.Property(x => x.CorrelationId)
            .HasColumnType("uniqueidentifier")
            .IsRequired();

        builder.HasOne(x => x.TicketOrder)
            .WithMany(o => o.WorkflowHistory)
            .HasForeignKey(x => x.TicketOrderId)
            .OnDelete(DeleteBehavior.Cascade);

        builder.HasIndex(x => new { x.TicketOrderId, x.OccurredAt })
            .HasDatabaseName("IX_OrderWorkflowHistory_TicketOrderId_OccurredAt");
    }
}
