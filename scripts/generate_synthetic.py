#!/usr/bin/env python3
"""
Synthetic Data Generator for Narrative Monitoring System.

Generates realistic demo data for 4 topics across 3 platforms (X, Reddit, YouTube).
Produces all JSON files the frontend needs, matching TypeScript type contracts exactly.

No API keys required. Uses numpy for synthetic embeddings.

Usage:
    python scripts/generate_synthetic.py

Output:
    data/topics.json                           — TopicSummary[] for Level 0
    data/claims/{topic_id}/extracted.json      — Claim[] with embeddings
    data/claims/{topic_id}/clusters.json       — Cluster[]
    data/metrics/{topic_id}/landscape_{window}.json  — LandscapeData per window
    data/metrics/{topic_id}/claims/{claim_id}.json   — ClaimDetail per claim
    data/metrics/{topic_id}/compare/{slice_pair}_{window}.json — CompareData
    data/metrics/{topic_id}/timeline_{window}.json   — TimelineData
"""

import json
import os
import random
import hashlib
from datetime import datetime, timedelta, timezone
from pathlib import Path
from typing import Any, Dict, Optional

import numpy as np

# Seed for reproducibility
random.seed(42)
np.random.seed(42)

BASE_DIR = Path(__file__).parent.parent
DATA_DIR = BASE_DIR / "data"

# Maps momentum_pattern archetype labels to numeric momentum values (-1 to +1)
MOMENTUM_PATTERN_VALUES = {
    "spike":     0.80,
    "rising":    0.50,
    "stable":    0.00,
    "declining": -0.45,
    "goes_dark": -0.65,
}

# ============================================================================
# Topic Definitions — each chosen to exercise specific metrics
# ============================================================================

