using System.IdentityModel.Tokens.Jwt;
using System.Security.Claims;
using System.Text;
using AegisTrader.API.Data;
using AegisTrader.Core.Entities;
using Microsoft.EntityFrameworkCore;
using Microsoft.IdentityModel.Tokens;

namespace AegisTrader.API.Services;

// ─── DTOs (Data Transfer Objects) ────────────────────────────────────────────
// These are simple records the controller accepts / returns.
// They are NOT database entities — they only carry data over HTTP.

public record RegisterRequest(string Username, string Email, string Password);
public record LoginRequest(string Email, string Password);
public record AuthResponse(string Token, Guid UserId, string Username, DateTime ExpiresAt);

// ─── AuthService ──────────────────────────────────────────────────────────────

public class AuthService
{
    private readonly AegisDbContext _context;
    private readonly IConfiguration _config;

    // LEARNING: IConfiguration lets us read from appsettings.json.
    // The values we added under "Jwt": { "Key": "...", ... } are accessible here.
    public AuthService(AegisDbContext context, IConfiguration config)
    {
        _context = context;
        _config = config;
    }

    // ── Register ─────────────────────────────────────────────────────────────

    public async Task<(bool Success, string Message)> Register(RegisterRequest req)
    {
        // 1. Uniqueness checks
        if (await _context.Users.AnyAsync(u => u.Email == req.Email))
            return (false, "An account with this email already exists.");

        if (await _context.Users.AnyAsync(u => u.Username == req.Username))
            return (false, "This username is already taken.");

        // 2. Password validation
        if (string.IsNullOrWhiteSpace(req.Password) || req.Password.Length < 6)
            return (false, "Password must be at least 6 characters.");

        // 3. BCrypt hashing
        // LEARNING: BCrypt.HashPassword takes the plaintext and generates a
        // cryptographic hash like "$2a$11$XZv...". The "11" is the work factor —
        // it controls how slow the hash is (slower = harder to brute-force).
        // NEVER store plaintext passwords. Even if the database is leaked,
        // a BCrypt hash cannot be reversed to the original password.
        var passwordHash = BCrypt.Net.BCrypt.HashPassword(req.Password, workFactor: 11);

        var user = new User
        {
            Username = req.Username,
            Email    = req.Email.ToLowerInvariant(),
            PasswordHash = passwordHash,
        };

        _context.Users.Add(user);
        await _context.SaveChangesAsync();

        return (true, "Registration successful.");
    }

    // ── Login ─────────────────────────────────────────────────────────────────

    public async Task<AuthResponse?> Login(LoginRequest req)
    {
        // 1. Find the user by email (case-insensitive)
        var user = await _context.Users
            .FirstOrDefaultAsync(u => u.Email == req.Email.ToLowerInvariant());

        if (user == null) return null;

        // 2. Verify the password against the stored BCrypt hash
        // LEARNING: BCrypt.Verify takes the raw plaintext password the user just
        // typed, and the stored hash. It re-hashes using the same salt and work
        // factor embedded inside the hash string, then compares. We never see
        // the original password again after registration.
        var passwordValid = BCrypt.Net.BCrypt.Verify(req.Password, user.PasswordHash);
        if (!passwordValid) return null;

        // 3. Generate the JWT token
        return GenerateToken(user);
    }

    // ── Token Generation ──────────────────────────────────────────────────────

    private AuthResponse GenerateToken(User user)
    {
        // LEARNING: A JWT has 3 parts separated by dots: Header.Payload.Signature
        //
        // Header  : algorithm (HS256) + type (JWT)
        // Payload : Claims — statements about the user (who they are, when the token expires)
        // Signature: HMAC of (Header + Payload) using the secret key
        //
        // The frontend receives the token and can READ the payload without the key,
        // but CANNOT FORGE a new valid signature without the secret — that's the security.

        var key = new SymmetricSecurityKey(
            Encoding.UTF8.GetBytes(_config["Jwt:Key"]!));

        var credentials = new SigningCredentials(key, SecurityAlgorithms.HmacSha256);

        var expiryDays = int.Parse(_config["Jwt:ExpiryDays"] ?? "7");
        var expiresAt = DateTime.UtcNow.AddDays(expiryDays);

        // Claims = the "facts" we embed in the token payload
        var claims = new[]
        {
            // NameIdentifier is the standard claim for a user's unique ID
            new Claim(ClaimTypes.NameIdentifier, user.Id.ToString()),
            new Claim(ClaimTypes.Name,           user.Username),
            new Claim(ClaimTypes.Email,          user.Email),
        };

        var token = new JwtSecurityToken(
            issuer:   _config["Jwt:Issuer"],
            audience: _config["Jwt:Audience"],
            claims:   claims,
            expires:  expiresAt,
            signingCredentials: credentials
        );

        var tokenString = new JwtSecurityTokenHandler().WriteToken(token);

        return new AuthResponse(tokenString, user.Id, user.Username, expiresAt);
    }
}
