using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace PickupManagement.Infrastructure.Persistence.Migrations
{
    /// <inheritdoc />
    public partial class InitialCreate : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.CreateTable(
                name: "AspNetRoles",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    Name = table.Column<string>(type: "nvarchar(256)", maxLength: 256, nullable: true),
                    NormalizedName = table.Column<string>(type: "nvarchar(256)", maxLength: 256, nullable: true),
                    ConcurrencyStamp = table.Column<string>(type: "nvarchar(max)", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_AspNetRoles", x => x.Id);
                });

            migrationBuilder.CreateTable(
                name: "AspNetUsers",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    FullName = table.Column<string>(type: "nvarchar(max)", nullable: false),
                    WarehouseId = table.Column<string>(type: "nvarchar(max)", nullable: true),
                    IsActive = table.Column<bool>(type: "bit", nullable: false),
                    CreatedAt = table.Column<DateTime>(type: "datetime2", nullable: false),
                    UserName = table.Column<string>(type: "nvarchar(256)", maxLength: 256, nullable: true),
                    NormalizedUserName = table.Column<string>(type: "nvarchar(256)", maxLength: 256, nullable: true),
                    Email = table.Column<string>(type: "nvarchar(256)", maxLength: 256, nullable: true),
                    NormalizedEmail = table.Column<string>(type: "nvarchar(256)", maxLength: 256, nullable: true),
                    EmailConfirmed = table.Column<bool>(type: "bit", nullable: false),
                    PasswordHash = table.Column<string>(type: "nvarchar(max)", nullable: true),
                    SecurityStamp = table.Column<string>(type: "nvarchar(max)", nullable: true),
                    ConcurrencyStamp = table.Column<string>(type: "nvarchar(max)", nullable: true),
                    PhoneNumber = table.Column<string>(type: "nvarchar(max)", nullable: true),
                    PhoneNumberConfirmed = table.Column<bool>(type: "bit", nullable: false),
                    TwoFactorEnabled = table.Column<bool>(type: "bit", nullable: false),
                    LockoutEnd = table.Column<DateTimeOffset>(type: "datetimeoffset", nullable: true),
                    LockoutEnabled = table.Column<bool>(type: "bit", nullable: false),
                    AccessFailedCount = table.Column<int>(type: "int", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_AspNetUsers", x => x.Id);
                });

            migrationBuilder.CreateTable(
                name: "IdempotencyRecord",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    IdempotencyKey = table.Column<string>(type: "nvarchar(150)", maxLength: 150, nullable: false),
                    HttpMethod = table.Column<string>(type: "varchar(10)", maxLength: 10, nullable: false),
                    RequestPath = table.Column<string>(type: "nvarchar(300)", maxLength: 300, nullable: false),
                    RequestHash = table.Column<string>(type: "varchar(64)", maxLength: 64, nullable: false),
                    StatusCode = table.Column<int>(type: "int", nullable: false),
                    ResponseBody = table.Column<string>(type: "nvarchar(max)", nullable: false),
                    CreatedAt = table.Column<DateTime>(type: "datetime2", nullable: false),
                    ExpiresAt = table.Column<DateTime>(type: "datetime2", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_IdempotencyRecord", x => x.Id);
                });

            migrationBuilder.CreateTable(
                name: "IntegrationRequest",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    OperationKey = table.Column<string>(type: "nvarchar(150)", maxLength: 150, nullable: false),
                    OperationType = table.Column<string>(type: "varchar(50)", maxLength: 50, nullable: false),
                    EntityId = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    Status = table.Column<string>(type: "varchar(30)", maxLength: 30, nullable: false),
                    AttemptCount = table.Column<int>(type: "int", nullable: false),
                    CreatedAt = table.Column<DateTime>(type: "datetime2", nullable: false),
                    CompletedAt = table.Column<DateTime>(type: "datetime2", nullable: true),
                    LastError = table.Column<string>(type: "nvarchar(1000)", maxLength: 1000, nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_IntegrationRequest", x => x.Id);
                });

            migrationBuilder.CreateTable(
                name: "PickupPlan",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    CustomerAccount = table.Column<string>(type: "nvarchar(20)", maxLength: 20, nullable: false),
                    CustomerNameSnapshot = table.Column<string>(type: "nvarchar(150)", maxLength: 150, nullable: false),
                    PickupDate = table.Column<DateOnly>(type: "date", nullable: false),
                    WarehouseId = table.Column<string>(type: "nvarchar(20)", maxLength: 20, nullable: false),
                    Status = table.Column<string>(type: "varchar(20)", maxLength: 20, nullable: false),
                    Notes = table.Column<string>(type: "nvarchar(500)", maxLength: 500, nullable: true),
                    CreatedBy = table.Column<string>(type: "nvarchar(100)", maxLength: 100, nullable: false),
                    CreatedAt = table.Column<DateTime>(type: "datetime2", nullable: false),
                    UpdatedAt = table.Column<DateTime>(type: "datetime2", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_PickupPlan", x => x.Id);
                });

            migrationBuilder.CreateTable(
                name: "PickupSettings",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    WarehouseId = table.Column<string>(type: "nvarchar(20)", maxLength: 20, nullable: false),
                    TicketPrefix = table.Column<string>(type: "nvarchar(10)", maxLength: 10, nullable: false),
                    NextDailySequence = table.Column<int>(type: "int", nullable: false),
                    BusinessTimeZone = table.Column<string>(type: "nvarchar(100)", maxLength: 100, nullable: false),
                    QueuePolicy = table.Column<string>(type: "varchar(30)", maxLength: 30, nullable: false),
                    AxDataAreaId = table.Column<string>(type: "nvarchar(4)", maxLength: 4, nullable: false),
                    PartialOrderPolicy = table.Column<string>(type: "varchar(30)", maxLength: 30, nullable: false),
                    CurrentSequenceDate = table.Column<DateOnly>(type: "date", nullable: true),
                    ArrivalCutoffTime = table.Column<TimeOnly>(type: "time(0)", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_PickupSettings", x => x.Id);
                });

            migrationBuilder.CreateTable(
                name: "AspNetRoleClaims",
                columns: table => new
                {
                    Id = table.Column<int>(type: "int", nullable: false)
                        .Annotation("SqlServer:Identity", "1, 1"),
                    RoleId = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    ClaimType = table.Column<string>(type: "nvarchar(max)", nullable: true),
                    ClaimValue = table.Column<string>(type: "nvarchar(max)", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_AspNetRoleClaims", x => x.Id);
                    table.ForeignKey(
                        name: "FK_AspNetRoleClaims_AspNetRoles_RoleId",
                        column: x => x.RoleId,
                        principalTable: "AspNetRoles",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "AspNetUserClaims",
                columns: table => new
                {
                    Id = table.Column<int>(type: "int", nullable: false)
                        .Annotation("SqlServer:Identity", "1, 1"),
                    UserId = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    ClaimType = table.Column<string>(type: "nvarchar(max)", nullable: true),
                    ClaimValue = table.Column<string>(type: "nvarchar(max)", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_AspNetUserClaims", x => x.Id);
                    table.ForeignKey(
                        name: "FK_AspNetUserClaims_AspNetUsers_UserId",
                        column: x => x.UserId,
                        principalTable: "AspNetUsers",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "AspNetUserLogins",
                columns: table => new
                {
                    LoginProvider = table.Column<string>(type: "nvarchar(450)", nullable: false),
                    ProviderKey = table.Column<string>(type: "nvarchar(450)", nullable: false),
                    ProviderDisplayName = table.Column<string>(type: "nvarchar(max)", nullable: true),
                    UserId = table.Column<Guid>(type: "uniqueidentifier", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_AspNetUserLogins", x => new { x.LoginProvider, x.ProviderKey });
                    table.ForeignKey(
                        name: "FK_AspNetUserLogins_AspNetUsers_UserId",
                        column: x => x.UserId,
                        principalTable: "AspNetUsers",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "AspNetUserRoles",
                columns: table => new
                {
                    UserId = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    RoleId = table.Column<Guid>(type: "uniqueidentifier", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_AspNetUserRoles", x => new { x.UserId, x.RoleId });
                    table.ForeignKey(
                        name: "FK_AspNetUserRoles_AspNetRoles_RoleId",
                        column: x => x.RoleId,
                        principalTable: "AspNetRoles",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                    table.ForeignKey(
                        name: "FK_AspNetUserRoles_AspNetUsers_UserId",
                        column: x => x.UserId,
                        principalTable: "AspNetUsers",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "AspNetUserTokens",
                columns: table => new
                {
                    UserId = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    LoginProvider = table.Column<string>(type: "nvarchar(450)", nullable: false),
                    Name = table.Column<string>(type: "nvarchar(450)", nullable: false),
                    Value = table.Column<string>(type: "nvarchar(max)", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_AspNetUserTokens", x => new { x.UserId, x.LoginProvider, x.Name });
                    table.ForeignKey(
                        name: "FK_AspNetUserTokens_AspNetUsers_UserId",
                        column: x => x.UserId,
                        principalTable: "AspNetUsers",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "IntegrationAttempt",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    IntegrationRequestId = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    StartedAt = table.Column<DateTime>(type: "datetime2", nullable: false),
                    FinishedAt = table.Column<DateTime>(type: "datetime2", nullable: true),
                    Outcome = table.Column<string>(type: "varchar(30)", maxLength: 30, nullable: false),
                    ErrorCode = table.Column<string>(type: "nvarchar(50)", maxLength: 50, nullable: true),
                    ErrorMessage = table.Column<string>(type: "nvarchar(1000)", maxLength: 1000, nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_IntegrationAttempt", x => x.Id);
                    table.ForeignKey(
                        name: "FK_IntegrationAttempt_IntegrationRequest_IntegrationRequestId",
                        column: x => x.IntegrationRequestId,
                        principalTable: "IntegrationRequest",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "PickupPlanOrder",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    PickupPlanId = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    DataAreaId = table.Column<string>(type: "nvarchar(4)", maxLength: 4, nullable: false),
                    SalesId = table.Column<string>(type: "nvarchar(20)", maxLength: 20, nullable: false),
                    OrderStatusSnapshot = table.Column<string>(type: "nvarchar(30)", maxLength: 30, nullable: true),
                    AddedAt = table.Column<DateTime>(type: "datetime2", nullable: false),
                    AddedBy = table.Column<string>(type: "nvarchar(100)", maxLength: 100, nullable: false),
                    IsActive = table.Column<bool>(type: "bit", nullable: false, defaultValue: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_PickupPlanOrder", x => x.Id);
                    table.ForeignKey(
                        name: "FK_PickupPlanOrder_PickupPlan_PickupPlanId",
                        column: x => x.PickupPlanId,
                        principalTable: "PickupPlan",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "PickupTicket",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    PickupPlanId = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    TicketDate = table.Column<DateOnly>(type: "date", nullable: false),
                    DailySequence = table.Column<int>(type: "int", nullable: false),
                    TicketNumber = table.Column<string>(type: "nvarchar(20)", maxLength: 20, nullable: false),
                    ArrivalTime = table.Column<DateTime>(type: "datetime2", nullable: false),
                    QueueNumber = table.Column<int>(type: "int", nullable: false),
                    Status = table.Column<string>(type: "varchar(30)", maxLength: 30, nullable: false),
                    CreditDecisionBy = table.Column<string>(type: "nvarchar(100)", maxLength: 100, nullable: true),
                    CreditDecisionAt = table.Column<DateTime>(type: "datetime2", nullable: true),
                    CreditComment = table.Column<string>(type: "nvarchar(500)", maxLength: 500, nullable: true),
                    ReadyAt = table.Column<DateTime>(type: "datetime2", nullable: true),
                    CollectedAt = table.Column<DateTime>(type: "datetime2", nullable: true),
                    RowVersion = table.Column<byte[]>(type: "rowversion", rowVersion: true, nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_PickupTicket", x => x.Id);
                    table.ForeignKey(
                        name: "FK_PickupTicket_PickupPlan_PickupPlanId",
                        column: x => x.PickupPlanId,
                        principalTable: "PickupPlan",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                });

            migrationBuilder.CreateTable(
                name: "PickupNotification",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    TicketId = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    TicketNumber = table.Column<string>(type: "nvarchar(20)", maxLength: 20, nullable: false),
                    DisplayEventType = table.Column<string>(type: "varchar(30)", maxLength: 30, nullable: false),
                    CreatedAt = table.Column<DateTime>(type: "datetime2", nullable: false),
                    PublishedAt = table.Column<DateTime>(type: "datetime2", nullable: true),
                    Status = table.Column<string>(type: "varchar(20)", maxLength: 20, nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_PickupNotification", x => x.Id);
                    table.ForeignKey(
                        name: "FK_PickupNotification_PickupTicket_TicketId",
                        column: x => x.TicketId,
                        principalTable: "PickupTicket",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "PickupTicketOrder",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    TicketId = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    PickupPlanOrderId = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    DataAreaId = table.Column<string>(type: "nvarchar(4)", maxLength: 4, nullable: false),
                    SalesId = table.Column<string>(type: "nvarchar(20)", maxLength: 20, nullable: false),
                    Status = table.Column<string>(type: "varchar(30)", maxLength: 30, nullable: false),
                    CreditStatus = table.Column<string>(type: "varchar(20)", maxLength: 20, nullable: false),
                    WarehouseStatus = table.Column<string>(type: "varchar(20)", maxLength: 20, nullable: false),
                    LastAxSyncAt = table.Column<DateTime>(type: "datetime2", nullable: true),
                    RowVersion = table.Column<byte[]>(type: "rowversion", rowVersion: true, nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_PickupTicketOrder", x => x.Id);
                    table.ForeignKey(
                        name: "FK_PickupTicketOrder_PickupPlanOrder_PickupPlanOrderId",
                        column: x => x.PickupPlanOrderId,
                        principalTable: "PickupPlanOrder",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "FK_PickupTicketOrder_PickupTicket_TicketId",
                        column: x => x.TicketId,
                        principalTable: "PickupTicket",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "PickupWorkflowHistory",
                columns: table => new
                {
                    Id = table.Column<long>(type: "bigint", nullable: false)
                        .Annotation("SqlServer:Identity", "1, 1"),
                    TicketId = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    OldStatus = table.Column<string>(type: "varchar(30)", maxLength: 30, nullable: true),
                    NewStatus = table.Column<string>(type: "varchar(30)", maxLength: 30, nullable: false),
                    Action = table.Column<string>(type: "varchar(50)", maxLength: 50, nullable: false),
                    Comment = table.Column<string>(type: "nvarchar(500)", maxLength: 500, nullable: true),
                    UserId = table.Column<string>(type: "nvarchar(100)", maxLength: 100, nullable: false),
                    OccurredAt = table.Column<DateTime>(type: "datetime2", nullable: false),
                    CorrelationId = table.Column<Guid>(type: "uniqueidentifier", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_PickupWorkflowHistory", x => x.Id);
                    table.ForeignKey(
                        name: "FK_PickupWorkflowHistory_PickupTicket_TicketId",
                        column: x => x.TicketId,
                        principalTable: "PickupTicket",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "OrderWorkflowHistory",
                columns: table => new
                {
                    Id = table.Column<long>(type: "bigint", nullable: false)
                        .Annotation("SqlServer:Identity", "1, 1"),
                    TicketOrderId = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    OldStatus = table.Column<string>(type: "varchar(30)", maxLength: 30, nullable: true),
                    NewStatus = table.Column<string>(type: "varchar(30)", maxLength: 30, nullable: false),
                    Action = table.Column<string>(type: "varchar(50)", maxLength: 50, nullable: false),
                    Comment = table.Column<string>(type: "nvarchar(500)", maxLength: 500, nullable: true),
                    UserId = table.Column<string>(type: "nvarchar(100)", maxLength: 100, nullable: false),
                    OccurredAt = table.Column<DateTime>(type: "datetime2", nullable: false),
                    CorrelationId = table.Column<Guid>(type: "uniqueidentifier", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_OrderWorkflowHistory", x => x.Id);
                    table.ForeignKey(
                        name: "FK_OrderWorkflowHistory_PickupTicketOrder_TicketOrderId",
                        column: x => x.TicketOrderId,
                        principalTable: "PickupTicketOrder",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateIndex(
                name: "IX_AspNetRoleClaims_RoleId",
                table: "AspNetRoleClaims",
                column: "RoleId");

            migrationBuilder.CreateIndex(
                name: "RoleNameIndex",
                table: "AspNetRoles",
                column: "NormalizedName",
                unique: true,
                filter: "[NormalizedName] IS NOT NULL");

            migrationBuilder.CreateIndex(
                name: "IX_AspNetUserClaims_UserId",
                table: "AspNetUserClaims",
                column: "UserId");

            migrationBuilder.CreateIndex(
                name: "IX_AspNetUserLogins_UserId",
                table: "AspNetUserLogins",
                column: "UserId");

            migrationBuilder.CreateIndex(
                name: "IX_AspNetUserRoles_RoleId",
                table: "AspNetUserRoles",
                column: "RoleId");

            migrationBuilder.CreateIndex(
                name: "EmailIndex",
                table: "AspNetUsers",
                column: "NormalizedEmail");

            migrationBuilder.CreateIndex(
                name: "UserNameIndex",
                table: "AspNetUsers",
                column: "NormalizedUserName",
                unique: true,
                filter: "[NormalizedUserName] IS NOT NULL");

            migrationBuilder.CreateIndex(
                name: "IX_IdempotencyRecord_ExpiresAt",
                table: "IdempotencyRecord",
                column: "ExpiresAt");

            migrationBuilder.CreateIndex(
                name: "UQ_IdempotencyRecord_IdempotencyKey",
                table: "IdempotencyRecord",
                column: "IdempotencyKey",
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_IntegrationAttempt_IntegrationRequestId_StartedAt",
                table: "IntegrationAttempt",
                columns: new[] { "IntegrationRequestId", "StartedAt" });

            migrationBuilder.CreateIndex(
                name: "IX_IntegrationRequest_Status_CreatedAt",
                table: "IntegrationRequest",
                columns: new[] { "Status", "CreatedAt" });

            migrationBuilder.CreateIndex(
                name: "UQ_IntegrationRequest_OperationKey",
                table: "IntegrationRequest",
                column: "OperationKey",
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_OrderWorkflowHistory_TicketOrderId_OccurredAt",
                table: "OrderWorkflowHistory",
                columns: new[] { "TicketOrderId", "OccurredAt" });

            migrationBuilder.CreateIndex(
                name: "IX_PickupNotification_Status_CreatedAt",
                table: "PickupNotification",
                columns: new[] { "Status", "CreatedAt" });

            migrationBuilder.CreateIndex(
                name: "IX_PickupNotification_TicketId",
                table: "PickupNotification",
                column: "TicketId");

            migrationBuilder.CreateIndex(
                name: "IX_PickupPlan_PickupDate_Status",
                table: "PickupPlan",
                columns: new[] { "PickupDate", "Status" });

            migrationBuilder.CreateIndex(
                name: "UQ_PickupPlanOrder_PickupPlanId_DataAreaId_SalesId",
                table: "PickupPlanOrder",
                columns: new[] { "PickupPlanId", "DataAreaId", "SalesId" },
                unique: true);

            migrationBuilder.CreateIndex(
                name: "UX_PickupPlanOrder_ActiveSalesOrder",
                table: "PickupPlanOrder",
                columns: new[] { "DataAreaId", "SalesId" },
                unique: true,
                filter: "[IsActive] = 1");

            migrationBuilder.CreateIndex(
                name: "UQ_PickupSettings_WarehouseId",
                table: "PickupSettings",
                column: "WarehouseId",
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_PickupTicket_TicketDate_Status_QueueNumber",
                table: "PickupTicket",
                columns: new[] { "TicketDate", "Status", "QueueNumber" });

            migrationBuilder.CreateIndex(
                name: "UQ_PickupTicket_PickupPlanId",
                table: "PickupTicket",
                column: "PickupPlanId",
                unique: true);

            migrationBuilder.CreateIndex(
                name: "UQ_PickupTicket_TicketDate_DailySequence",
                table: "PickupTicket",
                columns: new[] { "TicketDate", "DailySequence" },
                unique: true);

            migrationBuilder.CreateIndex(
                name: "UQ_PickupTicket_TicketDate_TicketNumber",
                table: "PickupTicket",
                columns: new[] { "TicketDate", "TicketNumber" },
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_PickupTicketOrder_TicketId_Status",
                table: "PickupTicketOrder",
                columns: new[] { "TicketId", "Status" });

            migrationBuilder.CreateIndex(
                name: "UQ_PickupTicketOrder_PickupPlanOrderId",
                table: "PickupTicketOrder",
                column: "PickupPlanOrderId",
                unique: true);

            migrationBuilder.CreateIndex(
                name: "UQ_PickupTicketOrder_TicketId_DataAreaId_SalesId",
                table: "PickupTicketOrder",
                columns: new[] { "TicketId", "DataAreaId", "SalesId" },
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_PickupWorkflowHistory_TicketId_OccurredAt",
                table: "PickupWorkflowHistory",
                columns: new[] { "TicketId", "OccurredAt" });
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(name: "AspNetRoleClaims");
            migrationBuilder.DropTable(name: "AspNetUserClaims");
            migrationBuilder.DropTable(name: "AspNetUserLogins");
            migrationBuilder.DropTable(name: "AspNetUserRoles");
            migrationBuilder.DropTable(name: "AspNetUserTokens");
            migrationBuilder.DropTable(name: "IdempotencyRecord");
            migrationBuilder.DropTable(name: "IntegrationAttempt");
            migrationBuilder.DropTable(name: "OrderWorkflowHistory");
            migrationBuilder.DropTable(name: "PickupNotification");
            migrationBuilder.DropTable(name: "PickupSettings");
            migrationBuilder.DropTable(name: "PickupWorkflowHistory");
            migrationBuilder.DropTable(name: "AspNetRoles");
            migrationBuilder.DropTable(name: "AspNetUsers");
            migrationBuilder.DropTable(name: "IntegrationRequest");
            migrationBuilder.DropTable(name: "PickupTicketOrder");
            migrationBuilder.DropTable(name: "PickupPlanOrder");
            migrationBuilder.DropTable(name: "PickupTicket");
            migrationBuilder.DropTable(name: "PickupPlan");
        }
    }
}
