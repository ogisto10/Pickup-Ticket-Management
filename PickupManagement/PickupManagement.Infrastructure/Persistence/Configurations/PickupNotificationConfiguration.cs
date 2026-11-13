using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;
using PickupManagement.Domain.Entities;

namespace PickupManagement.Infrastructure.Persistence.Configurations;

public class PickupNotificationConfiguration : IEntityTypeConfiguration<PickupNotification>
{
    public void Configure(EntityTypeBuilder<PickupNotification> builder)
    {
        builder.ToTable("PickupNotification");

        builder.HasKey(x => x.Id);

        builder.Property(x => x.Id)
            .HasColumnType("uniqueidentifier")
            .ValueGeneratedNever();

        builder.Property(x => x.TicketId)
            .HasColumnType("uniqueidentifier")
            .IsRequired();

        builder.Property(x => x.TicketNumber)
            .HasColumnType("nvarchar(20)")
            .HasMaxLength(20)
            .IsRequired();

        builder.Property(x => x.DisplayEventType)
            .HasColumnType("varchar(30)")
            .HasMaxLength(30)
            .HasConversion<string>()
            .IsRequired();

        builder.Property(x => x.CreatedAt)
            .HasColumnType("datetime2")
            .IsRequired();

        builder.Property(x => x.PublishedAt)
            .HasColumnType("datetime2");

        builder.Property(x => x.Status)
            .HasColumnType("varchar(20)")
            .HasMaxLength(20)
            .HasConversion<string>()
            .IsRequired();

        builder.HasOne(x => x.Ticket)
            .WithMany(t => t.Notifications)
            .HasForeignKey(x => x.TicketId)
            .OnDelete(DeleteBehavior.Cascade);

        builder.HasIndex(x => new { x.Status, x.CreatedAt })
            .HasDatabaseName("IX_PickupNotification_Status_CreatedAt");
    }
}
