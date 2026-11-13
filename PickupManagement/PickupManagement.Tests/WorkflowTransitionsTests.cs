using PickupManagement.Domain.Enums;
using PickupManagement.Domain.StateTransitions;
using Xunit;

namespace PickupManagement.Tests;

public class WorkflowTransitionsTests
{
    [Fact]
    public void Plan_CannotTransitionFromCompletedToArrived()
    {
        Assert.False(WorkflowTransitions.CanTransition(PickupPlanStatus.COMPLETED, PickupPlanStatus.ARRIVED));
        Assert.True(WorkflowTransitions.CanTransition(PickupPlanStatus.PLANNED, PickupPlanStatus.ARRIVED));
    }

    [Fact]
    public void Ticket_ReadyOnlyTransitionsToCollectedOrInPreparation()
    {
        Assert.True(WorkflowTransitions.CanTransition(PickupTicketStatus.READY, PickupTicketStatus.COLLECTED));
        Assert.False(WorkflowTransitions.CanTransition(PickupTicketStatus.COLLECTED, PickupTicketStatus.READY));
    }

    [Fact]
    public void Order_PendingCreditCannotJumpDirectlyToReady()
    {
        Assert.False(WorkflowTransitions.CanTransition(PickupTicketOrderStatus.PENDING_CREDIT, PickupTicketOrderStatus.READY));
        Assert.True(WorkflowTransitions.CanTransition(PickupTicketOrderStatus.RELEASED, PickupTicketOrderStatus.IN_PREPARATION));
    }
}
