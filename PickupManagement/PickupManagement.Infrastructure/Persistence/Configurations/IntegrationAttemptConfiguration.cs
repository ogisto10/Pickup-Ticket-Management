using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;
using PickupManagement.Domain.Entities;

namespace PickupManagement.Infrastructure.Persistence.Configurations;

public class IntegrationAttemptConfiguration : IEntityTypeConfiguration<IntegrationAttempt>
{
    public void Configure(EntityTypeBuilder<IntegrationAttempt> builder)
    {
        builder.ToTable("IntegrationAttempt");

        builder.HasKey(x => x.Id);

        builder.Property(x => x.Id)
            .HasColumnType("uniqueidentifier")
            .ValueGeneratedNever();

        builder.Property(x => x.IntegrationRequestId)
            .HasColumnType("uniqueidentifier")
            .IsRequired();

        builder.Property(x => x.StartedAt)
            .HasColumnType("datetime2")
            .IsRequired();

        builder.Property(x => x.FinishedAt)
            .HasColumnType("datetime2");

        builder.Property(x => x.Outcome)
            .HasColumnType("varchar(30)")
            .HasMaxLength(30)
            .HasConversion<string>()
            .IsRequired();

        builder.Property(x => x.ErrorCode)
            .HasColumnType("nvarchar(50)")
            .HasMaxLength(50);

        builder.Property(x => x.ErrorMessage)
            .HasColumnType("nvarchar(1000)")
            .HasMaxLength(1000);

        builder.HasOne(x => x.IntegrationRequest)
            .WithMany(r => r.Attempts)
            .HasForeignKey(x => x.IntegrationRequestId)
            .OnDelete(DeleteBehavior.Cascade);

        builder.HasIndex(x => new { x.IntegrationRequestId, x.StartedAt })
            .HasDatabaseName("IX_IntegrationAttempt_IntegrationRequestId_StartedAt");
    }
}
