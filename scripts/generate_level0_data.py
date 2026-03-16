#!/usr/bin/env python3
"""Generate all Level 0 redesign data: expanded topics, geo, youtube, discourse."""

import json
import random
import os
from pathlib import Path

random.seed(42)

DATA_DIR = Path(__file__).parent.parent / "data"

# ============================================================================
# TOPIC DEFINITIONS — 10 topics spanning politics, business, finance, culture, tech, science
# ============================================================================

TOPICS = [
    # --- Existing 4 (preserve IDs, update data) ---
    {
        "id": "ai-regulation",
        "name": "AI Regulation",
        "cluster_count": 7,
        "contestation_level": "high",
        "contestation_emergence": {"emerged_hours_ago": 50, "source_diversity": 0.69},
        "headline_divergence": {"jsd": 0.40, "dominant_typology": "Information Asymmetry", "trend": "increasing"},
        "top_accelerating_claim": {
            "text": "Unregulated AI development poses existential risks that demand immediate policy action",
            "momentum": 0.87, "source_diversity": 0.32
        },
        "most_persistent_claim": {
            "text": "AI regulation will stifle innovation and put domestic companies at a competitive disadvantage",
            "persistence_windows": 14
        },
        "key_signal": {"type": "momentum_spike", "summary": "'AI will eliminate millions of jobs and governments must prep...' accelerated from 20th to 72nd perc"},
        "activity_sparkline": [0.52, 0.68, 0.25, 0.67, 0.64, 0.82, 0.61, 0.71, 0.20, 0.89, 0.55, 0.47],
        "ifi": {"value": 13.3, "trend": "stable"},
        "top_situation": {"summary": "'AI regulation should target sp...' radicalizing — moving toward extreme framing", "severity": "high"},
        "system_confidence": 0.91,
        "clusters": [
            {"id": "ai-targeted", "label": "Targeted Regulation", "momentum": 0.45},
            {"id": "ai-innovation", "label": "Innovation Stifling", "momentum": -0.3},
            {"id": "ai-pharma-model", "label": "Pharmaceutical Model", "momentum": 0.2},
            {"id": "ai-gov-needed", "label": "Government Oversight", "momentum": 0.6},
            {"id": "ai-existential", "label": "Existential Risk", "momentum": 0.87},
            {"id": "ai-jobs", "label": "Job Displacement", "momentum": 0.72},
            {"id": "ai-open-source", "label": "Open Source Safety", "momentum": 0.15},
        ]
    },
    {
        "id": "immigration-policy",
        "name": "Immigration Policy",
        "cluster_count": 8,
        "contestation_level": "high",
        "contestation_emergence": None,
        "headline_divergence": {"jsd": 0.35, "dominant_typology": "Information Asymmetry", "trend": "decreasing"},
        "top_accelerating_claim": {
            "text": "Border security is a fundamental sovereign right and must be enforced strictly",
            "momentum": 0.83, "source_diversity": 0.56
        },
        "most_persistent_claim": {
            "text": "Immigration strengthens the economy through labor force growth and entrepreneurship",
            "persistence_windows": 14
        },
        "key_signal": {"type": "coordination_flag", "summary": "Near-duplicate content: 47 similar posts from non-overlapping accounts within 3h."},
        "activity_sparkline": [0.65, 0.60, 0.80, 0.62, 0.53, 0.64, 0.85, 0.69, 0.85, 0.84, 0.80, 0.35],
        "ifi": {"value": 16.5, "trend": "stable"},
        "top_situation": {"summary": "'Immigration policy should prio...' radicalizing — moving toward extreme framing", "severity": "high"},
        "system_confidence": 0.88,
        "clusters": [
            {"id": "imm-border", "label": "Border Security", "momentum": 0.83},
            {"id": "imm-economy", "label": "Economic Impact", "momentum": 0.4},
            {"id": "imm-humanitarian", "label": "Humanitarian Concern", "momentum": 0.55},
            {"id": "imm-legal", "label": "Legal Pathways", "momentum": 0.2},
            {"id": "imm-crime", "label": "Crime & Safety", "momentum": 0.7},
            {"id": "imm-asylum", "label": "Asylum Rights", "momentum": 0.35},
            {"id": "imm-workforce", "label": "Labor Shortages", "momentum": 0.3},
            {"id": "imm-cultural", "label": "Cultural Integration", "momentum": -0.1},
        ]
    },
    {
        "id": "us-israel-iran",
        "name": "US-Israel-Iran War",
        "cluster_count": 8,
        "contestation_level": "high",
        "contestation_emergence": None,
        "headline_divergence": {"jsd": 0.56, "dominant_typology": "Paradigmatic", "trend": "decreasing"},
        "top_accelerating_claim": {
            "text": "Iran's proxy network across the region poses a direct threat to US national security interests",
            "momentum": 0.80, "source_diversity": 0.73
        },
        "most_persistent_claim": {
            "text": "US military involvement in the Middle East is necessary to contain Iranian expansionism",
            "persistence_windows": 14
        },
        "key_signal": {"type": "momentum_spike", "summary": "'US arms sales to Israel make American taxpayers complicit...' accelerated from 20th to 72nd perc"},
        "activity_sparkline": [0.30, 0.46, 0.65, 0.86, 0.80, 0.56, 0.56, 0.27, 0.74, 0.38, 0.36, 0.60],
        "ifi": {"value": 12.7, "trend": "stable"},
        "top_situation": {"summary": "'The conflict is destabilizing the entire region...' polarizing — high friction (0.86)", "severity": "high"},
        "system_confidence": 0.82,
        "clusters": [
            {"id": "uii-us-involvement", "label": "US Involvement", "momentum": 0.65},
            {"id": "uii-iran-proxies", "label": "Iran Proxies", "momentum": 0.80},
            {"id": "uii-israel-defense", "label": "Israel Defense", "momentum": 0.55},
            {"id": "uii-ceasefire", "label": "Ceasefire Now", "momentum": 0.70},
            {"id": "uii-arms-sales", "label": "Arms Sales", "momentum": 0.60},
            {"id": "uii-destabilization", "label": "Regional Destabilization", "momentum": 0.45},
            {"id": "uii-media-bias", "label": "Media Bias", "momentum": 0.35},
            {"id": "uii-diplomacy", "label": "Diplomacy Path", "momentum": 0.20},
        ]
    },
    {
        "id": "climate-policy",
        "name": "Climate Change",
        "cluster_count": 7,
        "contestation_level": "high",
        "contestation_emergence": None,
        "headline_divergence": {"jsd": 0.50, "dominant_typology": "Paradigmatic", "trend": "decreasing"},
        "top_accelerating_claim": {
            "text": "Carbon capture technology is a fossil fuel industry distraction from real emissions reduction",
            "momentum": 0.50, "source_diversity": 0.20
        },
        "most_persistent_claim": {
            "text": "Rapid transition to renewable energy is essential to avoid catastrophic climate outcomes",
            "persistence_windows": 14
        },
        "key_signal": {"type": "momentum_spike", "summary": "'Carbon capture technology is a fossil fuel industry distract...' accelerated from 20th to 72nd perc"},
        "activity_sparkline": [0.37, 0.61, 0.63, 0.89, 0.79, 0.86, 0.66, 0.41, 0.39, 0.52, 0.83, 0.66],
        "ifi": {"value": 19.4, "trend": "stable"},
        "top_situation": {"summary": "'Individual carbon footprint re...' radicalizing — moving toward extreme framing", "severity": "high"},
        "system_confidence": 0.85,
        "clusters": [
            {"id": "clim-carbon", "label": "Carbon Capture Critique", "momentum": 0.50},
            {"id": "clim-renewable", "label": "Renewable Transition", "momentum": 0.45},
            {"id": "clim-nuclear", "label": "Nuclear Revival", "momentum": 0.6},
            {"id": "clim-cost", "label": "Economic Cost", "momentum": 0.3},
            {"id": "clim-justice", "label": "Climate Justice", "momentum": 0.55},
            {"id": "clim-skeptic", "label": "Climate Skepticism", "momentum": -0.2},
            {"id": "clim-footprint", "label": "Individual Responsibility", "momentum": 0.35},
        ]
    },
    # --- New 6 topics ---
    {
        "id": "ai-workplace",
        "name": "AI in the Workplace",
        "cluster_count": 6,
        "contestation_level": "high",
        "contestation_emergence": {"emerged_hours_ago": 30, "source_diversity": 0.55},
        "headline_divergence": {"jsd": 0.38, "dominant_typology": "Information Asymmetry", "trend": "increasing"},
        "top_accelerating_claim": {
            "text": "AI will automate away millions of white-collar jobs within the next five years",
            "momentum": 0.80, "source_diversity": 0.32
        },
        "most_persistent_claim": {
            "text": "AI is a productivity tool that augments human capabilities rather than replacing workers",
            "persistence_windows": 12
        },
        "key_signal": {"type": "divergence_shift", "summary": "Platform divergence on AI job displacement widened 0.14 JSD over 48h"},
        "activity_sparkline": [0.45, 0.52, 0.71, 0.68, 0.83, 0.76, 0.91, 0.85, 0.72, 0.69, 0.78, 0.82],
        "ifi": {"value": 21.2, "trend": "increasing"},
        "top_situation": {"summary": "'Companies pushing AI hardest are quietly laying off...' fragmenting — divergent sub-narratives", "severity": "medium"},
        "system_confidence": 0.79,
        "clusters": [
            {"id": "aiw-displacement", "label": "Job Displacement", "momentum": 0.80},
            {"id": "aiw-augmentation", "label": "AI Augmentation", "momentum": 0.45},
            {"id": "aiw-creative", "label": "Creative Threat", "momentum": 0.70},
            {"id": "aiw-retraining", "label": "Retraining Programs", "momentum": 0.35},
            {"id": "aiw-productivity", "label": "Productivity Gains", "momentum": 0.50},
            {"id": "aiw-luddite", "label": "Luddite Fallacy", "momentum": 0.60},
        ]
    },
    {
        "id": "crypto-web3",
        "name": "Cryptocurrency & Web3",
        "cluster_count": 6,
        "contestation_level": "high",
        "contestation_emergence": {"emerged_hours_ago": 18, "source_diversity": 0.62},
        "headline_divergence": {"jsd": 0.42, "dominant_typology": "Paradigmatic", "trend": "increasing"},
        "top_accelerating_claim": {
            "text": "Bitcoin's recent price action confirms the beginning of a new bull cycle",
            "momentum": 0.85, "source_diversity": 0.38
        },
        "most_persistent_claim": {
            "text": "Cryptocurrency represents the future of finance and will eventually replace traditional banking",
            "persistence_windows": 14
        },
        "key_signal": {"type": "coordination_flag", "summary": "Cross-platform sync: identical bull market framing detected across X and Reddit within 2h"},
        "activity_sparkline": [0.55, 0.63, 0.78, 0.82, 0.75, 0.88, 0.92, 0.85, 0.79, 0.83, 0.90, 0.87],
        "ifi": {"value": 24.1, "trend": "increasing"},
        "top_situation": {"summary": "'Most crypto projects are scams designed to transfer wealth...' high coordination signal detected", "severity": "high"},
        "system_confidence": 0.74,
        "clusters": [
            {"id": "cw-future", "label": "Crypto Future", "momentum": 0.65},
            {"id": "cw-scam", "label": "Crypto Scam", "momentum": 0.75},
            {"id": "cw-defi", "label": "DeFi Freedom", "momentum": 0.55},
            {"id": "cw-regulation", "label": "Regulation Needed", "momentum": 0.40},
            {"id": "cw-environment", "label": "Environmental Cost", "momentum": 0.30},
            {"id": "cw-speculation", "label": "Speculation", "momentum": 0.85},
        ]
    },
    {
        "id": "social-media-youth",
        "name": "Social Media & Youth Mental Health",
        "cluster_count": 6,
        "contestation_level": "high",
        "contestation_emergence": {"emerged_hours_ago": 40, "source_diversity": 0.78},
        "headline_divergence": {"jsd": 0.47, "dominant_typology": "Paradigmatic", "trend": "increasing"},
        "top_accelerating_claim": {
            "text": "Social media platforms should be banned for children under 16 to protect their mental health",
            "momentum": 0.81, "source_diversity": 0.52
        },
        "most_persistent_claim": {
            "text": "Parents bear primary responsibility for managing their children's screen time",
            "persistence_windows": 12
        },
        "key_signal": {"type": "phase_transition", "summary": "'Age verification systems' cluster reversed from mainstreaming to radicalizing"},
        "activity_sparkline": [0.35, 0.42, 0.38, 0.55, 0.48, 0.62, 0.58, 0.71, 0.65, 0.60, 0.57, 0.63],
        "ifi": {"value": 11.4, "trend": "stable"},
        "top_situation": {"summary": "'Tech companies knowingly designed addictive algorithms...' high friction — contested advance", "severity": "medium"},
        "system_confidence": 0.80,
        "clusters": [
            {"id": "smy-ban", "label": "Ban Platforms", "momentum": 0.81},
            {"id": "smy-parents", "label": "Parental Responsibility", "momentum": 0.45},
            {"id": "smy-platform", "label": "Platform Accountability", "momentum": 0.68},
            {"id": "smy-research", "label": "Research Mixed", "momentum": 0.25},
            {"id": "smy-verification", "label": "Age Verification", "momentum": 0.55},
            {"id": "smy-crisis", "label": "Mental Health Crisis", "momentum": 0.72},
        ]
    },
    {
        "id": "creator-economy",
        "name": "Content Creator Economy",
        "cluster_count": 6,
        "contestation_level": "medium",
        "contestation_emergence": None,
        "headline_divergence": {"jsd": 0.31, "dominant_typology": "Interpretive", "trend": "stable"},
        "top_accelerating_claim": {
            "text": "Platforms exploit creators by keeping the vast majority of ad revenue",
            "momentum": 0.72, "source_diversity": 0.48
        },
        "most_persistent_claim": {
            "text": "The creator economy has democratized media and given millions a viable path to income",
            "persistence_windows": 13
        },
        "key_signal": {"type": "arousal_escalation", "summary": "Arousal trend shifted stable → warming on 'algorithm tyranny' cluster over 72h"},
        "activity_sparkline": [0.40, 0.45, 0.55, 0.50, 0.62, 0.58, 0.70, 0.65, 0.72, 0.68, 0.75, 0.71],
        "ifi": {"value": 8.7, "trend": "increasing"},
        "top_situation": {"summary": "'Algorithm changes can destroy a creator's livelihood overnight...' warming — arousal escalating", "severity": "medium"},
        "system_confidence": 0.73,
        "clusters": [
            {"id": "ce-exploitation", "label": "Platform Exploitation", "momentum": 0.72},
            {"id": "ce-opportunity", "label": "Creator Opportunity", "momentum": 0.40},
            {"id": "ce-algorithm", "label": "Algorithm Tyranny", "momentum": 0.65},
            {"id": "ce-burnout", "label": "Burnout Epidemic", "momentum": 0.55},
            {"id": "ce-democratized", "label": "Democratized Media", "momentum": 0.30},
            {"id": "ce-monetization", "label": "Monetization Unfair", "momentum": 0.50},
        ]
    },
    {
        "id": "remote-work",
        "name": "Remote Work vs Return-to-Office",
        "cluster_count": 6,
        "contestation_level": "high",
        "contestation_emergence": None,
        "headline_divergence": {"jsd": 0.35, "dominant_typology": "Information Asymmetry", "trend": "stable"},
        "top_accelerating_claim": {
            "text": "Return-to-office mandates are about justifying commercial real estate, not productivity",
            "momentum": 0.78, "source_diversity": 0.61
        },
        "most_persistent_claim": {
            "text": "Remote work has proven that most office jobs never required physical presence",
            "persistence_windows": 14
        },
        "key_signal": {"type": "lead_lag", "summary": "'RTO is about real estate' detected on X 18h before Reddit with consistent framing"},
        "activity_sparkline": [0.30, 0.35, 0.45, 0.42, 0.55, 0.50, 0.48, 0.60, 0.57, 0.65, 0.62, 0.58],
        "ifi": {"value": 7.3, "trend": "stable"},
        "top_situation": {"summary": "'Remote work is eroding company culture...' lead-lag pattern detected across platforms", "severity": "low"},
        "system_confidence": 0.77,
        "clusters": [
            {"id": "rw-remote", "label": "Remote Forever", "momentum": 0.65},
            {"id": "rw-rto", "label": "RTO Mandate", "momentum": 0.55},
            {"id": "rw-hybrid", "label": "Hybrid Compromise", "momentum": 0.35},
            {"id": "rw-productivity", "label": "Productivity Debate", "momentum": 0.50},
            {"id": "rw-realestate", "label": "Commercial Real Estate", "momentum": 0.40},
            {"id": "rw-culture", "label": "Culture Erosion", "momentum": 0.60},
        ]
    },
    {
        "id": "us-china-tech",
        "name": "US-China Tech Competition",
        "cluster_count": 6,
        "contestation_level": "high",
        "contestation_emergence": {"emerged_hours_ago": 40, "source_diversity": 0.62},
        "headline_divergence": {"jsd": 0.44, "dominant_typology": "Information Asymmetry", "trend": "increasing"},
        "top_accelerating_claim": {
            "text": "US chip export controls are successfully slowing China's AI advancement",
            "momentum": 0.82, "source_diversity": 0.67
        },
        "most_persistent_claim": {
            "text": "The US must decouple from Chinese technology supply chains to protect national security",
            "persistence_windows": 12
        },
        "key_signal": {"type": "momentum_spike", "summary": "'Banning TikTok is necessary to prevent Chinese surveillance...' accelerated from 15th to 68th perc"},
        "activity_sparkline": [0.50, 0.58, 0.72, 0.68, 0.80, 0.75, 0.85, 0.82, 0.78, 0.88, 0.83, 0.90],
        "ifi": {"value": 18.6, "trend": "increasing"},
        "top_situation": {"summary": "'Export controls are backfiring as China accelerates...' coordination signal — burstiness anomaly", "severity": "high"},
        "system_confidence": 0.84,
        "clusters": [
            {"id": "uct-decouple", "label": "Decouple Now", "momentum": 0.75},
            {"id": "uct-engagement", "label": "Engagement Needed", "momentum": 0.25},
            {"id": "uct-chips", "label": "Chip War", "momentum": 0.82},
            {"id": "uct-tiktok", "label": "TikTok Ban", "momentum": 0.70},
            {"id": "uct-industrial", "label": "Industrial Policy", "momentum": 0.45},
            {"id": "uct-coldwar", "label": "Tech Cold War", "momentum": 0.65},
        ]
    },
]

