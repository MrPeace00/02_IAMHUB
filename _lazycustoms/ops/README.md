# Operations and Verification Scripts

This directory contains standalone python verification scripts that operate independently from the main application code:

- `audit_repo.py`: Audits structure, boundaries, and required files across `shop-chat-agent-main` and `_lazycustoms`.
- `check_catalog.py`: Verifies Shopify Catalog eligibility and password status.
- `check_discovery.py`: Verifies AI channel discovery readiness.
- `evidence/`: Holds output logs and evidence files from verification runs.
