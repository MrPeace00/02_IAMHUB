#!/usr/bin/env python3
"""
Shopify Catalog Eligibility Verification Script
Makes live HTTP requests against the storefront to verify password protection
status and catalog feed availability. Writes evidence to ops/evidence/.

Run from _lazycustoms directory:
    python ops/check_catalog.py --label baseline [--domain lazycustoms.com]
    python ops/check_catalog.py --label page2 --page 2   # fetch a single page only
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
USER_AGENT = "Mozilla/5.0 (compatible; LazyCustomsCatalogCheck/1.0)"
MAX_PAGES = 20  # safety cap against runaway pagination loops

# Shopify's password-gate page reliably includes these markers.
PASSWORD_GATE_MARKERS = ("id=\"password\"", "storefront_password", "Enter store using password")


def fetch(url):
    """Fetch a URL and return (status_code, body_text, headers) or (None, error, {})."""
    req = urllib.request.Request(url, headers={"User-Agent": USER_AGENT})
    try:
        with urllib.request.urlopen(req, timeout=TIMEOUT) as resp:
            body = resp.read().decode("utf-8", errors="replace")
            return resp.status, body, dict(resp.headers)
    except urllib.error.HTTPError as e:
        body = e.read().decode("utf-8", errors="replace") if e.fp else ""
        return e.code, body, dict(e.headers or {})
    except (urllib.error.URLError, TimeoutError) as e:
        return None, str(e), {}


def fetch_products_page(base_url, page):
    """Fetch one page of /products.json. Returns (status, products_list_or_None)."""
    feed_url = f"{base_url}/products.json?limit=250&page={page}"
    status, body, _ = fetch(feed_url)
    if status != 200:
        return status, None
    try:
        return status, json.loads(body).get("products", [])
    except json.JSONDecodeError:
        return status, None


def check_catalog(domain, label, page=None):
    base_url = f"https://{domain}"
    result = {
        "check": "catalog_eligibility",
        "domain": domain,
        "label": label,
        "timestamp": datetime.now(timezone.utc).isoformat(),
    }

    print("=" * 60)
    print("SHOPIFY CATALOG ELIGIBILITY CHECK")
    print("=" * 60)

    # 1. Password protection: probe the homepage for the Shopify password gate.
    status, body, _ = fetch(base_url)
    password_active = None
    if status is None:
        result["homepage_status"] = None
        result["homepage_error"] = body
        print(f"1. Password Protection: UNKNOWN — request to {base_url} failed: {body}")
    else:
        password_active = any(marker in body for marker in PASSWORD_GATE_MARKERS)
        result["homepage_status"] = status
        result["password_protection_active"] = password_active
        state = "Active (Store behind password)" if password_active else "Not active (Store is open)"
        print(f"1. Password Protection: {state}  [HTTP {status}]")

    # 2. Catalog feed: either a single requested page, or a full paginated walk.
    if page is not None:
        feed_status, products = fetch_products_page(base_url, page)
        page_count = len(products) if products is not None else None
        result["feed_status"] = feed_status
        result["page"] = page
        result["page_product_count"] = page_count

        if password_active:
            print("2. Catalog Status: Ineligible while storefront password is set")
            print("3. Action Item: Resolve Decision D1 in docs/00-decision-log.md to remove password")
        elif page_count is None:
            print(f"2. Catalog Status: UNKNOWN — could not read page {page} [HTTP {feed_status}]")
            print("3. Action Item: Verify /products.json is reachable and returns valid JSON")
        else:
            print(f"2. Catalog Status: page {page} returned {page_count} product(s)")
            print("3. Action Item: None — single-page check only, run without --page for a full paginated total")
    else:
        product_count, pages_fetched, feed_status = walk_all_pages(base_url, password_active)
        result["feed_status"] = feed_status
        result["product_count"] = product_count
        result["pages_fetched"] = pages_fetched

        if password_active:
            print("2. Catalog Status: Ineligible while storefront password is set")
            print("3. Action Item: Resolve Decision D1 in docs/00-decision-log.md to remove password")
        elif product_count is None:
            print(f"2. Catalog Status: UNKNOWN — could not read /products.json [HTTP {feed_status}]")
            print("3. Action Item: Verify /products.json is reachable and returns valid JSON")
        elif product_count == 0:
            print("2. Catalog Status: Ineligible — feed reachable but returned 0 products")
            print("3. Action Item: Publish Draft/unassigned products (see D2, D3 in docs/00-decision-log.md)")
        else:
            print(f"2. Catalog Status: Eligible — {product_count} product(s) across {pages_fetched} page(s)")
            print("3. Action Item: None — catalog feed is populated")

    print("=" * 60)

    write_evidence(result, label)
    return 0


def walk_all_pages(base_url, password_active):
    """Walk /products.json?page=N until an empty page or MAX_PAGES is hit. Returns (total, pages_fetched, last_status)."""
    if password_active:
        return None, 0, None

    total = 0
    pages_fetched = 0
    last_status = None
    for page in range(1, MAX_PAGES + 1):
        status, products = fetch_products_page(base_url, page)
        last_status = status
        if status != 200 or products is None:
            if pages_fetched == 0:
                return None, 0, status
            break
        if not products:
            break
        total += len(products)
        pages_fetched += 1
        if len(products) < 250:
            break  # short page means this was the last one

    return total, pages_fetched, last_status


def write_evidence(result, label):
    evidence_dir = Path(__file__).resolve().parent / "evidence"
    evidence_dir.mkdir(exist_ok=True)
    stamp = datetime.now(timezone.utc).strftime("%Y%m%dT%H%M%SZ")
    safe_label = re.sub(r"[^A-Za-z0-9_-]", "_", label)
    out_path = evidence_dir / f"catalog_check_{safe_label}_{stamp}.json"
    out_path.write_text(json.dumps(result, indent=2))
    print(f"Evidence written: {out_path.relative_to(Path(__file__).resolve().parent.parent)}")


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Verify Shopify catalog eligibility via live HTTP probes.")
    parser.add_argument("--domain", default="lazycustoms.com", help="Storefront domain to probe.")
    parser.add_argument("--label", default="manual", help="Label to tag this run's evidence file.")
    parser.add_argument("--page", type=int, default=None, help="Fetch only this single page of /products.json instead of walking all pages.")
    args = parser.parse_args()
    sys.exit(check_catalog(args.domain, args.label, args.page))
