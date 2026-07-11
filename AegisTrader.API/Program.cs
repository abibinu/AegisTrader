using System.Text;
using AegisTrader.API.Data;
using AegisTrader.API.Services;
using Microsoft.AspNetCore.Authentication.JwtBearer;
using Microsoft.EntityFrameworkCore;
using Microsoft.IdentityModel.Tokens;

var builder = WebApplication.CreateBuilder(args);

// ── Controllers & API Explorer ────────────────────────────────────────────────
builder.Services.AddControllers();
builder.Services.AddEndpointsApiExplorer();

// ── Swagger ───────────────────────────────────────────────────────────────────
// Note: Bearer security UI config requires Microsoft.OpenApi v2 types which
// conflict with Swashbuckle v10 in .NET 10. We keep Swagger simple here —
// auth testing is done via the React frontend or Postman.
builder.Services.AddSwaggerGen();

// ── Database ──────────────────────────────────────────────────────────────────
var connectionString = builder.Configuration.GetConnectionString("DefaultConnection");
builder.Services.AddDbContext<AegisDbContext>(options =>
    options.UseNpgsql(connectionString));

// ── JWT Authentication ────────────────────────────────────────────────────────
// LEARNING: This registers the JWT Bearer middleware. When a request arrives
// with an "Authorization: Bearer eyJ..." header, this middleware:
//   1. Parses the token
//   2. Validates the signature using our secret key
//   3. Checks the expiry date
//   4. Populates HttpContext.User with the Claims from the token
//
// If validation fails, the request is automatically rejected with 401.
// If we DON'T call UseAuthentication(), the [Authorize] attribute does nothing.

var jwtKey = builder.Configuration["Jwt:Key"]!;

builder.Services.AddAuthentication(JwtBearerDefaults.AuthenticationScheme)
    .AddJwtBearer(options =>
    {
        options.TokenValidationParameters = new TokenValidationParameters
        {
            ValidateIssuer           = true,
            ValidateAudience         = true,
            ValidateLifetime         = true,    // rejects expired tokens
            ValidateIssuerSigningKey = true,
            ValidIssuer              = builder.Configuration["Jwt:Issuer"],
            ValidAudience            = builder.Configuration["Jwt:Audience"],
            IssuerSigningKey         = new SymmetricSecurityKey(
                                            Encoding.UTF8.GetBytes(jwtKey)),
            ClockSkew                = TimeSpan.Zero, // no grace period on expiry
        };
    });

builder.Services.AddAuthorization();

// ── Application Services (Dependency Injection) ───────────────────────────────
builder.Services.AddScoped<AuthService>();
builder.Services.AddScoped<DataImportService>();
builder.Services.AddScoped<AnalyticsService>();
builder.Services.AddScoped<ReplayService>();
builder.Services.AddScoped<TradeService>();

// ── CORS ──────────────────────────────────────────────────────────────────────
builder.Services.AddCors(options =>
{
    options.AddPolicy("AllowAll", p =>
        p.AllowAnyOrigin().AllowAnyMethod().AllowAnyHeader());
});

// ── Build & Configure Middleware Pipeline ─────────────────────────────────────
var app = builder.Build();

// LEARNING: Middleware ORDER matters in ASP.NET Core.
// The request passes through each middleware in the order they're added.
// CORS must come before Auth so preflight OPTIONS requests are handled first.
// Authentication must come before Authorization.

app.UseCors("AllowAll");

app.UseSwagger();
app.UseSwaggerUI(c =>
{
    c.SwaggerEndpoint("/swagger/v1/swagger.json", "AegisTrader API V1");
    c.RoutePrefix = "swagger";
});

if (!app.Environment.IsDevelopment())
{
    app.UseHttpsRedirection();
}

// Health check — anonymous, no auth needed
app.MapGet("/", () => "AegisTrader API is running ✅");

// ── CRITICAL ORDER: Authentication → Authorization ────────────────────────────
// UseAuthentication() reads the JWT and populates User claims.
// UseAuthorization() then checks those claims against [Authorize] attributes.
// Swapping these two will break auth silently.
app.UseAuthentication();
app.UseAuthorization();

app.MapControllers();

app.Run();
