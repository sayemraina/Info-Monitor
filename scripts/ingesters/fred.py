"""
FRED (Federal Reserve Economic Data) ingester.
Key economic indicators. Free API key required.
"""

from __future__ import annotations

import json
import os
from datetime import datetime, timezone
from pathlib import Path
from typing import List

try:
    from fredapi import Fred
except ImportError:
    Fred = None

from . import register
from .base import BaseIngester

SCRIPTS_DIR = Path(__file__).parent.parent
TOPIC_KEYWORDS = json.loads((SCRIPTS_DIR / "topic_keywords.json").read_text())

SERIES_NAMES = {
    "CPIAUCSL": "Consumer Price Index (All Urban Consumers)",
    "UNRATE": "Unemployment Rate",
    "FEDFUNDS": "Federal Funds Effective Rate",
    "MORTGAGE30US": "30-Year Fixed Mortgage Rate",
    "HOUST": "Housing Starts (Thousands)",
    "MSPUS": "Median Sales Price of Houses Sold",
    "PAYEMS": "Total Nonfarm Payrolls (Thousands)",
    "PCE": "Personal Consumption Expenditures Price Index",
}


@register
class FREDIngester(BaseIngester):
    source_name = "fred"
    source_type = "event_signal"
    is_signal = True

    def ingest(self, topic_id: str, keywords: List[str], **kwargs) -> list:
        if Fred is None:
            print("    fredapi not installed — pip install fredapi")
            return []

        api_key = os.environ.get("FRED_API_KEY", "")
        if not api_key:
            print("    FRED_API_KEY not set")
            return []

        config = TOPIC_KEYWORDS.get(topic_id, {})
        series_ids = config.get("fred_series", [])
        if not series_ids:
            return []

        fred = Fred(api_key=api_key)
        signals = []

        for series_id in series_ids:
            try:
                data = fred.get_series(series_id, observation_start="2024-01-01")
                if data is None or data.empty:
                    continue
                data = data.dropna()
                if len(data) < 2:
                    continue

                latest_val = float(data.iloc[-1])
                prev_val = float(data.iloc[-2])
                latest_date = data.index[-1].strftime("%Y-%m-%d")

                pct_change = ((latest_val - prev_val) / abs(prev_val)) * 100 if prev_val != 0 else 0.0
                abs_change = abs(pct_change)
                severity = "high" if abs_change > 5 else "medium" if abs_change > 1 else "low"

                name = SERIES_NAMES.get(series_id, series_id)
                direction = "up" if pct_change > 0 else "down" if pct_change < 0 else "unchanged"

                sig = self.make_signal(
                    id=f"fred_{series_id}_{latest_date}",
                    source="fred",
                    source_type="event_signal",
                    signal_type="economic_indicator",
                    title=f"{name}: {latest_val:,.2f} ({direction} {abs_change:.1f}%)",
                    summary=f"{name} ({series_id}) at {latest_val:,.2f} as of {latest_date}. Previous: {prev_val:,.2f} ({direction} {abs_change:.1f}%).",
                    timestamp=f"{latest_date}T00:00:00Z",
                    severity=severity,
                    value=round(latest_val, 4),
                    change=round(pct_change, 2),
                    url=f"https://fred.stlouisfed.org/series/{series_id}",
                    topic_relevance=[topic_id],
                    metadata={"series_id": series_id, "series_name": name, "previous_value": round(prev_val, 4)},
                )
                signals.append(sig)
            except Exception as e:
                print(f"    Warning: FRED {series_id} failed: {e}")

        return signals

    def health_check(self) -> dict:
        if Fred is None:
            return {"ok": False, "message": "fredapi not installed"}
        api_key = os.environ.get("FRED_API_KEY", "")
        if not api_key:
            return {"ok": False, "message": "FRED_API_KEY not set"}
        try:
            fred = Fred(api_key=api_key)
            data = fred.get_series("UNRATE", observation_start="2025-01-01")
            return {"ok": data is not None and not data.empty, "message": f"UNRATE: {float(data.dropna().iloc[-1]):.1f}%"}
        except Exception as e:
            return {"ok": False, "message": str(e)}
