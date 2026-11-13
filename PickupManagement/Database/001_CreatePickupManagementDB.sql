-- =============================================================================
-- Client Pickup Ticket Management - SQL Server Database Schema
-- Target Database: PickupManagementDB
-- =============================================================================

IF DB_ID(N'PickupManagementDB') IS NULL
BEGIN
    CREATE DATABASE [PickupManagementDB];
END;
GO

USE [PickupManagementDB];
GO

SET ANSI_NULLS ON;
SET QUOTED_IDENTIFIER ON;
GO

-- 1. PickupPlan
CREATE TABLE [dbo].[PickupPlan] (
    [Id]                    UNIQUEIDENTIFIER NOT NULL,
    [CustomerAccount]       NVARCHAR(20)     NOT NULL,
    [CustomerNameSnapshot]  NVARCHAR(150)    NOT NULL,
    [PickupDate]            DATE             NOT NULL,
    [WarehouseId]           NVARCHAR(20)     NOT NULL,
    [Status]                VARCHAR(20)      NOT NULL,
    [Notes]                 NVARCHAR(500)    NULL,
    [CreatedBy]             NVARCHAR(100)    NOT NULL,
    [CreatedAt]             DATETIME2        NOT NULL,
    [UpdatedAt]             DATETIME2        NOT NULL,
    CONSTRAINT [PK_PickupPlan] PRIMARY KEY CLUSTERED ([Id]),
    CONSTRAINT [CK_PickupPlan_Status] CHECK ([Status] IN ('PLANNED', 'ARRIVED', 'ABSENT', 'CANCELLED', 'COMPLETED'))
);
GO

CREATE NONCLUSTERED INDEX [IX_PickupPlan_PickupDate_Status]
    ON [dbo].[PickupPlan] ([PickupDate], [Status]);
GO

-- 2. PickupPlanOrder
CREATE TABLE [dbo].[PickupPlanOrder] (
    [Id]                    UNIQUEIDENTIFIER NOT NULL,
    [PickupPlanId]          UNIQUEIDENTIFIER NOT NULL,
    [DataAreaId]            NVARCHAR(4)      NOT NULL,
    [SalesId]               NVARCHAR(20)     NOT NULL,
    [OrderStatusSnapshot]   NVARCHAR(30)     NULL,
    [AddedAt]               DATETIME2        NOT NULL,
    [AddedBy]               NVARCHAR(100)    NOT NULL,
    [IsActive]              BIT              NOT NULL CONSTRAINT [DF_PickupPlanOrder_IsActive] DEFAULT (1),
    CONSTRAINT [PK_PickupPlanOrder] PRIMARY KEY CLUSTERED ([Id]),
    CONSTRAINT [FK_PickupPlanOrder_PickupPlan_PickupPlanId]
        FOREIGN KEY ([PickupPlanId]) REFERENCES [dbo].[PickupPlan] ([Id]) ON DELETE CASCADE
);
GO

CREATE UNIQUE NONCLUSTERED INDEX [UQ_PickupPlanOrder_PickupPlanId_DataAreaId_SalesId]
    ON [dbo].[PickupPlanOrder] ([PickupPlanId], [DataAreaId], [SalesId]);
GO

CREATE UNIQUE NONCLUSTERED INDEX [UX_PickupPlanOrder_ActiveSalesOrder]
    ON [dbo].[PickupPlanOrder] ([DataAreaId], [SalesId])
    WHERE [IsActive] = 1;
GO

-- 3. PickupTicket
CREATE TABLE [dbo].[PickupTicket] (
    [Id]                    UNIQUEIDENTIFIER NOT NULL,
    [PickupPlanId]          UNIQUEIDENTIFIER NOT NULL,
    [TicketDate]            DATE             NOT NULL,
    [DailySequence]         INT              NOT NULL,
    [TicketNumber]          NVARCHAR(20)     NOT NULL,
    [ArrivalTime]           DATETIME2        NOT NULL,
    [QueueNumber]           INT              NOT NULL,
    [Status]                VARCHAR(30)      NOT NULL,
    [CreditDecisionBy]      NVARCHAR(100)    NULL,
    [CreditDecisionAt]      DATETIME2        NULL,
    [CreditComment]         NVARCHAR(500)    NULL,
    [ReadyAt]               DATETIME2        NULL,
    [CollectedAt]           DATETIME2        NULL,
    [RowVersion]            ROWVERSION       NOT NULL,
    CONSTRAINT [PK_PickupTicket] PRIMARY KEY CLUSTERED ([Id]),
    CONSTRAINT [FK_PickupTicket_PickupPlan_PickupPlanId]
        FOREIGN KEY ([PickupPlanId]) REFERENCES [dbo].[PickupPlan] ([Id]) ON DELETE NO ACTION,
    CONSTRAINT [CK_PickupTicket_Status] CHECK ([Status] IN ('ARRIVED', 'APPROVED', 'ON_HOLD', 'REJECTED', 'IN_PREPARATION', 'READY', 'COLLECTED', 'CANCELLED'))
);
GO

