using AegisTrader.API.Data;
using AegisTrader.API.Services;
using Microsoft.EntityFrameworkCore;

var builder = WebApplication.CreateBuilder(args);

builder.Services.AddControllers();
builder.Services.AddEndpointsApiExplorer();

builder.Services.AddSwaggerGen(); 

var connectionString = builder.Configuration.GetConnectionString("DefaultConnection");
builder.Services.AddDbContext<AegisDbContext>(options =>
    options.UseNpgsql(connectionString));

builder.Services.AddScoped<DataImportService>();
builder.Services.AddScoped<ReplayService>();
builder.Services.AddScoped<TradeService>();

var app = builder.Build();

app.UseSwagger();
app.UseSwaggerUI(c =>
{
    c.SwaggerEndpoint("/swagger/v1/swagger.json", "AegisTrader API V1");
    c.RoutePrefix = "swagger"; // This makes it available at /swagger
});

if (!app.Environment.IsDevelopment())
{
    app.UseHttpsRedirection();
}

// Health check endpoint
app.MapGet("/", () => "AegisTrader API is running");

app.UseAuthorization();

app.MapControllers();

app.Run();
