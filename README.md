# AegisTrader

> A deterministic Forex backtesting and paper trading simulation platform engineered for ICT / SMC trading frameworks.

**Lead Engineer:** Abi Binu · MCA Batch 2025–27

---

## 1. Project Overview

AegisTrader is a specialized, enterprise-grade trading simulation platform built for modern volume and structural trading frameworks — specifically Inner Circle Trader (ICT) and Smart Money Concepts (SMC). It provides a **deterministic historical replay engine** and a **real-time paper trading interface**, allowing traders to rigorously backtest strategies in a zero-risk sandbox environment.

### Project Goals
- Demonstrate rigorous full-stack enterprise development patterns (Controller → Service → Repository)
- Provide a zero-risk sandbox replicating real-world order execution mechanics
- Facilitate quantitative practice of ICT/SMC rulesets (liquidity sweeps, fair value gaps, order blocks)
- Generate professional-grade performance metrics: Win Rate, Profit Factor, and Max Drawdown

---

## 2. Technology Stack

| Domain | Technologies |
|--------|-------------|
| **Frontend** | React 19 (Hooks API), React Router v7, Axios, TradingView Lightweight Charts v5 |
| **Backend** | ASP.NET Core Web API (.NET 10 LTS) |
| **Database & ORM** | PostgreSQL, Entity Framework Core (Code-First migrations) |
| **Authentication** | JWT Bearer Security (BCrypt hashing, Register/Login flows, protected routes, AuthContext, Axios interceptors) |
| **Historical Data** | Dukascopy 1-minute OHLCV CSV → PostgreSQL bulk import |
| **Live Data Feed** | MetaTrader 5 (MT5) Python bridge — Vantage Markets Demo Account *(Phase 2)* |

### Live Data Architecture (MT5 Bridge — Phase 2)

Instead of a third-party REST API, AegisTrader's live price feed will be powered by a **local MT5 Python bridge** connecting to a **Vantage Markets demo account**:

```
[ Vantage MT5 Demo Account ]
         │  (MetaTrader 5 Terminal — local)
         ▼
[ Python Bridge Script ]   ← uses MetaTrader5 Python library
         │  POST /api/LivePrice/tick  (JSON tick data)
         ▼
[ ASP.NET Core LivePriceController ]
         │
         ▼
[ React Frontend — Live Forward Test Sandbox ]
```

This approach gives us:
- **Real institutional-grade price feeds** from Vantage (ECN pricing, 5-decimal Forex)
- **Zero API cost** — MT5 terminal is free, Vantage demo accounts are free
- **Full control** over tick rate and symbol selection (EURUSD, XAUUSD, etc.)
- Clean separation: historical replay uses PostgreSQL, live mode uses the MT5 bridge

The stub `LivePriceController` will be scaffolded in Phase 2 so the Python bridge only needs to `POST` tick data to a known endpoint.

---

## 3. System Architecture

```
[ React Frontend ]
      │  HTTP JSON + JWT Bearer Header
      ▼
[ ASP.NET Core Controllers ]
      │
      ▼
[ Business Logic Services ]
  ├── ReplayService    — Timestamp visibility barrier, step-forward logic
  ├── TradeService     — Overlap Constraint, pip P&L calculation
  └── AnalyticsService — Win Rate, Profit Factor, Max Drawdown
      │
      ▼
[ EF Core DbContext → PostgreSQL ]
```

---

## 4. Core Engine Specifications

### 4.1 The Historical Replay Clock

To eliminate look-ahead bias, the engine enforces a strict **timestamp visibility barrier** pulling up to 500 candles back for rich chart context:

```sql
SELECT * FROM Candlesticks
WHERE Symbol = @Symbol AND Timestamp <= @CurrentReplayTimestamp
ORDER BY Timestamp DESC LIMIT 500;
```

Every "Step Forward" interaction increments `CurrentReplayTimestamp` by the selected interval (1m / 5m / 15m / 1H / 4H) and returns only the newly visible data — the chart can never see the future.

### 4.2 The Overlap Constraint (Defensive Liquidation)

When a single candle's range violates **both** TP and SL simultaneously (e.g., a sharp spike), AegisTrader pessimistically defaults to a **Stop Loss closure** to reflect real-world adverse slippage:

| Scenario | Buy Order | Sell Order |
|----------|-----------|------------|
| TP hit only | Win — close at TP | Win — close at TP |
| SL hit only | Loss — close at SL | Loss — close at SL |
| Both hit (Overlap) | **Forced SL closure** | **Forced SL closure** |

### 4.3 Forex Financial Precision

All P&L is calculated using raw pip math — no percentage-based models:

```
Pips (Buy)  = (ExitPrice - EntryPrice) × 10,000
Pips (Sell) = (EntryPrice - ExitPrice) × 10,000
P&L = Pips × LotSize × PipValue ($10 per pip for standard lot on EURUSD)
```

### 4.4 Analytics Engine

Metrics computed via LINQ over the closed trades ledger:

