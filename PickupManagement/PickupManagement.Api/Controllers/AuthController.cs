using System.IdentityModel.Tokens.Jwt;
using System.Security.Claims;
using System.Text;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Identity;
using Microsoft.AspNetCore.Mvc;
using Microsoft.IdentityModel.Tokens;
using PickupManagement.Domain.Enums;
using PickupManagement.Infrastructure.Persistence;

namespace PickupManagement.Api.Controllers;

[ApiController]
[Route("api/auth")]
public class AuthController : ControllerBase
{
    private readonly UserManager<ApplicationUser> _userManager;
    private readonly SignInManager<ApplicationUser> _signInManager;
    private readonly IConfiguration _configuration;

    public AuthController(
        UserManager<ApplicationUser> userManager,
        SignInManager<ApplicationUser> signInManager,
        IConfiguration configuration)
    {
        _userManager = userManager;
        _signInManager = signInManager;
        _configuration = configuration;
    }

    [HttpPost("login")]
    [AllowAnonymous]
    [ProducesResponseType(typeof(LoginResponse), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status401Unauthorized)]
    public async Task<ActionResult<LoginResponse>> Login([FromBody] LoginRequest request)
    {
        var user = await _userManager.FindByNameAsync(request.UserName);
        if (user is null || !user.IsActive)
        {
            return Unauthorized(new { message = "Invalid credentials or inactive account." });
        }

        var check = await _signInManager.CheckPasswordSignInAsync(user, request.Password, lockoutOnFailure: true);
        if (!check.Succeeded)
        {
            return Unauthorized(new { message = "Invalid credentials." });
        }

        var roles = await _userManager.GetRolesAsync(user);
        var (token, expiresAt) = GenerateJwt(user, roles);

        return Ok(new LoginResponse(
            token,
            expiresAt,
            new UserProfileDto(user.Id, user.UserName!, user.FullName, user.Email, user.WarehouseId, roles.ToArray())));
    }

    [HttpGet("me")]
    [Authorize]
    [ProducesResponseType(typeof(UserProfileDto), StatusCodes.Status200OK)]
    public async Task<ActionResult<UserProfileDto>> Me()
    {
        var userId = User.FindFirstValue(ClaimTypes.NameIdentifier);
        if (userId is null)
        {
            return Unauthorized();
        }

        var user = await _userManager.FindByIdAsync(userId);
        if (user is null || !user.IsActive)
        {
            return Unauthorized();
        }

        var roles = await _userManager.GetRolesAsync(user);
        return Ok(new UserProfileDto(user.Id, user.UserName!, user.FullName, user.Email, user.WarehouseId, roles.ToArray()));
    }

    [HttpPost("users")]
    [Authorize(Roles = AppRoles.Administrator)]
    [ProducesResponseType(typeof(UserProfileDto), StatusCodes.Status201Created)]
    [ProducesResponseType(StatusCodes.Status400BadRequest)]
    public async Task<ActionResult<UserProfileDto>> CreateUser([FromBody] CreateUserRequest request)
    {
        if (!AppRoles.All.Contains(request.Role))
        {
            return BadRequest(new { message = $"Unknown role '{request.Role}'." });
        }

        var user = new ApplicationUser
        {
            Id = Guid.NewGuid(),
            UserName = request.UserName.Trim(),
            Email = request.Email.Trim(),
            FullName = request.FullName.Trim(),
            WarehouseId = request.WarehouseId?.Trim(),
            IsActive = true,
            EmailConfirmed = true,
            CreatedAt = DateTime.UtcNow
        };

        var result = await _userManager.CreateAsync(user, request.Password);
        if (!result.Succeeded)
        {
            return BadRequest(new { errors = result.Errors.Select(e => e.Description) });
        }

        await _userManager.AddToRoleAsync(user, request.Role);

        var profile = new UserProfileDto(user.Id, user.UserName!, user.FullName, user.Email, user.WarehouseId, [request.Role]);
        return CreatedAtAction(nameof(Me), profile);
    }

    private (string Token, DateTime ExpiresAt) GenerateJwt(ApplicationUser user, IList<string> roles)
    {
        var jwtSection = _configuration.GetSection("Jwt");
        var signingKey = jwtSection["SigningKey"]
            ?? throw new InvalidOperationException("Jwt:SigningKey is not configured.");
        var issuer = jwtSection["Issuer"] ?? "PickupManagement.Api";
        var audience = jwtSection["Audience"] ?? "PickupManagement.Ui";
        var minutes = int.TryParse(jwtSection["AccessTokenMinutes"], out var m) ? m : 480;

        var expiresAt = DateTime.UtcNow.AddMinutes(minutes);
        var claims = new List<Claim>
        {
            new(JwtRegisteredClaimNames.Sub, user.Id.ToString()),
            new(ClaimTypes.NameIdentifier, user.Id.ToString()),
            new(ClaimTypes.Name, user.UserName ?? string.Empty),
            new("fullName", user.FullName),
            new(JwtRegisteredClaimNames.Jti, Guid.NewGuid().ToString())
        };

        if (!string.IsNullOrWhiteSpace(user.WarehouseId))
        {
            claims.Add(new Claim("warehouseId", user.WarehouseId));
        }

        foreach (var role in roles)
        {
            claims.Add(new Claim(ClaimTypes.Role, role));
        }

        var key = new SymmetricSecurityKey(Encoding.UTF8.GetBytes(signingKey));
        var credentials = new SigningCredentials(key, SecurityAlgorithms.HmacSha256);

        var token = new JwtSecurityToken(
            issuer: issuer,
            audience: audience,
            claims: claims,
            expires: expiresAt,
            signingCredentials: credentials);

        return (new JwtSecurityTokenHandler().WriteToken(token), expiresAt);
    }
}

public record LoginRequest(string UserName, string Password);

public record LoginResponse(string AccessToken, DateTime ExpiresAt, UserProfileDto User);

public record UserProfileDto(
    Guid Id,
    string UserName,
    string FullName,
    string? Email,
    string? WarehouseId,
    string[] Roles);

public record CreateUserRequest(
    string UserName,
    string Email,
    string FullName,
    string Password,
    string Role,
    string? WarehouseId);
