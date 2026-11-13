using System.Text;
using System.Text.Json.Serialization;
using Microsoft.AspNetCore.Authentication.JwtBearer;
using Microsoft.AspNetCore.Identity;
using Microsoft.EntityFrameworkCore;
using Microsoft.IdentityModel.Tokens;
using Microsoft.OpenApi.Models;
using PickupManagement.Api.Hubs;
using PickupManagement.Api.Middleware;
using PickupManagement.Api.Notifications;
using PickupManagement.Api.Services;
using PickupManagement.Api.Swagger;
using PickupManagement.Application.AxIntegration;
using PickupManagement.Application.Common.Interfaces;
using PickupManagement.Application.Credit;
using PickupManagement.Application.Notifications;
using PickupManagement.Application.Planning;
using PickupManagement.Application.Reception;
using PickupManagement.Application.Warehouse;
using PickupManagement.Domain.Enums;
using PickupManagement.Infrastructure.AxIntegration;
using PickupManagement.Infrastructure.BackgroundJobs;
using PickupManagement.Infrastructure.Credit;
using PickupManagement.Infrastructure.Persistence;
using PickupManagement.Infrastructure.Planning;
using PickupManagement.Infrastructure.Reception;
using PickupManagement.Infrastructure.Warehouse;

var builder = WebApplication.CreateBuilder(args);

var connectionString = builder.Configuration.GetConnectionString("DefaultConnection")
    ?? throw new InvalidOperationException("ConnectionStrings:DefaultConnection is required.");

builder.Services.AddDbContext<PickupManagementDbContext>(options =>
    options.UseSqlServer(connectionString, sql =>
    {
        sql.MigrationsAssembly(typeof(PickupManagementDbContext).Assembly.FullName);
        sql.EnableRetryOnFailure(maxRetryCount: 3);
    }));

builder.Services.AddIdentity<ApplicationUser, IdentityRole<Guid>>(options =>
    {
        options.Password.RequiredLength = 8;
        options.Password.RequireDigit = true;
        options.Password.RequireUppercase = true;
        options.Password.RequireLowercase = true;
        options.Password.RequireNonAlphanumeric = true;
        options.Lockout.MaxFailedAccessAttempts = 5;
        options.Lockout.DefaultLockoutTimeSpan = TimeSpan.FromMinutes(15);
    })
    .AddEntityFrameworkStores<PickupManagementDbContext>()
    .AddDefaultTokenProviders();

var jwtSection = builder.Configuration.GetSection("Jwt");
var signingKey = jwtSection["SigningKey"]
    ?? throw new InvalidOperationException("Jwt:SigningKey is required.");

builder.Services.AddAuthentication(options =>
    {
        options.DefaultAuthenticateScheme = JwtBearerDefaults.AuthenticationScheme;
        options.DefaultChallengeScheme = JwtBearerDefaults.AuthenticationScheme;
    })
    .AddJwtBearer(options =>
    {
        options.TokenValidationParameters = new TokenValidationParameters
        {
            ValidateIssuer = true,
            ValidateAudience = true,
            ValidateLifetime = true,
            ValidateIssuerSigningKey = true,
            ValidIssuer = jwtSection["Issuer"],
            ValidAudience = jwtSection["Audience"],
            IssuerSigningKey = new SymmetricSecurityKey(Encoding.UTF8.GetBytes(signingKey)),
            ClockSkew = TimeSpan.FromSeconds(30)
        };

        options.Events = new JwtBearerEvents
        {
            OnMessageReceived = context =>
            {
                var accessToken = context.Request.Query["access_token"];
                var path = context.HttpContext.Request.Path;
                if (!string.IsNullOrEmpty(accessToken) && path.StartsWithSegments("/hubs/pickup"))
                {
                    context.Token = accessToken;
                }
                return Task.CompletedTask;
            }
        };
    });

