namespace PickupManagement.Infrastructure.AxIntegration;

public class AxAifOptions
{
    public const string SectionName = "AxAif";

    public string ServiceGroupName { get; set; } = "DOSI_PickupManagementServiceGroup";
    public string EndpointUrl { get; set; } = "net.tcp://ax-aos:8201/DynamicsAx/Services/DOSI_PickupManagementServiceGroup";
    public string DefaultDataAreaId { get; set; } = "DAT";
    public string ReleaseClassName { get; set; } = "CONFIGURABLE_PENDING_AX_AUDIT";
    public int TimeoutSeconds { get; set; } = 30;
}
