using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;
using PickupManagement.Domain.Entities;

namespace PickupManagement.Infrastructure.Persistence.Configurations;

public class PickupTicketConfiguration : IEntityTypeConfiguration<PickupTicket>
{
    public void Configure(EntityTypeBuilder<PickupTicket> builder)
    {
        builder.ToTable("PickupTicket");

        builder.HasKey(x => x.Id);

        builder.Property(x => x.Id)
            .HasColumnType("uniqueidentifier")
            .ValueGeneratedNever();

        builder.Property(x => x.PickupPlanId)
            .HasColumnType("uniqueidentifier")
            .IsRequired();

        builder.Property(x => x.TicketDate)
            .HasColumnType("date")
            .IsRequired();

        builder.Property(x => x.DailySequence)
            .HasColumnType("int")
            .IsRequired();

        builder.Property(x => x.TicketNumber)
            .HasColumnType("nvarchar(20)")
            .HasMaxLength(20)
            .IsRequired();

        builder.Property(x => x.ArrivalTime)
            .HasColumnType("datetime2")
            .IsRequired();

        builder.Property(x => x.QueueNumber)
            .HasColumnType("int")
            .IsRequired();

        builder.Property(x => x.Status)
            .HasColumnType("varchar(30)")
            .HasMaxLength(30)
            .HasConversion<string>()
            .IsRequired();

        builder.Property(x => x.CreditDecisionBy)
            .HasColumnType("nvarchar(100)")
            .HasMaxLength(100);

        builder.Property(x => x.CreditDecisionAt)
            .HasColumnType("datetime2");

        builder.Property(x => x.CreditComment)
            .HasColumnType("nvarchar(500)")
            .HasMaxLength(500);

        builder.Property(x => x.ReadyAt)
            .HasColumnType("datetime2");

        builder.Property(x => x.CollectedAt)
            .HasColumnType("datetime2");

        builder.Property(x => x.RowVersion)
            .IsRowVersion()
            .IsConcurrencyToken();

        builder.HasOne(x => x.PickupPlan)
            .WithOne(p => p.Ticket)
            .HasForeignKey<PickupTicket>(x => x.PickupPlanId)
            .OnDelete(DeleteBehavior.Restrict);

        builder.HasIndex(x => x.PickupPlanId)
            .IsUnique()
            .HasDatabaseName("UQ_PickupTicket_PickupPlanId");

        builder.HasIndex(x => new { x.TicketDate, x.DailySequence })
            .IsUnique()
            .HasDatabaseName("UQ_PickupTicket_TicketDate_DailySequence");

        builder.HasIndex(x => new { x.TicketDate, x.TicketNumber })
            .IsUnique()
            .HasDatabaseName("UQ_PickupTicket_TicketDate_TicketNumber");

        builder.HasIndex(x => new { x.TicketDate, x.Status, x.QueueNumber })
            .HasDatabaseName("IX_PickupTicket_TicketDate_Status_QueueNumber");
    }
}