# ============================================================================
# GEOGRAPHIC DATA — US metro area mapping per topic cluster
# ============================================================================

US_REGIONS = {
    "dc": {"lat": 38.9, "lng": -77.0, "name": "Washington DC"},
    "nyc": {"lat": 40.7, "lng": -74.0, "name": "New York"},
    "la": {"lat": 34.0, "lng": -118.2, "name": "Los Angeles"},
    "sf": {"lat": 37.8, "lng": -122.4, "name": "San Francisco"},
    "chicago": {"lat": 41.9, "lng": -87.6, "name": "Chicago"},
    "houston": {"lat": 29.8, "lng": -95.4, "name": "Houston"},
    "miami": {"lat": 25.8, "lng": -80.2, "name": "Miami"},
    "seattle": {"lat": 47.6, "lng": -122.3, "name": "Seattle"},
    "boston": {"lat": 42.4, "lng": -71.1, "name": "Boston"},
    "austin": {"lat": 30.3, "lng": -97.7, "name": "Austin"},
    "denver": {"lat": 39.7, "lng": -105.0, "name": "Denver"},
    "atlanta": {"lat": 33.7, "lng": -84.4, "name": "Atlanta"},
    "phoenix": {"lat": 33.4, "lng": -112.1, "name": "Phoenix"},
    "dallas": {"lat": 32.8, "lng": -96.8, "name": "Dallas"},
    "detroit": {"lat": 42.3, "lng": -83.0, "name": "Detroit"},
    "philly": {"lat": 39.9, "lng": -75.2, "name": "Philadelphia"},
    "san_diego": {"lat": 32.7, "lng": -117.2, "name": "San Diego"},
    "el_paso": {"lat": 31.8, "lng": -106.4, "name": "El Paso"},
    "tucson": {"lat": 32.2, "lng": -110.9, "name": "Tucson"},
    "portland": {"lat": 45.5, "lng": -122.7, "name": "Portland"},
    "minneapolis": {"lat": 44.98, "lng": -93.27, "name": "Minneapolis"},
    "nashville": {"lat": 36.16, "lng": -86.78, "name": "Nashville"},
    "salt_lake": {"lat": 40.76, "lng": -111.89, "name": "Salt Lake City"},
}

