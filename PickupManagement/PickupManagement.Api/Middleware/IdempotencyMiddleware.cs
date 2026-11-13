using System.Security.Cryptography;
using System.Text;
using Microsoft.EntityFrameworkCore;
using PickupManagement.Domain.Entities;
using PickupManagement.Infrastructure.Persistence;

namespace PickupManagement.Api.Middleware;

public class IdempotencyMiddleware
{
    public const string HeaderName = "Idempotency-Key";
    private static readonly HashSet<string> WriteMethods = new(StringComparer.OrdinalIgnoreCase)
    {
        HttpMethods.Post,
        HttpMethods.Put,
        HttpMethods.Patch,
        HttpMethods.Delete
    };

    private readonly RequestDelegate _next;
    private readonly ILogger<IdempotencyMiddleware> _logger;

    public IdempotencyMiddleware(RequestDelegate next, ILogger<IdempotencyMiddleware> logger)
    {
        _next = next;
        _logger = logger;
    }

    public async Task InvokeAsync(HttpContext context, PickupManagementDbContext dbContext)
    {
        if (!WriteMethods.Contains(context.Request.Method) ||
            !context.Request.Path.StartsWithSegments("/api") ||
            context.Request.Path.StartsWithSegments("/api/auth/login"))
        {
            await _next(context);
            return;
        }

        if (!context.Request.Headers.TryGetValue(HeaderName, out var keyValues) ||
            string.IsNullOrWhiteSpace(keyValues.ToString()))
        {
            context.Response.StatusCode = StatusCodes.Status400BadRequest;
            context.Response.ContentType = "application/problem+json";
            await context.Response.WriteAsJsonAsync(new
            {
                title = "Missing Idempotency-Key",
                status = 400,
                detail = $"Header '{HeaderName}' is required for write operations."
            });
            return;
        }

        var idempotencyKey = keyValues.ToString().Trim();
        var requestHash = await ComputeRequestHashAsync(context.Request);
        var now = DateTime.UtcNow;

        var existing = await dbContext.IdempotencyRecords
            .AsNoTracking()
            .FirstOrDefaultAsync(x => x.IdempotencyKey == idempotencyKey && x.ExpiresAt > now);

        if (existing is not null)
        {
            if (!string.Equals(existing.RequestHash, requestHash, StringComparison.Ordinal))
            {
                context.Response.StatusCode = StatusCodes.Status409Conflict;
                context.Response.ContentType = "application/problem+json";
                await context.Response.WriteAsJsonAsync(new
                {
                    title = "Idempotency Key Conflict",
                    status = 409,
                    detail = "The supplied Idempotency-Key was already used with a different request payload."
                });
                return;
            }

            _logger.LogInformation("Returning cached idempotent response for key {IdempotencyKey}", idempotencyKey);
            context.Response.StatusCode = existing.StatusCode;
            context.Response.ContentType = "application/json; charset=utf-8";
            context.Response.Headers["X-Idempotent-Replay"] = "true";
            await context.Response.WriteAsync(existing.ResponseBody);
            return;
        }

        var originalBodyStream = context.Response.Body;
        await using var responseBuffer = new MemoryStream();
        context.Response.Body = responseBuffer;

        try
        {
            await _next(context);

            responseBuffer.Position = 0;
            var responseBody = await new StreamReader(responseBuffer, Encoding.UTF8).ReadToEndAsync();

            if (context.Response.StatusCode is >= 200 and < 300)
            {
                dbContext.IdempotencyRecords.Add(new IdempotencyRecord
                {
                    Id = Guid.NewGuid(),
                    IdempotencyKey = idempotencyKey,
                    HttpMethod = context.Request.Method,
                    RequestPath = context.Request.Path.ToString(),
                    RequestHash = requestHash,
                    StatusCode = context.Response.StatusCode,
                    ResponseBody = responseBody,
                    CreatedAt = now,
                    ExpiresAt = now.AddHours(24)
                });

                try
                {
                    await dbContext.SaveChangesAsync();
                }
                catch (DbUpdateException)
                {
                    // Concurrent duplicate key insert: safe to proceed returning response
                }
            }

            responseBuffer.Position = 0;
            await responseBuffer.CopyToAsync(originalBodyStream);
        }
        finally
        {
            context.Response.Body = originalBodyStream;
        }
    }

    private static async Task<string> ComputeRequestHashAsync(HttpRequest request)
    {
        request.EnableBuffering();
        request.Body.Position = 0;
        using var reader = new StreamReader(request.Body, Encoding.UTF8, leaveOpen: true);
        var body = await reader.ReadToEndAsync();
        request.Body.Position = 0;

        var raw = $"{request.Method.ToUpperInvariant()}|{request.Path.Value?.ToLowerInvariant()}|{body}";
        var bytes = SHA256.HashData(Encoding.UTF8.GetBytes(raw));
        return Convert.ToHexString(bytes);
    }
}