TOPICS = [
    {
        "id": "ai-regulation",
        "name": "AI Regulation",
        "archetypes": [
            # Pro-regulation cluster
            {"text": "AI systems require government regulation to prevent harm to society",
             "subject": "AI regulation", "assertion": "government regulation is necessary",
             "framing": "public safety", "stance": "pro", "arousal": "medium",
             "cluster": "pro-regulation", "concept": "regulation-needed",
             "platforms": {"x": 0.35, "reddit": 0.40, "youtube": 0.25},
             "momentum_pattern": "stable", "persistence": 12},
            {"text": "Unregulated AI development poses existential risks that demand immediate policy action",
             "subject": "AI existential risk", "assertion": "AI poses existential risks requiring urgent regulation",
             "framing": "existential threat", "stance": "pro", "arousal": "high",
             "cluster": "pro-regulation", "concept": "regulation-needed",
             "platforms": {"x": 0.50, "reddit": 0.20, "youtube": 0.30},
             "momentum_pattern": "spike", "persistence": 4},
            {"text": "AI companies cannot be trusted to self-regulate given profit incentives",
             "subject": "AI self-regulation", "assertion": "self-regulation fails due to profit motive",
             "framing": "corporate distrust", "stance": "pro", "arousal": "medium",
             "cluster": "pro-regulation", "concept": "regulation-needed",
             "platforms": {"x": 0.45, "reddit": 0.45, "youtube": 0.10},
             "momentum_pattern": "rising", "persistence": 8},

            # Anti-regulation cluster
            {"text": "AI regulation will stifle innovation and put domestic companies at a competitive disadvantage",
             "subject": "AI regulation", "assertion": "regulation harms innovation and competitiveness",
             "framing": "innovation vs safety", "stance": "anti", "arousal": "medium",
             "cluster": "anti-regulation", "concept": "regulation-harmful",
             "platforms": {"x": 0.50, "reddit": 0.25, "youtube": 0.25},
             "momentum_pattern": "stable", "persistence": 14},
            {"text": "Current AI regulatory frameworks are outdated and designed for narrow AI, not general-purpose systems",
             "subject": "AI regulatory frameworks", "assertion": "existing frameworks are obsolete",
             "framing": "regulatory lag", "stance": "anti", "arousal": "low",
             "cluster": "anti-regulation", "concept": "regulation-harmful",
             "platforms": {"x": 0.20, "reddit": 0.30, "youtube": 0.50},
             "momentum_pattern": "stable", "persistence": 10},

            # Open source cluster
            {"text": "Open source AI development is essential to prevent concentration of AI power in large corporations",
             "subject": "open source AI", "assertion": "open source prevents power concentration",
             "framing": "power distribution", "stance": "pro", "arousal": "medium",
             "cluster": "open-source", "concept": "open-source-ai",
             "platforms": {"x": 0.30, "reddit": 0.60, "youtube": 0.10},
             "momentum_pattern": "rising", "persistence": 6},
            {"text": "Open source AI models enable dangerous capabilities to be freely distributed without safeguards",
             "subject": "open source AI safety", "assertion": "open source AI enables dangerous access",
             "framing": "security risk", "stance": "anti", "arousal": "high",
             "cluster": "anti-open-source", "concept": "open-source-danger",
             "platforms": {"x": 0.55, "reddit": 0.25, "youtube": 0.20},
             "momentum_pattern": "spike", "persistence": 3},

            # Targeted regulation cluster
            {"text": "AI regulation should target specific harms rather than impose blanket restrictions",
             "subject": "AI regulation approach", "assertion": "targeted regulation is better than blanket bans",
             "framing": "precision regulation", "stance": "neutral", "arousal": "low",
             "cluster": "targeted-regulation", "concept": "targeted-approach",
             "platforms": {"x": 0.15, "reddit": 0.65, "youtube": 0.20},
             "momentum_pattern": "rising", "persistence": 9},

            # AI jobs cluster
            {"text": "AI will eliminate millions of jobs and governments must prepare workforce transition programs",
             "subject": "AI and employment", "assertion": "AI will cause mass job displacement",
             "framing": "economic disruption", "stance": "pro", "arousal": "high",
             "cluster": "ai-jobs", "concept": "job-displacement",
             "platforms": {"x": 0.60, "reddit": 0.20, "youtube": 0.20},
             "momentum_pattern": "spike", "persistence": 5},

            # Silence target — this claim goes dark
            {"text": "AI regulation should be modeled after pharmaceutical oversight with staged approval processes",
             "subject": "AI regulatory model", "assertion": "pharmaceutical model should apply to AI",
             "framing": "established precedent", "stance": "pro", "arousal": "low",
             "cluster": "pharma-model", "concept": "pharma-regulation",
             "platforms": {"x": 0.30, "reddit": 0.60, "youtube": 0.10},
             "momentum_pattern": "goes_dark", "persistence": 6},
        ],
    },
    {
        "id": "immigration-policy",
        "name": "Immigration Policy",
        "archetypes": [
            {"text": "Immigration strengthens the economy through labor force growth and entrepreneurship",
             "subject": "immigration economics", "assertion": "immigration is economically beneficial",
             "framing": "economic growth", "stance": "pro", "arousal": "low",
             "cluster": "pro-immigration-economic", "concept": "immigration-benefits",
             "platforms": {"x": 0.25, "reddit": 0.55, "youtube": 0.20},
             "momentum_pattern": "stable", "persistence": 14},
            {"text": "Unchecked immigration undermines wages for native workers and strains public services",
             "subject": "immigration impact", "assertion": "immigration harms native workers and services",
             "framing": "economic burden", "stance": "anti", "arousal": "high",
             "cluster": "anti-immigration-economic", "concept": "immigration-harms",
             "platforms": {"x": 0.60, "reddit": 0.15, "youtube": 0.25},
             "momentum_pattern": "rising", "persistence": 12},
            {"text": "Border security is a fundamental sovereign right and must be enforced strictly",
             "subject": "border security", "assertion": "strict border enforcement is essential",
             "framing": "national sovereignty", "stance": "anti", "arousal": "high",
             "cluster": "border-security", "concept": "strict-enforcement",
             "platforms": {"x": 0.55, "reddit": 0.20, "youtube": 0.25},
             "momentum_pattern": "spike", "persistence": 8},
            {"text": "Immigration policy should prioritize humanitarian obligations and asylum rights",
             "subject": "asylum policy", "assertion": "humanitarian obligations must come first",
             "framing": "human rights", "stance": "pro", "arousal": "medium",
             "cluster": "humanitarian", "concept": "humanitarian-priority",
             "platforms": {"x": 0.30, "reddit": 0.50, "youtube": 0.20},
             "momentum_pattern": "stable", "persistence": 10},
            {"text": "A path to citizenship for undocumented immigrants is both morally right and economically sound",
             "subject": "citizenship pathway", "assertion": "citizenship path is moral and practical",
             "framing": "integration", "stance": "pro", "arousal": "medium",
             "cluster": "pathway-citizenship", "concept": "citizenship-path",
             "platforms": {"x": 0.35, "reddit": 0.45, "youtube": 0.20},
             "momentum_pattern": "declining", "persistence": 7},
            {"text": "Current immigration levels are part of a deliberate agenda to change national demographics",
             "subject": "immigration conspiracy", "assertion": "immigration is a demographic replacement scheme",
             "framing": "conspiracy", "stance": "anti", "arousal": "high",
             "cluster": "replacement-theory", "concept": "demographic-replacement",
             "platforms": {"x": 0.70, "reddit": 0.10, "youtube": 0.20},
             "momentum_pattern": "spike", "persistence": 3},
            {"text": "Immigration reform should focus on skills-based selection to match labor market needs",
             "subject": "immigration reform", "assertion": "skills-based selection optimizes outcomes",
             "framing": "pragmatic reform", "stance": "neutral", "arousal": "low",
             "cluster": "skills-based", "concept": "merit-immigration",
             "platforms": {"x": 0.20, "reddit": 0.50, "youtube": 0.30},
             "momentum_pattern": "rising", "persistence": 9},
            {"text": "Immigrants commit crimes at lower rates than native-born citizens according to research",
             "subject": "immigration and crime", "assertion": "immigrants have lower crime rates",
             "framing": "evidence-based", "stance": "pro", "arousal": "low",
             "cluster": "crime-stats", "concept": "immigration-safety",
             "platforms": {"x": 0.30, "reddit": 0.60, "youtube": 0.10},
             "momentum_pattern": "goes_dark", "persistence": 5},
        ],
    },
    {
        "id": "us-israel-iran",
        "name": "US-Israel-Iran War",
        "archetypes": [
            {"text": "US military involvement in the Middle East is necessary to contain Iranian expansionism",
             "subject": "US involvement", "assertion": "US military presence is necessary to counter Iran",
             "framing": "strategic necessity", "stance": "pro", "arousal": "high",
             "cluster": "us-involvement", "concept": "us-military-role",
             "platforms": {"x": 0.50, "reddit": 0.25, "youtube": 0.25},
             "momentum_pattern": "stable", "persistence": 14},
            {"text": "Iran's proxy network across the region poses a direct threat to US national security interests",
             "subject": "Iran proxies", "assertion": "Iranian proxies threaten US security",
             "framing": "national security", "stance": "pro", "arousal": "high",
             "cluster": "iran-proxies", "concept": "proxy-threat",
             "platforms": {"x": 0.55, "reddit": 0.20, "youtube": 0.25},
             "momentum_pattern": "spike", "persistence": 5},
            {"text": "Israel has the right to defend itself against attacks from Iranian-backed groups",
             "subject": "Israel defense", "assertion": "Israel's military response is justified self-defense",
             "framing": "self-defense", "stance": "pro", "arousal": "high",
             "cluster": "israel-defense", "concept": "right-to-defend",
             "platforms": {"x": 0.45, "reddit": 0.20, "youtube": 0.35},
             "momentum_pattern": "rising", "persistence": 12},
            {"text": "An immediate ceasefire is the only way to prevent further civilian casualties and regional escalation",
             "subject": "ceasefire", "assertion": "ceasefire is urgently needed",
             "framing": "humanitarian urgency", "stance": "anti", "arousal": "high",
             "cluster": "ceasefire-now", "concept": "ceasefire-demand",
             "platforms": {"x": 0.40, "reddit": 0.40, "youtube": 0.20},
             "momentum_pattern": "spike", "persistence": 6},
            {"text": "US arms sales to Israel make American taxpayers complicit in the humanitarian crisis",
             "subject": "arms sales", "assertion": "US arms transfers enable humanitarian violations",
             "framing": "accountability", "stance": "anti", "arousal": "medium",
             "cluster": "arms-sales", "concept": "arms-complicity",
             "platforms": {"x": 0.45, "reddit": 0.35, "youtube": 0.20},
             "momentum_pattern": "rising", "persistence": 10},
            {"text": "The conflict is destabilizing the entire region and risks drawing in additional state actors",
             "subject": "regional destabilization", "assertion": "conflict threatens broader regional stability",
             "framing": "geopolitical risk", "stance": "neutral", "arousal": "medium",
             "cluster": "regional-destabilization", "concept": "regional-spillover",
             "platforms": {"x": 0.30, "reddit": 0.45, "youtube": 0.25},
             "momentum_pattern": "stable", "persistence": 11},
            {"text": "Media coverage is systematically biased and fails to provide context for the conflict",
             "subject": "media bias", "assertion": "media coverage lacks crucial context",
             "framing": "media critique", "stance": "ambiguous", "arousal": "low",
             "cluster": "media-bias", "concept": "media-framing",
             "platforms": {"x": 0.60, "reddit": 0.15, "youtube": 0.25},
             "momentum_pattern": "declining", "persistence": 8},
            {"text": "Diplomatic engagement with Iran is preferable to military escalation and should be pursued urgently",
             "subject": "diplomacy", "assertion": "diplomacy with Iran is the better path",
             "framing": "de-escalation", "stance": "anti", "arousal": "low",
             "cluster": "diplomacy-path", "concept": "diplomatic-solution",
             "platforms": {"x": 0.20, "reddit": 0.55, "youtube": 0.25},
             "momentum_pattern": "goes_dark", "persistence": 7},
        ],
    },
    {
        "id": "climate-policy",
        "name": "Climate Change",
        "archetypes": [
            {"text": "Rapid transition to renewable energy is essential to avoid catastrophic climate outcomes",
             "subject": "energy transition", "assertion": "rapid renewable transition is essential",
             "framing": "climate urgency", "stance": "pro", "arousal": "medium",
             "cluster": "rapid-transition", "concept": "energy-transition",
             "platforms": {"x": 0.35, "reddit": 0.40, "youtube": 0.25},
             "momentum_pattern": "stable", "persistence": 14},
            {"text": "Climate alarmism exaggerates risks and the proposed policies would devastate the economy",
             "subject": "climate policy economics", "assertion": "climate policies are economically destructive",
             "framing": "economic realism", "stance": "anti", "arousal": "medium",
             "cluster": "climate-skeptic", "concept": "policy-harm",
             "platforms": {"x": 0.55, "reddit": 0.15, "youtube": 0.30},
             "momentum_pattern": "stable", "persistence": 12},
            {"text": "Nuclear energy should be central to climate policy as the only scalable clean baseload power",
             "subject": "nuclear energy", "assertion": "nuclear is essential for climate goals",
             "framing": "pragmatic environmentalism", "stance": "pro", "arousal": "low",
             "cluster": "nuclear-advocacy", "concept": "nuclear-power",
             "platforms": {"x": 0.25, "reddit": 0.55, "youtube": 0.20},
             "momentum_pattern": "rising", "persistence": 10},
            {"text": "Carbon capture technology is a fossil fuel industry distraction from real emissions reduction",
             "subject": "carbon capture", "assertion": "carbon capture delays real climate action",
             "framing": "greenwashing", "stance": "anti", "arousal": "medium",
             "cluster": "anti-ccs", "concept": "ccs-critique",
             "platforms": {"x": 0.40, "reddit": 0.45, "youtube": 0.15},
             "momentum_pattern": "spike", "persistence": 4},
            {"text": "Individual carbon footprint reduction is meaningless compared to corporate and industrial emissions",
             "subject": "emissions responsibility", "assertion": "corporate emissions dwarf individual impact",
             "framing": "systemic critique", "stance": "pro", "arousal": "medium",
             "cluster": "corporate-responsibility", "concept": "corporate-emissions",
             "platforms": {"x": 0.50, "reddit": 0.35, "youtube": 0.15},
             "momentum_pattern": "rising", "persistence": 8},
            {"text": "Climate change is a natural cyclical phenomenon and human contribution is overstated",
             "subject": "climate science", "assertion": "human-caused climate change is exaggerated",
             "framing": "scientific skepticism", "stance": "anti", "arousal": "low",
             "cluster": "denialism", "concept": "natural-cycles",
             "platforms": {"x": 0.45, "reddit": 0.10, "youtube": 0.45},
             "momentum_pattern": "declining", "persistence": 6},
            {"text": "Climate justice requires wealthy nations to fund adaptation in developing countries",
             "subject": "climate justice", "assertion": "wealthy nations owe climate debt to developing world",
             "framing": "global equity", "stance": "pro", "arousal": "medium",
             "cluster": "climate-justice", "concept": "climate-equity",
             "platforms": {"x": 0.30, "reddit": 0.40, "youtube": 0.30},
             "momentum_pattern": "goes_dark", "persistence": 7},
        ],
    },
    {
        "id": "ai-workplace",
        "name": "AI in the Workplace",
        "archetypes": [
            {"text": "AI will automate away millions of white-collar jobs within the next five years",
             "subject": "AI job displacement", "assertion": "mass white-collar job loss is imminent",
             "framing": "economic disruption", "stance": "anti", "arousal": "high",
             "cluster": "job-displacement", "concept": "mass-automation",
             "platforms": {"x": 0.55, "reddit": 0.25, "youtube": 0.20},
             "momentum_pattern": "spike", "persistence": 5},
            {"text": "AI is a productivity tool that augments human capabilities rather than replacing workers",
             "subject": "AI augmentation", "assertion": "AI enhances rather than replaces human work",
             "framing": "technology optimism", "stance": "pro", "arousal": "medium",
             "cluster": "ai-augmentation", "concept": "human-ai-collaboration",
             "platforms": {"x": 0.30, "reddit": 0.40, "youtube": 0.30},
             "momentum_pattern": "stable", "persistence": 12},
            {"text": "AI-generated content is destroying the value of creative work and undermining artists' livelihoods",
             "subject": "AI and creative work", "assertion": "generative AI threatens creative professionals",
             "framing": "creative destruction", "stance": "anti", "arousal": "high",
             "cluster": "creative-threat", "concept": "creative-displacement",
             "platforms": {"x": 0.50, "reddit": 0.30, "youtube": 0.20},
             "momentum_pattern": "rising", "persistence": 10},
            {"text": "Massive investment in retraining programs is needed to prepare workers for an AI-driven economy",
             "subject": "workforce retraining", "assertion": "retraining is essential for AI transition",
             "framing": "policy response", "stance": "neutral", "arousal": "low",
             "cluster": "retraining", "concept": "workforce-adaptation",
             "platforms": {"x": 0.20, "reddit": 0.50, "youtube": 0.30},
             "momentum_pattern": "rising", "persistence": 9},
            {"text": "Companies using AI are seeing measurable productivity gains that benefit both employers and employees",
             "subject": "AI productivity", "assertion": "AI demonstrably improves workplace productivity",
             "framing": "evidence-based", "stance": "pro", "arousal": "low",
             "cluster": "productivity-gains", "concept": "productivity-evidence",
             "platforms": {"x": 0.25, "reddit": 0.35, "youtube": 0.40},
             "momentum_pattern": "stable", "persistence": 11},
            {"text": "Fears about AI replacing jobs are the same Luddite arguments made about every technological revolution",
             "subject": "AI job fears", "assertion": "AI job fears repeat historical Luddite fallacy",
             "framing": "historical precedent", "stance": "pro", "arousal": "medium",
             "cluster": "luddite-fallacy", "concept": "historical-parallel",
             "platforms": {"x": 0.60, "reddit": 0.25, "youtube": 0.15},
             "momentum_pattern": "spike", "persistence": 4},
            {"text": "AI adoption without worker protections will accelerate income inequality to unsustainable levels",
             "subject": "AI inequality", "assertion": "unregulated AI adoption worsens inequality",
             "framing": "social justice", "stance": "anti", "arousal": "medium",
             "cluster": "job-displacement", "concept": "inequality-risk",
             "platforms": {"x": 0.40, "reddit": 0.45, "youtube": 0.15},
             "momentum_pattern": "declining", "persistence": 7},
            {"text": "The companies pushing AI hardest are quietly laying off the workers it was supposed to augment",
             "subject": "corporate AI adoption", "assertion": "augmentation rhetoric masks replacement reality",
             "framing": "corporate critique", "stance": "anti", "arousal": "high",
             "cluster": "creative-threat", "concept": "augmentation-myth",
             "platforms": {"x": 0.65, "reddit": 0.20, "youtube": 0.15},
             "momentum_pattern": "goes_dark", "persistence": 6},
        ],
    },
    {
        "id": "crypto-web3",
        "name": "Cryptocurrency & Web3",
        "archetypes": [
            {"text": "Cryptocurrency represents the future of finance and will eventually replace traditional banking systems",
             "subject": "crypto future", "assertion": "crypto will displace traditional finance",
             "framing": "financial revolution", "stance": "pro", "arousal": "medium",
             "cluster": "crypto-future", "concept": "crypto-adoption",
             "platforms": {"x": 0.50, "reddit": 0.35, "youtube": 0.15},
             "momentum_pattern": "stable", "persistence": 14},
            {"text": "The vast majority of crypto projects are scams designed to transfer wealth from retail investors to insiders",
             "subject": "crypto fraud", "assertion": "most crypto projects are scams",
             "framing": "consumer protection", "stance": "anti", "arousal": "high",
             "cluster": "crypto-scam", "concept": "fraud-exposure",
             "platforms": {"x": 0.55, "reddit": 0.30, "youtube": 0.15},
             "momentum_pattern": "spike", "persistence": 5},
            {"text": "DeFi protocols offer financial freedom to the unbanked and underserved populations globally",
             "subject": "DeFi access", "assertion": "DeFi democratizes financial access",
             "framing": "financial inclusion", "stance": "pro", "arousal": "medium",
             "cluster": "defi-freedom", "concept": "financial-inclusion",
             "platforms": {"x": 0.30, "reddit": 0.50, "youtube": 0.20},
             "momentum_pattern": "rising", "persistence": 10},
            {"text": "Crypto regulation is essential to protect consumers and maintain financial system stability",
             "subject": "crypto regulation", "assertion": "regulation needed for consumer protection",
             "framing": "regulatory necessity", "stance": "neutral", "arousal": "low",
             "cluster": "regulation-needed", "concept": "crypto-regulation",
             "platforms": {"x": 0.25, "reddit": 0.45, "youtube": 0.30},
             "momentum_pattern": "rising", "persistence": 9},
            {"text": "Proof-of-work mining is an environmental catastrophe that no amount of financial innovation justifies",
             "subject": "crypto energy", "assertion": "crypto mining causes unacceptable environmental harm",
             "framing": "environmental critique", "stance": "anti", "arousal": "medium",
             "cluster": "environmental-cost", "concept": "mining-impact",
             "platforms": {"x": 0.35, "reddit": 0.40, "youtube": 0.25},
             "momentum_pattern": "declining", "persistence": 8},
            {"text": "Bitcoin's recent price action confirms the beginning of a new bull cycle that will surpass previous highs",
             "subject": "bitcoin price", "assertion": "new crypto bull market is underway",
             "framing": "market analysis", "stance": "pro", "arousal": "high",
             "cluster": "speculation", "concept": "price-prediction",
             "platforms": {"x": 0.65, "reddit": 0.20, "youtube": 0.15},
             "momentum_pattern": "spike", "persistence": 3},
            {"text": "Web3 is nothing more than a rebranding of failed blockchain promises with venture capital marketing",
             "subject": "Web3 critique", "assertion": "Web3 is repackaged hype",
             "framing": "industry skepticism", "stance": "anti", "arousal": "low",
             "cluster": "crypto-scam", "concept": "web3-skepticism",
             "platforms": {"x": 0.40, "reddit": 0.50, "youtube": 0.10},
             "momentum_pattern": "goes_dark", "persistence": 6},
        ],
    },
    {
        "id": "social-media-youth",
        "name": "Social Media & Youth Mental Health",
        "archetypes": [
            {"text": "Social media platforms should be banned for children under 16 to protect their mental health",
             "subject": "social media bans", "assertion": "platforms should be banned for minors",
             "framing": "child protection", "stance": "pro", "arousal": "high",
             "cluster": "ban-platforms", "concept": "age-restriction",
             "platforms": {"x": 0.45, "reddit": 0.30, "youtube": 0.25},
             "momentum_pattern": "spike", "persistence": 6},
            {"text": "Parents bear primary responsibility for managing their children's screen time and online activity",
             "subject": "parental responsibility", "assertion": "parents not platforms are responsible",
             "framing": "personal responsibility", "stance": "anti", "arousal": "medium",
             "cluster": "parental-responsibility", "concept": "parent-role",
             "platforms": {"x": 0.50, "reddit": 0.30, "youtube": 0.20},
             "momentum_pattern": "stable", "persistence": 12},
            {"text": "Tech companies knowingly designed addictive algorithms that exploit developing adolescent brains",
             "subject": "platform design", "assertion": "platforms deliberately exploit youth psychology",
             "framing": "corporate accountability", "stance": "pro", "arousal": "high",
             "cluster": "platform-accountability", "concept": "algorithmic-harm",
             "platforms": {"x": 0.40, "reddit": 0.35, "youtube": 0.25},
             "momentum_pattern": "rising", "persistence": 10},
            {"text": "The research on social media and mental health is far more mixed than headlines suggest",
             "subject": "research evidence", "assertion": "evidence for social media harm is inconclusive",
             "framing": "scientific nuance", "stance": "neutral", "arousal": "low",
             "cluster": "research-mixed", "concept": "evidence-uncertainty",
             "platforms": {"x": 0.15, "reddit": 0.60, "youtube": 0.25},
             "momentum_pattern": "stable", "persistence": 11},
            {"text": "Age verification systems for social media are invasive and will create new privacy risks for all users",
             "subject": "age verification", "assertion": "age verification creates privacy risks",
             "framing": "privacy concern", "stance": "anti", "arousal": "medium",
             "cluster": "age-verification", "concept": "verification-privacy",
             "platforms": {"x": 0.35, "reddit": 0.50, "youtube": 0.15},
             "momentum_pattern": "rising", "persistence": 8},
            {"text": "Youth mental health was declining before social media and blaming platforms distracts from real causes",
             "subject": "mental health trends", "assertion": "social media is scapegoated for broader mental health crisis",
             "framing": "contextual analysis", "stance": "anti", "arousal": "low",
             "cluster": "parental-responsibility", "concept": "attribution-error",
             "platforms": {"x": 0.25, "reddit": 0.55, "youtube": 0.20},
             "momentum_pattern": "declining", "persistence": 7},
            {"text": "We are witnessing a generational mental health crisis directly caused by smartphone-based social media",
             "subject": "mental health crisis", "assertion": "smartphones caused a youth mental health epidemic",
             "framing": "public health emergency", "stance": "pro", "arousal": "high",
             "cluster": "mental-health-crisis", "concept": "crisis-framing",
             "platforms": {"x": 0.55, "reddit": 0.20, "youtube": 0.25},
             "momentum_pattern": "spike", "persistence": 4},
            {"text": "Digital literacy education is more effective than bans at protecting young people online",
             "subject": "digital literacy", "assertion": "education beats prohibition",
             "framing": "pragmatic solution", "stance": "neutral", "arousal": "low",
             "cluster": "research-mixed", "concept": "education-approach",
             "platforms": {"x": 0.20, "reddit": 0.45, "youtube": 0.35},
             "momentum_pattern": "goes_dark", "persistence": 5},
        ],
    },
    {
        "id": "creator-economy",
        "name": "Content Creator Economy",
        "archetypes": [
            {"text": "Platforms exploit creators by keeping the vast majority of ad revenue while creators do all the work",
             "subject": "platform revenue share", "assertion": "platforms unfairly capture creator value",
             "framing": "labor exploitation", "stance": "anti", "arousal": "high",
             "cluster": "platform-exploitation", "concept": "revenue-inequality",
             "platforms": {"x": 0.50, "reddit": 0.30, "youtube": 0.20},
             "momentum_pattern": "spike", "persistence": 5},
            {"text": "The creator economy has democratized media and given millions a viable path to independent income",
             "subject": "creator opportunity", "assertion": "creator economy enables independent income",
             "framing": "economic opportunity", "stance": "pro", "arousal": "medium",
             "cluster": "creator-opportunity", "concept": "democratized-media",
             "platforms": {"x": 0.30, "reddit": 0.25, "youtube": 0.45},
             "momentum_pattern": "stable", "persistence": 13},
            {"text": "Algorithm changes can destroy a creator's livelihood overnight with zero transparency or recourse",
             "subject": "algorithm power", "assertion": "algorithms have unchecked power over creator livelihoods",
             "framing": "platform tyranny", "stance": "anti", "arousal": "high",
             "cluster": "algorithm-tyranny", "concept": "algorithmic-control",
             "platforms": {"x": 0.55, "reddit": 0.30, "youtube": 0.15},
             "momentum_pattern": "rising", "persistence": 9},
            {"text": "Creator burnout is reaching epidemic levels as platforms demand constant content output",
             "subject": "creator burnout", "assertion": "content demands cause widespread burnout",
             "framing": "mental health", "stance": "anti", "arousal": "medium",
             "cluster": "burnout-epidemic", "concept": "creator-wellbeing",
             "platforms": {"x": 0.35, "reddit": 0.40, "youtube": 0.25},
             "momentum_pattern": "rising", "persistence": 8},
            {"text": "Anyone with talent and persistence can build a sustainable career as a content creator",
             "subject": "creator success", "assertion": "creator career is accessible to anyone with talent",
             "framing": "meritocracy", "stance": "pro", "arousal": "low",
             "cluster": "democratized-media", "concept": "creator-accessibility",
             "platforms": {"x": 0.25, "reddit": 0.30, "youtube": 0.45},
             "momentum_pattern": "stable", "persistence": 11},
            {"text": "Platform monetization policies are designed to maximize engagement metrics at the expense of content quality",
             "subject": "monetization incentives", "assertion": "monetization rewards engagement over quality",
             "framing": "systemic critique", "stance": "anti", "arousal": "medium",
             "cluster": "monetization-unfair", "concept": "perverse-incentives",
             "platforms": {"x": 0.40, "reddit": 0.45, "youtube": 0.15},
             "momentum_pattern": "declining", "persistence": 7},
            {"text": "The top 1% of creators capture nearly all the revenue while millions earn essentially nothing",
             "subject": "creator inequality", "assertion": "creator economy is extremely top-heavy",
             "framing": "income inequality", "stance": "neutral", "arousal": "low",
             "cluster": "platform-exploitation", "concept": "winner-take-all",
             "platforms": {"x": 0.35, "reddit": 0.50, "youtube": 0.15},
             "momentum_pattern": "spike", "persistence": 4},
            {"text": "Creators who diversify across platforms and own their audience are building real businesses",
             "subject": "creator strategy", "assertion": "platform diversification enables real business",
             "framing": "business advice", "stance": "pro", "arousal": "low",
             "cluster": "creator-opportunity", "concept": "creator-strategy",
             "platforms": {"x": 0.20, "reddit": 0.35, "youtube": 0.45},
             "momentum_pattern": "goes_dark", "persistence": 6},
        ],
    },
    {
        "id": "remote-work",
        "name": "Remote Work vs Return-to-Office",
        "archetypes": [
            {"text": "Remote work has proven that most office jobs never required physical presence in the first place",
             "subject": "remote work viability", "assertion": "office presence was always unnecessary for most jobs",
             "framing": "paradigm shift", "stance": "pro", "arousal": "medium",
             "cluster": "remote-forever", "concept": "remote-proven",
             "platforms": {"x": 0.45, "reddit": 0.40, "youtube": 0.15},
             "momentum_pattern": "stable", "persistence": 14},
            {"text": "Return-to-office mandates are about justifying commercial real estate investments, not productivity",
             "subject": "RTO motivation", "assertion": "RTO is about real estate not productivity",
             "framing": "corporate critique", "stance": "pro", "arousal": "high",
             "cluster": "remote-forever", "concept": "rto-real-estate",
             "platforms": {"x": 0.60, "reddit": 0.25, "youtube": 0.15},
             "momentum_pattern": "spike", "persistence": 5},
            {"text": "In-person collaboration is essential for innovation and companies requiring RTO will outperform",
             "subject": "in-person value", "assertion": "physical collaboration drives innovation advantage",
             "framing": "competitive advantage", "stance": "anti", "arousal": "medium",
             "cluster": "rto-mandate", "concept": "collaboration-value",
             "platforms": {"x": 0.35, "reddit": 0.30, "youtube": 0.35},
             "momentum_pattern": "rising", "persistence": 10},
            {"text": "Hybrid work with 2-3 office days is the pragmatic compromise that satisfies most employees and employers",
             "subject": "hybrid model", "assertion": "hybrid work balances flexibility and collaboration",
             "framing": "pragmatic compromise", "stance": "neutral", "arousal": "low",
             "cluster": "hybrid-compromise", "concept": "hybrid-model",
             "platforms": {"x": 0.25, "reddit": 0.50, "youtube": 0.25},
             "momentum_pattern": "stable", "persistence": 12},
            {"text": "Productivity data consistently shows remote workers are more productive than their in-office counterparts",
             "subject": "remote productivity", "assertion": "data proves remote workers are more productive",
             "framing": "evidence-based", "stance": "pro", "arousal": "low",
             "cluster": "productivity-debate", "concept": "remote-productivity",
             "platforms": {"x": 0.30, "reddit": 0.45, "youtube": 0.25},
             "momentum_pattern": "rising", "persistence": 9},
            {"text": "The commercial real estate market faces a structural collapse as remote work reduces demand for office space",
             "subject": "commercial real estate", "assertion": "remote work is collapsing office demand",
             "framing": "market disruption", "stance": "neutral", "arousal": "medium",
             "cluster": "commercial-real-estate", "concept": "office-market",
             "platforms": {"x": 0.40, "reddit": 0.35, "youtube": 0.25},
             "momentum_pattern": "declining", "persistence": 8},
            {"text": "Remote work is eroding company culture and creating a generation of isolated, disengaged workers",
             "subject": "remote culture", "assertion": "remote work damages culture and engagement",
             "framing": "organizational health", "stance": "anti", "arousal": "medium",
             "cluster": "culture-erosion", "concept": "culture-damage",
             "platforms": {"x": 0.40, "reddit": 0.30, "youtube": 0.30},
             "momentum_pattern": "spike", "persistence": 4},
            {"text": "Junior employees suffer most from remote work as they miss mentorship and informal learning opportunities",
             "subject": "junior development", "assertion": "remote work harms junior career development",
             "framing": "career impact", "stance": "anti", "arousal": "low",
             "cluster": "culture-erosion", "concept": "mentorship-gap",
             "platforms": {"x": 0.25, "reddit": 0.55, "youtube": 0.20},
             "momentum_pattern": "goes_dark", "persistence": 6},
        ],
    },
    {
        "id": "us-china-tech",
        "name": "US-China Tech Competition",
        "archetypes": [
            {"text": "The US must decouple from Chinese technology supply chains to protect national security",
             "subject": "tech decoupling", "assertion": "decoupling from China is a national security imperative",
             "framing": "national security", "stance": "pro", "arousal": "high",
             "cluster": "decouple-now", "concept": "supply-chain-security",
             "platforms": {"x": 0.50, "reddit": 0.25, "youtube": 0.25},
             "momentum_pattern": "rising", "persistence": 12},
            {"text": "Continued engagement with China's tech sector benefits both economies and reduces conflict risk",
             "subject": "tech engagement", "assertion": "engagement is better than decoupling",
             "framing": "economic interdependence", "stance": "anti", "arousal": "low",
             "cluster": "engagement-needed", "concept": "mutual-benefit",
             "platforms": {"x": 0.20, "reddit": 0.50, "youtube": 0.30},
             "momentum_pattern": "declining", "persistence": 9},
            {"text": "US chip export controls are successfully slowing China's AI advancement and should be expanded",
             "subject": "chip restrictions", "assertion": "export controls effectively limit China's AI progress",
             "framing": "strategic success", "stance": "pro", "arousal": "medium",
             "cluster": "chip-war", "concept": "export-controls",
             "platforms": {"x": 0.45, "reddit": 0.30, "youtube": 0.25},
             "momentum_pattern": "spike", "persistence": 5},
            {"text": "Banning TikTok is necessary to prevent Chinese surveillance and influence operations on American citizens",
             "subject": "TikTok ban", "assertion": "TikTok is a Chinese surveillance and influence tool",
             "framing": "security threat", "stance": "pro", "arousal": "high",
             "cluster": "tiktok-ban", "concept": "platform-security",
             "platforms": {"x": 0.55, "reddit": 0.20, "youtube": 0.25},
             "momentum_pattern": "spike", "persistence": 4},
            {"text": "Industrial policy and government investment in domestic chip manufacturing will determine tech leadership",
             "subject": "industrial policy", "assertion": "government investment is key to tech competitiveness",
             "framing": "strategic investment", "stance": "neutral", "arousal": "low",
             "cluster": "industrial-policy", "concept": "domestic-investment",
             "platforms": {"x": 0.25, "reddit": 0.45, "youtube": 0.30},
             "momentum_pattern": "stable", "persistence": 11},
            {"text": "We are in a technology cold war with China and treating it otherwise is dangerously naive",
             "subject": "tech cold war", "assertion": "US-China tech rivalry is a new cold war",
             "framing": "geopolitical framing", "stance": "pro", "arousal": "high",
             "cluster": "tech-cold-war", "concept": "cold-war-framing",
             "platforms": {"x": 0.60, "reddit": 0.15, "youtube": 0.25},
             "momentum_pattern": "rising", "persistence": 8},
            {"text": "Export controls are backfiring as China accelerates domestic chip development and finds alternative suppliers",
             "subject": "export control effectiveness", "assertion": "controls accelerate Chinese self-sufficiency",
             "framing": "policy critique", "stance": "anti", "arousal": "medium",
             "cluster": "engagement-needed", "concept": "backfire-effect",
             "platforms": {"x": 0.35, "reddit": 0.45, "youtube": 0.20},
             "momentum_pattern": "stable", "persistence": 10},
            {"text": "The TikTok ban sets a dangerous precedent for government control of internet platforms",
             "subject": "TikTok precedent", "assertion": "banning TikTok threatens internet freedom",
             "framing": "civil liberties", "stance": "anti", "arousal": "medium",
             "cluster": "tiktok-ban", "concept": "censorship-concern",
             "platforms": {"x": 0.45, "reddit": 0.40, "youtube": 0.15},
             "momentum_pattern": "goes_dark", "persistence": 5},
        ],
    },
]

