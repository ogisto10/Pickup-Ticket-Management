using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;
using PickupManagement.Domain.Entities;

namespace PickupManagement.Infrastructure.Persistence.Configurations;

public class IdempotencyRecordConfiguration : IEntityTypeConfiguration<IdempotencyRecord>
{
    public void Configure(EntityTypeBuilder<IdempotencyRecord> builder)
    {
        builder.ToTable("IdempotencyRecord");

        builder.HasKey(x => x.Id);

        builder.Property(x => x.Id)
            .HasColumnType("uniqueidentifier")
            .ValueGeneratedNever();

        builder.Property(x => x.IdempotencyKey)
            .HasColumnType("nvarchar(150)")
            .HasMaxLength(150)
            .IsRequired();

        builder.Property(x => x.HttpMethod)
            .HasColumnType("varchar(10)")
            .HasMaxLength(10)
            .IsRequired();

        builder.Property(x => x.RequestPath)
            .HasColumnType("nvarchar(300)")
            .HasMaxLength(300)
            .IsRequired();

        builder.Property(x => x.RequestHash)
            .HasColumnType("varchar(64)")
            .HasMaxLength(64)
            .IsRequired();

        builder.Property(x => x.StatusCode)
            .HasColumnType("int")
            .IsRequired();

        builder.Property(x => x.ResponseBody)
            .HasColumnType("nvarchar(max)")
            .IsRequired();

        builder.Property(x => x.CreatedAt)
            .HasColumnType("datetime2")
            .IsRequired();

        builder.Property(x => x.ExpiresAt)
            .HasColumnType("datetime2")
            .IsRequired();

        builder.HasIndex(x => x.IdempotencyKey)
            .IsUnique()
            .HasDatabaseName("UQ_IdempotencyRecord_IdempotencyKey");

        builder.HasIndex(x => x.ExpiresAt)
            .HasDatabaseName("IX_IdempotencyRecord_ExpiresAt");
    }
}
