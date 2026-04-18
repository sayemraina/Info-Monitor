"""
Federal Register API ingester.
Executive orders, proposed rules, final rules. No auth required.
"""

from __future__ import annotations

import json
import time
from pathlib import Path
from typing import List

import requests

from . import register
from .base import BaseIngester

SCRIPTS_DIR = Path(__file__).parent.parent
TOPIC_KEYWORDS = json.loads((SCRIPTS_DIR / "topic_keywords.json").read_text())

FED_REG_API = "https://www.federalregister.gov/api/v1/documents.json"

DOC_TYPE_MAP = {
    "Presidential Document": "executive_order",
    "Rule": "final_rule",
    "Proposed Rule": "proposed_rule",
    "Notice": "notice",
}


@register
class FedRegisterIngester(BaseIngester):
    source_name = "fed_register"
    source_type = "government"
    is_signal = True

    def ingest(self, topic_id: str, keywords: List[str], **kwargs) -> list:
        signals = []

        for kw in keywords[:2]:
            try:
                params = {"conditions[term]": kw, "per_page": 10, "order": "newest"}
                resp = requests.get(FED_REG_API, params=params, timeout=15)
                if resp.status_code != 200:
                    continue

                results = resp.json().get("results", [])

                for doc in results:
                    title = doc.get("title", "")
                    if not title:
                        continue

                    doc_type = doc.get("type", "")
                    pub_date = doc.get("publication_date", "")
                    doc_number = doc.get("document_number", "")
                    agencies = [a.get("name", "") for a in doc.get("agencies", [])]
                    abstract = doc.get("abstract", "")
                    html_url = doc.get("html_url", "")

                    signal_type = DOC_TYPE_MAP.get(doc_type, "notice")
                    severity = "high" if signal_type == "executive_order" else "medium" if signal_type == "final_rule" else "low"

                    agency_str = ", ".join(agencies[:3]) if agencies else "Unknown agency"
                    summary = abstract[:300] if abstract else f"{doc_type} by {agency_str}"

                    sig = self.make_signal(
                        id=f"fedreg_{doc_number}",
                        source="fed_register",
                        source_type="government",
                        signal_type=signal_type,
                        title=title[:200],
                        summary=summary,
                        timestamp=f"{pub_date}T00:00:00Z" if pub_date else self.now_iso(),
                        severity=severity,
                        url=html_url,
                        topic_relevance=[topic_id],
                        metadata={"doc_number": doc_number, "doc_type": doc_type, "agencies": agencies, "keyword": kw},
                    )
                    signals.append(sig)

                time.sleep(0.5)
            except Exception as e:
                print(f"    Warning: Federal Register search '{kw}' failed: {e}")

        seen = set()
        return [s for s in signals if s["id"] not in seen and not seen.add(s["id"])]

    def health_check(self) -> dict:
        try:
            resp = requests.get(FED_REG_API, params={"conditions[term]": "test", "per_page": 1}, timeout=10)
            return {"ok": resp.status_code == 200, "message": "Federal Register API reachable"}
        except Exception as e:
            return {"ok": False, "message": str(e)}
