using System.Net;
using System.Text.Json;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using PickupManagement.Application.Common.Exceptions;

namespace PickupManagement.Api.Middleware;

public class ExceptionHandlingMiddleware
{
    private readonly RequestDelegate _next;
    private readonly ILogger<ExceptionHandlingMiddleware> _logger;

    public ExceptionHandlingMiddleware(
        RequestDelegate next,
        ILogger<ExceptionHandlingMiddleware> logger)
    {
        _next = next;
        _logger = logger;
    }

    public async Task InvokeAsync(HttpContext context)
    {
        var correlationId = context.TraceIdentifier;
        context.Response.Headers["X-Correlation-Id"] = correlationId;

        try
        {
            await _next(context);
        }
        catch (Exception ex)
        {
            await HandleExceptionAsync(context, ex, correlationId);
        }
    }

    private async Task HandleExceptionAsync(
        HttpContext context,
        Exception exception,
        string correlationId)
    {
        var (statusCode, title, detail, errorCode) = exception switch
        {
            DomainValidationException dve => (
                HttpStatusCode.BadRequest,
                "Validation Failed",
                dve.Message,
                dve.ErrorCode),
            ResourceNotFoundException rnfe => (
                HttpStatusCode.NotFound,
                "Resource Not Found",
                rnfe.Message,
                "NOT_FOUND"),
            ConflictException ce => (
                HttpStatusCode.Conflict,
                "Conflict",
                ce.Message,
                "CONFLICT"),
            DbUpdateConcurrencyException => (
                HttpStatusCode.Conflict,
                "Concurrency Conflict",
                "The record was modified by another operator. Please reload and retry.",
                "CONCURRENCY_CONFLICT"),
            UnauthorizedAccessException => (
                HttpStatusCode.Forbidden,
                "Forbidden",
                "You do not have permission to perform this operation.",
                "FORBIDDEN"),
            _ => (
                HttpStatusCode.InternalServerError,
                "Internal Server Error",
                "An unexpected error occurred. Contact an administrator with the correlation ID.",
                "INTERNAL_ERROR")
        };

        if (statusCode == HttpStatusCode.InternalServerError)
        {
            _logger.LogError(exception, "Unhandled exception. CorrelationId={CorrelationId}", correlationId);
        }
        else
        {
            _logger.LogWarning(exception, "Request failed ({StatusCode}, {ErrorCode}). CorrelationId={CorrelationId}",
                (int)statusCode, errorCode, correlationId);
        }

        if (context.Response.HasStarted)
        {
            return;
        }

        context.Response.StatusCode = (int)statusCode;
        context.Response.ContentType = "application/problem+json";

        var problem = new ProblemDetails
        {
            Status = (int)statusCode,
            Title = title,
            Detail = detail,
            Instance = context.Request.Path
        };
        problem.Extensions["errorCode"] = errorCode;
        problem.Extensions["correlationId"] = correlationId;

        await context.Response.WriteAsync(JsonSerializer.Serialize(problem));
    }
}