| Metric | Formula |
|--------|---------|
| **Win Rate** | (Winning Trades / Total Trades) × 100 |
| **Profit Factor** | Gross Profit / Gross Loss |
| **Max Drawdown** | Peak-to-trough equity curve: tracks the worst capital decline from any high-water mark |

---

## 5. Database Schema

```
Users
  └── Id (UUID PK), Username, Email, PasswordHash, CreatedAt

TradingSessions
  └── Id (UUID PK), UserId (FK → Users), Symbol, Type (Replay/LivePaper),
      InitialBalance, CurrentBalance, CurrentReplayTimestamp, CreatedAt

Candlesticks
  └── Id (BigInt PK), Symbol, Timestamp, Open, High, Low, Close, Volume
  └── INDEX on (Symbol, Timestamp) — optimized for replay queries

Trades
  └── Id (UUID PK), SessionId (FK → TradingSessions), Direction (Buy/Sell),
      Status (Open/Closed), EntryPrice, StopLoss, TakeProfit, LotSize,
      ExitPrice, PnL, OpenedAt, ClosedAt
```

---

## 6. Current Build Status

| Module | Status |
|--------|--------|
| PostgreSQL schema & EF Core migrations | ✅ Complete |
| Dukascopy CSV data seeder | ✅ Complete — Over 1M rows (EURUSD, 2024–2026) |
| Historical Replay Engine (ReplayService) | ✅ Complete (pulls 500 visible candles) |
| Overlap Constraint (TradeService) | ✅ Complete |
| Analytics Engine (MaxDrawdown) | ✅ Complete |
| Swagger / OpenAPI | ✅ Active at `/swagger` |
| React Replay UI (TV Visuals, SMA(20), Volume Histogram) | ✅ Complete |
| Step-Forward Controls (+1m/+5m/+15m/+1H/+4H) | ✅ Complete |
| Real-time Dynamic Floating P&L | ✅ Complete (Unrealized P&L updates live on every tick) |
| Session Balance Auto-Update on Trade Close | ✅ Complete (Persists to database on trade exit) |
| Trade History Panel | ✅ Complete |
| Analytics Dashboard Page | ✅ Complete |
| React Router (`/replay`, `/analytics/:id`) | ✅ Complete |
| JWT Authentication | ✅ Complete (BCrypt register/login, token storage, interceptors) |
| MT5 Python Live Price Bridge | 🔲 Planned (Phase 2) |
| Candle Timeframe Aggregation (5m/15m/1H) | 🔲 Planned |

---

## 7. Developer Setup

### Prerequisites
- [.NET 10 SDK](https://dotnet.microsoft.com/download)
- [Node.js 20+](https://nodejs.org)
- [PostgreSQL 16](https://www.postgresql.org/download/)
- MetaTrader 5 Terminal *(Phase 2 only)*

### Backend (ASP.NET Core API)

```bash
# 1. Configure your PostgreSQL connection string in:
#    AegisTrader.API/appsettings.json → ConnectionStrings → DefaultConnection

# 2. Apply database migrations
cd AegisTrader.API
dotnet ef database update

# 3. Run the API server (port 5273)
dotnet run
# Swagger UI available at: http://localhost:5273/swagger
```

### Seed Historical Data

The seeder expects a **Dukascopy-format semicolon-delimited CSV**:
```
20260501 000100;1.12345;1.12360;1.12330;1.12350;100
```

Trigger the import via the API:
```
POST http://localhost:5273/api/Seed/import-eurusd?filePath=C:\path\to\EURUSD_1m.csv
```

Verify the seed completed:
```
GET http://localhost:5273/api/Seed/status?symbol=EURUSD
→ { "symbol": "EURUSD", "count": 1000000, "earliestCandle": "...", "latestCandle": "..." }
```

### Frontend (React + Vite)

```bash
cd AegisTrader.Frontend
npm install
npm run dev
# App available at: http://localhost:5173
```

---

## 8. API Endpoint Reference

| Method | Endpoint | Description |
|--------|----------|-------------|
| `POST` | `/api/Auth/register` | Register a new user with secure BCrypt hashing |
| `POST` | `/api/Auth/login` | Authenticate user and obtain a JWT bearer token |
| `GET` | `/api/Seed/status?symbol=EURUSD` | Diagnostics: candle count & database date range |
| `POST` | `/api/Seed/import-file?filePath=...` | Bulk import single CSV file |
| `POST` | `/api/Replay/start?symbol=EURUSD&startTime=...` | Create a new replay session |
| `GET` | `/api/Replay/{sessionId}/candles` | Get visible candles (last 500) |
| `POST` | `/api/Replay/{sessionId}/step?minutes=15` | Advance replay clock, returns new time & current balance |
| `POST` | `/api/Trade/open?sessionId=...&direction=Buy&sl=...&tp=...&lots=...` | Place a trade at market |
| `GET` | `/api/Trade/history/{sessionId}` | Get all trades for a session |
| `GET` | `/api/Trade/analytics/{sessionId}` | Get Win Rate, PF, Drawdown |

---

*AegisTrader — Enterprise Forex Backtesting Platform*
