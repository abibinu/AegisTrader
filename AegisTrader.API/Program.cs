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
builder.Services.AddScoped<AnalyticsService>();
builder.Services.AddScoped<ReplayService>();
builder.Services.AddScoped<TradeService>();
builder.Services.AddCors(options => {
    options.AddPolicy("AllowAll", p => p.AllowAnyOrigin().AllowAnyMethod().AllowAnyHeader());
});

var app = builder.Build();

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

// Health check endpoint
app.MapGet("/", () => "AegisTrader API is running");

app.UseAuthorization();

app.MapControllers();

app.Run();