# Adversarial pair definitions — hand-picked per topic for realistic demo data
ADVERSARIAL_PAIR_DEFS: dict[str, list[tuple[str, str]]] = {
    "ai-regulation": [
        ("pro-regulation", "anti-regulation"),
        ("open-source", "anti-open-source"),
    ],
    "immigration-policy": [
        ("pro-immigration-economic", "anti-immigration-economic"),
        ("humanitarian", "border-security"),
    ],
    "us-israel-iran": [
        ("us-involvement", "ceasefire-now"),
        ("israel-defense", "arms-sales"),
    ],
    "climate-policy": [
        ("rapid-transition", "climate-skeptic"),
    ],
    "ai-workplace": [
        ("job-displacement", "ai-augmentation"),
        ("creative-threat", "luddite-fallacy"),
    ],
    "crypto-web3": [
        ("crypto-future", "crypto-scam"),
        ("defi-freedom", "regulation-needed"),
    ],
    "social-media-youth": [
        ("ban-platforms", "parental-responsibility"),
        ("platform-accountability", "research-mixed"),
    ],
    "creator-economy": [
        ("platform-exploitation", "creator-opportunity"),
        ("algorithm-tyranny", "democratized-media"),
    ],
    "remote-work": [
        ("remote-forever", "rto-mandate"),
        ("productivity-debate", "culture-erosion"),
    ],
    "us-china-tech": [
        ("decouple-now", "engagement-needed"),
        ("tiktok-ban", "industrial-policy"),
    ],
}

