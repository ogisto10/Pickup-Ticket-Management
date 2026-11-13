using Microsoft.OpenApi.Models;
using Swashbuckle.AspNetCore.SwaggerGen;
using PickupManagement.Api.Middleware;

namespace PickupManagement.Api.Swagger;

public class SwaggerIdempotencyHeaderFilter : IOperationFilter
{
    private static readonly HashSet<string> WriteMethods = new(StringComparer.OrdinalIgnoreCase)
    {
        "POST", "PUT", "PATCH", "DELETE"
    };

    public void Apply(OpenApiOperation operation, OperationFilterContext context)
    {
        var method = context.ApiDescription.HttpMethod;
        var path = context.ApiDescription.RelativePath ?? string.Empty;

        if (method is null || !WriteMethods.Contains(method) || path.StartsWith("api/auth/login", StringComparison.OrdinalIgnoreCase))
        {
            return;
        }

        operation.Parameters ??= new List<OpenApiParameter>();
        operation.Parameters.Add(new OpenApiParameter
        {
            Name = IdempotencyMiddleware.HeaderName,
            In = ParameterLocation.Header,
            Required = true,
            Description = "Unique idempotency key (UUID) preventing duplicate execution on retry.",
            Schema = new OpenApiSchema { Type = "string", Format = "uuid" }
        });
    }
}
