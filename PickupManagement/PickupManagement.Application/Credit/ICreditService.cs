namespace PickupManagement.Application.Credit;

public interface ICreditService
{
    Task<TicketCreditContextDto> GetCreditContextAsync(
        Guid ticketId,
        CancellationToken cancellationToken = default);

    Task<CreditDecisionResponse> RecordCreditDecisionAsync(
        Guid ticketId,
        CreditDecisionRequest request,
        CancellationToken cancellationToken = default);

    Task<CreditOrderResultDto> ReleaseOrderAsync(
        Guid ticketId,
        Guid orderId,
        CancellationToken cancellationToken = default);
}
