# Dependency audit reconciliation

- Machine local time: 2026-09-11 23:47:13 -04:00
- Machine UTC time: 2026-09-12T03:47:13Z
- Scope: D-103 wording, React Router package state, and OI-9

## Recorded-state comparison

- D-103-era commit inspected: `70395ac`.
- The `shop-chat-agent-main/package-lock.json` blob at `70395ac` and immediately before this remediation was identical: `fcd6ec05722c8d9e82769e5f3e6b590d9eab777d`.
- Both locks resolved `react-router` to `7.11.0`.
- The September 9 verification row already recorded high findings in both the React Router and Prisma chains.
- The September 12 pre-remediation audit recorded 12 high-severity package entries across those same two chains.

Conclusion: React Router did not reappear because of a dependency rollback. D-103's statement that the React Router chain was remediated was broader than the preserved lock and verification record support. The record is corrected forward; the historical entry is not erased.

## Compatible remediation

The five directly declared React Router packages were moved together from the lock's `7.11.0` family to `7.18.3`:

- `react-router`
- `@react-router/dev`
- `@react-router/fs-routes`
- `@react-router/node`
- `@react-router/serve`

The Shopify React Router adapter resolves against the same `7.18.3` instance. A normal `npm ci` completed successfully after the lock was regenerated; no forced audit fix, framework-major migration, or downgrade was used.

Official source checked: https://github.com/advisories/GHSA-chx6-hx7r-mcp5 reports affected React Router versions below `7.18.0` and a patched version of `7.18.0`. Release history: https://github.com/remix-run/react-router/releases.

## Post-remediation result

`npm audit --omit=dev --json` now reports 4 high-severity package entries, all in the existing Prisma/deepmerge chain:

- `@prisma/config`
- `@shopify/shopify-app-session-storage-prisma`
- `deepmerge-ts`
- `prisma`

No React Router vulnerability is present in the post-remediation audit. npm's offered fix for the remaining chain changes `@shopify/shopify-app-session-storage-prisma` to `6.0.9` and marks it as a semver-major change, so OI-9 remains open as a narrower accepted tracked risk.

## Verification

- `npm ls @react-router/dev @react-router/fs-routes @react-router/node @react-router/serve react-router @shopify/shopify-app-react-router --depth=1`: matched React Router family at `7.18.3`; Shopify adapter deduped to it.
- `npm test`: 32/32 passed after the NR-8 hardening pass.
- `npm run lint`: passed.
- `npm run typecheck`: passed.
- `npm run build`: passed.

This evidence changes dependency and local-test claims only. It does not establish a deployment or live customer round trip.
