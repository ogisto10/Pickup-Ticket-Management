namespace PickupManagement.Application.Common.Exceptions;

public class DomainValidationException : Exception
{
    public string ErrorCode { get; }

    public DomainValidationException(string message, string errorCode = "VALIDATION_ERROR")
        : base(message)
    {
        ErrorCode = errorCode;
    }
}

public class ResourceNotFoundException : Exception
{
    public ResourceNotFoundException(string message) : base(message)
    {
    }
}

public class ConflictException : Exception
{
    public ConflictException(string message) : base(message)
    {
    }
}
