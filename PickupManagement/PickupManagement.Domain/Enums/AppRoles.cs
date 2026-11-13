namespace PickupManagement.Domain.Enums;

public static class AppRoles
{
    public const string Commercial = "Commercial";
    public const string Reception = "Reception";
    public const string CreditManager = "CreditManager";
    public const string WarehouseOperator = "WarehouseOperator";
    public const string Supervisor = "Supervisor";
    public const string Administrator = "Administrator";
    public const string DisplayDevice = "DisplayDevice";

    public static readonly string[] All =
    [
        Commercial,
        Reception,
        CreditManager,
        WarehouseOperator,
        Supervisor,
        Administrator,
        DisplayDevice
    ];
}
