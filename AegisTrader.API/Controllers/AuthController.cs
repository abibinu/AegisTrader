using AegisTrader.API.Services;
using Microsoft.AspNetCore.Mvc;

namespace AegisTrader.API.Controllers;

/// <summary>
/// Handles user registration and login.
/// These endpoints are intentionally ANONYMOUS — they're how you GET a token.
/// Every other controller will require [Authorize].
/// </summary>
[ApiController]
[Route("api/[controller]")]
public class AuthController : ControllerBase
{
    private readonly AuthService _authService;

    public AuthController(AuthService authService)
    {
        _authService = authService;
    }

    /// <summary>
    /// Register a new user account.
    /// POST /api/Auth/register
    /// Body: { "username": "abi", "email": "abi@test.com", "password": "mypassword" }
    /// </summary>
    [HttpPost("register")]
    public async Task<IActionResult> Register([FromBody] RegisterRequest req)
    {
        // Validate that the request body is not null / fields are not empty
        if (string.IsNullOrWhiteSpace(req.Username) ||
            string.IsNullOrWhiteSpace(req.Email) ||
            string.IsNullOrWhiteSpace(req.Password))
        {
            return BadRequest("Username, email, and password are required.");
        }

        var (success, message) = await _authService.Register(req);

        if (!success)
        {
            // 409 Conflict is the correct HTTP status for "resource already exists"
            return Conflict(new { message });
        }

        return Ok(new { message });
    }

    /// <summary>
    /// Login and receive a JWT token.
    /// POST /api/Auth/login
    /// Body: { "email": "abi@test.com", "password": "mypassword" }
    /// Returns: { "token": "eyJ...", "userId": "...", "username": "abi", "expiresAt": "..." }
    /// </summary>
    [HttpPost("login")]
    public async Task<IActionResult> Login([FromBody] LoginRequest req)
    {
        if (string.IsNullOrWhiteSpace(req.Email) || string.IsNullOrWhiteSpace(req.Password))
            return BadRequest("Email and password are required.");

        var result = await _authService.Login(req);

        if (result == null)
        {
            // LEARNING: Always return 401 for "wrong email OR wrong password".
            // Never tell the user WHICH one was wrong — that leaks info to attackers.
            return Unauthorized(new { message = "Invalid email or password." });
        }

        return Ok(result);
    }
}
