"""
SEC EDGAR filing search ingester.
Searches for corporate filings mentioning topic-relevant keywords.
"""

from __future__ import annotations

import json
import time
from datetime import datetime, timezone, timedelta
from pathlib import Path
from typing import List

import requests

from . import register
from .base import BaseIngester

SCRIPTS_DIR = Path(__file__).parent.parent
TOPIC_KEYWORDS = json.loads((SCRIPTS_DIR / "topic_keywords.json").read_text())

EDGAR_SEARCH = "https://efts.sec.gov/LATEST/search-index"
USER_AGENT = "InfoMonitor research@infomonitor.app"


@register
class SECEdgarIngester(BaseIngester):
    source_name = "sec_edgar"
    source_type = "government"
    is_signal = True

    def ingest(self, topic_id: str, keywords: List[str], **kwargs) -> list:
        config = TOPIC_KEYWORDS.get(topic_id, {})
        sec_keywords = config.get("sec_keywords", [])
        if not sec_keywords:
            return []

        signals = []
        now = datetime.now(timezone.utc)
        start_date = (now - timedelta(days=30)).strftime("%Y-%m-%d")
        end_date = now.strftime("%Y-%m-%d")

        for kw in sec_keywords[:3]:  # max 3 keyword searches per topic
            try:
                params = {
                    "q": f'"{kw}"',
                    "dateRange": "custom",
                    "startdt": start_date,
                    "enddt": end_date,
                    "forms": "10-K,10-Q,8-K",
                }
                headers = {"User-Agent": USER_AGENT}
                resp = requests.get(EDGAR_SEARCH, params=params, headers=headers, timeout=15)

                if resp.status_code != 200:
                    # Try alternative EDGAR full-text search endpoint
                    alt_url = f"https://efts.sec.gov/LATEST/search-index?q=%22{kw.replace(' ', '%20')}%22&forms=10-K,10-Q"
                    resp = requests.get(alt_url, headers=headers, timeout=15)
                    if resp.status_code != 200:
                        continue

                data = resp.json()
                hits = data.get("hits", {}).get("hits", [])

                for hit in hits[:10]:
                    source = hit.get("_source", {})
                    filing_date = source.get("file_date", "")
                    company = source.get("entity_name", "Unknown")
                    form_type = source.get("form_type", "")
                    file_num = source.get("file_num", "")

                    sig = self.make_signal(
                        id=f"sec_{self.content_hash(f'{company}_{form_type}_{filing_date}')[:12]}",
                        source="sec_edgar",
                        source_type="government",
                        signal_type="corporate_filing",
                        title=f"{company} — {form_type} filing ({filing_date})",
                        summary=f"{company} filed {form_type} mentioning '{kw}'. Filing date: {filing_date}.",
                        timestamp=f"{filing_date}T00:00:00Z" if filing_date else now.isoformat(),
                        severity="low",
                        url=f"https://www.sec.gov/cgi-bin/browse-edgar?action=getcompany&filenum={file_num}" if file_num else None,
                        topic_relevance=[topic_id],
                        metadata={
                            "company": company,
                            "form_type": form_type,
                            "keyword": kw,
                        },
                    )
                    signals.append(sig)

                time.sleep(1)  # SEC rate limit compliance

            except Exception as e:
                print(f"    Warning: SEC EDGAR search for '{kw}' failed: {e}")
                continue

        return signals

    def health_check(self) -> dict:
        try:
            resp = requests.get(
                "https://efts.sec.gov/LATEST/search-index?q=test&forms=10-K",
                headers={"User-Agent": USER_AGENT},
                timeout=10,
            )
            return {"ok": resp.status_code == 200, "message": "EDGAR API reachable"}
        except Exception as e:
            return {"ok": False, "message": str(e)}
