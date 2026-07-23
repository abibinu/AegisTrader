import sys
import time
import random
import requests

# Target API settings
API_URL = "http://localhost:5273/api/LivePrice/tick"
SYMBOL = "EURUSD"
TICK_INTERVAL_SEC = 0.5  # Send ticks every 500ms

# Attempt to load MetaTrader5
try:
    import MetaTrader5 as mt5
    MT5_AVAILABLE = True
except ImportError:
    MT5_AVAILABLE = False
    print(">>> 'MetaTrader5' Python library not found. Running in Fallback Simulator mode.")
    print(">>> To run with MT5, install: pip install MetaTrader5 (Windows only)")

def initialize_mt5():
    global MT5_AVAILABLE
    if not MT5_AVAILABLE:
        return False
    
    # Initialize connection to MT5 terminal
    if not mt5.initialize():
        print(f">>> MetaTrader5 init failed: {mt5.last_error()}. Falling back to Simulator.")
        MT5_AVAILABLE = False
        return False
        
    print(">>> MetaTrader5 bridge initialized successfully.")
    # Check if symbol is visible/available
    selected = mt5.symbol_select(SYMBOL, True)
    if not selected:
        print(f">>> Warning: Failed to select {SYMBOL} in terminal. Price updates might fail.")
    return True

def run_bridge():
    # Initial price baseline for simulator
    bid = 1.13850
    # Fetch last known price from DB as baseline to avoid chart gaps
    try:
        res = requests.get("http://localhost:5273/api/LivePrice/history?symbol=" + SYMBOL, timeout=2.0)
        if res.status_code == 200:
            history = res.json()
            if history and len(history) > 0:
                last_candle = history[-1]
                bid = float(last_candle.get("close") or last_candle.get("Close") or 1.13850)
                print(f">>> Baseline price loaded from DB: {bid:.5f}")
    except Exception as e:
        print(f">>> Failed to load baseline from DB: {e}. Defaulting to {bid:.5f}")

    spread = 0.00012  # 1.2 pip spread
    ask = bid + spread

    is_mt5_active = initialize_mt5()

    print(f"\n[BRIDGE] AegisTrader MT5 Bridge running for [{SYMBOL}]...")
    print(f"[API] Forwarding tick updates to {API_URL} every {TICK_INTERVAL_SEC}s\n")

    try:
        while True:
            if is_mt5_active:
                # Read actual live price tick from Vantage Markets MT5 Terminal
                tick = mt5.symbol_info_tick(SYMBOL)
                if tick is not None:
                    bid = tick.bid
                    ask = tick.ask
                else:
                    print(f"Warning: Failed to read {SYMBOL} tick from terminal. Using last known prices.")
            else:
                # Fallback Simulator mode: Random walk generator mimicking live market ticks
                change = random.uniform(-0.00008, 0.00008)
                bid = round(bid + change, 5)
                # Keep EURUSD within standard boundaries (1.05000 to 1.15000)
                if bid < 1.04000:
                    bid = 1.04500
                elif bid > 1.16000:
                    bid = 1.15500
                ask = round(bid + spread, 5)

            # Build tick payload
            payload = {
                "Symbol": SYMBOL,
                "Bid": float(bid),
                "Ask": float(ask)
            }

            # Forward to AegisTrader API
            try:
                res = requests.post(API_URL, json=payload, timeout=2.0)
                if res.status_code == 200:
                    mode_label = "Vantage-MT5" if is_mt5_active else "SIMULATOR"
                    print(f"[{mode_label}] Sent {SYMBOL} Tick -> Bid: {bid:.5f} | Ask: {ask:.5f}", end="\r")
                else:
                    print(f"\n[Error] API returned status {res.status_code}: {res.text}")
            except requests.exceptions.RequestException as e:
                print(f"\n[Error] Failed to connect to API: {e}. Is the C# server running on port 5273?")

            time.sleep(TICK_INTERVAL_SEC)

    except KeyboardInterrupt:
        print("\n\nStopping MT5 Bridge...")
    finally:
        if is_mt5_active:
            mt5.shutdown()
        print("Bridge shutdown complete.")

if __name__ == "__main__":
    run_bridge()
