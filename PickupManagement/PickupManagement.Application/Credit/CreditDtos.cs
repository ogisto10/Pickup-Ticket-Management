using PickupManagement.Application.AxIntegration;
using PickupManagement.Application.Reception;
using PickupManagement.Domain.Enums;

namespace PickupManagement.Application.Credit;

public record CreditOrderDecisionInput(
    string SalesId,
    bool ApproveForRelease);

public record CreditDecisionRequest(
    OrderCreditStatus Decision,
    string? Comment,
    IReadOnlyList<CreditOrderDecisionInput>? Orders);

public record CreditOrderResultDto(
    Guid OrderId,
    string SalesId,
    OrderCreditStatus CreditStatus,
    PickupTicketOrderStatus OrderStatus,
    string ReleaseOutcome, // APPROVED, RELEASE_PENDING, RECONCILING, RELEASED, BLOCKED, REJECTED, ON_HOLD
    string? AxReference,
    string? ErrorMessage);

public record CreditDecisionResponse(
    Guid TicketId,
    string TicketNumber,
    PickupTicketStatus TicketStatus,
    OrderCreditStatus Decision,
    string? Comment,
    IReadOnlyList<CreditOrderResultDto> Orders);

public record CreditOrderContextDto(
    Guid OrderId,
    string DataAreaId,
    string SalesId,
    PickupTicketOrderStatus Status,
    OrderCreditStatus CreditStatus,
    bool IsEligible,
    bool IsAlreadyReleased,
    bool IsCancelled,
    string AxStatus,
    string EligibilityLabel,
    string? BlockingReason,
    DateTime? LastAxSyncAt);

public record TicketCreditContextDto(
    TicketDetailDto Ticket,
    AxCustomerCreditInfoDto? CustomerCredit,
    IReadOnlyList<CreditOrderContextDto> Orders);