# Which clusters are hot in which regions, per topic
GEO_MAPPING = {
    "ai-regulation": [
        ("ai-existential", ["sf", "seattle", "boston"], 0.85),
        ("ai-gov-needed", ["dc", "nyc", "chicago"], 0.72),
        ("ai-jobs", ["detroit", "houston", "atlanta"], 0.65),
        ("ai-innovation", ["sf", "austin", "seattle"], 0.60),
        ("ai-open-source", ["portland", "denver", "austin"], 0.45),
    ],
    "immigration-policy": [
        ("imm-border", ["el_paso", "tucson", "san_diego", "phoenix"], 0.90),
        ("imm-crime", ["houston", "dallas", "miami"], 0.75),
        ("imm-economy", ["la", "chicago", "nyc"], 0.60),
        ("imm-humanitarian", ["dc", "boston", "sf"], 0.55),
        ("imm-workforce", ["austin", "denver", "minneapolis"], 0.50),
    ],
    "us-israel-iran": [
        ("uii-iran-proxies", ["dc", "nyc", "houston"], 0.80),
        ("uii-ceasefire", ["chicago", "sf", "portland"], 0.70),
        ("uii-arms-sales", ["dc", "boston", "seattle"], 0.65),
        ("uii-us-involvement", ["dc", "miami", "dallas"], 0.60),
        ("uii-destabilization", ["nyc", "la", "atlanta"], 0.50),
    ],
    "climate-policy": [
        ("clim-nuclear", ["dc", "boston", "chicago"], 0.70),
        ("clim-carbon", ["houston", "dallas", "denver"], 0.65),
        ("clim-justice", ["la", "sf", "portland"], 0.60),
        ("clim-renewable", ["austin", "denver", "seattle"], 0.55),
        ("clim-skeptic", ["houston", "phoenix", "nashville"], 0.45),
    ],
    "ai-workplace": [
        ("aiw-displacement", ["sf", "nyc", "chicago", "detroit"], 0.85),
        ("aiw-creative", ["la", "nyc", "austin"], 0.75),
        ("aiw-augmentation", ["sf", "seattle", "boston"], 0.65),
        ("aiw-retraining", ["dc", "chicago", "detroit"], 0.55),
        ("aiw-productivity", ["sf", "austin", "denver"], 0.50),
    ],
    "crypto-web3": [
        ("cw-speculation", ["nyc", "miami", "sf"], 0.85),
        ("cw-scam", ["nyc", "la", "chicago"], 0.75),
        ("cw-defi", ["sf", "austin", "miami"], 0.70),
        ("cw-regulation", ["dc", "nyc", "boston"], 0.55),
        ("cw-environment", ["portland", "seattle", "denver"], 0.45),
    ],
    "social-media-youth": [
        ("smy-ban", ["dc", "dallas", "nashville", "phoenix"], 0.85),
        ("smy-platform", ["sf", "seattle", "nyc"], 0.70),
        ("smy-crisis", ["la", "chicago", "atlanta"], 0.65),
        ("smy-parents", ["houston", "dallas", "nashville"], 0.55),
        ("smy-research", ["boston", "dc", "sf"], 0.50),
    ],
    "creator-economy": [
        ("ce-exploitation", ["la", "nyc", "miami"], 0.80),
        ("ce-algorithm", ["sf", "seattle", "austin"], 0.70),
        ("ce-burnout", ["la", "nyc", "chicago"], 0.60),
        ("ce-opportunity", ["austin", "miami", "nashville"], 0.55),
        ("ce-monetization", ["sf", "nyc", "la"], 0.50),
    ],
    "remote-work": [
        ("rw-remote", ["sf", "austin", "denver", "portland"], 0.80),
        ("rw-rto", ["nyc", "chicago", "dc"], 0.70),
        ("rw-realestate", ["nyc", "sf", "chicago"], 0.65),
        ("rw-culture", ["dc", "boston", "atlanta"], 0.55),
        ("rw-hybrid", ["seattle", "austin", "denver"], 0.50),
    ],
    "us-china-tech": [
        ("uct-decouple", ["dc", "sf", "seattle"], 0.85),
        ("uct-chips", ["sf", "austin", "portland"], 0.75),
        ("uct-tiktok", ["dc", "la", "nyc"], 0.70),
        ("uct-coldwar", ["dc", "nyc", "boston"], 0.65),
        ("uct-industrial", ["detroit", "houston", "phoenix"], 0.55),
    ],
}

