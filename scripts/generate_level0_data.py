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
        "id": "israel-palestine",
        "name": "Israel-Palestine Conflict",
        "cluster_count": 6,
        "contestation_level": "high",
        "contestation_emergence": None,
        "headline_divergence": {"jsd": 0.56, "dominant_typology": "Paradigmatic", "trend": "decreasing"},
        "top_accelerating_claim": {
            "text": "Media coverage of the conflict is systematically biased against Israel",
            "momentum": 0.77, "source_diversity": 0.73
        },
        "most_persistent_claim": {
            "text": "Israel has the right to defend itself against terrorist attacks on its civilians",
            "persistence_windows": 14
        },
        "key_signal": {"type": "momentum_spike", "summary": "'Western governments are complicit in the crisis through cont...' accelerated from 20th to 72nd perc"},
        "activity_sparkline": [0.30, 0.46, 0.65, 0.86, 0.80, 0.56, 0.56, 0.27, 0.74, 0.38, 0.36, 0.60],
        "ifi": {"value": 12.7, "trend": "stable"},
        "top_situation": {"summary": "'Both sides have committed atro...' polarizing — high friction (0.86)", "severity": "high"},
        "clusters": [
            {"id": "ip-media-bias", "label": "Media Bias", "momentum": 0.77},
            {"id": "ip-self-defense", "label": "Self-Defense", "momentum": 0.5},
            {"id": "ip-civilian", "label": "Civilian Impact", "momentum": 0.65},
            {"id": "ip-two-state", "label": "Two-State Solution", "momentum": 0.15},
            {"id": "ip-intl-law", "label": "International Law", "momentum": 0.4},
            {"id": "ip-complicity", "label": "Western Complicity", "momentum": 0.6},
        ]
    },
    {
        "id": "climate-policy",
        "name": "Climate Policy",
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
        "id": "cryptocurrency-regulation",
        "name": "Cryptocurrency Regulation",
        "cluster_count": 6,
        "contestation_level": "high",
        "contestation_emergence": {"emerged_hours_ago": 30, "source_diversity": 0.55},
        "headline_divergence": {"jsd": 0.38, "dominant_typology": "Information Asymmetry", "trend": "increasing"},
        "top_accelerating_claim": {
            "text": "SEC enforcement actions are killing American crypto innovation while other nations welcome it",
            "momentum": 0.79, "source_diversity": 0.44
        },
        "most_persistent_claim": {
            "text": "Stablecoins need federal regulation to prevent systemic financial risk",
            "persistence_windows": 11
        },
        "key_signal": {"type": "divergence_shift", "summary": "Platform divergence on stablecoin regulation widened 0.12 JSD over 48h"},
        "activity_sparkline": [0.45, 0.52, 0.71, 0.68, 0.83, 0.76, 0.91, 0.85, 0.72, 0.69, 0.78, 0.82],
        "ifi": {"value": 21.2, "trend": "increasing"},
        "top_situation": {"summary": "'DeFi protocols are unregulable by design...' fragmenting — divergent sub-narratives", "severity": "medium"},
        "clusters": [
            {"id": "crypto-sec", "label": "SEC Overreach", "momentum": 0.79},
            {"id": "crypto-stable", "label": "Stablecoin Risk", "momentum": 0.45},
            {"id": "crypto-defi", "label": "DeFi Governance", "momentum": 0.6},
            {"id": "crypto-cbdc", "label": "CBDC Concerns", "momentum": 0.35},
            {"id": "crypto-fraud", "label": "Consumer Protection", "momentum": 0.5},
            {"id": "crypto-innovation", "label": "Innovation Flight", "momentum": 0.7},
        ]
    },
    {
        "id": "housing-crisis",
        "name": "US Housing Crisis",
        "cluster_count": 7,
        "contestation_level": "medium",
        "contestation_emergence": None,
        "headline_divergence": {"jsd": 0.29, "dominant_typology": "Interpretive", "trend": "stable"},
        "top_accelerating_claim": {
            "text": "Corporate landlords and institutional investors are the primary driver of housing unaffordability",
            "momentum": 0.72, "source_diversity": 0.61
        },
        "most_persistent_claim": {
            "text": "Zoning reform and increased housing supply are the most effective solutions to the housing crisis",
            "persistence_windows": 16
        },
        "key_signal": {"type": "arousal_escalation", "summary": "Arousal trend shifted stable → warming on 'corporate landlord' cluster over 72h"},
        "activity_sparkline": [0.40, 0.45, 0.55, 0.50, 0.62, 0.58, 0.70, 0.65, 0.72, 0.68, 0.75, 0.71],
        "ifi": {"value": 8.7, "trend": "increasing"},
        "top_situation": {"summary": "'Wall Street buying single-family homes...' warming — arousal escalating", "severity": "medium"},
        "clusters": [
            {"id": "house-corp", "label": "Corporate Landlords", "momentum": 0.72},
            {"id": "house-zoning", "label": "Zoning Reform", "momentum": 0.4},
            {"id": "house-rate", "label": "Interest Rates", "momentum": 0.3},
            {"id": "house-supply", "label": "Housing Supply", "momentum": 0.5},
            {"id": "house-rent", "label": "Rent Control", "momentum": 0.55},
            {"id": "house-homeless", "label": "Homelessness", "momentum": 0.45},
            {"id": "house-remote", "label": "Remote Work Impact", "momentum": 0.25},
        ]
    },
    {
        "id": "social-media-censorship",
        "name": "Social Media Censorship",
        "cluster_count": 6,
        "contestation_level": "high",
        "contestation_emergence": {"emerged_hours_ago": 18, "source_diversity": 0.78},
        "headline_divergence": {"jsd": 0.47, "dominant_typology": "Paradigmatic", "trend": "increasing"},
        "top_accelerating_claim": {
            "text": "Platform content moderation is politically biased and systematically suppresses conservative viewpoints",
            "momentum": 0.81, "source_diversity": 0.38
        },
        "most_persistent_claim": {
            "text": "Content moderation is necessary to prevent the spread of misinformation and protect public health",
            "persistence_windows": 13
        },
        "key_signal": {"type": "coordination_flag", "summary": "Cross-platform sync: identical framing on 'censorship' detected across X and Reddit within 2h"},
        "activity_sparkline": [0.55, 0.63, 0.78, 0.82, 0.75, 0.88, 0.92, 0.85, 0.79, 0.83, 0.90, 0.87],
        "ifi": {"value": 24.1, "trend": "increasing"},
        "top_situation": {"summary": "'Government-big tech collusion to suppress...' high coordination signal detected", "severity": "high"},
        "clusters": [
            {"id": "cens-bias", "label": "Political Bias", "momentum": 0.81},
            {"id": "cens-health", "label": "Health Misinfo", "momentum": 0.4},
            {"id": "cens-free-speech", "label": "Free Speech", "momentum": 0.65},
            {"id": "cens-section230", "label": "Section 230", "momentum": 0.5},
            {"id": "cens-foreign", "label": "Foreign Influence", "momentum": 0.35},
            {"id": "cens-algorithm", "label": "Algorithmic Bias", "momentum": 0.55},
        ]
    },
    {
        "id": "vaccine-policy",
        "name": "Vaccine Policy",
        "cluster_count": 5,
        "contestation_level": "high",
        "contestation_emergence": None,
        "headline_divergence": {"jsd": 0.52, "dominant_typology": "Paradigmatic", "trend": "stable"},
        "top_accelerating_claim": {
            "text": "Mandatory vaccination policies violate bodily autonomy and informed consent principles",
            "momentum": 0.68, "source_diversity": 0.52
        },
        "most_persistent_claim": {
            "text": "Vaccines are safe, effective, and essential for public health according to overwhelming scientific consensus",
            "persistence_windows": 18
        },
        "key_signal": {"type": "phase_transition", "summary": "'Natural immunity is superior' cluster reversed from mainstreaming to radicalizing"},
        "activity_sparkline": [0.35, 0.42, 0.38, 0.55, 0.48, 0.62, 0.58, 0.71, 0.65, 0.60, 0.57, 0.63],
        "ifi": {"value": 11.4, "trend": "stable"},
        "top_situation": {"summary": "'Pharma companies have legal immunity from...' high friction — contested advance", "severity": "medium"},
        "clusters": [
            {"id": "vax-mandate", "label": "Mandate Opposition", "momentum": 0.68},
            {"id": "vax-science", "label": "Scientific Consensus", "momentum": 0.3},
            {"id": "vax-natural", "label": "Natural Immunity", "momentum": 0.55},
            {"id": "vax-pharma", "label": "Pharma Accountability", "momentum": 0.6},
            {"id": "vax-children", "label": "Child Vaccination", "momentum": 0.4},
        ]
    },
    {
        "id": "education-reform",
        "name": "Education Reform",
        "cluster_count": 6,
        "contestation_level": "medium",
        "contestation_emergence": None,
        "headline_divergence": {"jsd": 0.31, "dominant_typology": "Interpretive", "trend": "stable"},
        "top_accelerating_claim": {
            "text": "School choice and voucher programs are essential to breaking the public school monopoly",
            "momentum": 0.62, "source_diversity": 0.48
        },
        "most_persistent_claim": {
            "text": "Public schools are underfunded and need more resources, not competition from private alternatives",
            "persistence_windows": 15
        },
        "key_signal": {"type": "lead_lag", "summary": "'Parental rights in curriculum' detected on X 18h before Reddit with consistent framing"},
        "activity_sparkline": [0.30, 0.35, 0.45, 0.42, 0.55, 0.50, 0.48, 0.60, 0.57, 0.65, 0.62, 0.58],
        "ifi": {"value": 7.3, "trend": "stable"},
        "top_situation": {"summary": "'CRT in schools is indoctrination...' lead-lag pattern detected across platforms", "severity": "low"},
        "clusters": [
            {"id": "edu-choice", "label": "School Choice", "momentum": 0.62},
            {"id": "edu-funding", "label": "Public Funding", "momentum": 0.35},
            {"id": "edu-curriculum", "label": "Curriculum Control", "momentum": 0.55},
            {"id": "edu-teachers", "label": "Teacher Shortage", "momentum": 0.3},
            {"id": "edu-tech", "label": "EdTech & AI", "momentum": 0.45},
            {"id": "edu-higher", "label": "Higher Ed Costs", "momentum": 0.4},
        ]
    },
    {
        "id": "us-china-relations",
        "name": "US-China Relations",
        "cluster_count": 7,
        "contestation_level": "high",
        "contestation_emergence": {"emerged_hours_ago": 40, "source_diversity": 0.62},
        "headline_divergence": {"jsd": 0.44, "dominant_typology": "Information Asymmetry", "trend": "increasing"},
        "top_accelerating_claim": {
            "text": "China's military buildup around Taiwan represents the most significant geopolitical threat of the decade",
            "momentum": 0.85, "source_diversity": 0.67
        },
        "most_persistent_claim": {
            "text": "Economic decoupling from China would devastate American consumers and businesses",
            "persistence_windows": 12
        },
        "key_signal": {"type": "momentum_spike", "summary": "'Taiwan semiconductor dependence is a national security crisis...' accelerated from 15th to 68th perc"},
        "activity_sparkline": [0.50, 0.58, 0.72, 0.68, 0.80, 0.75, 0.85, 0.82, 0.78, 0.88, 0.83, 0.90],
        "ifi": {"value": 18.6, "trend": "increasing"},
        "top_situation": {"summary": "'China's tech transfer is systematic IP theft...' coordination signal — burstiness anomaly", "severity": "high"},
        "clusters": [
            {"id": "china-taiwan", "label": "Taiwan Threat", "momentum": 0.85},
            {"id": "china-trade", "label": "Trade Decoupling", "momentum": 0.5},
            {"id": "china-tech", "label": "Tech Competition", "momentum": 0.7},
            {"id": "china-ip", "label": "IP Theft", "momentum": 0.6},
            {"id": "china-supply", "label": "Supply Chain", "momentum": 0.55},
            {"id": "china-diplomacy", "label": "Diplomatic Engagement", "momentum": 0.2},
            {"id": "china-semiconductor", "label": "Semiconductor War", "momentum": 0.75},
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
    "israel-palestine": [
        ("ip-media-bias", ["nyc", "dc", "la"], 0.80),
        ("ip-civilian", ["chicago", "detroit", "sf"], 0.70),
        ("ip-complicity", ["boston", "portland", "seattle"], 0.65),
        ("ip-self-defense", ["miami", "nyc", "dallas"], 0.60),
        ("ip-intl-law", ["dc", "boston", "sf"], 0.50),
    ],
    "climate-policy": [
        ("clim-nuclear", ["dc", "boston", "chicago"], 0.70),
        ("clim-carbon", ["houston", "dallas", "denver"], 0.65),
        ("clim-justice", ["la", "sf", "portland"], 0.60),
        ("clim-renewable", ["austin", "denver", "seattle"], 0.55),
        ("clim-skeptic", ["houston", "phoenix", "nashville"], 0.45),
    ],
    "cryptocurrency-regulation": [
        ("crypto-sec", ["nyc", "dc", "sf"], 0.80),
        ("crypto-defi", ["sf", "austin", "miami"], 0.70),
        ("crypto-innovation", ["miami", "austin", "la"], 0.65),
        ("crypto-stable", ["dc", "nyc", "chicago"], 0.55),
        ("crypto-fraud", ["nyc", "la", "atlanta"], 0.50),
    ],
    "housing-crisis": [
        ("house-corp", ["la", "nyc", "sf", "seattle"], 0.85),
        ("house-rent", ["nyc", "sf", "boston"], 0.75),
        ("house-zoning", ["sf", "la", "austin"], 0.65),
        ("house-homeless", ["la", "sf", "portland", "seattle"], 0.60),
        ("house-remote", ["denver", "austin", "nashville", "salt_lake"], 0.50),
    ],
    "social-media-censorship": [
        ("cens-bias", ["dallas", "houston", "nashville", "phoenix"], 0.85),
        ("cens-free-speech", ["austin", "dc", "miami"], 0.70),
        ("cens-algorithm", ["sf", "seattle", "nyc"], 0.60),
        ("cens-section230", ["dc", "nyc", "boston"], 0.55),
        ("cens-health", ["la", "chicago", "philly"], 0.50),
    ],
    "vaccine-policy": [
        ("vax-mandate", ["dallas", "houston", "nashville", "phoenix"], 0.80),
        ("vax-pharma", ["nyc", "dc", "boston"], 0.65),
        ("vax-natural", ["austin", "denver", "portland"], 0.60),
        ("vax-science", ["boston", "sf", "dc", "seattle"], 0.55),
        ("vax-children", ["la", "chicago", "atlanta", "philly"], 0.50),
    ],
    "education-reform": [
        ("edu-choice", ["dallas", "houston", "nashville", "phoenix"], 0.70),
        ("edu-funding", ["detroit", "chicago", "philly"], 0.65),
        ("edu-curriculum", ["dc", "austin", "atlanta"], 0.60),
        ("edu-tech", ["sf", "seattle", "austin"], 0.50),
        ("edu-higher", ["nyc", "boston", "la"], 0.55),
    ],
    "us-china-relations": [
        ("china-taiwan", ["dc", "sf", "seattle"], 0.85),
        ("china-tech", ["sf", "seattle", "austin", "boston"], 0.75),
        ("china-semiconductor", ["sf", "austin", "portland"], 0.70),
        ("china-trade", ["la", "nyc", "houston", "chicago"], 0.65),
        ("china-ip", ["dc", "boston", "detroit"], 0.55),
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
    "israel-palestine": [
        {"text": "Media coverage of the conflict is systematically biased against Israel. Same events, wildly different framing", "cluster_id": "ip-media-bias", "tags": ["→ Media Bias cluster", "🔥 arousal: high"]},
        {"text": "The civilian death toll is unconscionable. No political goal justifies this level of destruction", "cluster_id": "ip-civilian", "tags": ["→ Civilian Impact cluster", "🔥 arousal: high"]},
        {"text": "Israel has the right to defend itself against terrorist attacks on its civilians. Full stop.", "cluster_id": "ip-self-defense", "tags": ["→ Self-Defense cluster"]},
        {"text": "Western governments are complicit through continued arms sales and diplomatic cover", "cluster_id": "ip-complicity", "tags": ["→ Western Complicity cluster", "📈 momentum spike"]},
        {"text": "Two-state solution is the only viable path. Everything else is fantasy or ethnic cleansing", "cluster_id": "ip-two-state", "tags": ["→ Two-State Solution cluster"]},
        {"text": "International humanitarian law applies to all parties. Selective enforcement undermines the entire framework", "cluster_id": "ip-intl-law", "tags": ["→ International Law cluster"]},
    ],
    "climate-policy": [
        {"text": "Carbon capture is fossil fuel industry greenwashing. They've known the science for 50 years and did nothing", "cluster_id": "clim-carbon", "tags": ["→ Carbon Capture Critique cluster", "🔥 arousal: high"]},
        {"text": "Nuclear energy is the only realistic path to baseload decarbonization. Renewables alone can't do it", "cluster_id": "clim-nuclear", "tags": ["→ Nuclear Revival cluster", "📈 momentum spike"]},
        {"text": "Individual carbon footprint was literally invented by BP's PR team. It's systemic, not personal", "cluster_id": "clim-footprint", "tags": ["→ Individual Responsibility cluster", "↗ radicalizing"]},
        {"text": "Climate justice means recognizing that the Global South pays the highest price for emissions they didn't create", "cluster_id": "clim-justice", "tags": ["→ Climate Justice cluster"]},
        {"text": "Solar and wind are now cheaper than coal in most markets. The transition is economic, not just moral", "cluster_id": "clim-renewable", "tags": ["→ Renewable Transition cluster"]},
        {"text": "Climate models have been wrong for decades. The alarmism is a political tool, not science", "cluster_id": "clim-skeptic", "tags": ["→ Climate Skepticism cluster", "🔥 arousal: medium"]},
    ],
    "cryptocurrency-regulation": [
        {"text": "SEC enforcement actions are killing American crypto innovation while Dubai and Singapore welcome builders", "cluster_id": "crypto-sec", "tags": ["→ SEC Overreach cluster", "🔥 arousal: high"]},
        {"text": "Stablecoins without federal regulation are ticking time bombs — they're shadow banks with no oversight", "cluster_id": "crypto-stable", "tags": ["→ Stablecoin Risk cluster"]},
        {"text": "DeFi protocols are unregulable by design — and that's the point. Code is law", "cluster_id": "crypto-defi", "tags": ["→ DeFi Governance cluster", "↗ fragmenting"]},
        {"text": "CBDCs are government surveillance coins. They want to track every transaction you make", "cluster_id": "crypto-cbdc", "tags": ["→ CBDC Concerns cluster", "🔥 arousal: high"]},
        {"text": "FTX, Celsius, Luna — how many people need to lose everything before we regulate this industry?", "cluster_id": "crypto-fraud", "tags": ["→ Consumer Protection cluster"]},
        {"text": "The US is losing the crypto talent war. Every enforcement action pushes another team offshore", "cluster_id": "crypto-innovation", "tags": ["→ Innovation Flight cluster", "📈 momentum spike"]},
    ],
    "housing-crisis": [
        {"text": "Corporate landlords bought 1 in 4 single-family homes last year. This isn't a market — it's extraction", "cluster_id": "house-corp", "tags": ["→ Corporate Landlords cluster", "🔥 arousal: high"]},
        {"text": "Zoning reform is the single most impactful thing cities can do. Let people build housing where there's demand", "cluster_id": "house-zoning", "tags": ["→ Zoning Reform cluster"]},
        {"text": "Rent control doesn't work — it reduces supply and raises rents for everyone not lucky enough to have a unit", "cluster_id": "house-rent", "tags": ["→ Rent Control cluster", "↗ fragmenting"]},
        {"text": "Remote work hollowed out city centers and made rural towns unaffordable. Nobody planned for this", "cluster_id": "house-remote", "tags": ["→ Remote Work Impact cluster"]},
        {"text": "The homelessness crisis is a housing crisis. Every city that built more housing saw numbers drop", "cluster_id": "house-homeless", "tags": ["→ Homelessness cluster"]},
        {"text": "Interest rates make it impossible for first-time buyers. An entire generation is locked out", "cluster_id": "house-rate", "tags": ["→ Interest Rates cluster", "🔥 arousal: medium"]},
    ],
    "social-media-censorship": [
        {"text": "Platform content moderation is politically biased and systematically suppresses conservative viewpoints", "cluster_id": "cens-bias", "tags": ["→ Political Bias cluster", "🔥 arousal: high"]},
        {"text": "Content moderation is necessary. Without it, platforms become cesspools of harassment and disinfo", "cluster_id": "cens-health", "tags": ["→ Health Misinfo cluster"]},
        {"text": "Section 230 reform would break the internet. Platforms can't review billions of posts manually", "cluster_id": "cens-section230", "tags": ["→ Section 230 cluster"]},
        {"text": "Free speech means the government can't censor you. It doesn't mean a private company has to host you", "cluster_id": "cens-free-speech", "tags": ["→ Free Speech cluster", "↗ mainstreaming"]},
        {"text": "Algorithmic amplification is the real censorship. What they DON'T show you matters more than what they remove", "cluster_id": "cens-algorithm", "tags": ["→ Algorithmic Bias cluster", "📈 momentum spike"]},
        {"text": "Government-big tech collusion to suppress speech is documented. The Twitter files proved it", "cluster_id": "cens-bias", "tags": ["→ Political Bias cluster", "⚠ coordination signal", "🔥 arousal: high"]},
    ],
    "vaccine-policy": [
        {"text": "Mandatory vaccination violates bodily autonomy. No government should force a medical procedure", "cluster_id": "vax-mandate", "tags": ["→ Mandate Opposition cluster", "🔥 arousal: high"]},
        {"text": "Vaccines are safe and effective — overwhelming scientific consensus from decades of research", "cluster_id": "vax-science", "tags": ["→ Scientific Consensus cluster"]},
        {"text": "Natural immunity from infection provides broader, longer-lasting protection than vaccination alone", "cluster_id": "vax-natural", "tags": ["→ Natural Immunity cluster", "↗ radicalizing"]},
        {"text": "Pharma companies have legal immunity from vaccine injuries. No accountability means no trust", "cluster_id": "vax-pharma", "tags": ["→ Pharma Accountability cluster", "🔥 arousal: medium"]},
        {"text": "The childhood vaccination schedule has tripled since the 1980s. Parents deserve answers, not dismissal", "cluster_id": "vax-children", "tags": ["→ Child Vaccination cluster"]},
    ],
    "education-reform": [
        {"text": "School choice gives parents the power to find the best environment for their kids. Competition improves all schools", "cluster_id": "edu-choice", "tags": ["→ School Choice cluster"]},
        {"text": "Public schools are starved of resources while politicians funnel money to private alternatives", "cluster_id": "edu-funding", "tags": ["→ Public Funding cluster", "🔥 arousal: medium"]},
        {"text": "Parents have a right to know what's being taught. Curriculum transparency shouldn't be controversial", "cluster_id": "edu-curriculum", "tags": ["→ Curriculum Control cluster", "↗ lead-lag: X → Reddit"]},
        {"text": "We can't keep teachers when starting salary is less than a warehouse job. The shortage is self-inflicted", "cluster_id": "edu-teachers", "tags": ["→ Teacher Shortage cluster"]},
        {"text": "AI tutoring will personalize education in ways no classroom can. This is the biggest opportunity in a century", "cluster_id": "edu-tech", "tags": ["→ EdTech & AI cluster"]},
        {"text": "Student debt is $1.7 trillion. Higher education is a broken system extracting wealth from young people", "cluster_id": "edu-higher", "tags": ["→ Higher Ed Costs cluster", "🔥 arousal: high"]},
    ],
    "us-china-relations": [
        {"text": "China's military buildup around Taiwan represents the most significant geopolitical threat of the decade", "cluster_id": "china-taiwan", "tags": ["→ Taiwan Threat cluster", "🔥 arousal: high"]},
        {"text": "Economic decoupling from China would devastate American consumers. Everything costs more without them", "cluster_id": "china-trade", "tags": ["→ Trade Decoupling cluster"]},
        {"text": "China's systematic IP theft has cost the US $600 billion annually. At what point is it economic warfare?", "cluster_id": "china-ip", "tags": ["→ IP Theft cluster", "⚠ coordination signal"]},
        {"text": "Taiwan semiconductor dependence is a national security crisis. TSMC controls 90% of advanced chips", "cluster_id": "china-semiconductor", "tags": ["→ Semiconductor War cluster", "📈 momentum spike"]},
        {"text": "We need diplomatic engagement, not saber-rattling. Cold War thinking gets everyone killed", "cluster_id": "china-diplomacy", "tags": ["→ Diplomatic Engagement cluster"]},
        {"text": "China's AI capabilities are advancing faster than anyone predicted. The tech race is real", "cluster_id": "china-tech", "tags": ["→ Tech Competition cluster", "🔥 arousal: medium"]},
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

    print("\n4. YouTube data (placeholder):")
    generate_placeholder_youtube()

    print("\nDone! YouTube data needs real video IDs — run separately.")