# Time configuration
NOW = datetime(2026, 3, 16, 12, 0, 0, tzinfo=timezone.utc)
WINDOWS = {
    "6h": timedelta(hours=6),
    "24h": timedelta(hours=24),
    "7d": timedelta(days=7),
}
NUM_6H_WINDOWS = 28  # 7 days of 6h windows


def gen_id(prefix: str, *parts: str) -> str:
    """Generate deterministic ID from parts."""
    h = hashlib.sha256("|".join(parts).encode()).hexdigest()[:12]
    return f"{prefix}_{h}"


def gen_embedding(base_vector: np.ndarray, noise_scale: float = 0.1) -> list[float]:
    """Generate a noisy version of a base embedding vector."""
    noisy = base_vector + np.random.normal(0, noise_scale, size=base_vector.shape)
    noisy = noisy / np.linalg.norm(noisy)  # L2 normalize
    return noisy.tolist()


def generate_momentum_series(pattern: str, n_windows: int = NUM_6H_WINDOWS) -> list[float]:
    """Generate a momentum time series matching the pattern."""
    if pattern == "stable":
        base = 0.5 + np.random.uniform(-0.05, 0.05)
        return [max(0, min(1, base + np.random.normal(0, 0.03))) for _ in range(n_windows)]
    elif pattern == "rising":
        return [max(0, min(1, 0.2 + (0.6 * i / n_windows) + np.random.normal(0, 0.04)))
                for i in range(n_windows)]
    elif pattern == "declining":
        return [max(0, min(1, 0.8 - (0.6 * i / n_windows) + np.random.normal(0, 0.04)))
                for i in range(n_windows)]
    elif pattern == "spike":
        series = [max(0, min(1, 0.2 + np.random.normal(0, 0.03))) for _ in range(n_windows)]
        spike_start = n_windows - 6  # spike in last 36h
        for i in range(spike_start, min(spike_start + 4, n_windows)):
            series[i] = max(0, min(1, 0.7 + np.random.normal(0, 0.05)))
        # slight decay after spike
        for i in range(spike_start + 4, n_windows):
            series[i] = max(0, min(1, 0.55 + np.random.normal(0, 0.04)))
        return series
    elif pattern == "goes_dark":
        series = [max(0, min(1, 0.5 + np.random.normal(0, 0.04))) for _ in range(n_windows)]
        # Active then drops to near-zero in last 3 windows
        for i in range(n_windows - 3, n_windows):
            series[i] = max(0, 0.02 + np.random.normal(0, 0.01))
        return series
    else:
        return [random.uniform(0.1, 0.9) for _ in range(n_windows)]


def arousal_to_float(arousal: str) -> float:
    return {"high": 0.85, "medium": 0.5, "low": 0.15}[arousal]


def compute_friction_quadrant(momentum: float, friction: float) -> str:
    high_mom = momentum > 0.5
    high_fric = friction > 0.35
    if high_mom and not high_fric:
        return "unopposed_advance"
    elif high_mom and high_fric:
        return "contested_advance"
    elif not high_mom and high_fric:
        return "successful_suppression"
    else:
        return "dead"


def make_metric(value: float, window: str, sparkline: list[float],
                ci_width: float = 0.1, baseline: str = "global") -> dict[str, Any]:
    """Create a Metric object."""
    half = ci_width / 2
    return {
        "value": round(value, 4),
        "confidence_interval": [round(max(0, value - half), 4), round(min(1, value + half), 4)],
        "baseline": baseline,
        "time_window": window,
        "sparkline": [round(v, 4) for v in sparkline[-8:]],  # last 8 points
        "source_distribution": "production",
    }


def make_momentum_extended(value: float, window: str, sparkline: list[float],
                           archetype: dict) -> dict[str, Any]:
    """Create a MomentumExtended object."""
    friction = round(random.uniform(0.1, 0.8), 4)
    source_div = round(random.uniform(0.3, 0.95), 4)
    bridge = round(random.uniform(0.02, 0.25), 4)
    # Spikes have lower source diversity (concentrated)
    if archetype["momentum_pattern"] == "spike":
        source_div = round(random.uniform(0.15, 0.40), 4)
    m = make_metric(value, window, sparkline)
    m.update({
        "source_diversity": source_div,
        "bridge_ratio": bridge,
        "persistence_windows": archetype["persistence"],
        "friction": friction,
        "friction_quadrant": compute_friction_quadrant(value, friction),
    })
    return m


def generate_cluster_base_vectors(n_clusters: int, dim: int = 128) -> dict[str, np.ndarray]:
    """Generate well-separated base vectors for clusters."""
    vectors = {}
    for i in range(n_clusters):
        v = np.random.randn(dim)
        v = v / np.linalg.norm(v)
        vectors[f"cluster_{i}"] = v
    return vectors


def generate_2d_positions(
    clusters: list[dict],
    claims: list[dict],
    momentum_map: Optional[Dict[str, float]] = None,
) -> list[dict]:
    """Generate 2D positions for force layout. Cluster members near each other."""
    cluster_centers: dict[str, tuple[float, float]] = {}
    n_clusters = len(clusters)
    for i, c in enumerate(clusters):
        angle = 2 * np.pi * i / n_clusters
        radius = 200 + random.uniform(-30, 30)
        cluster_centers[c["id"]] = (
            300 + radius * np.cos(angle),
            250 + radius * np.sin(angle),
        )

    total_claims = len(claims)
    cluster_counts = {}
    for c in claims:
        cluster_counts[c["cluster_id"]] = cluster_counts.get(c["cluster_id"], 0) + 1

    positions = []
    for claim in claims:
        cx, cy = cluster_centers.get(claim["cluster_id"], (300, 250))
        base_momentum = momentum_map.get(claim["id"], 0.0) if momentum_map else 0.0
        noisy_momentum = round(max(-1.0, min(1.0, base_momentum + random.gauss(0, 0.08))), 3)
        
        expected_share = cluster_counts.get(claim["cluster_id"], 1) / max(1, total_claims)
        production_share = random.uniform(expected_share * 0.5, expected_share * 2.5)
        salience = round(production_share / expected_share, 3)
        
        positions.append({
            "claim_id": claim["id"],
            "x": round(cx + random.gauss(0, 35), 2),
            "y": round(cy + random.gauss(0, 35), 2),
            "momentum": noisy_momentum,
            "salience": salience,
        })
    return positions