def generate_geo_data():
    """Generate data/geo/{topic_id}.json for each topic."""
    for topic in TOPICS:
        tid = topic["id"]
        mapping = GEO_MAPPING.get(tid, [])
        geo_clusters = []
        for cluster_id, regions, base_salience in mapping:
            # Find cluster label
            cluster_label = cluster_id
            for c in topic.get("clusters", []):
                if c["id"] == cluster_id:
                    cluster_label = c["label"]
                    break

            geo_regions = []
            for region_key in regions:
                r = US_REGIONS[region_key]
                salience = base_salience * random.uniform(0.7, 1.0)
                # Find momentum from cluster data
                momentum = 0.5
                for c in topic.get("clusters", []):
                    if c["id"] == cluster_id:
                        momentum = c["momentum"]
                        break
                geo_regions.append({
                    "lat": r["lat"] + random.uniform(-0.3, 0.3),
                    "lng": r["lng"] + random.uniform(-0.3, 0.3),
                    "radius_km": random.randint(80, 250),
                    "salience": round(salience, 2),
                    "momentum": round(momentum, 2),
                })

            geo_clusters.append({
                "cluster_id": cluster_id,
                "cluster_label": cluster_label,
                "regions": geo_regions,
            })

        out = {"topic_id": tid, "geo_clusters": geo_clusters}
        path = DATA_DIR / "geo" / f"{tid}.json"
        path.write_text(json.dumps(out, indent=2))
        print(f"  wrote {path}")


