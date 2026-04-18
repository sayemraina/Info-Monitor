"""
Yahoo Finance + CoinGecko price ingester.
Tracks stock/crypto prices as discourse triggers.
"""

from __future__ import annotations

import json
from datetime import datetime, timezone
from pathlib import Path
from typing import List

try:
    import yfinance as yf
except ImportError:
    yf = None

from . import register
from .base import BaseIngester

SCRIPTS_DIR = Path(__file__).parent.parent
TOPIC_KEYWORDS = json.loads((SCRIPTS_DIR / "topic_keywords.json").read_text())


@register
class YahooFinanceIngester(BaseIngester):
    source_name = "yahoo_finance"
    source_type = "event_signal"
    is_signal = True

    def ingest(self, topic_id: str, keywords: List[str], **kwargs) -> list:
        if yf is None:
            print("    yfinance not installed — pip install yfinance")
            return []

        config = TOPIC_KEYWORDS.get(topic_id, {})
        tickers = config.get("stock_tickers", [])
        if not tickers:
            return []

        signals = []
        for symbol in tickers:
            try:
                ticker = yf.Ticker(symbol)
                hist = ticker.history(period="5d")
                if hist.empty or len(hist) < 2:
                    continue

                latest_close = float(hist["Close"].iloc[-1])
                prev_close = float(hist["Close"].iloc[-2])
                daily_change = ((latest_close - prev_close) / prev_close) * 100

                # Severity based on magnitude of change
                abs_change = abs(daily_change)
                if abs_change > 5:
                    severity = "high"
                elif abs_change > 2:
                    severity = "medium"
                else:
                    severity = "low"

                # Human-readable name
                name = symbol.replace("-USD", "").replace("=F", " Futures")
                direction = "up" if daily_change > 0 else "down"

                sig = self.make_signal(
                    id=f"price_{symbol}_{datetime.now(timezone.utc).strftime('%Y%m%d')}",
                    source="yahoo_finance",
                    source_type="event_signal",
                    signal_type="price_movement",
                    title=f"{name}: ${latest_close:,.2f} ({direction} {abs_change:.1f}%)",
                    summary=f"{symbol} closed at ${latest_close:,.2f}, {direction} {abs_change:.1f}% from previous close of ${prev_close:,.2f}",
                    timestamp=datetime.now(timezone.utc).isoformat(),
                    severity=severity,
                    value=round(latest_close, 2),
                    change=round(daily_change, 2),
                    topic_relevance=[topic_id],
                    metadata={"symbol": symbol, "prev_close": round(prev_close, 2)},
                )
                signals.append(sig)

            except Exception as e:
                print(f"    Warning: {symbol} failed: {e}")
                continue

        return signals

    def health_check(self) -> dict:
        if yf is None:
            return {"ok": False, "message": "yfinance not installed"}
        try:
            t = yf.Ticker("AAPL")
            h = t.history(period="1d")
            return {"ok": not h.empty, "message": f"AAPL: ${float(h['Close'].iloc[-1]):,.2f}"}
        except Exception as e:
            return {"ok": False, "message": str(e)}
