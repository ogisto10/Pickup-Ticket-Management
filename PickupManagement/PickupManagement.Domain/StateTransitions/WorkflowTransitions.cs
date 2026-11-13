using PickupManagement.Domain.Enums;

namespace PickupManagement.Domain.StateTransitions;

public static class WorkflowTransitions
{
    private static readonly IReadOnlyDictionary<PickupPlanStatus, PickupPlanStatus[]> PlanTransitions =
        new Dictionary<PickupPlanStatus, PickupPlanStatus[]>
        {
            [PickupPlanStatus.PLANNED] = [PickupPlanStatus.ARRIVED, PickupPlanStatus.ABSENT, PickupPlanStatus.CANCELLED],
            [PickupPlanStatus.ARRIVED] = [PickupPlanStatus.COMPLETED, PickupPlanStatus.CANCELLED],
            [PickupPlanStatus.ABSENT] = [],
            [PickupPlanStatus.CANCELLED] = [],
            [PickupPlanStatus.COMPLETED] = []
        };

    private static readonly IReadOnlyDictionary<PickupTicketStatus, PickupTicketStatus[]> TicketTransitions =
        new Dictionary<PickupTicketStatus, PickupTicketStatus[]>
        {
            [PickupTicketStatus.ARRIVED] = [PickupTicketStatus.APPROVED, PickupTicketStatus.ON_HOLD, PickupTicketStatus.REJECTED, PickupTicketStatus.IN_PREPARATION, PickupTicketStatus.CANCELLED],
            [PickupTicketStatus.ON_HOLD] = [PickupTicketStatus.APPROVED, PickupTicketStatus.REJECTED, PickupTicketStatus.IN_PREPARATION, PickupTicketStatus.CANCELLED],
            [PickupTicketStatus.REJECTED] = [PickupTicketStatus.APPROVED, PickupTicketStatus.ON_HOLD, PickupTicketStatus.CANCELLED],
            [PickupTicketStatus.APPROVED] = [PickupTicketStatus.IN_PREPARATION, PickupTicketStatus.READY, PickupTicketStatus.ON_HOLD, PickupTicketStatus.CANCELLED],
            [PickupTicketStatus.IN_PREPARATION] = [PickupTicketStatus.READY, PickupTicketStatus.ON_HOLD, PickupTicketStatus.CANCELLED],
            [PickupTicketStatus.READY] = [PickupTicketStatus.COLLECTED, PickupTicketStatus.IN_PREPARATION],
            [PickupTicketStatus.COLLECTED] = [],
            [PickupTicketStatus.CANCELLED] = []
        };

    private static readonly IReadOnlyDictionary<PickupTicketOrderStatus, PickupTicketOrderStatus[]> OrderTransitions =
        new Dictionary<PickupTicketOrderStatus, PickupTicketOrderStatus[]>
        {
            [PickupTicketOrderStatus.PENDING_CREDIT] = [PickupTicketOrderStatus.RELEASE_PENDING, PickupTicketOrderStatus.BLOCKED, PickupTicketOrderStatus.CANCELLED],
            [PickupTicketOrderStatus.RELEASE_PENDING] = [PickupTicketOrderStatus.RELEASED, PickupTicketOrderStatus.RECONCILING, PickupTicketOrderStatus.BLOCKED, PickupTicketOrderStatus.CANCELLED],
            [PickupTicketOrderStatus.RECONCILING] = [PickupTicketOrderStatus.RELEASED, PickupTicketOrderStatus.BLOCKED, PickupTicketOrderStatus.RELEASE_PENDING, PickupTicketOrderStatus.CANCELLED],
            [PickupTicketOrderStatus.RELEASED] = [PickupTicketOrderStatus.IN_PREPARATION, PickupTicketOrderStatus.READY, PickupTicketOrderStatus.BLOCKED, PickupTicketOrderStatus.CANCELLED],
            [PickupTicketOrderStatus.IN_PREPARATION] = [PickupTicketOrderStatus.READY, PickupTicketOrderStatus.BLOCKED, PickupTicketOrderStatus.CANCELLED],
            [PickupTicketOrderStatus.READY] = [PickupTicketOrderStatus.COLLECTED, PickupTicketOrderStatus.IN_PREPARATION, PickupTicketOrderStatus.BLOCKED],
            [PickupTicketOrderStatus.BLOCKED] = [PickupTicketOrderStatus.PENDING_CREDIT, PickupTicketOrderStatus.RELEASE_PENDING, PickupTicketOrderStatus.CANCELLED],
            [PickupTicketOrderStatus.CANCELLED] = [],
            [PickupTicketOrderStatus.COLLECTED] = []
        };

    public static bool CanTransition(PickupPlanStatus from, PickupPlanStatus to)
        => PlanTransitions.TryGetValue(from, out var allowed) && allowed.Contains(to);

    public static bool CanTransition(PickupTicketStatus from, PickupTicketStatus to)
        => TicketTransitions.TryGetValue(from, out var allowed) && allowed.Contains(to);

    public static bool CanTransition(PickupTicketOrderStatus from, PickupTicketOrderStatus to)
        => OrderTransitions.TryGetValue(from, out var allowed) && allowed.Contains(to);
}
