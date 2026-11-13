using PickupManagement.Domain.Enums;

namespace PickupManagement.Domain.Entities;

public class IntegrationRequest
{
    public Guid Id { get; set; }
    public string OperationKey { get; set; } = string.Empty;
    public string OperationType { get; set; } = string.Empty;
    public Guid EntityId { get; set; }
    public IntegrationRequestStatus Status { get; set; } = IntegrationRequestStatus.PENDING;
    public int AttemptCount { get; set; }
    public DateTime CreatedAt { get; set; }
    public DateTime? CompletedAt { get; set; }
    public string? LastError { get; set; }

    public ICollection<IntegrationAttempt> Attempts { get; set; } = new List<IntegrationAttempt>();
}
