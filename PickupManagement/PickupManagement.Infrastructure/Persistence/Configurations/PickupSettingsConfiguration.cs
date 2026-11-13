using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;
using PickupManagement.Domain.Entities;

namespace PickupManagement.Infrastructure.Persistence.Configurations;

public class PickupSettingsConfiguration : IEntityTypeConfiguration<PickupSettings>
{
    public void Configure(EntityTypeBuilder<PickupSettings> builder)
    {
        builder.ToTable("PickupSettings");

        builder.HasKey(x => x.Id);

        builder.Property(x => x.Id)
            .HasColumnType("uniqueidentifier")
            .ValueGeneratedNever();

        builder.Property(x => x.WarehouseId)
            .HasColumnType("nvarchar(20)")
            .HasMaxLength(20)
            .IsRequired();

        builder.Property(x => x.TicketPrefix)
            .HasColumnType("nvarchar(10)")
            .HasMaxLength(10)
            .IsRequired();

        builder.Property(x => x.NextDailySequence)
            .HasColumnType("int")
            .IsRequired();

        builder.Property(x => x.BusinessTimeZone)
            .HasColumnType("nvarchar(100)")
            .HasMaxLength(100)
            .IsRequired();

        builder.Property(x => x.QueuePolicy)
            .HasColumnType("varchar(30)")
            .HasMaxLength(30)
            .HasConversion<string>()
            .IsRequired();

        builder.Property(x => x.AxDataAreaId)
            .HasColumnType("nvarchar(4)")
            .HasMaxLength(4)
            .IsRequired();

        builder.Property(x => x.PartialOrderPolicy)
            .HasColumnType("varchar(30)")
            .HasMaxLength(30)
            .HasConversion<string>()
            .IsRequired();

        builder.Property(x => x.CurrentSequenceDate)
            .HasColumnType("date");

        builder.Property(x => x.ArrivalCutoffTime)
            .HasColumnType("time(0)");

        builder.HasIndex(x => x.WarehouseId)
            .IsUnique()
            .HasDatabaseName("UQ_PickupSettings_WarehouseId");
    }
}
