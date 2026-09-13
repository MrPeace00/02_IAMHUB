# Git object-store and history scan evidence

## Verdict

**REVIEW REQUIRED.** The repository object database passed Git integrity checks, and no provider-formatted API keys, private keys, JWTs, bearer tokens, Slack webhooks, or Shopify cart tokens were detected. Two credential-like query parameters were found in two unreachable historical `dev-server.log` blobs and require manual validation. Their values are intentionally not retained in this report or the machine-readable report.

Two additional critical-severity matches are confirmed placeholder basic-auth URLs under `chat.example.com` in reachable test blobs.

## Run identity

| Field | Value |
|---|---|
| Generated at (UTC) | `2026-09-12T13:45:51.993Z` |
| Repository HEAD | `10f7d6babbef13fbfd19c61db086add2fea05f8a` |
| `origin/main` | `f258473856d1cbf853f0da6ce1c9ca35912f6b5b` |
| HEAD ahead of `origin/main` | 1 commit |
| Scanner | `scan_git_object_store_20260912.mjs` |
| Scanner SHA-256 | `9d9aadc7873468dfeaad25579f30b6fda72996de23189c3634f26500edda069e` |
| JSON report SHA-256 | `b2302ed42fefe5d42c5cce3be83e8861216640c793966d0e1e15c8049dce3cc0` |

## Coverage

The scanner enumerated the complete local Git object database with `git cat-file --batch-all-objects`. It scanned every blob, commit, and annotated tag, including objects reachable from refs, reachable only from reflogs, and unreachable objects.

| Metric | Result |
|---|---:|
| Total objects enumerated | 530 |
| Blobs | 274 |
| Commits | 19 |
| Trees | 237 |
| Reachable from refs | 439 |
| Reflog-only | 20 |
| Unreachable | 71 |
| Bytes scanned in blobs/commits/tags | 8,472,421 |
| Commits reachable from refs | 18 |
| Commits reachable including reflogs | 19 |

## Findings

| Severity | Count | Disposition |
|---|---:|---|
| Critical | 4 | 2 unreachable query-credential matches require review; 2 reachable basic-auth matches are placeholders |
| Review | 43 | Generic assignment heuristic; names are predominantly access/session/conversation/token variables and are not confirmed credentials |
| Personal data | 46 | 38 Git metadata addresses, 2 reserved examples, and 6 review-required contact/package-metadata matches |
| Internal identifier | 6 | UUIDs in XML or PNG provenance metadata; 4 reachable and 2 reflog-only |

Critical finding metadata (matched values withheld):

| Detector | Object | Reachability | Historical path | Location | Assessment |
|---|---|---|---|---|---|
| `query-credential` | `7ae3d87c8eacf1aae26c217f3fde73816e0a56e4` | unreachable | `dev-server.log` | line 36, column 57 | `key` parameter; manual validation required |
| `query-credential` | `c40d2dfb11d616f49664b42a8c49a5e9da3c90a3` | unreachable | `dev-server.log` | line 36, column 57 | `key` parameter; manual validation required |
| `url-basic-auth` | `af0f5006e7df32257a120ab70d26a1b13a45637f` | reachable | `tests/widget-backend.test.mjs` and historical aliases | line 24, column 100 | placeholder at `chat.example.com` |
| `url-basic-auth` | `f35c6b25bc62533945bc52907ac4ab81ae17fd97` | reachable | `tests/widget-backend.test.mjs` and historical aliases | line 23, column 100 | placeholder at `chat.example.com` |

The scan also identified 8 sensitive-name path candidates. All are reachable and consist of `.env.example` files, one backup/review XML document, and session/conversation database migrations. A sensitive filename alone is not a content finding.

## Git integrity cross-check

`git fsck --full --strict --no-reflogs --unreachable` exited with status 0 and reported no integrity errors. It listed 91 objects as unreachable when reflogs are intentionally excluded: 32 blobs, 1 commit, and 58 trees. This is consistent with the scanner's 71 fully unreachable objects plus 20 reflog-only objects.

## Method and limitations

- Pattern-based scanning can produce false positives and false negatives.
- Binary blobs were scanned as byte-preserving Latin-1 text for recognizable token strings.
- Compressed or encrypted payloads were not decompressed or decrypted.
- This was a repository-local scanner, not a Gitleaks or TruffleHog run.
- No matched values or value-derived hashes were retained.

The machine-readable evidence, including every finding's object ID, reachability, historical paths, and location, is in `git_object_store_scan_20260912_full.json`.