def generate_adversarial_pairs(
    topic_id: str,
    cluster_objects: list[dict],
    archetypes: list[dict],
) -> list[dict]:
    """Generate adversarial pair data for a topic.

    Uses ADVERSARIAL_PAIR_DEFS to identify natural cluster oppositions,
    then generates momentum correlation, response lag, and mutation evidence.
    """
    pair_defs = ADVERSARIAL_PAIR_DEFS.get(topic_id, [])
    if not pair_defs:
        return []

    # Build lookup: cluster_name -> cluster object
    name_to_cluster: dict[str, dict] = {}
    for arch in archetypes:
        cid = gen_id("clu", topic_id, arch["cluster"])
        for co in cluster_objects:
            if co["id"] == cid:
                name_to_cluster[arch["cluster"]] = co
                break

    pairs = []
    for name_a, name_b in pair_defs:
        ca = name_to_cluster.get(name_a)
        cb = name_to_cluster.get(name_b)
        if not ca or not cb:
            continue

        # Momentum correlation: negative = inverse = adversarial
        correlation = round(random.uniform(-0.85, -0.35), 3)

        # Response lag — shorter for spike-pattern archetypes
        arch_a = next((a for a in archetypes if a["cluster"] == name_a), None)
        arch_b = next((a for a in archetypes if a["cluster"] == name_b), None)
        has_spike = (
            (arch_a and arch_a["momentum_pattern"] == "spike")
            or (arch_b and arch_b["momentum_pattern"] == "spike")
        )
        median_hours = random.randint(2, 12) if has_spike else random.randint(8, 48)

        if median_hours < 8:
            consistency = "high"
            interpretation = (
                "Consistent short response lag — suggests organized rapid response capability."
            )
        elif median_hours < 24:
            consistency = "medium"
            interpretation = (
                "Moderate response lag — pattern is ambiguous between organic and organized dynamics."
            )
        else:
            consistency = "low"
            interpretation = (
                "Variable long response lag — consistent with organic counter-mobilization."
            )

        # Mutation evidence — 40% chance of detection
        mutation_detected = random.random() < 0.4
        if mutation_detected:
            mutation_desc = random.choice([
                f"Cluster '{ca['label'][:40]}' adopted terminology from the counter-narrative after it gained momentum.",
                f"Framing shifted in '{ca['label'][:40]}' following emergence of counter-cluster response.",
                f"Centroid movement detected in '{cb['label'][:40]}' post-counter-emergence — possible strategic reframing.",
            ])
            mutation_conf = round(random.uniform(0.45, 0.80), 2)
        else:
            mutation_desc = "No framing shift detected in response to counter-narrative."
            mutation_conf = 0.0

        confidence = round(min(0.90, 0.55 + abs(correlation) * 0.4), 2)

        pairs.append({
            "cluster_id_a": ca["id"],
            "cluster_id_b": cb["id"],
            "label_a": ca["label"][:80],
            "label_b": cb["label"][:80],
            "momentum_correlation": correlation,
            "response_lag": {
                "median_hours": median_hours,
                "consistency": consistency,
                "interpretation": interpretation,
            },
            "mutation_evidence": {
                "detected": mutation_detected,
                "description": mutation_desc,
                "confidence": mutation_conf,
            },
            "confidence": confidence,
        })

    return pairs


def generate_events(topic_id: str, claims: list[dict], archetypes: list[dict]) -> list[dict]:
    """Generate timeline events from claim patterns."""
    events = []
    event_counter = 0

    for arch in archetypes:
        matching_claims = [c for c in claims if c["concept_id"] == arch["concept"]]
        if not matching_claims:
            continue
        representative = matching_claims[0]

        if arch["momentum_pattern"] == "spike":
            event_counter += 1
            events.append({
                "id": gen_id("evt", topic_id, str(event_counter)),
                "type": "momentum_spike",
                "timestamp": (NOW - timedelta(hours=random.randint(6, 36))).isoformat(),
                "claim_id": representative["id"],
                "slice_id": None,
                "severity": "high",
                "confidence": round(random.uniform(0.75, 0.95), 2),
                "summary": f"'{arch['text'][:60]}...' accelerated from 20th to 72nd percentile in 12h. Source diversity: {'low' if arch.get('momentum_pattern') == 'spike' else 'moderate'}.",
                "detail": {"percentile_from": 20, "percentile_to": 72, "hours": 12},
            })

        if arch["momentum_pattern"] == "goes_dark":
            event_counter += 1
            events.append({
                "id": gen_id("evt", topic_id, str(event_counter)),
                "type": "claim_dark",
                "timestamp": (NOW - timedelta(hours=random.randint(2, 12))).isoformat(),
                "claim_id": representative["id"],
                "slice_id": None,
                "severity": "medium",
                "confidence": round(random.uniform(0.65, 0.85), 2),
                "summary": f"'{arch['text'][:50]}...' went dark — active in last 3 windows, now zero production.",
                "detail": {"last_active_window": 3, "topic_volume_change": 0.05},
            })

        if arch["arousal"] == "high" and arch["momentum_pattern"] in ("spike", "rising"):
            event_counter += 1
            events.append({
                "id": gen_id("evt", topic_id, str(event_counter)),
                "type": "arousal_escalation",
                "timestamp": (NOW - timedelta(hours=random.randint(12, 72))).isoformat(),
                "claim_id": representative["id"],
                "slice_id": None,
                "severity": "medium",
                "confidence": round(random.uniform(0.70, 0.90), 2),
                "summary": f"'{arch['subject']}' arousal shifted low to high over 48h, semantic content stable.",
                "detail": {"arousal_from": "low", "arousal_to": "high", "hours": 48},
            })

    # Add vocabulary_rotation
    mutating_archs = [a for a in archetypes if a.get("mutation_direction", "stable") != "stable"]
    m_arch = mutating_archs[0] if mutating_archs else archetypes[0]
    matching_c = [c for c in claims if c["concept_id"] == m_arch["concept"]]
    if matching_c:
        event_counter += 1
        events.append({
            "id": gen_id("evt", topic_id, str(event_counter)),
            "type": "vocabulary_rotation",
            "timestamp": (NOW - timedelta(hours=random.randint(12, 60))).isoformat(),
            "claim_id": matching_c[0]["id"],
            "slice_id": None,
            "severity": "medium",
            "confidence": round(random.uniform(0.65, 0.85), 2),
            "summary": f"Vocabulary rotation detected in '{m_arch['subject'][:30]}': emerging terminology overlaps with adjacent narratives.",
            "detail": {"rotation_shift": 0.42, "hours": 24},
        })

    # Add a divergence shift event
    event_counter += 1
    events.append({
        "id": gen_id("evt", topic_id, str(event_counter)),
        "type": "divergence_shift",
        "timestamp": (NOW - timedelta(hours=random.randint(24, 96))).isoformat(),
        "claim_id": None,
        "slice_id": "x_platform",
        "severity": "medium",
        "confidence": round(random.uniform(0.70, 0.85), 2),
        "summary": f"X vs Reddit divergence increased 23% over 48h. Mode: information asymmetry.",
        "detail": {"jsd_change": 0.23, "hours": 48, "mode": "information_asymmetry"},
    })

    # Add a coordination flag for topics with spikes
    spike_archs = [a for a in archetypes if a["momentum_pattern"] == "spike"]
    if spike_archs:
        arch = spike_archs[0]
        matching = [c for c in claims if c["concept_id"] == arch["concept"]]
        if matching:
            event_counter += 1
            events.append({
                "id": gen_id("evt", topic_id, str(event_counter)),
                "type": "coordination_flag",
                "timestamp": (NOW - timedelta(hours=random.randint(6, 48))).isoformat(),
                "claim_id": matching[0]["id"],
                "slice_id": None,
                "severity": "high" if arch["arousal"] == "high" else "medium",
                "confidence": round(random.uniform(0.60, 0.80), 2),
                "summary": f"Near-duplicate content: 47 similar posts from non-overlapping accounts within 3h.",
                "detail": {"signal": "near_duplicate", "count": 47, "window_hours": 3},
            })

    # Add a lead-lag event
    event_counter += 1
    events.append({
        "id": gen_id("evt", topic_id, str(event_counter)),
        "type": "lead_lag",
        "timestamp": (NOW - timedelta(hours=random.randint(48, 120))).isoformat(),
        "claim_id": claims[0]["id"] if claims else None,
        "slice_id": None,
        "severity": "low",
        "confidence": round(random.uniform(0.55, 0.75), 2),
        "summary": f"'{claims[0]['text'][:40]}...' first detected on Reddit, appeared on X 22h later. Fidelity: 81%.",
        "detail": {"source_platform": "reddit", "target_platform": "x", "lag_hours": 22, "fidelity": 0.81},
    })

    # Add adversarial response lag events (uses existing coordination_flag type)
    adv_defs = ADVERSARIAL_PAIR_DEFS.get(topic_id, [])
    for name_a, name_b in adv_defs[:1]:  # 1 adversarial event per topic
        arch_a = next((a for a in archetypes if a["cluster"] == name_a), None)
        arch_b = next((a for a in archetypes if a["cluster"] == name_b), None)
        if arch_a and arch_b:
            lag_h = random.randint(3, 18)
            event_counter += 1
            events.append({
                "id": gen_id("evt", topic_id, str(event_counter)),
                "type": "coordination_flag",
                "timestamp": (NOW - timedelta(hours=random.randint(12, 60))).isoformat(),
                "claim_id": None,
                "slice_id": None,
                "severity": "medium" if lag_h < 8 else "low",
                "confidence": round(random.uniform(0.55, 0.80), 2),
                "summary": (
                    f"Counter-narrative response lag of {lag_h}h between "
                    f"'{arch_a['subject'][:30]}' and '{arch_b['subject'][:30]}' clusters"
                    f" — {'consistent with organized rapid response' if lag_h < 8 else 'consistent with organic counter-mobilization'}."
                ),
                "detail": {
                    "signal": "adversarial_response_lag",
                    "cluster_a": name_a,
                    "cluster_b": name_b,
                    "lag_hours": lag_h,
                },
            })

    # Sort by severity (high first) then timestamp (recent first)
    severity_order = {"high": 0, "medium": 1, "low": 2}
    events.sort(key=lambda e: (severity_order[e["severity"]], e["timestamp"]))
    events.reverse()
    events.sort(key=lambda e: severity_order[e["severity"]])

    return events


def generate_supply_chain(claim: dict, topic_id: str) -> dict:
    """Generate a supply chain for a claim."""
    platforms = ["reddit", "x", "youtube"]
    first_platform = claim.get("first_seen_platform", random.choice(platforms))
    other_platforms = [p for p in platforms if p != first_platform]

    hops = [{
        "platform": first_platform,
        "timestamp": claim["first_seen_timestamp"],
        "claim_id": claim["id"],
        "fidelity_to_origin": 1.0,
        "fidelity_to_previous": 1.0,
    }]

    if random.random() > 0.3:  # 70% chance of cross-platform hop
        second = random.choice(other_platforms)
        lag_hours = random.randint(8, 48)
        first_ts = datetime.fromisoformat(claim["first_seen_timestamp"])
        hops.append({
            "platform": second,
            "timestamp": (first_ts + timedelta(hours=lag_hours)).isoformat(),
            "claim_id": gen_id("clm", topic_id, second, claim["text"][:20]),
            "fidelity_to_origin": round(random.uniform(0.60, 0.92), 2),
            "fidelity_to_previous": round(random.uniform(0.65, 0.95), 2),
        })

    return {
        "concept_id": claim.get("concept_id", "unknown"),
        "hops": hops,
        "observation_boundary": "No public antecedent detected",
    }


def generate_coordination_check() -> dict:
    """Generate coordination signal scores."""
    def signal(elevated: bool = False) -> dict:
        if elevated:
            score = round(random.uniform(0.5, 0.9), 2)
            baseline = round(random.uniform(0.1, 0.3), 2)
            return {"score": score, "organic_baseline": baseline, "severity": "high" if score > 0.7 else "medium"}
        else:
            score = round(random.uniform(0.05, 0.3), 2)
            baseline = round(random.uniform(0.1, 0.4), 2)
            return {"score": score, "organic_baseline": baseline, "severity": "low"}

    elevated = random.random() > 0.6
    return {
        "burstiness": signal(elevated and random.random() > 0.5),
        "near_duplicate": signal(elevated),
        "cross_platform_sync": signal(random.random() > 0.7),
        "source_diversity_anomaly": signal(elevated and random.random() > 0.5),
    }