CREATE UNIQUE NONCLUSTERED INDEX [UQ_PickupTicket_PickupPlanId]
    ON [dbo].[PickupTicket] ([PickupPlanId]);
GO

CREATE UNIQUE NONCLUSTERED INDEX [UQ_PickupTicket_TicketDate_DailySequence]
    ON [dbo].[PickupTicket] ([TicketDate], [DailySequence]);
GO

CREATE UNIQUE NONCLUSTERED INDEX [UQ_PickupTicket_TicketDate_TicketNumber]
    ON [dbo].[PickupTicket] ([TicketDate], [TicketNumber]);
GO

CREATE NONCLUSTERED INDEX [IX_PickupTicket_TicketDate_Status_QueueNumber]
    ON [dbo].[PickupTicket] ([TicketDate], [Status], [QueueNumber]);
GO

-- 4. PickupTicketOrder
CREATE TABLE [dbo].[PickupTicketOrder] (
    [Id]                    UNIQUEIDENTIFIER NOT NULL,
    [TicketId]              UNIQUEIDENTIFIER NOT NULL,
    [PickupPlanOrderId]     UNIQUEIDENTIFIER NOT NULL,
    [DataAreaId]            NVARCHAR(4)      NOT NULL,
    [SalesId]               NVARCHAR(20)     NOT NULL,
    [Status]                VARCHAR(30)      NOT NULL,
    [CreditStatus]          VARCHAR(20)      NOT NULL,
    [WarehouseStatus]       VARCHAR(20)      NOT NULL,
    [LastAxSyncAt]          DATETIME2        NULL,
    [RowVersion]            ROWVERSION       NOT NULL,
    CONSTRAINT [PK_PickupTicketOrder] PRIMARY KEY CLUSTERED ([Id]),
    CONSTRAINT [FK_PickupTicketOrder_PickupTicket_TicketId]
        FOREIGN KEY ([TicketId]) REFERENCES [dbo].[PickupTicket] ([Id]) ON DELETE CASCADE,
    CONSTRAINT [FK_PickupTicketOrder_PickupPlanOrder_PickupPlanOrderId]
        FOREIGN KEY ([PickupPlanOrderId]) REFERENCES [dbo].[PickupPlanOrder] ([Id]) ON DELETE NO ACTION,
    CONSTRAINT [CK_PickupTicketOrder_Status] CHECK ([Status] IN ('PENDING_CREDIT', 'RELEASE_PENDING', 'RECONCILING', 'RELEASED', 'IN_PREPARATION', 'READY', 'BLOCKED', 'CANCELLED', 'COLLECTED')),
    CONSTRAINT [CK_PickupTicketOrder_CreditStatus] CHECK ([CreditStatus] IN ('PENDING', 'APPROVED', 'REJECTED', 'ON_HOLD')),
    CONSTRAINT [CK_PickupTicketOrder_WarehouseStatus] CHECK ([WarehouseStatus] IN ('PENDING', 'PREPARING', 'READY', 'COLLECTED'))
);
GO

CREATE UNIQUE NONCLUSTERED INDEX [UQ_PickupTicketOrder_PickupPlanOrderId]
    ON [dbo].[PickupTicketOrder] ([PickupPlanOrderId]);
GO

CREATE UNIQUE NONCLUSTERED INDEX [UQ_PickupTicketOrder_TicketId_DataAreaId_SalesId]
    ON [dbo].[PickupTicketOrder] ([TicketId], [DataAreaId], [SalesId]);
GO

CREATE NONCLUSTERED INDEX [IX_PickupTicketOrder_TicketId_Status]
    ON [dbo].[PickupTicketOrder] ([TicketId], [Status]);
GO

-- 5. PickupWorkflowHistory
CREATE TABLE [dbo].[PickupWorkflowHistory] (
    [Id]                    BIGINT IDENTITY(1,1) NOT NULL,
    [TicketId]              UNIQUEIDENTIFIER     NOT NULL,
    [OldStatus]             VARCHAR(30)          NULL,
    [NewStatus]             VARCHAR(30)          NOT NULL,
    [Action]                VARCHAR(50)          NOT NULL,
    [Comment]               NVARCHAR(500)        NULL,
    [UserId]                NVARCHAR(100)        NOT NULL,
    [OccurredAt]            DATETIME2            NOT NULL,
    [CorrelationId]         UNIQUEIDENTIFIER     NOT NULL,
    CONSTRAINT [PK_PickupWorkflowHistory] PRIMARY KEY CLUSTERED ([Id]),
    CONSTRAINT [FK_PickupWorkflowHistory_PickupTicket_TicketId]
        FOREIGN KEY ([TicketId]) REFERENCES [dbo].[PickupTicket] ([Id]) ON DELETE CASCADE
);
GO

