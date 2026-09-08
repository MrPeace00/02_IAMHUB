#!/usr/bin/env python3
"""
Repository Audit Script for Lazy Customs

Audits the structure and integrity of:
1. shop-chat-agent-main (Shopify reference app fork)
2. _lazycustoms (Project management, records, and staged additions)

Run from _lazycustoms directory:
    python ops/audit_repo.py
"""

import os
import sys
from pathlib import Path

def audit():
    base_dir = Path(__file__).resolve().parent.parent.parent
    shop_chat_dir = base_dir / "shop-chat-agent-main"
    lazycustoms_dir = base_dir / "_lazycustoms"

    print("=" * 60)
    print("LAZY CUSTOMS REPOSITORY AUDIT")
    print("=" * 60)
    print(f"Base Directory: {base_dir}")
    print(f"Reference App:  {shop_chat_dir}")
    print(f"Deliverables:   {lazycustoms_dir}")
    print("-" * 60)

    errors = []
    warnings = []

    # 1. Audit shop-chat-agent-main
    print("\n[1/3] Auditing shop-chat-agent-main...")
    if not shop_chat_dir.exists():
        errors.append(f"MISSING DIRECTORY: {shop_chat_dir}")
    else:
        required_shop_files = [
            "package.json",
            "vite.config.js",
            "tsconfig.json",
            "Dockerfile",
            "shopify.app.toml",
            "shopify.web.toml",
            "app/root.jsx",
            "app/shopify.server.js",
            "extensions/chat-bubble/shopify.extension.toml",
            "prisma/schema.prisma"
        ]
        for rel_path in required_shop_files:
            file_path = shop_chat_dir / rel_path
            if file_path.exists():
                print(f"  [OK] {rel_path}")
            else:
                errors.append(f"shop-chat-agent-main missing: {rel_path}")

    # 2. Audit _lazycustoms
    print("\n[2/3] Auditing _lazycustoms deliverables...")
    if not lazycustoms_dir.exists():
        errors.append(f"MISSING DIRECTORY: {lazycustoms_dir}")
    else:
        required_lazy_files = [
            "README.md",
            "chat-agent-additions/.env.example",
            "docs/00-decision-log.md",
            "docs/01-ucp-implementation-log.md",
            "docs/02-catalog-eligibility-audit.md",
            "docs/03-product-data-spec.md",
            "docs/04-knowledge-base-answers.md",
            "docs/05-architecture.md",
            "docs/06-pod-integration-notes.md",
            "docs/07-repo-audit.md",
            "ops/README.md",
            "ops/audit_repo.py",
            "ops/check_catalog.py",
            "ops/check_discovery.py"
        ]
        for rel_path in required_lazy_files:
            file_path = lazycustoms_dir / rel_path
            if file_path.exists():
                print(f"  [OK] {rel_path}")
            else:
                warnings.append(f"_lazycustoms missing: {rel_path}")

    # 3. Check boundary separation
    print("\n[3/3] Auditing directory separation boundaries...")
    leaked_files = [
        "package.json",
        "vite.config.js",
        "tsconfig.json",
        "Dockerfile"
    ]
    for filename in leaked_files:
        leaked_path = lazycustoms_dir / filename
        if leaked_path.exists():
            errors.append(f"LEAK DETECTED: {filename} should NOT be in _lazycustoms root")
        else:
            print(f"  [OK] No leak for {filename} in _lazycustoms root")

    # Summary
    print("\n" + "=" * 60)
    print("AUDIT SUMMARY")
    print("=" * 60)
    if warnings:
        print("\nWARNINGS:")
        for w in warnings:
            print(f"  - {w}")

    if errors:
        print("\nERRORS:")
        for e in errors:
            print(f"  - {e}")
        print("\nResult: FAIL (Fix errors before proceeding)")
        return 1
    else:
        print("\nResult: PASS - All boundaries and structure verified clean.")
        return 0

if __name__ == "__main__":
    sys.exit(audit())