def generate_example_content(archetype: dict, platform: str) -> list[dict]:
    """Generate 3-5 example posts for a claim."""
    examples = []
    variations = [
        archetype["text"],
        f"Honestly, {archetype['text'].lower()}",
        f"People need to understand: {archetype['text'].lower()}",
        f"This is obvious — {archetype['assertion']}",
        f"Can't believe we're still debating this. {archetype['text']}",
    ]
    for i in range(random.randint(3, 5)):
        examples.append({
            "text": variations[i % len(variations)],
            "platform": platform,
            "confidence": round(random.uniform(0.7, 0.98), 2),
            "is_influencer_framing": platform == "youtube",
        })
    return examples


def generate_compare_data(topic_id: str, clusters: list[dict],
                          slice_a_id: str, slice_b_id: str,
                          window: str) -> dict:
    """Generate comparison data between two slices."""
    # Simulate different distributions per slice
    per_cluster = []
    for c in clusters:
        sal_a = round(random.uniform(0.05, 0.95), 4)
        sal_b = round(random.uniform(0.05, 0.95), 4)
        per_cluster.append({
            "cluster_id": c["id"],
            "label": c["label"],
            "salience_a": sal_a,
            "salience_b": sal_b,
            "arousal_a": round(random.uniform(0.1, 0.9), 2),
            "arousal_b": round(random.uniform(0.1, 0.9), 2),
            "mutation_a": random.choice(["mainstreaming", "radicalizing", "stable"]),
            "mutation_b": random.choice(["mainstreaming", "radicalizing", "stable"]),
        })

    # Compute JSD from salience distributions
    eps = 1e-10
    p = np.array([pc["salience_a"] for pc in per_cluster]) + eps
    q = np.array([pc["salience_b"] for pc in per_cluster]) + eps
    p = p / p.sum()
    q = q / q.sum()
    m = 0.5 * (p + q)
    jsd = float(0.5 * np.sum(p * np.log(p / m)) + 0.5 * np.sum(q * np.log(q / m)))
    jsd_sqrt = float(np.sqrt(max(0, jsd)))

    # Typology scores
    info_asym = round(random.uniform(0.3, 0.8), 2)
    interpretive = round(random.uniform(0.1, 0.5), 2)
    paradigmatic = round(max(0, 1.0 - info_asym - interpretive), 2)
    scores = {"information_asymmetry": info_asym, "interpretive": interpretive, "paradigmatic": paradigmatic}
    dominant = max(scores, key=scores.get)  # type: ignore[arg-type]

    trend = [round(jsd_sqrt + random.gauss(0, 0.03), 4) for _ in range(8)]

    return {
        "slice_a": {
            "id": slice_a_id, "type": "platform",
            "label": slice_a_id.replace("_", " ").title(),
            "active_volume": random.randint(500, 5000),
            "meets_minimum_threshold": True,
            "base_rate_weight": round(random.uniform(0.3, 0.7), 2),
            "is_influencer_framing": "youtube" in slice_a_id,
        },
        "slice_b": {
            "id": slice_b_id, "type": "platform",
            "label": "Influencer Framing (YouTube)" if "youtube" in slice_b_id
                     else slice_b_id.replace("_", " ").title(),
            "active_volume": random.randint(500, 5000),
            "meets_minimum_threshold": True,
            "base_rate_weight": round(random.uniform(0.3, 0.7), 2),
            "is_influencer_framing": "youtube" in slice_b_id,
        },
        "divergence": {
            "jsd": round(jsd, 4),
            "jsd_sqrt": round(jsd_sqrt, 4),
            "trend": trend,
            "typology": {
                "information_asymmetry": info_asym,
                "interpretive": interpretive,
                "paradigmatic": paradigmatic,
                "dominant_mode": dominant.replace("_", " ").title(),
                "paradigmatic_caveat": paradigmatic > 0.3,
            },
        },
        "per_cluster": per_cluster,
        "arousal_comparison": {
            "slice_a_avg": round(random.uniform(0.3, 0.7), 2),
            "slice_b_avg": round(random.uniform(0.3, 0.7), 2),
        },
        "exposure_comparison": {
            "slice_a": make_metric(random.uniform(0.3, 0.8), window, trend),
            "slice_b": make_metric(random.uniform(0.3, 0.8), window, trend),
        },
    }




def _platform_presence(claim_id: str, first_seen_platform: str) -> dict:
    """Generate platform presence distribution for a claim.
    Distributional share: what fraction of this claim's volume comes from each platform."""
    PLATFORM_SLUG = {"x": "x_platform", "reddit": "reddit_platform", "youtube": "youtube_influencer"}
    rng = random.Random(hash(claim_id + "platform_presence"))
    slug = PLATFORM_SLUG.get(first_seen_platform, first_seen_platform)
    out_platforms = ["x_platform", "reddit_platform", "youtube_influencer"]
    weights = {}
    for p in out_platforms:
        weights[p] = rng.uniform(0.4, 0.85) if p == slug else rng.uniform(0.02, 0.4)
    total = sum(weights.values())
    return {k: round(v / total, 2) for k, v in weights.items()}


# ---------------------------------------------------------------------------
# IFI helper functions — temporal √JSD + Entropic Flux Direction
# ---------------------------------------------------------------------------

def _ifi_normalize(v: list) -> list:
    total = sum(v) + 1e-12
    return [x / total for x in v]

def _ifi_entropy_bits(p: list) -> float:
    """Shannon entropy in bits: H(p) = −Σ pᵢ log₂(pᵢ)"""
    import math
    p = _ifi_normalize(p)
    return -sum(x * math.log2(x + 1e-12) for x in p if x > 0)

def _ifi_jsd_sqrt(p: list, q: list) -> float:
    """√JSD between two distributions. Bounded [0,1], true metric."""
    import math
    p, q = _ifi_normalize(p), _ifi_normalize(q)
    m = [(pi + qi) / 2 for pi, qi in zip(p, q)]
    def kl(a: list, b: list) -> float:
        return sum(ai * math.log2(ai / (bi + 1e-12) + 1e-12) for ai, bi in zip(a, b) if ai > 0)
    jsd = max(0.0, 0.5 * kl(p, m) + 0.5 * kl(q, m))
    return math.sqrt(jsd)

def _ifi_flux_character(delta_h: float, threshold: float = 0.05) -> str:
    if delta_h > threshold:
        return "diversifying"
    elif delta_h < -threshold:
        return "consolidating"
    return "reshuffling"

def _ifi_window_salience(clusters: list, window: str) -> list:
    """
    Build a cluster salience vector for the given time window.
    Applies deterministic per-window perturbation that reflects realistic dynamics:
      6h  — amplifies volatile clusters (radicalizing / fragmenting)
      24h — baseline proportional to member_count (no perturbation)
      7d  — amplifies stable clusters; shrinks fragmenting
    Uses a seeded RNG so results are reproducible across calls.
    """
    base = [float(c.get("member_count", 1)) for c in clusters]
    # Seed from window name + cluster IDs so results are deterministic but topic-specific
    rng = random.Random(hash(window + "".join(c["id"] for c in clusters)))
    if window == "6h":
        for i, c in enumerate(clusters):
            if c.get("mutation_direction") in ("radicalizing", "fragmenting"):
                base[i] *= rng.uniform(1.3, 1.9)
            elif c.get("mutation_direction") == "stable":
                base[i] *= rng.uniform(0.4, 0.7)
    elif window == "7d":
        for i, c in enumerate(clusters):
            if c.get("mutation_direction") == "stable":
                base[i] *= rng.uniform(1.4, 1.8)
            elif c.get("mutation_direction") == "fragmenting":
                base[i] *= rng.uniform(0.2, 0.5)
    # 24h — no perturbation, pure member_count baseline
    return _ifi_normalize(base)


def generate_ifi(clusters: list, window: str, coord_count: int = 0, arousal_escalating: bool = False) -> dict:
    """
    Compute IFI using temporal √JSD + ΔEntropy (Entropic Flux Direction).

    Value (0–100): √JSD(p_current, p_previous) × 100
      — magnitude of structural change in cluster-salience distribution
    flux_character: consolidating | diversifying | reshuffling
      — derived from ΔEntropy = H(p_current) − H(p_previous), zero free parameters
    flags: qualitative annotations, NOT weighted into the numeric value
    """
    window_order = ["6h", "24h", "7d"]
    idx = window_order.index(window)
    prev_window = window_order[max(0, idx - 1)]

    p = _ifi_window_salience(clusters, window)
    # For 6h (first window), compare against 7d as the "long-run baseline"
    q = _ifi_window_salience(clusters, prev_window if window != prev_window else "7d")

    jsd_sqrt_val = _ifi_jsd_sqrt(p, q)
    delta_h = _ifi_entropy_bits(p) - _ifi_entropy_bits(q)
    character = _ifi_flux_character(delta_h)

    value_100 = round(jsd_sqrt_val * 100, 1)

    # Trend: diversifying + high flux = increasing; consolidating + high flux = decreasing
    if character == "diversifying" and jsd_sqrt_val > 0.25:
        trend = "increasing"
    elif character == "consolidating" and jsd_sqrt_val > 0.25:
        trend = "decreasing"
    else:
        trend = "stable"

    # Sparkline: 12 historical readings seeded around current value
    rng = random.Random(hash(window + str(value_100) + "sparkline"))
    sparkline = [round(max(0.0, min(100.0, value_100 + rng.uniform(-12, 12))), 1) for _ in range(12)]

    # Confidence interval: Fisher approximation ±50/√n, clamped [2, 8]
    n = sum(c.get("member_count", 1) for c in clusters)
    ci_width = max(2.0, min(8.0, 50.0 / (n ** 0.5 + 1)))

    return {
        "value": value_100,
        "trend": trend,
        "sparkline": sparkline,
        "entropy_delta": round(delta_h, 4),
        "flux_character": character,
        "flags": {
            "coordination_detected": coord_count >= 3,
            "arousal_escalating": arousal_escalating,
        },
        "temporal_window_pair": [prev_window if window != prev_window else "7d", window],
        "confidence_interval": [
            max(0.0, round(value_100 - ci_width, 1)),
            min(100.0, round(value_100 + ci_width, 1)),
        ],
    }