CREATE NONCLUSTERED INDEX [IX_PickupWorkflowHistory_TicketId_OccurredAt]
    ON [dbo].[PickupWorkflowHistory] ([TicketId], [OccurredAt]);
GO

-- 6. OrderWorkflowHistory
CREATE TABLE [dbo].[OrderWorkflowHistory] (
    [Id]                    BIGINT IDENTITY(1,1) NOT NULL,
    [TicketOrderId]         UNIQUEIDENTIFIER     NOT NULL,
    [OldStatus]             VARCHAR(30)          NULL,
    [NewStatus]             VARCHAR(30)          NOT NULL,
    [Action]                VARCHAR(50)          NOT NULL,
    [Comment]               NVARCHAR(500)        NULL,
    [UserId]                NVARCHAR(100)        NOT NULL,
    [OccurredAt]            DATETIME2            NOT NULL,
    [CorrelationId]         UNIQUEIDENTIFIER     NOT NULL,
    CONSTRAINT [PK_OrderWorkflowHistory] PRIMARY KEY CLUSTERED ([Id]),
    CONSTRAINT [FK_OrderWorkflowHistory_PickupTicketOrder_TicketOrderId]
        FOREIGN KEY ([TicketOrderId]) REFERENCES [dbo].[PickupTicketOrder] ([Id]) ON DELETE CASCADE
);
GO

CREATE NONCLUSTERED INDEX [IX_OrderWorkflowHistory_TicketOrderId_OccurredAt]
    ON [dbo].[OrderWorkflowHistory] ([TicketOrderId], [OccurredAt]);
GO

-- 7. IntegrationRequest
CREATE TABLE [dbo].[IntegrationRequest] (
    [Id]                    UNIQUEIDENTIFIER NOT NULL,
    [OperationKey]          NVARCHAR(150)    NOT NULL,
    [OperationType]         VARCHAR(50)      NOT NULL,
    [EntityId]              UNIQUEIDENTIFIER NOT NULL,
    [Status]                VARCHAR(30)      NOT NULL,
    [AttemptCount]          INT              NOT NULL,
    [CreatedAt]             DATETIME2        NOT NULL,
    [CompletedAt]           DATETIME2        NULL,
    [LastError]             NVARCHAR(1000)   NULL,
    CONSTRAINT [PK_IntegrationRequest] PRIMARY KEY CLUSTERED ([Id]),
    CONSTRAINT [CK_IntegrationRequest_Status] CHECK ([Status] IN ('PENDING', 'IN_PROGRESS', 'SUCCEEDED', 'RECONCILING', 'FAILED_BUSINESS', 'FAILED_TECHNICAL'))
);
GO

CREATE UNIQUE NONCLUSTERED INDEX [UQ_IntegrationRequest_OperationKey]
    ON [dbo].[IntegrationRequest] ([OperationKey]);
GO

CREATE NONCLUSTERED INDEX [IX_IntegrationRequest_Status_CreatedAt]
    ON [dbo].[IntegrationRequest] ([Status], [CreatedAt]);
GO

-- 8. IntegrationAttempt
CREATE TABLE [dbo].[IntegrationAttempt] (
    [Id]                    UNIQUEIDENTIFIER NOT NULL,
    [IntegrationRequestId]  UNIQUEIDENTIFIER NOT NULL,
    [StartedAt]             DATETIME2        NOT NULL,
    [FinishedAt]            DATETIME2        NULL,
    [Outcome]               VARCHAR(30)      NOT NULL,
    [ErrorCode]             NVARCHAR(50)     NULL,
    [ErrorMessage]          NVARCHAR(1000)   NULL,
    CONSTRAINT [PK_IntegrationAttempt] PRIMARY KEY CLUSTERED ([Id]),
    CONSTRAINT [FK_IntegrationAttempt_IntegrationRequest_IntegrationRequestId]
        FOREIGN KEY ([IntegrationRequestId]) REFERENCES [dbo].[IntegrationRequest] ([Id]) ON DELETE CASCADE,
    CONSTRAINT [CK_IntegrationAttempt_Outcome] CHECK ([Outcome] IN ('SUCCEEDED', 'TIMEOUT', 'BUSINESS_ERROR', 'TECHNICAL_ERROR'))
);
GO

