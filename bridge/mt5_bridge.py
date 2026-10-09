import sys
import time
import random
import requests

# Target API settings
API_URL = "http://localhost:5273/api/LivePrice/tick"
TICK_INTERVAL_SEC = 0.5  # Send ticks every 500ms for all assets

# Supported symbols list
TARGET_SYMBOLS = ["EURUSD", "GBPUSD", "USDJPY", "AUDUSD", "XAUUSD", "BTCUSD"]

# Potential broker symbol aliases (in case MT5 broker names Gold as GOLD or EURUSD as EURUSD.v)
SYMBOL_ALIASES = {
    "EURUSD": ["EURUSD", "EURUSD.v", "EURUSDm", "EURUSD+"],
    "GBPUSD": ["GBPUSD", "GBPUSD.v", "GBPUSDm", "GBPUSD+"],
    "USDJPY": ["USDJPY", "USDJPY.v", "USDJPYm", "USDJPY+"],
    "AUDUSD": ["AUDUSD", "AUDUSD.v", "AUDUSDm", "AUDUSD+"],
    "XAUUSD": ["XAUUSD", "GOLD", "XAUUSD.v", "XAUUSDm", "GOLD.v"],
    "BTCUSD": ["BTCUSD", "BITCOIN", "BTCUSD.v", "BTCUSDm", "BTC/USD"],
}

# Resolved MT5 symbol names mapping: target_symbol -> actual_mt5_symbol
mt5_symbol_map = {}

# Initial baseline prices & spreads for simulation fallback
SIM_STATE = {
    "EURUSD": {"bid": 1.08500, "anchor": 1.08500, "spread": 0.00012, "dec": 5, "vol": 0.000015, "min": 1.02000, "max": 1.18000},
    "GBPUSD": {"bid": 1.28500, "anchor": 1.28500, "spread": 0.00015, "dec": 5, "vol": 0.000020, "min": 1.20000, "max": 1.38000},
    "USDJPY": {"bid": 154.500, "anchor": 154.500, "spread": 0.015,   "dec": 3, "vol": 0.020,    "min": 140.000, "max": 165.000},
    "AUDUSD": {"bid": 0.65500, "anchor": 0.65500, "spread": 0.00012, "dec": 5, "vol": 0.000012, "min": 0.60000, "max": 0.72000},
    "XAUUSD": {"bid": 2650.00, "anchor": 2650.00, "spread": 0.25,    "dec": 2, "vol": 0.45,     "min": 2400.00, "max": 2900.00},
    "BTCUSD": {"bid": 68500.0, "anchor": 68500.0, "spread": 5.00,    "dec": 2, "vol": 15.0,     "min": 50000.0, "max": 95000.0},
}

# Attempt to load MetaTrader5
try:
    import MetaTrader5 as mt5
    MT5_AVAILABLE = True
except ImportError:
    MT5_AVAILABLE = False
    print(">>> 'MetaTrader5' Python library not found. Running in Fallback Simulator mode.")
    print(">>> To run with MT5, install: pip install MetaTrader5 (Windows only)")

def initialize_mt5():
    global MT5_AVAILABLE, mt5_symbol_map
    if not MT5_AVAILABLE:
        return False
    
    # Initialize connection to MT5 terminal
    if not mt5.initialize():
        print(f">>> MetaTrader5 init failed: {mt5.last_error()}. Falling back to Simulator.")
        MT5_AVAILABLE = False
        return False
        
    print(">>> MetaTrader5 bridge initialized successfully.")

    # Resolve MT5 symbol mapping for each target asset
    all_mt5_symbols = [s.name for s in (mt5.symbols_get() or [])]

    for target in TARGET_SYMBOLS:
        candidates = SYMBOL_ALIASES.get(target, [target])
        found_symbol = None

        for candidate in candidates:
            # Check if symbol is present in terminal market watch or available symbols
            if candidate in all_mt5_symbols or mt5.symbol_select(candidate, True):
                mt5.symbol_select(candidate, True)
                found_symbol = candidate
                break

        if found_symbol:
            mt5_symbol_map[target] = found_symbol
            print(f">>> [MT5] Symbol '{target}' mapped to terminal symbol '{found_symbol}'.")
        else:
            print(f">>> [MT5 Warning] '{target}' not found in MT5 terminal. Will use simulator for this asset.")

    return True

def run_bridge():
    # Load last known prices from C# API DB as baseline to avoid chart gaps
    for sym in TARGET_SYMBOLS:
        try:
            res = requests.get(f"http://localhost:5273/api/LivePrice/history?symbol={sym}&count=1", timeout=3.0)
            if res.status_code == 200:
                history = res.json()
                if history and len(history) > 0:
                    last_candle = history[-1]
                    db_close = float(last_candle.get("close") or last_candle.get("Close") or 0)
                    if db_close > 0:
                        SIM_STATE[sym]["bid"] = db_close
                        SIM_STATE[sym]["anchor"] = db_close
                        print(f">>> Baseline DB price for {sym}: {db_close:.{SIM_STATE[sym]['dec']}f}")
        except Exception:
            pass

    is_mt5_active = initialize_mt5()

    print(f"\n[BRIDGE] AegisTrader Multi-Asset MT5 Bridge running for {TARGET_SYMBOLS}...")
    print(f"[API] Forwarding tick updates to {API_URL} every {TICK_INTERVAL_SEC}s\n")

    try:
        while True:
            cycle_summary = []

            for sym in TARGET_SYMBOLS:
                bid = None
                ask = None
                mt5_sym = mt5_symbol_map.get(sym)

                if is_mt5_active and mt5_sym:
                    tick = mt5.symbol_info_tick(mt5_sym)
                    if tick is not None and tick.bid > 0 and tick.ask > 0:
                        bid = float(tick.bid)
                        ask = float(tick.ask)

                if bid is None or ask is None:
                    # Fallback Simulator mode for this asset
                    st = SIM_STATE[sym]
                    drift = (st["anchor"] - st["bid"]) * 0.005
                    noise = random.uniform(-st["vol"], st["vol"])
                    bid = round(st["bid"] + drift + noise, st["dec"])

                    if bid < st["min"]:
                        bid = st["min"] + st["vol"] * 10
                        st["anchor"] = bid
                    elif bid > st["max"]:
                        bid = st["max"] - st["vol"] * 10
                        st["anchor"] = bid

                    st["bid"] = bid
                    ask = round(bid + st["spread"], st["dec"])

                # Post tick payload to C# API
                payload = {
                    "Symbol": sym,
                    "Bid": float(bid),
                    "Ask": float(ask)
                }

                try:
                    res = requests.post(API_URL, json=payload, timeout=1.5)
                    if res.status_code == 200:
                        dec = SIM_STATE[sym]["dec"]
                        src = "MT5" if (is_mt5_active and mt5_sym) else "SIM"
                        cycle_summary.append(f"{sym}({src}): {bid:.{dec}f}")
                except Exception as e:
                    pass

            # Print single line summary of all streaming ticks
            if cycle_summary:
                print(f"[TICK FEED] | " + " | ".join(cycle_summary), end="\r")

            time.sleep(TICK_INTERVAL_SEC)

    except KeyboardInterrupt:
        print("\n\nStopping MT5 Bridge...")
    finally:
        if is_mt5_active:
            mt5.shutdown()
        print("Bridge shutdown complete.")

if __name__ == "__main__":
    run_bridge()