# ============================================================================
# DISCOURSE FEED — synthesized from topic claim data
# ============================================================================

USERNAMES_X = [
    "policy_watch_dc", "freedomfirst_99", "datadriven_takes", "citizen_analyst",
    "realpolitik_now", "truth_seeker_42", "indie_journo", "concerned_parent_3",
    "market_watcher", "civic_mind_101", "neutral_observer", "daily_digest_feed",
    "grassroots_voice", "the_contrarian", "signal_boost_dc", "factcheck_this",
    "mainst_media_watcher", "deep_state_skeptic", "policy_nerd_23", "open_source_intel",
]

USERNAMES_REDDIT = [
    "u/PolicyAnalyst2026", "u/SkepticalCitizen", "u/DataDrivenDebater", "u/GrassrootsVoice",
    "u/DeepDiveResearch", "u/ModerateCenter", "u/ConcernedVoter", "u/EconomistView",
    "u/TechPolicyWonk", "u/IndependentMind_42", "u/CriticalThinker99", "u/PublicInterestLaw",
    "u/MediaLiteracy101", "u/NuancedTakes", "u/EvidenceBased", "u/LocalPerspective",
]

DISCOURSE_TEMPLATES = {
    "ai-regulation": [
        {"text": "Unregulated AI development poses existential risks that demand immediate policy action. We can't afford to wait.", "cluster_id": "ai-existential", "tags": ["→ Existential Risk cluster", "🔥 arousal: high"]},
        {"text": "AI regulation will stifle innovation and put domestic companies at a competitive disadvantage against China", "cluster_id": "ai-innovation", "tags": ["→ Innovation Stifling cluster", "↗ fragmenting"]},
        {"text": "The pharmaceutical model for AI regulation makes the most sense — staged approvals with clear safety benchmarks", "cluster_id": "ai-pharma-model", "tags": ["→ Pharmaceutical Model cluster"]},
        {"text": "AI will eliminate millions of jobs and governments are completely unprepared for the economic fallout", "cluster_id": "ai-jobs", "tags": ["→ Job Displacement cluster", "🔥 arousal: high", "📈 momentum spike"]},
        {"text": "Government oversight of AI systems is necessary — we regulate every other industry that can harm people", "cluster_id": "ai-gov-needed", "tags": ["→ Government Oversight cluster", "↙ mainstreaming"]},
        {"text": "Open source AI models are the best path to safety — transparency beats regulation every time", "cluster_id": "ai-open-source", "tags": ["→ Open Source Safety cluster"]},
        {"text": "The EU AI Act is the gold standard. We need something equivalent in the US before it's too late", "cluster_id": "ai-gov-needed", "tags": ["→ Government Oversight cluster", "↗ lead-lag: X → Reddit"]},
        {"text": "Every major tech CEO has called for AI regulation — when has that EVER happened before? Something is very wrong", "cluster_id": "ai-existential", "tags": ["→ Existential Risk cluster", "⚠ coordination signal"]},
    ],
    "immigration-policy": [
        {"text": "Border security is a fundamental sovereign right and must be enforced strictly. Every nation has this right.", "cluster_id": "imm-border", "tags": ["→ Border Security cluster", "🔥 arousal: high"]},
        {"text": "Immigration strengthens the economy through labor force growth and entrepreneurship — the data is clear", "cluster_id": "imm-economy", "tags": ["→ Economic Impact cluster"]},
        {"text": "47 near-identical posts about 'border invasion' from accounts created this month. Something coordinated happening here", "cluster_id": "imm-crime", "tags": ["→ Crime & Safety cluster", "⚠ near-duplicate ×47"]},
        {"text": "Asylum seekers have a legal right to present their case. Turning them away violates international law", "cluster_id": "imm-asylum", "tags": ["→ Asylum Rights cluster"]},
        {"text": "Agricultural workers are 70% immigrant labor. Deport them all and food prices triple overnight", "cluster_id": "imm-workforce", "tags": ["→ Labor Shortages cluster", "🔥 arousal: medium"]},
        {"text": "My town was safe until they opened that facility. Crime is up 300% — that's not xenophobia, that's statistics", "cluster_id": "imm-crime", "tags": ["→ Crime & Safety cluster", "🔥 arousal: high", "↗ radicalizing"]},
        {"text": "Legal immigration pathways are so broken that waiting legally takes 15-20 years. Fix the system", "cluster_id": "imm-legal", "tags": ["→ Legal Pathways cluster"]},
        {"text": "Cultural integration isn't about assimilation — it's about shared civic values while preserving heritage", "cluster_id": "imm-cultural", "tags": ["→ Cultural Integration cluster"]},
    ],
    "us-israel-iran": [
        {"text": "US military involvement is necessary to contain Iranian expansionism. Withdrawal would be catastrophic", "cluster_id": "uii-us-involvement", "tags": ["→ US Involvement cluster", "🔥 arousal: high"]},
        {"text": "Iran's proxy network — Hezbollah, Houthis, Iraqi militias — is the real threat to regional stability", "cluster_id": "uii-iran-proxies", "tags": ["→ Iran Proxies cluster", "🔥 arousal: high"]},
        {"text": "An immediate ceasefire is the only way to prevent further civilian casualties. No more escalation", "cluster_id": "uii-ceasefire", "tags": ["→ Ceasefire Now cluster", "📈 momentum spike"]},
        {"text": "US arms sales to Israel make American taxpayers complicit in the humanitarian crisis", "cluster_id": "uii-arms-sales", "tags": ["→ Arms Sales cluster", "🔥 arousal: medium"]},
        {"text": "The conflict is destabilizing the entire region. Jordan, Lebanon, Iraq — all feeling the spillover", "cluster_id": "uii-destabilization", "tags": ["→ Regional Destabilization cluster"]},
        {"text": "Diplomatic engagement with Iran is the only path that doesn't end in regional war", "cluster_id": "uii-diplomacy", "tags": ["→ Diplomacy Path cluster"]},
    ],
    "climate-policy": [
        {"text": "Carbon capture is fossil fuel industry greenwashing. They've known the science for 50 years and did nothing", "cluster_id": "clim-carbon", "tags": ["→ Carbon Capture Critique cluster", "🔥 arousal: high"]},
        {"text": "Nuclear energy is the only realistic path to baseload decarbonization. Renewables alone can't do it", "cluster_id": "clim-nuclear", "tags": ["→ Nuclear Revival cluster", "📈 momentum spike"]},
        {"text": "Individual carbon footprint was literally invented by BP's PR team. It's systemic, not personal", "cluster_id": "clim-footprint", "tags": ["→ Individual Responsibility cluster", "↗ radicalizing"]},
        {"text": "Climate justice means recognizing that the Global South pays the highest price for emissions they didn't create", "cluster_id": "clim-justice", "tags": ["→ Climate Justice cluster"]},
        {"text": "Solar and wind are now cheaper than coal in most markets. The transition is economic, not just moral", "cluster_id": "clim-renewable", "tags": ["→ Renewable Transition cluster"]},
        {"text": "Climate models have been wrong for decades. The alarmism is a political tool, not science", "cluster_id": "clim-skeptic", "tags": ["→ Climate Skepticism cluster", "🔥 arousal: medium"]},
    ],
    "ai-workplace": [
        {"text": "AI will automate away millions of white-collar jobs within the next five years. This isn't speculation anymore", "cluster_id": "aiw-displacement", "tags": ["→ Job Displacement cluster", "🔥 arousal: high"]},
        {"text": "AI is a productivity tool that augments humans. Every tech revolution created more jobs than it destroyed", "cluster_id": "aiw-augmentation", "tags": ["→ AI Augmentation cluster"]},
        {"text": "AI-generated content is destroying the value of creative work. Artists, writers, designers — all under threat", "cluster_id": "aiw-creative", "tags": ["→ Creative Threat cluster", "🔥 arousal: high"]},
        {"text": "Massive investment in retraining programs is needed NOW. We can't wait until after the layoffs hit", "cluster_id": "aiw-retraining", "tags": ["→ Retraining Programs cluster"]},
        {"text": "Fears about AI replacing jobs are the same Luddite arguments made about every technology revolution", "cluster_id": "aiw-luddite", "tags": ["→ Luddite Fallacy cluster", "📈 momentum spike"]},
        {"text": "The companies pushing AI hardest are quietly laying off the workers it was supposed to augment", "cluster_id": "aiw-displacement", "tags": ["→ Job Displacement cluster", "⚠ coordination signal", "🔥 arousal: high"]},
    ],
    "crypto-web3": [
        {"text": "Cryptocurrency represents the future of finance. Traditional banking is a dead system walking", "cluster_id": "cw-future", "tags": ["→ Crypto Future cluster", "🔥 arousal: medium"]},
        {"text": "The vast majority of crypto projects are scams. FTX, Celsius, Luna — the pattern is clear", "cluster_id": "cw-scam", "tags": ["→ Crypto Scam cluster", "🔥 arousal: high"]},
        {"text": "DeFi protocols offer financial freedom to billions of unbanked people. This is liberation tech", "cluster_id": "cw-defi", "tags": ["→ DeFi Freedom cluster", "↗ fragmenting"]},
        {"text": "Crypto regulation is essential to protect consumers. The wild west era needs to end", "cluster_id": "cw-regulation", "tags": ["→ Regulation Needed cluster"]},
        {"text": "Proof-of-work mining is an environmental catastrophe. No financial innovation justifies this", "cluster_id": "cw-environment", "tags": ["→ Environmental Cost cluster"]},
        {"text": "Bitcoin's price action confirms a new bull cycle. This is just the beginning of the next run", "cluster_id": "cw-speculation", "tags": ["→ Speculation cluster", "📈 momentum spike", "🔥 arousal: high"]},
    ],
    "social-media-youth": [
        {"text": "Social media platforms should be banned for children under 16. The evidence of harm is overwhelming", "cluster_id": "smy-ban", "tags": ["→ Ban Platforms cluster", "🔥 arousal: high"]},
        {"text": "Parents bear primary responsibility for screen time. Government bans are overreach", "cluster_id": "smy-parents", "tags": ["→ Parental Responsibility cluster"]},
        {"text": "Tech companies knowingly designed addictive algorithms that exploit developing adolescent brains", "cluster_id": "smy-platform", "tags": ["→ Platform Accountability cluster", "🔥 arousal: high", "↗ radicalizing"]},
        {"text": "The research on social media and mental health is far more mixed than headlines suggest", "cluster_id": "smy-research", "tags": ["→ Research Mixed cluster"]},
        {"text": "Age verification systems create new privacy risks for ALL users. Cure worse than the disease", "cluster_id": "smy-verification", "tags": ["→ Age Verification cluster", "🔥 arousal: medium"]},
        {"text": "We are witnessing a generational mental health crisis directly caused by smartphone social media", "cluster_id": "smy-crisis", "tags": ["→ Mental Health Crisis cluster", "📈 momentum spike"]},
    ],
    "creator-economy": [
        {"text": "Platforms exploit creators by keeping the vast majority of ad revenue. Creators do all the work", "cluster_id": "ce-exploitation", "tags": ["→ Platform Exploitation cluster", "🔥 arousal: high"]},
        {"text": "The creator economy has democratized media. Anyone with talent can build an audience now", "cluster_id": "ce-opportunity", "tags": ["→ Creator Opportunity cluster"]},
        {"text": "Algorithm changes can destroy a creator's livelihood overnight. Zero transparency, zero recourse", "cluster_id": "ce-algorithm", "tags": ["→ Algorithm Tyranny cluster", "🔥 arousal: high", "📈 momentum spike"]},
        {"text": "Creator burnout is reaching epidemic levels. Platforms demand constant content output", "cluster_id": "ce-burnout", "tags": ["→ Burnout Epidemic cluster", "🔥 arousal: medium"]},
        {"text": "The top 1% of creators capture nearly all revenue. Millions earn essentially nothing", "cluster_id": "ce-exploitation", "tags": ["→ Platform Exploitation cluster"]},
        {"text": "Monetization policies reward engagement metrics, not quality. The incentives are completely broken", "cluster_id": "ce-monetization", "tags": ["→ Monetization Unfair cluster"]},
    ],
    "remote-work": [
        {"text": "Remote work has proven that most office jobs never required physical presence. The jig is up", "cluster_id": "rw-remote", "tags": ["→ Remote Forever cluster", "🔥 arousal: medium"]},
        {"text": "Return-to-office mandates are about justifying commercial real estate, not productivity", "cluster_id": "rw-remote", "tags": ["→ Remote Forever cluster", "🔥 arousal: high", "📈 momentum spike"]},
        {"text": "In-person collaboration is essential for innovation. Companies requiring RTO will outperform", "cluster_id": "rw-rto", "tags": ["→ RTO Mandate cluster"]},
        {"text": "Hybrid work with 2-3 office days is the pragmatic compromise everyone should adopt", "cluster_id": "rw-hybrid", "tags": ["→ Hybrid Compromise cluster"]},
        {"text": "Remote work is eroding company culture and creating a generation of isolated, disengaged workers", "cluster_id": "rw-culture", "tags": ["→ Culture Erosion cluster", "🔥 arousal: medium"]},
        {"text": "The commercial real estate market faces structural collapse. Remote work killed office demand", "cluster_id": "rw-realestate", "tags": ["→ Commercial Real Estate cluster", "↗ lead-lag: X → Reddit"]},
    ],
    "us-china-tech": [
        {"text": "The US must decouple from Chinese technology supply chains. This is a national security imperative", "cluster_id": "uct-decouple", "tags": ["→ Decouple Now cluster", "🔥 arousal: high"]},
        {"text": "US chip export controls are successfully slowing China's AI advancement and should be expanded", "cluster_id": "uct-chips", "tags": ["→ Chip War cluster", "📈 momentum spike"]},
        {"text": "Banning TikTok is necessary to prevent Chinese surveillance on American citizens", "cluster_id": "uct-tiktok", "tags": ["→ TikTok Ban cluster", "🔥 arousal: high"]},
        {"text": "We are in a technology cold war with China. Treating it otherwise is dangerously naive", "cluster_id": "uct-coldwar", "tags": ["→ Tech Cold War cluster", "🔥 arousal: medium"]},
        {"text": "Export controls are backfiring — China is accelerating domestic chip development faster than expected", "cluster_id": "uct-engagement", "tags": ["→ Engagement Needed cluster", "⚠ coordination signal"]},
        {"text": "Industrial policy and government investment in domestic chips will determine tech leadership", "cluster_id": "uct-industrial", "tags": ["→ Industrial Policy cluster"]},
    ],
}

