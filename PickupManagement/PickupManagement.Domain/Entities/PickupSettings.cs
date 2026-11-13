using PickupManagement.Domain.Enums;

namespace PickupManagement.Domain.Entities;

public class PickupSettings
{
    public Guid Id { get; set; }
    public string WarehouseId { get; set; } = string.Empty;
    public string TicketPrefix { get; set; } = "A-";
    public int NextDailySequence { get; set; } = 1;
    public string BusinessTimeZone { get; set; } = "UTC";
    public QueuePolicy QueuePolicy { get; set; } = QueuePolicy.FIFO;

    // Configurable operational policies (section 6.3, 8, and rule 10)
    public string AxDataAreaId { get; set; } = "DAT";
    public PartialOrderPolicy PartialOrderPolicy { get; set; } = PartialOrderPolicy.BLOCK_TICKET;
    public DateOnly? CurrentSequenceDate { get; set; }
    public TimeOnly? ArrivalCutoffTime { get; set; }
}
