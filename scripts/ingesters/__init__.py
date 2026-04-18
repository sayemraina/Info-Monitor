"""
Ingester registry — maps source names to ingester classes.
Each ingester outputs normalized documents for the extraction pipeline.
"""

from __future__ import annotations

from typing import Dict, List, Optional, Type

from .base import BaseIngester

# Registry populated as ingesters are imported
REGISTRY: Dict[str, Type[BaseIngester]] = {}


def register(cls: Type[BaseIngester]) -> Type[BaseIngester]:
    """Decorator to register an ingester class."""
    REGISTRY[cls.source_name] = cls
    return cls


def get_ingester(name: str) -> Optional[Type[BaseIngester]]:
    return REGISTRY.get(name)


def list_ingesters() -> List[str]:
    return sorted(REGISTRY.keys())


# Import all ingesters to trigger registration
def _load_all():
    try:
        from . import rss
    except ImportError:
        pass
    try:
        from . import gdelt
    except ImportError:
        pass
    try:
        from . import fred
    except ImportError:
        pass
    try:
        from . import congress
    except ImportError:
        pass
    try:
        from . import fed_register
    except ImportError:
        pass
    try:
        from . import wikipedia_edits
    except ImportError:
        pass
    try:
        from . import yahoo_finance
    except ImportError:
        pass
    try:
        from . import sec_edgar
    except ImportError:
        pass
    # Tier 2 ingesters
    try:
        from . import bluesky
    except ImportError:
        pass
    try:
        from . import newsapi
    except ImportError:
        pass
    try:
        from . import polymarket
    except ImportError:
        pass
    try:
        from . import youtube
    except ImportError:
        pass
    try:
        from . import x
    except ImportError:
        pass
    # Tier 3 ingesters
    try:
        from . import acled
    except ImportError:
        pass
    try:
        from . import cloudflare_radar
    except ImportError:
        pass
    try:
        from . import worldpop
    except ImportError:
        pass


_load_all()