builder.Services.AddAuthorization(options =>
{
    options.AddPolicy("PlanningAccess", p => p.RequireRole(AppRoles.Commercial, AppRoles.Supervisor, AppRoles.Administrator));
    options.AddPolicy("ReceptionAccess", p => p.RequireRole(AppRoles.Reception, AppRoles.Supervisor, AppRoles.Administrator));
    options.AddPolicy("QueueAccess", p => p.RequireRole(AppRoles.Reception, AppRoles.CreditManager, AppRoles.Supervisor, AppRoles.Administrator));
    options.AddPolicy("CreditAccess", p => p.RequireRole(AppRoles.CreditManager));
    options.AddPolicy("WarehouseAccess", p => p.RequireRole(AppRoles.WarehouseOperator, AppRoles.Supervisor, AppRoles.Administrator));
    options.AddPolicy("SupervisorAccess", p => p.RequireRole(AppRoles.Supervisor, AppRoles.Administrator));
    options.AddPolicy("AdminAccess", p => p.RequireRole(AppRoles.Administrator));
    options.AddPolicy("DisplayAccess", p => p.RequireRole(AppRoles.DisplayDevice, AppRoles.Reception, AppRoles.Supervisor, AppRoles.Administrator));
});

builder.Services.AddHttpContextAccessor();
builder.Services.AddScoped<ICurrentUserService, CurrentUserService>();
builder.Services.AddSingleton<IDateTimeProvider, SystemDateTimeProvider>();

builder.Services.Configure<AxAifOptions>(builder.Configuration.GetSection(AxAifOptions.SectionName));
if (builder.Configuration.GetValue<bool>("UseMockAxAdapter"))
{
    builder.Services.AddSingleton<IAxPickupService, MockAxPickupService>();
}
else
{
    builder.Services.AddScoped<IAxPickupService, AxAifPickupService>();
}

builder.Services.AddScoped<IPickupPlanService, PickupPlanService>();
builder.Services.AddScoped<IReceptionService, ReceptionService>();
builder.Services.AddScoped<ICreditService, CreditService>();
builder.Services.AddScoped<IWarehouseService, WarehouseService>();
builder.Services.AddScoped<IPickupRealtimeNotifier, SignalRPickupNotifier>();
builder.Services.AddHostedService<IntegrationReconciliationWorker>();
builder.Services.AddHostedService<AbsentCutoffWorker>();

builder.Services.AddControllers()
    .AddJsonOptions(options =>
    {
        options.JsonSerializerOptions.Converters.Add(new JsonStringEnumConverter());
    });

builder.Services.AddSignalR();

var allowedOrigins = builder.Configuration.GetSection("Cors:AllowedOrigins").Get<string[]>() ?? ["http://localhost:4200"];
builder.Services.AddCors(options =>
{
    options.AddPolicy("UiCors", policy =>
    {
        policy.WithOrigins(allowedOrigins)
            .AllowAnyHeader()
            .AllowAnyMethod()
            .AllowCredentials();
    });
});

builder.Services.AddEndpointsApiExplorer();
builder.Services.AddSwaggerGen(options =>
{
    options.SwaggerDoc("v1", new OpenApiInfo
    {
        Title = "Client Pickup Ticket Management API",
        Version = "v1",
        Description = "ASP.NET Core Web API for Client Pickup Ticket Management integrated with Dynamics AX 2012 R3."
    });

    options.AddSecurityDefinition("Bearer", new OpenApiSecurityScheme
    {
        Name = "Authorization",
        Type = SecuritySchemeType.Http,
        Scheme = "bearer",
        BearerFormat = "JWT",
        In = ParameterLocation.Header,
        Description = "Enter JWT Bearer token."
    });

    options.AddSecurityRequirement(new OpenApiSecurityRequirement
    {
        {
            new OpenApiSecurityScheme
            {
                Reference = new OpenApiReference { Type = ReferenceType.SecurityScheme, Id = "Bearer" }
            },
            Array.Empty<string>()
        }
    });

    options.OperationFilter<SwaggerIdempotencyHeaderFilter>();
});

var app = builder.Build();

await IdentityDataSeeder.SeedAsync(
    app.Services,
    seedDevelopmentUsers: app.Environment.IsDevelopment(),
    builder.Configuration);

app.UseMiddleware<ExceptionHandlingMiddleware>();

if (app.Environment.IsDevelopment())
{
    app.UseSwagger();
    app.UseSwaggerUI();
}

app.UseHttpsRedirection();
app.UseCors("UiCors");
app.UseAuthentication();
app.UseAuthorization();
app.UseMiddleware<IdempotencyMiddleware>();

app.MapControllers();
app.MapHub<PickupHub>("/hubs/pickup");

app.Run();
