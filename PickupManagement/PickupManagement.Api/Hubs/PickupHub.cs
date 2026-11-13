using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.SignalR;
using PickupManagement.Domain.Enums;

namespace PickupManagement.Api.Hubs;

public class PickupHub : Hub
{
    public const string PublicDisplayGroup = "public-display";
    public const string OperationsGroup = "operations";

    [AllowAnonymous]
    public async Task JoinPublicDisplay()
    {
        // Public display receives ONLY sanitized ticket numbers and pickup counter events.
        // Never broadcast customer names, account numbers, balances, or sales order details here.
        await Groups.AddToGroupAsync(Context.ConnectionId, PublicDisplayGroup);
    }

    [Authorize(Roles = $"{AppRoles.Reception},{AppRoles.CreditManager},{AppRoles.WarehouseOperator},{AppRoles.Supervisor},{AppRoles.Administrator}")]
    public async Task JoinOperations()
    {
        await Groups.AddToGroupAsync(Context.ConnectionId, OperationsGroup);
    }
}
