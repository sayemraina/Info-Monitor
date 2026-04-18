"""
Polymarket prediction market ingester.
Money-weighted sentiment signals. Free, no auth for public market data.
Cloudflare may block datacenter IPs — graceful degradation if so.
"""

from __future__ import annotations

import json
import time
from datetime import datetime, timezone
from pathlib import Path
from typing import List

import requests

from . import register
from .base import BaseIngester

SCRIPTS_DIR = Path(__file__).parent.parent
TOPIC_KEYWORDS = json.loads((SCRIPTS_DIR / "topic_keywords.json").read_text())

GAMMA_API = "https://gamma-api.polymarket.com"


@register
class PolymarketIngester(BaseIngester):
    source_name = "polymarket"
    source_type = "prediction_market"
    is_signal = True

    def ingest(self, topic_id: str, keywords: List[str], **kwargs) -> list:
        signals = []

        # Search for markets matching topic keywords
        for kw in keywords[:2]:
            try:
                headers = {
                    "Accept": "application/json",
                    "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) InfoMonitor/1.0",
                }
                resp = requests.get(
                    f"{GAMMA_API}/markets",
                    params={"tag": kw, "limit": 10, "active": True, "closed": False},
                    headers=headers,
                    timeout=15,
                )

                if resp.status_code == 403:
                    print(f"    Polymarket blocked by Cloudflare (403) — skipping")
                    return []

                if resp.status_code != 200:
                    # Try alternative endpoint
                    resp = requests.get(
                        f"{GAMMA_API}/events",
                        params={"tag": kw, "limit": 10, "active": True},
                        headers=headers,
                        timeout=15,
                    )
                    if resp.status_code != 200:
                        continue

                data = resp.json()
                markets = data if isinstance(data, list) else data.get("markets", data.get("data", []))

                for market in markets:
                    question = market.get("question", market.get("title", ""))
                    if not question:
                        continue

                    # Get current probability
                    outcomes = market.get("outcomes", [])
                    best_ask = market.get("bestAsk", 0)
                    volume = market.get("volume", market.get("volumeNum", 0))

                    # Parse probability from outcomes or bestAsk
                    probability = None
                    if outcomes and isinstance(outcomes, list) and len(outcomes) >= 2:
                        # First outcome is typically "Yes"
                        yes_price = market.get("outcomePrices", ["0.5"])[0]
                        try:
                            probability = float(yes_price)
                        except (ValueError, TypeError, IndexError):
                            pass
                    if probability is None and best_ask:
                        try:
                            probability = float(best_ask)
                        except (ValueError, TypeError):
                            probability = 0.5

                    if probability is None:
                        probability = 0.5

                    pct = round(probability * 100, 1)
                    market_id = market.get("id", market.get("conditionId", self.content_hash(question)[:12]))

                    try:
                        vol_num = float(volume) if volume else 0
                        vol_str = f" Volume: ${vol_num:,.0f}" if vol_num else ""
                    except (ValueError, TypeError):
                        vol_str = ""

                    sig = self.make_signal(
                        id=f"poly_{str(market_id)[:16]}",
                        source="polymarket",
                        source_type="prediction_market",
                        signal_type="prediction_market",
                        title=f"{question[:150]} — {pct}% Yes",
                        summary=f"Polymarket gives {pct}% odds.{vol_str}",
                        timestamp=self.now_iso(),
                        severity="high" if abs(probability - 0.5) > 0.3 else "medium" if abs(probability - 0.5) > 0.15 else "low",
                        value=round(probability, 4),
                        url=f"https://polymarket.com/event/{market.get('slug', '')}" if market.get("slug") else None,
                        topic_relevance=[topic_id],
                        metadata={"market_id": str(market_id), "volume": volume, "keyword": kw},
                    )
                    signals.append(sig)

                time.sleep(1)

            except requests.exceptions.ConnectionError:
                print(f"    Polymarket connection failed (Cloudflare?) — skipping")
                return []
            except Exception as e:
                print(f"    Warning: Polymarket search '{kw}' failed: {e}")
                continue

        # Dedup
        seen = set()
        return [s for s in signals if s["id"] not in seen and not seen.add(s["id"])]

    def health_check(self) -> dict:
        try:
            headers = {"User-Agent": "Mozilla/5.0 InfoMonitor/1.0"}
            resp = requests.get(f"{GAMMA_API}/markets?limit=1", headers=headers, timeout=10)
            if resp.status_code == 403:
                return {"ok": False, "message": "Blocked by Cloudflare"}
            return {"ok": resp.status_code == 200, "message": "Polymarket API reachable"}
        except Exception as e:
            return {"ok": False, "message": str(e)}
