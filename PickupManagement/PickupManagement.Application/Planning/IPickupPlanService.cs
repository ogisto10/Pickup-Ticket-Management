namespace PickupManagement.Application.Planning;

public interface IPickupPlanService
{
    Task<PickupPlanResponse> CreateAsync(
        CreatePickupPlanRequest request,
        CancellationToken cancellationToken = default);

    Task<IReadOnlyList<PickupPlanListItemDto>> ListByDateAsync(
        DateOnly date,
        CancellationToken cancellationToken = default);

    Task<PickupPlanListItemDto> GetByIdAsync(
        Guid id,
        CancellationToken cancellationToken = default);

    Task<PickupPlanResponse> UpdateAsync(
        Guid id,
        UpdatePickupPlanRequest request,
        CancellationToken cancellationToken = default);
}