def generate_situations(clusters: list[dict], archetypes: list[dict], events: list[dict]) -> list[dict]:
    import random
    situations = []
    concept_to_arch = {a["concept"]: a for a in archetypes}
    for c in clusters:
        arch = concept_to_arch.get(c["concept_id"])
        if not arch: continue
        momentum = random.uniform(0.1, 0.9)
        friction = round(random.uniform(0.1, 0.9), 2)
        source_div = round(random.uniform(0.1, 0.9), 2)
        if momentum > 0.5 and c["arousal_trend"] == "warming" and friction > 0.6:
            situations.append({
                "id": gen_id("sit", c["id"], "esc"),
                "severity": "high",
                "summary": f"'{c['label'][:30]}...' escalating — gaining speed, emotionally charged, actively fought over",
                "cluster_id": c["id"],
                "metric_basis": "momentum > 0.5 AND arousal = warming AND friction > 0.6"
            })
        elif c["mutation_direction"] == "mainstreaming" and arch["persistence"] > 10:
            situations.append({
                "id": gen_id("sit", c["id"], "main"),
                "severity": "medium",
                "summary": f"'{c['label'][:30]}...' mainstreaming — deeply embedded",
                "cluster_id": c["id"],
                "metric_basis": "mutation = mainstreaming AND persistence > 10"
            })
        elif friction > 0.8:
            situations.append({
                "id": gen_id("sit", c["id"], "pol"),
                "severity": "high",
                "summary": f"'{c['label'][:30]}...' polarizing — high friction ({friction})",
                "cluster_id": c["id"],
                "metric_basis": "friction > 0.8"
            })
        elif momentum > 0.5 and source_div < 0.3:
            situations.append({
                "id": gen_id("sit", c["id"], "acc"),
                "severity": "medium",
                "summary": f"'{c['label'][:30]}...' accelerating with low source diversity",
                "cluster_id": c["id"],
                "metric_basis": "momentum > 0.5 AND source_diversity < 0.3"
            })
        elif c["mutation_direction"] == "radicalizing":
            situations.append({
                "id": gen_id("sit", c["id"], "rad"),
                "severity": "high",
                "summary": f"'{c['label'][:30]}...' radicalizing — moving toward extreme framing",
                "cluster_id": c["id"],
                "metric_basis": "mutation = radicalizing"
            })
        elif momentum > 0.35:
            situations.append({
                "id": gen_id("sit", c["id"], "mon"),
                "severity": "low",
                "summary": f"'{c['label'][:30]}...' under active monitoring — rising signals detected",
                "cluster_id": c["id"],
                "metric_basis": "momentum > 0.35"
            })
    severity_order = {"high": 0, "medium": 1, "low": 2}
    situations.sort(key=lambda x: severity_order[x["severity"]])
    for e in events:
        if e["type"] == "claim_dark":
            situations.append({
                "id": gen_id("sit", "dark"),
                "severity": "medium",
                "summary": f"A claim went dark — previously active, now zero production",
                "cluster_id": clusters[0]["id"] if clusters else "",
                "metric_basis": "claim_dark event detected"
            })
    situations.sort(key=lambda x: severity_order[x["severity"]])
    return situations[:5]

def generate_topic(topic_def: dict) -> None:
    """Generate all data files for a single topic."""
    topic_id = topic_def["id"]
    archetypes = topic_def["archetypes"]

    print(f"  Generating topic: {topic_def['name']} ({topic_id})")

    # Create directories
    claims_dir = DATA_DIR / "claims" / topic_id
    metrics_dir = DATA_DIR / "metrics" / topic_id
    claims_detail_dir = metrics_dir / "claims"
    compare_dir = metrics_dir / "compare"
    for d in [claims_dir, metrics_dir, claims_detail_dir, compare_dir]:
        d.mkdir(parents=True, exist_ok=True)

    # Generate base vectors per cluster
    cluster_names = list(set(a["cluster"] for a in archetypes))
    n_clusters = len(cluster_names)
    base_vectors = generate_cluster_base_vectors(n_clusters, dim=128)
    cluster_vector_map = {name: base_vectors[f"cluster_{i}"] for i, name in enumerate(cluster_names)}

    # Generate claims from archetypes
    claims = []
    for arch in archetypes:
        n_instances = random.randint(15, 45)
        base_vec = cluster_vector_map[arch["cluster"]]

        for j in range(n_instances):
            platform = random.choices(
                ["x", "reddit", "youtube"],
                weights=[arch["platforms"]["x"], arch["platforms"]["reddit"], arch["platforms"]["youtube"]],
                k=1,
            )[0]

            days_ago = random.uniform(0, 7)
            timestamp = (NOW - timedelta(days=days_ago)).isoformat()

            claim_id = gen_id("clm", topic_id, arch["cluster"], str(j))
            claims.append({
                "id": claim_id,
                "text": arch["text"],
                "subject": arch["subject"],
                "assertion": arch["assertion"],
                "framing": arch["framing"],
                "stance": arch["stance"],
                "confidence": round(random.uniform(0.6, 0.98), 2),
                "arousal": arch["arousal"],
                "register": random.choice(["vernacular", "journalistic", "academic", "meme", "formal"]),
                "cluster_id": gen_id("clu", topic_id, arch["cluster"]),
                "concept_id": arch["concept"],
                "first_seen_platform": platform,
                "first_seen_timestamp": timestamp,
                "platform_presence": _platform_presence(claim_id, platform),
                "embedding": gen_embedding(base_vec, noise_scale=0.12),
                # Extra fields for metrics computation
                "_archetype_cluster": arch["cluster"],
                "_momentum_pattern": arch["momentum_pattern"],
                "_persistence": arch["persistence"],
                "_platform": platform,
            })

    # Build cluster objects
    cluster_objects = []
    for cluster_name in cluster_names:
        cluster_claims = [c for c in claims if c["_archetype_cluster"] == cluster_name]
        arch = next(a for a in archetypes if a["cluster"] == cluster_name)
        cluster_id = gen_id("clu", topic_id, cluster_name)

        arousal_val = np.mean([arousal_to_float(c["arousal"]) for c in cluster_claims])
        mutation_dir = random.choice(["mainstreaming", "radicalizing", "fragmenting", "stable"])

        cluster_objects.append({
            "id": cluster_id,
            "concept_id": arch["concept"],
            "label": arch["text"][:80],
            "member_count": len(cluster_claims),
            "mutation_direction": mutation_dir,
            "mutation_magnitude": round(random.uniform(0.1, 0.7), 2),
            "arousal_trend": random.choice(["warming", "cooling", "stable"]),
            "arousal_value": round(float(arousal_val), 2),
            "adversarial_pairs": [],
        })

    # Generate adversarial pairs and populate cluster fields
    adv_pairs = generate_adversarial_pairs(topic_id, cluster_objects, archetypes)
    for pair in adv_pairs:
        for co in cluster_objects:
            if co["id"] == pair["cluster_id_a"] and pair["cluster_id_b"] not in co["adversarial_pairs"]:
                co["adversarial_pairs"].append(pair["cluster_id_b"])
            if co["id"] == pair["cluster_id_b"] and pair["cluster_id_a"] not in co["adversarial_pairs"]:
                co["adversarial_pairs"].append(pair["cluster_id_a"])

    # Save extracted claims (without embedding for frontend, with for pipeline)
    frontend_claims = [{k: v for k, v in c.items()
                        if not k.startswith("_") and k != "embedding"}
                       for c in claims]
    with open(claims_dir / "extracted.json", "w") as f:
        json.dump(frontend_claims, f, indent=2)

    with open(claims_dir / "clusters.json", "w") as f:
        json.dump(cluster_objects, f, indent=2)

    # Build momentum lookup from full claims (before _-field stripping)
    _momentum_map = {
        c["id"]: MOMENTUM_PATTERN_VALUES.get(c.get("_momentum_pattern", "stable"), 0.0)
        for c in claims
    }

    # Generate landscape data per time window
    events = generate_events(topic_id, frontend_claims, archetypes)
    for window in ["6h", "24h", "7d"]:
        positions = generate_2d_positions(cluster_objects, frontend_claims, momentum_map=_momentum_map)

        # Find top metrics from archetypes
        spike_archs = [a for a in archetypes if a["momentum_pattern"] == "spike"]
        persistent_archs = sorted(archetypes, key=lambda a: a["persistence"], reverse=True)
        high_friction_claims = [c for c in claims if random.random() > 0.5]

        top_acc_arch = spike_archs[0] if spike_archs else archetypes[0]
        top_acc_claim = next((c for c in claims if c["concept_id"] == top_acc_arch["concept"]), claims[0])
        top_acc_momentum = generate_momentum_series(top_acc_arch["momentum_pattern"])

        top_pers_arch = persistent_archs[0]
        top_pers_claim = next((c for c in claims if c["concept_id"] == top_pers_arch["concept"]), claims[0])

        top_fric_claim = high_friction_claims[0] if high_friction_claims else claims[0]

        high_arousal_concepts = [a for a in archetypes if a["arousal"] == "high"]
        top_arousal = high_arousal_concepts[0] if high_arousal_concepts else archetypes[0]

        mutation_archs = [a for a in archetypes if a["momentum_pattern"] in ("rising", "spike")]
        notable_mut = mutation_archs[0] if mutation_archs else None

        landscape = {
            "claims": frontend_claims,
            "clusters": cluster_objects,
            "positions": positions,
            "adversarial_pairs": adv_pairs,
            "topic_metrics": {
                "cluster_count": n_clusters,
                "contestation_level": "high" if n_clusters >= 6 else "medium" if n_clusters >= 4 else "low",
                "top_accelerating": {
                    "claim_id": top_acc_claim["id"],
                    "momentum": make_momentum_extended(
                        top_acc_momentum[-1], window, top_acc_momentum, top_acc_arch,
                    ),
                },
                "most_persistent": {
                    "claim_id": top_pers_claim["id"],
                    "persistence_windows": top_pers_arch["persistence"],
                },
                "top_friction": {
                    "claim_id": top_fric_claim["id"],
                    "friction": round(random.uniform(0.55, 0.85), 4),
                },
                "highest_arousal": {
                    "concept_id": top_arousal["concept"],
                    "arousal_trend": "warming" if top_arousal["momentum_pattern"] in ("spike", "rising") else "stable",
                },
                "notable_mutation": {
                    "concept_id": notable_mut["concept"],
                    "direction": "mainstreaming",
                } if notable_mut else None,
                "ifi": generate_ifi(
                    clusters=cluster_objects,
                    window=window,
                    coord_count=random.randint(2, 10),
                    arousal_escalating=(top_arousal["momentum_pattern"] in ("spike", "rising")),
                ),
                "situations": generate_situations(cluster_objects, archetypes, events)
            },
        }

        with open(metrics_dir / f"landscape_{window}.json", "w") as f:
            json.dump(landscape, f, indent=2)

    # Generate claim detail files for top claims (one per archetype)
    for arch in archetypes:
        matching = [c for c in claims if c["concept_id"] == arch["concept"]]
        if not matching:
            continue
        for claim in matching[:4]:
            momentum_series = generate_momentum_series(arch["momentum_pattern"])
            current_momentum = momentum_series[-1]

            detail = {
                "claim": {k: v for k, v in claim.items() if not k.startswith("_") and k != "embedding"},
                "momentum": make_momentum_extended(current_momentum, "24h", momentum_series, arch),
                "salience": make_metric(round(random.uniform(0.3, 0.9), 4), "24h", momentum_series, ci_width=0.15),
                "friction": make_metric(round(random.uniform(0.1, 0.8), 4), "24h",
                                        [round(random.uniform(0.1, 0.8), 2) for _ in range(8)]),
                "persistence": make_metric(arch["persistence"] / NUM_6H_WINDOWS, "24h",
                                           [round(i / NUM_6H_WINDOWS, 2) for i in range(8)]),
                "arousal": make_metric(arousal_to_float(arch["arousal"]), "24h",
                                       [round(arousal_to_float(arch["arousal"]) + random.gauss(0, 0.05), 2) for _ in range(8)]),
                "expressibility": make_metric(round(random.uniform(0.15, 0.65), 4), "24h",
                                              [round(random.uniform(0.15, 0.65), 2) for _ in range(8)]),
                "exposure": {
                    "production": make_metric(round(random.uniform(0.2, 0.6), 4), "24h", momentum_series),
                    "amplification": make_metric(round(random.uniform(0.3, 0.8), 4), "24h", momentum_series),
                    "estimated_exposure": make_metric(round(random.uniform(0.4, 0.95), 4), "24h", momentum_series,
                                                       ci_width=0.25),
                },
                "confidence_detail": {
                    "score": claim["confidence"],
                    "factors": random.sample([
                        "sarcasm detected", "quote-tweet ambiguity", "short content",
                        "cross-register variation", "meme reference", "clear direct assertion",
                    ], k=random.randint(1, 3)),
                },
                "provenance": {
                    "first_platform": claim["first_seen_platform"],
                    "first_timestamp": claim["first_seen_timestamp"],
                    "lead_lag": [
                        {"platform": p, "lag_hours": random.randint(4, 48)}
                        for p in ["x", "reddit", "youtube"]
                        if p != claim["first_seen_platform"] and random.random() > 0.4
                    ],
                },
                "supply_chain": generate_supply_chain(claim, topic_id),
                "coordination": generate_coordination_check(),
                "semantic_neighbors": [
                    {"claim_id": c["id"], "similarity": round(random.uniform(0.50, 0.82), 2)}
                    for c in random.sample(
                        [c for c in frontend_claims if c["concept_id"] != arch["concept"]],
                        min(3, len([c for c in frontend_claims if c["concept_id"] != arch["concept"]])),
                    )
                ],
                "adversarial_pairs": [
                    p for p in adv_pairs
                    if claim["cluster_id"] in (p["cluster_id_a"], p["cluster_id_b"])
                ],
                "example_content": generate_example_content(arch, claim["first_seen_platform"]),
            }
    
            with open(claims_detail_dir / f"{claim['id']}.json", "w") as f:
                json.dump(detail, f, indent=2)

    # Generate comparison data for slice pairs
    slice_pairs = [("x_platform", "reddit_platform"), ("x_platform", "youtube_influencer")]
    for window in ["6h", "24h", "7d"]:
        for sa, sb in slice_pairs:
            compare = generate_compare_data(topic_id, cluster_objects, sa, sb, window)
            filename = f"{sa}_{sb}_{window}.json"
            with open(compare_dir / filename, "w") as f:
                json.dump(compare, f, indent=2)


    for window in ["6h", "24h", "7d"]:
        timeline = {
            "events": events,
            "total_count": len(events),
        }
        with open(metrics_dir / f"timeline_{window}.json", "w") as f:
            json.dump(timeline, f, indent=2)

    return {
        "n_claims": len(claims),
        "n_clusters": n_clusters,
        "n_events": len(events),
        "cluster_objects": cluster_objects,
        "claims": frontend_claims,
        "archetypes": archetypes,
        "events": events,
    }