CREATE NONCLUSTERED INDEX [IX_IntegrationAttempt_IntegrationRequestId_StartedAt]
    ON [dbo].[IntegrationAttempt] ([IntegrationRequestId], [StartedAt]);
GO

-- 9. PickupNotification
CREATE TABLE [dbo].[PickupNotification] (
    [Id]                    UNIQUEIDENTIFIER NOT NULL,
    [TicketId]              UNIQUEIDENTIFIER NOT NULL,
    [TicketNumber]          NVARCHAR(20)     NOT NULL,
    [DisplayEventType]      VARCHAR(30)      NOT NULL,
    [CreatedAt]             DATETIME2        NOT NULL,
    [PublishedAt]           DATETIME2        NULL,
    [Status]                VARCHAR(20)      NOT NULL,
    CONSTRAINT [PK_PickupNotification] PRIMARY KEY CLUSTERED ([Id]),
    CONSTRAINT [FK_PickupNotification_PickupTicket_TicketId]
        FOREIGN KEY ([TicketId]) REFERENCES [dbo].[PickupTicket] ([Id]) ON DELETE CASCADE,
    CONSTRAINT [CK_PickupNotification_DisplayEventType] CHECK ([DisplayEventType] IN ('NOW_SERVING', 'ORDER_READY', 'COLLECTED', 'REMOVED')),
    CONSTRAINT [CK_PickupNotification_Status] CHECK ([Status] IN ('PENDING', 'PUBLISHED', 'FAILED'))
);
GO

CREATE NONCLUSTERED INDEX [IX_PickupNotification_Status_CreatedAt]
    ON [dbo].[PickupNotification] ([Status], [CreatedAt]);
GO

-- 10. PickupSettings
CREATE TABLE [dbo].[PickupSettings] (
    [Id]                    UNIQUEIDENTIFIER NOT NULL,
    [WarehouseId]           NVARCHAR(20)     NOT NULL,
    [TicketPrefix]          NVARCHAR(10)     NOT NULL,
    [NextDailySequence]     INT              NOT NULL,
    [BusinessTimeZone]      NVARCHAR(100)    NOT NULL,
    [QueuePolicy]           VARCHAR(30)      NOT NULL,
    [AxDataAreaId]          NVARCHAR(4)      NOT NULL,
    [PartialOrderPolicy]    VARCHAR(30)      NOT NULL,
    [CurrentSequenceDate]   DATE             NULL,
    [ArrivalCutoffTime]     TIME(0)          NULL,
    CONSTRAINT [PK_PickupSettings] PRIMARY KEY CLUSTERED ([Id]),
    CONSTRAINT [CK_PickupSettings_QueuePolicy] CHECK ([QueuePolicy] IN ('FIFO', 'PRIORITY_OVERRIDE')),
    CONSTRAINT [CK_PickupSettings_PartialOrderPolicy] CHECK ([PartialOrderPolicy] IN ('BLOCK_TICKET', 'ALLOW_REMOVAL_BY_SUPERVISOR'))
);
GO

CREATE UNIQUE NONCLUSTERED INDEX [UQ_PickupSettings_WarehouseId]
    ON [dbo].[PickupSettings] ([WarehouseId]);
GO

-- 11. IdempotencyRecord (supports Idempotency-Key across all write endpoints)
CREATE TABLE [dbo].[IdempotencyRecord] (
    [Id]                    UNIQUEIDENTIFIER NOT NULL,
    [IdempotencyKey]        NVARCHAR(150)    NOT NULL,
    [HttpMethod]            VARCHAR(10)      NOT NULL,
    [RequestPath]           NVARCHAR(300)    NOT NULL,
    [RequestHash]           VARCHAR(64)      NOT NULL,
    [StatusCode]            INT              NOT NULL,
    [ResponseBody]          NVARCHAR(MAX)    NOT NULL,
    [CreatedAt]             DATETIME2        NOT NULL,
    [ExpiresAt]             DATETIME2        NOT NULL,
    CONSTRAINT [PK_IdempotencyRecord] PRIMARY KEY CLUSTERED ([Id])
);
GO

CREATE UNIQUE NONCLUSTERED INDEX [UQ_IdempotencyRecord_IdempotencyKey]
    ON [dbo].[IdempotencyRecord] ([IdempotencyKey]);
GO

CREATE NONCLUSTERED INDEX [IX_IdempotencyRecord_ExpiresAt]
    ON [dbo].[IdempotencyRecord] ([ExpiresAt]);
GO
