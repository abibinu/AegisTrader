# AegisTrader — Gantt & PERT Charts (June 8 – September 6)

> **Chapter 6: System Planning & Scheduling Diagrams**  
> Timeline: **June 8, 2026 – September 6, 2026** (13 Weeks)

---

## 1. Gantt Chart (Project Schedule & Milestones)

```mermaid
gantt
    dateFormat  YYYY-MM-DD
    title AegisTrader Development Timeline (June 8 - Sep 6)
    axisFormat  %b %d

    section Phase 1: Requirements & Analysis
    Literature Survey & Problem Statement       :active, p1a, 2026-06-08, 2026-06-14
    Feasibility Study & SRS Documentation       :p1b, 2026-06-15, 2026-06-21

    section Phase 2: System Architecture & DB
    Layered Controller-Service Architecture     :p2a, 2026-06-22, 2026-06-28
    PostgreSQL Database Schema & EF Core Mapping:p2b, 2026-06-29, 2026-07-05

    section Phase 3: Core Backend & Replay Engine
    ASP.NET Core API Setup & JWT Auth (BCrypt)  :p3a, 2026-07-06, 2026-07-12
    Replay Engine & Anti-Lookahead Barrier      :p3b, 2026-07-13, 2026-07-19
    Server-Side MTF Aggregation Service         :p3c, 2026-07-20, 2026-07-26

    section Phase 4: Live Bridge & Execution
    Python MT5 Live Price Bridge (500ms IPC)    :p4a, 2026-07-27, 2026-08-02
    Trade Service & Overlap Resolution Engine   :p4b, 2026-08-03, 2026-08-09
    Quantitative Analytics Engine               :p4c, 2026-08-10, 2026-08-16

    section Phase 5: Frontend UI & Charts
    React 19 Frontend & Tailwind CSS Layout     :p5a, 2026-08-17, 2026-08-23
    TradingView Lightweight Charts Integration  :p5b, 2026-08-24, 2026-08-30

    section Phase 6: Testing & Final MVP
    Integration Testing & Performance Tuning    :p6a, 2026-08-31, 2026-09-03
    Project Documentation & Presentation Script :crit, p6b, 2026-09-04, 2026-09-06
```

---

## 2. PERT Chart (Multi-Branch Parallel Work Stream Layout)

```mermaid
flowchart TD
    %% Milestone Start Node
    Start(("Start Project<br/>June 08"))

    %% Initial Core Requirements
    T1["T1: Requirements & SRS Analysis<br/>(Jun 08 - Jun 21 | 14 Days)"]
    T2["T2: System Architecture & DB Design<br/>(Jun 22 - Jul 05 | 14 Days)"]

    Start --> T1 --> T2

    %% Branching Parallel Work Streams
    subgraph StreamA ["Stream A: Core Backend & Replay Engine"]
        T3["T3: JWT Auth & API Scaffold<br/>(Jul 06 - Jul 12 | 7 Days)"]
        T4["T4: Replay Engine & Barrier<br/>(Jul 13 - Jul 19 | 7 Days)"]
        T5["T5: Server MTF Aggregation<br/>(Jul 20 - Jul 26 | 7 Days)"]
        T3 --> T4 --> T5
    end

    subgraph StreamB ["Stream B: Live Bridge & Execution Mechanics"]
        T6["T6: Python MT5 Live Bridge<br/>(Jul 27 - Aug 02 | 7 Days)"]
        T7["T7: Trade Execution & Overlap Engine<br/>(Aug 03 - Aug 09 | 7 Days)"]
        T6 --> T7
    end

    subgraph StreamC ["Stream C: Frontend Client & Chart Canvas"]
        T8["T8: React 19 & Tailwind UI<br/>(Aug 17 - Aug 23 | 7 Days)"]
        T9["T9: TradingView Charts Canvas<br/>(Aug 24 - Aug 30 | 7 Days)"]
        T8 --> T9
    end

    %% Parallel Branch Trigger Connections
    T2 --> T3
    T2 --> T6
    T2 --> T8

    %% Convergence Node
    T10["T10: Quantitative Analytics Engine<br/>(Aug 10 - Aug 16 | 7 Days)"]
    T5 --> T10
    T7 --> T10
    T9 --> T10

    %% Final Testing & Release
    T11["T11: Integration & Performance Testing<br/>(Aug 31 - Sep 03 | 4 Days)"]
    T12["T12: Documentation & Presentation Prep<br/>(Sep 04 - Sep 06 | 3 Days)"]
    Finish(("MVP Release & Evaluation<br/>September 06"))

    T10 --> T11 --> T12 --> Finish

    %% Critical Path Highlighting (Red Border)
    style Start fill:#2563EB,stroke:#1D4ED8,color:#FFFFFF,stroke-width:2px;
    style Finish fill:#16A34A,stroke:#15803D,color:#FFFFFF,stroke-width:2px;
    style T1 stroke:#DC2626,stroke-width:3px;
    style T2 stroke:#DC2626,stroke-width:3px;
    style T3 stroke:#DC2626,stroke-width:3px;
    style T4 stroke:#DC2626,stroke-width:3px;
    style T5 stroke:#DC2626,stroke-width:3px;
    style T10 stroke:#DC2626,stroke-width:3px;
    style T11 stroke:#DC2626,stroke-width:3px;
    style T12 stroke:#DC2626,stroke-width:3px;
```

---

## 3. PERT Critical Path Task Table

| Task ID | Task Description | Predecessors | Optimistic ($O$) | Most Likely ($M$) | Pessimistic ($P$) | Expected ($T_e$) | Critical Path? |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| **T1** | Requirements & SRS Analysis | - | 10 days | 14 days | 18 days | **14.0 days** | Yes |
| **T2** | Architecture & DB Design | T1 | 10 days | 14 days | 18 days | **14.0 days** | Yes |
| **T3** | Auth & API Scaffold | T2 | 5 days | 7 days | 9 days | **7.0 days** | No |
| **T4** | Replay Engine & Timestamp Barrier | T3 | 5 days | 7 days | 9 days | **7.0 days** | Yes |
| **T5** | MTF Server-Side Aggregation | T4 | 5 days | 7 days | 9 days | **7.0 days** | Yes |
| **T6** | Python MT5 Live Price Bridge | T5 | 5 days | 7 days | 9 days | **7.0 days** | No |
| **T7** | Trade Execution & Overlap Engine | T6 | 5 days | 7 days | 9 days | **7.0 days** | Yes |
| **T8** | Analytics Service | T7 | 5 days | 7 days | 9 days | **7.0 days** | No |
| **T9** | React 19 Frontend UI Setup | T8 | 5 days | 7 days | 9 days | **7.0 days** | No |
| **T10** | TradingView Charts Canvas | T9 | 5 days | 7 days | 9 days | **7.0 days** | Yes |
| **T11** | Integration & Performance Testing | T10 | 3 days | 4 days | 5 days | **4.0 days** | Yes |
| **T12** | Documentation & Presentation Prep | T11 | 2 days | 3 days | 4 days | **3.0 days** | Yes |

*Formula used:* $T_e = \frac{O + 4M + P}{6}$
