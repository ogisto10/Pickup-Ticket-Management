namespace PickupManagement.Application.Common.Interfaces;

public interface ICurrentUserService
{
    string UserId { get; }
    string UserName { get; }
    IReadOnlyCollection<string> Roles { get; }
    bool IsInRole(string role);
}

public interface IDateTimeProvider
{
    DateTime UtcNow { get; }
}
