# AegisTrader

## 1. Project Overview
AegisTrader is a specialized trading simulation platform engineered specifically for modern volume and structural trading frameworks, such as Inner Circle Trader (ICT) and Smart Money Concepts (SMC). The primary engineering objective is to provide a deterministic historical replay engine and a real-time paper trading interface, allowing students to backtest strategies without capital exposure.

### Project Goals
* Demonstrate rigorous full-stack enterprise development patterns.
* Provide a zero-risk sandbox environment simulating order execution mechanics.
* Facilitate quantitative practice of ICT/SMC rulesets (e.g., liquidity sweeps, fair value gaps).
* Generate professional-grade quantitative trading performance metrics and analytics.

## 2. Technology Stack
The platform utilizes a decoupled, modern web architecture optimized for high-performance data processing.

* **Backend Framework:** ASP.NET Core Web API (.NET 10 LTS)
* **Frontend Architecture:** React (Functional Components, Hooks API) with React Router
* **Database Engine:** PostgreSQL (ACID compliant, transaction-safe historical storage)
* **ORM:** Entity Framework Core (Code-First migration strategy)
* **Authentication:** JWT Bearer Authentication (Cryptographically signed symmetric tokens)
* **Data Visualization:** TradingView Financial Lightweight Charts
* **Live Market Routing:** CurrencyFreaks API & ExchangeRate.host

## 3. System Architecture
The system utilizes a clean, decoupled Controller-Service-Repository architecture pattern. Requests stream linearly from the client to endpoints, which abstract core execution rules into dedicated service boundaries before persistence layers interact with the database engine.

### Execution Flow
1. **Client Layer:** React Frontend View dispatches HTTP JSON Requests with JWT Bearer Headers.
2. **Routing Layer:** ASP.NET Core API Routing / Controllers handle incoming traffic.
3. **Business Logic Layer:** Application Services manage the Replay Engine and Trade Evaluation.
4. **Data Access Layer:** Entity Framework Core DbContext translates logic.
5. **Storage Layer:** PostgreSQL Database Engine persists the data.

## 4. Core Execution Engine Specifications

### The Historical Replay Clock
To avoid look-ahead bias during historical backtesting simulations, the application implements a strict timestamp visibility barrier. When a historical replay session initializes, a CurrentReplayTimestamp pointer is set at the historical start date. The server restricts chart delivery by enforcing that candlestick timestamps must be less than or equal to the current replay timestamp.

### The Overlap Constraint (Defensive Liquidation)
AegisTrader implements highly conservative liquidation criteria to guarantee realistic performance reporting against adverse real-world slippage.

If a single historical candle features a range that violates both the Take Profit (TP) and Stop Loss (SL) boundaries simultaneously:
* **Buy Orders:** The execution engine defaults to a pessimistic assumption, processing the order strictly as a Stop Loss closure.
* **Sell Orders:** The system immediately processes the order as a Stop Loss closure.

### Financial Precision Realignment
AegisTrader bypasses standard percentage-based cryptocurrency calculations. The financial mathematics are built entirely around raw Pip calculations optimized for Forex pairs (EURUSD, XAUUSD). Pricing relies on fractional precision down to five decimal places (0.00001) for currencies and two decimal places (0.01) for commodities.

## 5. Database Schema
The physical data layer enforces structural integrity via foreign keys and strict relational constraints.

* **Users:** Id (UUID), Username, Email, PasswordHash, CreatedAt
* **TradingSessions:** Id (UUID), UserId (FK), Session Type (Replay/Forward), Account Balance, BaseCurrency, CurrentReplayTimestamp
* **Candlesticks:** Id (BigInt), Symbol, Timestamp, Open, High, Low, Close, Volume
* **Trades:** Id (UUID), SessionId (FK), Direction (Buy/Sell), EntryPrice, StopLoss, TakeProfit, LotSize, PnL, Status (Open/Closed)

## 6. Developer Initialization
*(To be populated post-scaffolding)*

1. Database Connection Strings
2. Entity Framework Update Commands
3. .NET CLI Build Instructions
4. Node Package Manager Installation

---
**Lead Engineer:** Abi Binu