def generate_discourse_data():
    """Generate data/discourse/{topic_id}.json for each topic."""
    for topic in TOPICS:
        tid = topic["id"]
        templates = DISCOURSE_TEMPLATES.get(tid, [])
        posts = []

        # Generate 30-50 posts per topic by expanding templates
        for i, tmpl in enumerate(templates):
            # Base post
            platform = "x" if i % 3 != 2 else "reddit"
            username = random.choice(USERNAMES_X if platform == "x" else USERNAMES_REDDIT)
            posts.append({
                "platform": platform,
                "username": username,
                "text": tmpl["text"],
                "cluster_id": tmpl["cluster_id"],
                "system_tags": tmpl["tags"],
                "extracted_at": f"2026-03-{random.randint(12,15)}T{random.randint(6,23):02d}:{random.randint(0,59):02d}:00Z",
            })

        # Add variations to reach ~30 posts
        while len(posts) < 30:
            tmpl = random.choice(templates)
            platform = random.choice(["x", "reddit"])
            username = random.choice(USERNAMES_X if platform == "x" else USERNAMES_REDDIT)
            # Slightly vary the text
            text = tmpl["text"]
            if random.random() > 0.5:
                text = text.rstrip(".") + " — this is exactly what I've been saying"
            elif random.random() > 0.5:
                text = "Thread: " + text
            posts.append({
                "platform": platform,
                "username": username,
                "text": text,
                "cluster_id": tmpl["cluster_id"],
                "system_tags": tmpl["tags"],
                "extracted_at": f"2026-03-{random.randint(12,15)}T{random.randint(6,23):02d}:{random.randint(0,59):02d}:00Z",
            })

        path = DATA_DIR / "discourse" / f"{tid}.json"
        path.write_text(json.dumps(posts, indent=2))
        print(f"  wrote {path} ({len(posts)} posts)")


