using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using PickupManagement.Api.Controllers;
using PickupManagement.Application.AxIntegration;
using PickupManagement.Application.Common.Exceptions;
using PickupManagement.Application.Common.Interfaces;
using PickupManagement.Application.Credit;
using PickupManagement.Application.Notifications;
using PickupManagement.Application.Planning;
using PickupManagement.Application.Warehouse;
using PickupManagement.Domain.Entities;
using PickupManagement.Domain.Enums;
using PickupManagement.Infrastructure.AxIntegration;
using PickupManagement.Infrastructure.Credit;
using PickupManagement.Infrastructure.Persistence;
using PickupManagement.Infrastructure.Planning;
using PickupManagement.Infrastructure.Warehouse;
using Xunit;

namespace PickupManagement.Tests;

public class PickupWorkflowIntegrationTests
{
    private sealed class StubCurrentUser : ICurrentUserService
    {
        public string UserId => "test-user-id";
        public string UserName => "test.operator";
        public IReadOnlyCollection<string> Roles => [AppRoles.Administrator];
        public bool IsInRole(string role) => true;
    }

    private sealed class StubClock : IDateTimeProvider
    {
        public DateTime UtcNow { get; set; } = new(2026, 11, 13, 9, 0, 0, DateTimeKind.Utc);
    }

    private sealed class NoOpNotifier : IPickupRealtimeNotifier
    {
        public Task NotifyQueueUpdatedAsync(Guid ticketId, string eventType, CancellationToken cancellationToken = default)
            => Task.CompletedTask;

        public Task NotifyPublicDisplayUpdatedAsync(CancellationToken cancellationToken = default)
            => Task.CompletedTask;
    }

    private sealed class TimeoutAxService : IAxPickupService
    {
        private readonly MockAxPickupService _inner = new();

        public Task<IReadOnlyList<AxCustomerDto>> SearchCustomersAsync(string search, string dataAreaId, CancellationToken ct = default)
            => _inner.SearchCustomersAsync(search, dataAreaId, ct);

        public Task<AxCustomerDto?> GetCustomerForPickupAsync(string customerAccount, string dataAreaId, CancellationToken ct = default)
            => _inner.GetCustomerForPickupAsync(customerAccount, dataAreaId, ct);

        public Task<IReadOnlyList<AxSalesOrderDto>> GetEligibleSalesOrdersAsync(string customerAccount, string warehouseId, string dataAreaId, CancellationToken ct = default)
            => _inner.GetEligibleSalesOrdersAsync(customerAccount, warehouseId, dataAreaId, ct);

        public Task<AxCustomerCreditInfoDto?> GetCustomerCreditInfoAsync(string customerAccount, string dataAreaId, CancellationToken ct = default)
            => _inner.GetCustomerCreditInfoAsync(customerAccount, dataAreaId, ct);

        public Task<AxOrderReleaseEligibilityDto> ValidateOrderForReleaseAsync(string salesId, string dataAreaId, CancellationToken ct = default)
            => _inner.ValidateOrderForReleaseAsync(salesId, dataAreaId, ct);

        public Task<AxReleaseResultDto> ReleaseSalesOrderForPickupAsync(string salesId, string operationKey, string dataAreaId, CancellationToken ct = default)
            => Task.FromResult(new AxReleaseResultDto(false, true, false, null, "TIMEOUT", "Simulated AIF timeout"));

        public Task<IReadOnlyList<AxOrderPickupStatusDto>> GetSalesOrderPickupStatusAsync(IReadOnlyCollection<string> salesIds, string dataAreaId, CancellationToken ct = default)
            => _inner.GetSalesOrderPickupStatusAsync(salesIds, dataAreaId, ct);

        public Task<AxIntegrationStatusDto?> GetPickupIntegrationStatusAsync(string operationKey, CancellationToken ct = default)
            => _inner.GetPickupIntegrationStatusAsync(operationKey, ct);
    }

    private static PickupManagementDbContext CreateDbContext()
    {
        var options = new DbContextOptionsBuilder<PickupManagementDbContext>()
            .UseInMemoryDatabase(Guid.NewGuid().ToString())
            .Options;

        var db = new PickupManagementDbContext(options);
        db.PickupSettings.Add(new PickupSettings
        {
            Id = Guid.NewGuid(),
            WarehouseId = "MAIN",
            TicketPrefix = "A-",
            NextDailySequence = 1,
            BusinessTimeZone = "UTC",
            QueuePolicy = QueuePolicy.FIFO,
            AxDataAreaId = "DAT",
            PartialOrderPolicy = PartialOrderPolicy.BLOCK_TICKET,
            CurrentSequenceDate = new DateOnly(2026, 11, 13)
        });
        db.SaveChanges();
        return db;
    }

    [Fact]
    public async Task CreatePlan_PreventsDuplicateActiveSalesOrder()
    {
        await using var db = CreateDbContext();
        var ax = new MockAxPickupService();
        var service = new PickupPlanService(db, ax, new StubCurrentUser(), new StubClock());

        var date = new DateOnly(2026, 11, 14);
        await service.CreateAsync(new CreatePickupPlanRequest("411-021", date, "MAIN", ["SO-001258"], null));

        await Assert.ThrowsAsync<ConflictException>(() =>
            service.CreateAsync(new CreatePickupPlanRequest("411-021", date, "MAIN", ["SO-001258", "SO-001264"], null)));
    }

