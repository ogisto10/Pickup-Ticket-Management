using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;
using PickupManagement.Domain.Entities;

namespace PickupManagement.Infrastructure.Persistence.Configurations;

public class PickupWorkflowHistoryConfiguration : IEntityTypeConfiguration<PickupWorkflowHistory>
{
    public void Configure(EntityTypeBuilder<PickupWorkflowHistory> builder)
    {
        builder.ToTable("PickupWorkflowHistory");

        builder.HasKey(x => x.Id);

        builder.Property(x => x.Id)
            .HasColumnType("bigint")
            .UseIdentityColumn();

        builder.Property(x => x.TicketId)
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

        builder.HasOne(x => x.Ticket)
            .WithMany(t => t.WorkflowHistory)
            .HasForeignKey(x => x.TicketId)
            .OnDelete(DeleteBehavior.Cascade);

        builder.HasIndex(x => new { x.TicketId, x.OccurredAt })
            .HasDatabaseName("IX_PickupWorkflowHistory_TicketId_OccurredAt");
    }
}
