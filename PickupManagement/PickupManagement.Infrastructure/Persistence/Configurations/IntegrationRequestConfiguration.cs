using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;
using PickupManagement.Domain.Entities;

namespace PickupManagement.Infrastructure.Persistence.Configurations;

public class IntegrationRequestConfiguration : IEntityTypeConfiguration<IntegrationRequest>
{
    public void Configure(EntityTypeBuilder<IntegrationRequest> builder)
    {
        builder.ToTable("IntegrationRequest");

        builder.HasKey(x => x.Id);

        builder.Property(x => x.Id)
            .HasColumnType("uniqueidentifier")
            .ValueGeneratedNever();

        builder.Property(x => x.OperationKey)
            .HasColumnType("nvarchar(150)")
            .HasMaxLength(150)
            .IsRequired();

        builder.Property(x => x.OperationType)
            .HasColumnType("varchar(50)")
            .HasMaxLength(50)
            .IsRequired();

        builder.Property(x => x.EntityId)
            .HasColumnType("uniqueidentifier")
            .IsRequired();

        builder.Property(x => x.Status)
            .HasColumnType("varchar(30)")
            .HasMaxLength(30)
            .HasConversion<string>()
            .IsRequired();

        builder.Property(x => x.AttemptCount)
            .HasColumnType("int")
            .IsRequired();

        builder.Property(x => x.CreatedAt)
            .HasColumnType("datetime2")
            .IsRequired();

        builder.Property(x => x.CompletedAt)
            .HasColumnType("datetime2");

        builder.Property(x => x.LastError)
            .HasColumnType("nvarchar(1000)")
            .HasMaxLength(1000);

        builder.HasIndex(x => x.OperationKey)
            .IsUnique()
            .HasDatabaseName("UQ_IntegrationRequest_OperationKey");

        builder.HasIndex(x => new { x.Status, x.CreatedAt })
            .HasDatabaseName("IX_IntegrationRequest_Status_CreatedAt");
    }
}