    [Fact]
    public async Task CreditRelease_WhenAxTimesOut_DoesNotReportReleasedAndMarksReconciling()
    {
        await using var db = CreateDbContext();
        var planId = Guid.NewGuid();
        var planOrderId = Guid.NewGuid();
        var ticketId = Guid.NewGuid();
        var ticketOrderId = Guid.NewGuid();

        db.PickupPlans.Add(new PickupPlan
        {
            Id = planId,
            CustomerAccount = "411-021",
            CustomerNameSnapshot = "Atlas Building Supplies",
            PickupDate = new DateOnly(2026, 11, 13),
            WarehouseId = "MAIN",
            Status = PickupPlanStatus.ARRIVED,
            CreatedBy = "test",
            CreatedAt = DateTime.UtcNow,
            UpdatedAt = DateTime.UtcNow
        });
        db.PickupPlanOrders.Add(new PickupPlanOrder
        {
            Id = planOrderId,
            PickupPlanId = planId,
            DataAreaId = "DAT",
            SalesId = "SO-001258",
            AddedAt = DateTime.UtcNow,
            AddedBy = "test",
            IsActive = true
        });
        db.PickupTickets.Add(new PickupTicket
        {
            Id = ticketId,
            PickupPlanId = planId,
            TicketDate = new DateOnly(2026, 11, 13),
            DailySequence = 1,
            TicketNumber = "A-001",
            ArrivalTime = DateTime.UtcNow,
            QueueNumber = 1,
            Status = PickupTicketStatus.ARRIVED
        });
        db.PickupTicketOrders.Add(new PickupTicketOrder
        {
            Id = ticketOrderId,
            TicketId = ticketId,
            PickupPlanOrderId = planOrderId,
            DataAreaId = "DAT",
            SalesId = "SO-001258",
            Status = PickupTicketOrderStatus.PENDING_CREDIT,
            CreditStatus = OrderCreditStatus.PENDING,
            WarehouseStatus = OrderWarehouseStatus.PENDING
        });
        await db.SaveChangesAsync();

        var creditService = new CreditService(db, new TimeoutAxService(), new StubCurrentUser(), new StubClock(), new NoOpNotifier());
        var response = await creditService.RecordCreditDecisionAsync(
            ticketId,
            new CreditDecisionRequest(OrderCreditStatus.APPROVED, "Verified", [new("SO-001258", true)]));

        var orderResult = Assert.Single(response.Orders);
        Assert.Equal("RECONCILING", orderResult.ReleaseOutcome);
        Assert.Equal(PickupTicketOrderStatus.RECONCILING, orderResult.OrderStatus);
        Assert.NotEqual(PickupTicketStatus.IN_PREPARATION, response.TicketStatus);
    }

    [Fact]
    public async Task Ticket_BecomesReadyOnlyWhenAllActiveOrdersAreReady()
    {
        await using var db = CreateDbContext();
        var planId = Guid.NewGuid();
        var po1 = Guid.NewGuid();
        var po2 = Guid.NewGuid();
        var ticketId = Guid.NewGuid();
        var o1 = Guid.NewGuid();
        var o2 = Guid.NewGuid();

        db.PickupPlans.Add(new PickupPlan
        {
            Id = planId,
            CustomerAccount = "411-021",
            CustomerNameSnapshot = "Atlas Building Supplies",
            PickupDate = new DateOnly(2026, 11, 13),
            WarehouseId = "MAIN",
            Status = PickupPlanStatus.ARRIVED,
            CreatedBy = "test",
            CreatedAt = DateTime.UtcNow,
            UpdatedAt = DateTime.UtcNow
        });
        db.PickupPlanOrders.AddRange(
            new PickupPlanOrder { Id = po1, PickupPlanId = planId, DataAreaId = "DAT", SalesId = "SO-001258", AddedAt = DateTime.UtcNow, AddedBy = "test", IsActive = true },
            new PickupPlanOrder { Id = po2, PickupPlanId = planId, DataAreaId = "DAT", SalesId = "SO-001275", AddedAt = DateTime.UtcNow, AddedBy = "test", IsActive = true });
        db.PickupTickets.Add(new PickupTicket
        {
            Id = ticketId,
            PickupPlanId = planId,
            TicketDate = DateOnly.FromDateTime(DateTime.UtcNow),
            DailySequence = 1,
            TicketNumber = "A-001",
            ArrivalTime = DateTime.UtcNow,
            QueueNumber = 1,
            Status = PickupTicketStatus.IN_PREPARATION
        });
        db.PickupTicketOrders.AddRange(
            new PickupTicketOrder { Id = o1, TicketId = ticketId, PickupPlanOrderId = po1, DataAreaId = "DAT", SalesId = "SO-001258", Status = PickupTicketOrderStatus.RELEASED },
            new PickupTicketOrder { Id = o2, TicketId = ticketId, PickupPlanOrderId = po2, DataAreaId = "DAT", SalesId = "SO-001275", Status = PickupTicketOrderStatus.RELEASED });
        await db.SaveChangesAsync();

        var warehouseService = new WarehouseService(db, new MockAxPickupService(), new StubCurrentUser(), new StubClock(), new NoOpNotifier());

        var firstReady = await warehouseService.MarkOrderReadyAsync(ticketId, o1, null);
        Assert.False(firstReady.TicketReadyForCollection);
        Assert.Equal(PickupTicketStatus.IN_PREPARATION, firstReady.TicketStatus);

        var secondReady = await warehouseService.MarkOrderReadyAsync(ticketId, o2, null);
        Assert.True(secondReady.TicketReadyForCollection);
        Assert.Equal(PickupTicketStatus.READY, secondReady.TicketStatus);

        var displayController = new DisplayController(db);
        var displayAction = await displayController.GetState("MAIN", CancellationToken.None);
        var okResult = Assert.IsType<OkObjectResult>(displayAction.Result);
        var displayState = Assert.IsType<PublicDisplayStateDto>(okResult.Value);
        Assert.Equal("A-001", displayState.NowServingTicketNumber);
        Assert.Single(displayState.ReadyTickets);
    }
}