def generate_topics_json(topic_results: dict) -> None:
    """Generate the Level 0 topics.json file."""
    summaries = []

    for topic_def in TOPICS:
        tid = topic_def["id"]
        result = topic_results[tid]
        archetypes = result["archetypes"]
        events = result["events"]

        spike_archs = [a for a in archetypes if a["momentum_pattern"] == "spike"]
        persistent_archs = sorted(archetypes, key=lambda a: a["persistence"], reverse=True)

        top_acc = spike_archs[0] if spike_archs else archetypes[0]
        top_pers = persistent_archs[0]

        # Key signal: highest severity event
        key_signal = None
        if events:
            top_event = events[0]
            key_signal = {
                "type": top_event["type"],
                "summary": top_event["summary"][:100],
            }

        # Headline divergence
        jsd_val = round(random.uniform(0.3, 0.8), 2)

        summary = {
            "id": tid,
            "name": topic_def["name"],
            "cluster_count": result["n_clusters"],
            "contestation_level": "high" if result["n_clusters"] >= 6 else "medium",
            "contestation_emergence": {
                "emerged_hours_ago": random.randint(12, 72),
                "source_diversity": round(random.uniform(0.3, 0.8), 2),
            } if random.random() > 0.5 else None,
            "headline_divergence": {
                "jsd": jsd_val,
                "dominant_typology": random.choice(["Information Asymmetry", "Interpretive", "Paradigmatic"]),
                "trend": random.choice(["increasing", "stable", "decreasing"]),
            },
            "top_accelerating_claim": {
                "text": top_acc["text"],
                "momentum": round(random.uniform(0.5, 0.9), 2),
                "source_diversity": round(random.uniform(0.2, 0.8), 2),
            },
            "most_persistent_claim": {
                "text": top_pers["text"],
                "persistence_windows": top_pers["persistence"],
            },
            "key_signal": key_signal,
            "activity_sparkline": [round(random.uniform(0.2, 0.9), 2) for _ in range(12)],
        }
        
        landscape_24h_path = DATA_DIR / "metrics" / tid / "landscape_24h.json"
        ifi_val = None
        top_sit = None
        if landscape_24h_path.exists():
            with open(landscape_24h_path) as f:
                l24 = json.load(f)
                ifi = l24.get("topic_metrics", {}).get("ifi")
                if ifi:
                    ifi_val = {"value": ifi["value"], "trend": ifi["trend"]}
                sits = l24.get("topic_metrics", {}).get("situations", [])
                if sits:
                    top_sit = {"summary": sits[0]["summary"], "severity": sits[0]["severity"]}
        summary["ifi"] = ifi_val
        summary["top_situation"] = top_sit

        summaries.append(summary)

    with open(DATA_DIR / "topics.json", "w") as f:
        json.dump(summaries, f, indent=2)
    print(f"  Generated topics.json with {len(summaries)} topics")


def _make_generic_topic(topic_id: str, name: str, query: str) -> dict:
    """Create a generic 4-cluster topic definition for arbitrary new topics.
    Used in synthetic fallback mode for the Live Topic Input demo flow."""
    subject = query or name
    return {
        "id": topic_id,
        "name": name,
        "archetypes": [
            {
                "text": f"{subject} requires urgent collective action to address its root causes",
                "subject": subject, "assertion": "requires urgent collective action",
                "framing": "urgency", "stance": "pro", "arousal": "high",
                "cluster": f"{topic_id}-action", "concept": f"{topic_id}-action",
                "platforms": {"x": 0.50, "reddit": 0.30, "youtube": 0.20},
                "momentum_pattern": "rising", "persistence": 8,
            },
            {
                "text": f"Proposed interventions on {subject} will create worse problems than they solve",
                "subject": subject, "assertion": "interventions cause more harm",
                "framing": "unintended consequences", "stance": "anti", "arousal": "medium",
                "cluster": f"{topic_id}-skeptic", "concept": f"{topic_id}-skeptic",
                "platforms": {"x": 0.55, "reddit": 0.20, "youtube": 0.25},
                "momentum_pattern": "stable", "persistence": 10,
            },
            {
                "text": f"The mainstream narrative around {subject} ignores crucial evidence and perspectives",
                "subject": subject, "assertion": "mainstream framing is misleading",
                "framing": "counter-narrative", "stance": "anti", "arousal": "high",
                "cluster": f"{topic_id}-counter", "concept": f"{topic_id}-counter",
                "platforms": {"x": 0.60, "reddit": 0.15, "youtube": 0.25},
                "momentum_pattern": "spike", "persistence": 4,
            },
            {
                "text": f"Evidence-based reform on {subject} should prioritize measurable outcomes over ideology",
                "subject": subject, "assertion": "evidence-based approach is optimal",
                "framing": "pragmatism", "stance": "neutral", "arousal": "low",
                "cluster": f"{topic_id}-pragmatic", "concept": f"{topic_id}-pragmatic",
                "platforms": {"x": 0.20, "reddit": 0.60, "youtube": 0.20},
                "momentum_pattern": "stable", "persistence": 12,
            },
        ],
    }


def main():
    import argparse

    parser = argparse.ArgumentParser(description="Generate synthetic narrative monitoring data")
    parser.add_argument(
        "--topic", type=str, default=None,
        help="Generate only this topic by ID. If ID not in predefined list, a generic template is used.",
    )
    parser.add_argument(
        "--name", type=str, default=None,
        help="Display name for the topic (used with --topic for new topics)",
    )
    parser.add_argument(
        "--query", type=str, default=None,
        help="Search query / subject description (used with --topic for new topics)",
    )
    args = parser.parse_args()

    print("Generating synthetic data for Narrative Monitoring System...")
    print(f"  Output directory: {DATA_DIR}")
    print()

    # Ensure data directories exist
    for d in [DATA_DIR / "raw", DATA_DIR / "claims", DATA_DIR / "metrics"]:
        d.mkdir(parents=True, exist_ok=True)

    # Determine which topics to generate
    if args.topic:
        predefined = [t for t in TOPICS if t["id"] == args.topic]
        if predefined:
            topics_to_generate = predefined
            print(f"  Mode: single topic (predefined) — {args.topic}")
        else:
            name = args.name or args.topic.replace("-", " ").title()
            topics_to_generate = [_make_generic_topic(args.topic, name, args.query or name)]
            print(f"  Mode: single topic (generic template) — {args.topic} / {name}")
    else:
        topics_to_generate = TOPICS
        print(f"  Mode: all {len(TOPICS)} topics")

    print()

    topic_results = {}
    for topic_def in topics_to_generate:
        print(f"  Generating: {topic_def['id']} — {topic_def['name']}")
        result = generate_topic(topic_def)
        topic_results[topic_def["id"]] = result
        print(f"    -> {result['n_claims']} claims, {result['n_clusters']} clusters, {result['n_events']} events")
        print()

    # If generating a single topic, build its TopicSummary directly and merge into existing topics.json
    if args.topic:
        topic_def = topics_to_generate[0]
        result = topic_results[args.topic]
        archetypes = result["archetypes"]
        events = result["events"]
        spike_archs = [a for a in archetypes if a["momentum_pattern"] == "spike"]
        persistent_archs = sorted(archetypes, key=lambda a: a["persistence"], reverse=True)
        top_acc = spike_archs[0] if spike_archs else archetypes[0]
        top_pers = persistent_archs[0]
        key_signal = None
        if events:
            top_event = events[0]
            key_signal = {"type": top_event["type"], "summary": top_event["summary"][:100]}
        new_summary = {
            "id": args.topic,
            "name": topic_def["name"],
            "cluster_count": result["n_clusters"],
            "contestation_level": "high" if result["n_clusters"] >= 6 else "medium",
            "contestation_emergence": {
                "emerged_hours_ago": random.randint(12, 72),
                "source_diversity": round(random.uniform(0.3, 0.8), 2),
            } if random.random() > 0.5 else None,
            "headline_divergence": {
                "jsd": round(random.uniform(0.3, 0.8), 2),
                "dominant_typology": random.choice(["Information Asymmetry", "Interpretive", "Paradigmatic"]),
                "trend": random.choice(["increasing", "stable", "decreasing"]),
            },
            "top_accelerating_claim": {
                "text": top_acc["text"],
                "momentum": round(random.uniform(0.5, 0.9), 2),
                "source_diversity": round(random.uniform(0.2, 0.8), 2),
            },
            "most_persistent_claim": {
                "text": top_pers["text"],
                "persistence_windows": top_pers["persistence"],
            },
            "key_signal": key_signal,
            "activity_sparkline": [round(random.uniform(0.2, 0.9), 2) for _ in range(12)],
        }
        
        landscape_24h_path = DATA_DIR / "metrics" / tid / "landscape_24h.json"
        ifi_val = None
        top_sit = None
        if landscape_24h_path.exists():
            with open(landscape_24h_path) as f:
                l24 = json.load(f)
                ifi = l24.get("topic_metrics", {}).get("ifi")
                if ifi:
                    ifi_val = {"value": ifi["value"], "trend": ifi["trend"]}
                sits = l24.get("topic_metrics", {}).get("situations", [])
                if sits:
                    top_sit = {"summary": sits[0]["summary"], "severity": sits[0]["severity"]}
        summary["ifi"] = ifi_val
        summary["top_situation"] = top_sit

        # Merge into existing topics.json
        topics_path = DATA_DIR / "topics.json"
        existing: list = []
        if topics_path.exists():
            with open(topics_path) as f:
                existing = json.load(f)
        existing = [t for t in existing if t["id"] != args.topic]
        existing.append(new_summary)
        with open(topics_path, "w") as f:
            json.dump(existing, f, indent=2)
        print(f"  Merged into topics.json ({len(existing)} total topics)")
    else:
        generate_topics_json(topic_results)

    print()
    print("Done!")
    if args.topic:
        print(f"  Generated: data/metrics/{args.topic}/landscape_24h.json")
    else:
        print("  Verify: ls data/topics.json data/metrics/*/landscape_24h.json")


if __name__ == "__main__":
    main()
