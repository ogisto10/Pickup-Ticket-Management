namespace PickupManagement.Domain.Enums;

public enum IntegrationRequestStatus
{
    PENDING,
    IN_PROGRESS,
    SUCCEEDED,
    RECONCILING,
    FAILED_BUSINESS,
    FAILED_TECHNICAL
}

public enum IntegrationAttemptOutcome
{
    SUCCEEDED,
    TIMEOUT,
    BUSINESS_ERROR,
    TECHNICAL_ERROR
}
