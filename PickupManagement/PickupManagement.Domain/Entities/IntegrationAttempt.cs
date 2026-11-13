using PickupManagement.Domain.Enums;

namespace PickupManagement.Domain.Entities;

public class IntegrationAttempt
{
    public Guid Id { get; set; }
    public Guid IntegrationRequestId { get; set; }
    public DateTime StartedAt { get; set; }
    public DateTime? FinishedAt { get; set; }
    public IntegrationAttemptOutcome Outcome { get; set; }
    public string? ErrorCode { get; set; }
    public string? ErrorMessage { get; set; }

    public IntegrationRequest IntegrationRequest { get; set; } = null!;
}