def generate_topics_json():
    """Generate expanded data/topics.json with 10 topics."""
    topics_out = []
    for topic in TOPICS:
        # Remove internal 'clusters' key — not part of TopicSummary
        out = {k: v for k, v in topic.items() if k != "clusters"}
        topics_out.append(out)

    # Sort by IFI descending (highest flux first — matches auto-rotation order)
    topics_out.sort(key=lambda t: t.get("ifi", {}).get("value", 0), reverse=True)

    path = DATA_DIR / "topics.json"
    path.write_text(json.dumps(topics_out, indent=2))
    print(f"  wrote {path} ({len(topics_out)} topics)")


def generate_placeholder_youtube():
    """Generate placeholder YouTube data. Will be replaced with real video IDs later."""
    # Placeholder — real video IDs will be filled in separately
    for topic in TOPICS:
        tid = topic["id"]
        videos = []
        for i in range(5):
            videos.append({
                "video_id": f"placeholder_{tid}_{i}",
                "title": f"[Placeholder] {topic['name']} Discussion #{i+1}",
                "channel_name": random.choice(["CNN", "Fox News", "MSNBC", "BBC News", "PBS NewsHour", "The Hill", "CNBC", "Bloomberg", "Reuters", "Vice News"]),
                "view_count": random.randint(50000, 2000000),
                "published_at": f"2026-03-{random.randint(1,15):02d}T{random.randint(8,20):02d}:00:00Z",
            })

        path = DATA_DIR / "youtube" / f"{tid}.json"
        path.write_text(json.dumps(videos, indent=2))
        print(f"  wrote {path} (placeholder — needs real video IDs)")


if __name__ == "__main__":
    print("Generating Level 0 data...")

    print("\n1. Topics (expanded to 10):")
    generate_topics_json()

    print("\n2. Geographic data:")
    generate_geo_data()

    print("\n3. Discourse feed data:")
    generate_discourse_data()

    # NOTE: YouTube data is managed manually with real video IDs in data/youtube/*.json
    # Do NOT call generate_placeholder_youtube() here — it would overwrite real video IDs.

    print("\nDone! (YouTube data NOT regenerated — managed manually with real video IDs)")
