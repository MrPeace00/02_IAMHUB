#!/usr/bin/env python3
"""
Shopify AI Channel Discovery Verification Script
Makes live HTTP requests against the storefront to check indexing and
discovery readiness for AI sales channels. Writes evidence to ops/evidence/.

Run from _lazycustoms directory:
    python ops/check_discovery.py --label baseline [--domain lazycustoms.com]
"""

import argparse
import json
import re
import sys
import urllib.error
import urllib.request
from datetime import datetime, timezone
from pathlib import Path

TIMEOUT = 10
USER_AGENT = "Mozilla/5.0 (compatible; LazyCustomsDiscoveryCheck/1.0)"

PASSWORD_GATE_MARKERS = ("id=\"password\"", "storefront_password", "Enter store using password")
NOINDEX_MARKER = re.compile(r'<meta[^>]+name=["\']robots["\'][^>]+content=["\'][^"\']*noindex', re.IGNORECASE)
DISALLOW_ROOT = re.compile(r'^\s*Disallow:\s*/\s*$', re.MULTILINE)


def fetch(url):
    """Fetch a URL and return (status_code, body_text) or (None, error)."""
    req = urllib.request.Request(url, headers={"User-Agent": USER_AGENT})
    try:
        with urllib.request.urlopen(req, timeout=TIMEOUT) as resp:
            return resp.status, resp.read().decode("utf-8", errors="replace")
    except urllib.error.HTTPError as e:
        body = e.read().decode("utf-8", errors="replace") if e.fp else ""
        return e.code, body
    except (urllib.error.URLError, TimeoutError) as e:
        return None, str(e)


def check_discovery(domain, label):
    base_url = f"https://{domain}"
    result = {
        "check": "ai_discovery",
        "domain": domain,
        "label": label,
        "timestamp": datetime.now(timezone.utc).isoformat(),
    }

    print("=" * 60)
    print("AI CHANNEL DISCOVERY VERIFICATION")
    print("=" * 60)

    # 1. Password gate blocks crawling outright.
    home_status, home_body = fetch(base_url)
    password_active = None
    if home_status is None:
        result["homepage_error"] = home_body
        print(f"Store Discovery Mode: UNKNOWN — request to {base_url} failed: {home_body}")
        write_evidence(result, label)
        return 0

    password_active = any(marker in home_body for marker in PASSWORD_GATE_MARKERS)
    result["homepage_status"] = home_status
    result["password_protection_active"] = password_active

    # 2. robots.txt: check for a blanket Disallow.
    robots_status, robots_body = fetch(f"{base_url}/robots.txt")
    robots_disallow_all = bool(robots_status == 200 and DISALLOW_ROOT.search(robots_body))
    result["robots_status"] = robots_status
    result["robots_disallow_all"] = robots_disallow_all

    # 3. Homepage meta robots noindex.
    noindex = bool(NOINDEX_MARKER.search(home_body))
    result["homepage_noindex"] = noindex

    restricted = password_active or robots_disallow_all or noindex
    result["discovery_restricted"] = restricted

    if password_active:
        print("1. Store Discovery Mode: Restricted")
        print("2. Reason: Password protection prevents open-web crawling and catalog indexing")
        print("3. Requirement: Store must be live and password removed for AI channel discovery")
    elif robots_disallow_all:
        print("1. Store Discovery Mode: Restricted")
        print("2. Reason: robots.txt disallows all crawlers (Disallow: /)")
        print("3. Requirement: Update robots.txt to allow crawling of storefront pages")
    elif noindex:
        print("1. Store Discovery Mode: Restricted")
        print("2. Reason: Homepage sets a <meta name=\"robots\" content=\"noindex\"> tag")
        print("3. Requirement: Remove noindex directive from the homepage")
    else:
        print("1. Store Discovery Mode: Open")
        print(f"2. Evidence: HTTP {home_status} on homepage, robots.txt HTTP {robots_status} (no blanket disallow), no noindex meta tag")
        print("3. Requirement: None — store is discoverable; verify catalog feed separately with check_catalog.py")

    print("=" * 60)

    write_evidence(result, label)
    return 0


def write_evidence(result, label):
    evidence_dir = Path(__file__).resolve().parent / "evidence"
    evidence_dir.mkdir(exist_ok=True)
    stamp = datetime.now(timezone.utc).strftime("%Y%m%dT%H%M%SZ")
    safe_label = re.sub(r"[^A-Za-z0-9_-]", "_", label)
    out_path = evidence_dir / f"discovery_check_{safe_label}_{stamp}.json"
    out_path.write_text(json.dumps(result, indent=2))
    print(f"Evidence written: {out_path.relative_to(Path(__file__).resolve().parent.parent)}")


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Verify AI channel discovery readiness via live HTTP probes.")
    parser.add_argument("--domain", default="lazycustoms.com", help="Storefront domain to probe.")
    parser.add_argument("--label", default="manual", help="Label to tag this run's evidence file.")
    args = parser.parse_args()
    sys.exit(check_discovery(args.domain, args.label))
