using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace AegisTrader.API.Migrations
{
    /// <inheritdoc />
    public partial class AddTrades : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.CreateTable(
                name: "Trades",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    SessionId = table.Column<Guid>(type: "uuid", nullable: false),
                    Direction = table.Column<int>(type: "integer", nullable: false),
                    Status = table.Column<int>(type: "integer", nullable: false),
                    EntryPrice = table.Column<decimal>(type: "numeric(18,6)", nullable: false),
                    StopLoss = table.Column<decimal>(type: "numeric(18,6)", nullable: false),
                    TakeProfit = table.Column<decimal>(type: "numeric(18,6)", nullable: false),
                    LotSize = table.Column<decimal>(type: "numeric(18,6)", nullable: false),
                    ExitPrice = table.Column<decimal>(type: "numeric", nullable: true),
                    PnL = table.Column<decimal>(type: "numeric(18,6)", nullable: false),
                    OpenedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    ClosedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_Trades", x => x.Id);
                });
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "Trades");
        }
    }
}
