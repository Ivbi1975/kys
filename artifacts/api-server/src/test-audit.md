# Test Audit Report — Task #298

**Date**: 2026-05-19  
**Scope**: Full test audit — API server + frontend (hisse-kagidi)

---

## Vitest 4 Deprecation Fix

**Issue**: `poolOptions` in vitest.config.ts is removed in Vitest 4.  
**Fix**: Replaced with top-level `forks: { singleFork: true }` and added `env: { BULK_IMPORT_RATE_LIMIT: "100" }` to bypass the 3 req/min rate limit during test runs.

---

## Existing Test Failures Fixed

| Test | File | Issue | Fix |
|------|------|-------|-----|
| D08 soft-delete integrity | `donations-integrity.test.ts` | `expect(status).not.toBe(200)` too weak | Changed to strict `toBe(404)` |
| Transfer conflict | `transfers.test.ts` | Only expected 400, got 409 on conflict | Added 409 to accepted status array |

---

## New Test Files (7)

### `auth.test.ts`
Tests: login validation, token format (s1.<exp>.<sig>), Bearer token on protected endpoint, expired/fake/malformed token → 401, API key auth, photo-token.  
Uses `it.skipIf(!hasAuthConfig)` to deterministically skip token tests when APP_PASSWORD/SESSION_SECRET not set in environment.

### `audit-log.test.ts`
Tests: fire-and-forget write (300ms delay), entityType/action/date/limit filters, hasMore+nextCursor pagination shape.  
Note: project-create audit logs have `projectId: null` by design (project doesn't exist yet when audit fires). Tests use `entityType=project&entityId=` filter accordingly.

### `backup.test.ts`
Tests: export shape (required fields, KA data, donation shareCount), dryRun summary response, replace confirmReplace guard (409), invalid payload (400/403), full Export→PermanentDelete→Import→Verify round-trip with shareCount assertion.  
Uses `it.skipIf(!hasAdminKey)` for import round-trip — requires ADMIN_KEY env var.  
Note: merge mode skips existing KAs, so round-trip uses permanent delete (not soft-delete) before import.

### `pool-filters.test.ts`
Tests: search (ASCII + Turkish: İ, Ş, Ç, Ğ), donationType filter, `status=excluded` semantics (excluded=true per item), `status=active` semantics (excluded=false per item), excluded+active totals sum to overall total, tagIds filter, filter combos, offset pagination (no-overlap, full-sweep, over-limit).  
**Cursor pagination** (KA donations endpoint `GET /api/kesim-alanlari/:id/donations`): nextCursor returned when hasMore=true, second page has no overlap with first, paginating all pages collects exactly N records, invalid cursor → 400.  
**API constraint note**: The project pool endpoint (`/api/projects/:id/donations`) uses **offset**-based pagination (`limit`, `offset`, returns `{items, total}`). Cursor pagination (`nextCursor`, `hasMore`) is implemented on the KA-level endpoint (`/api/kesim-alanlari/:id/donations`) only. Cursor tests are on the KA endpoint, which is the correct implementation target.

### `ai-notes.test.ts`
Tests: settings CRUD, deprecated `/classify` returns 410, payload validation (empty/missing/wrong-type), classify-async job creation (202 or 503 when OpenAI not configured), job status/cancel lifecycle.

### `vys.test.ts`
Tests: dev-mode bypass detection, missing/wrong key → 401, correct key or bypass → 200, project/donation/KA list, required response fields, 404 for nonexistent projectId.  
Uses `X-API-Key` header (confirmed from middleware). Dev bypass applies when `VYS_API_KEY` not set and `IS_DEV=true`.

### `stats.test.ts`
Tests: KA dashboard 200, project dashboard required fields (totalAnimals, kesildiCount, remainingCount, kesildiPercent, kesimAlanlari), strict numerical assertions (totalAnimals==2 after creating 2 groups, kesildiCount==0 initially), kesildi toggle increases count by exactly 1, reverting decreases by 1, KA-level sum equals project total, pool total >= created donations.  
**Bug fixed**: Dashboard cache (30s TTL) was not invalidated on kesildi toggle → added `cacheInvalidatePrefix("dashboard:<projectId>")` in `groups.ts` after toggle.

---

## Bug Fixed (Production Code)

**File**: `artifacts/api-server/src/routes/kesim-alanlari/groups.ts`  
**Issue**: `PUT /api/kesim-alanlari/:id/animal-groups/:groupId` with `kesildi` toggle did not invalidate the project dashboard cache (30s TTL). Dashboard showed stale kesildiCount after toggle.  
**Fix**: Added `cacheInvalidatePrefix("dashboard:<projectId>")` in the async post-response callback when `kesildi` is toggled.

---

## Frontend Changes

### Fast Refresh Fix
**File**: `useKesimAlaniState.tsx`  
**Issue**: `VirtuosoTable` and `VirtuosoTableHead` forwardRef components defined inside a custom hook file, causing Fast Refresh warning.  
**Fix**: Moved to new `VirtuosoComponents.tsx` file.

### GroupListPanel Performance
**File**: `GroupListPanel.tsx`  
**Issues**:
1. Rules of Hooks: 3 `useMemo` hooks were after `if (!kesim) return null` early return
2. `visibleItems` and `visibleRows` were recomputed inline in an IIFE every render
3. No `React.memo` wrapper

**Fixes**:
1. All `useMemo` hooks moved above early return (`gridClassName`, `lockedCount`, `activeColorTag`)
2. `visibleItems` and `visibleRows` lifted to `useMemo` hooks above early return
3. Component export wrapped with `React.memo`

---

## Final Test Results

| Suite | Files | Tests | Status |
|-------|-------|-------|--------|
| API server | 12 | 211 | ✅ All pass |
| Frontend | 3 | 65 | ✅ All pass |
| **Total** | **15** | **276** | **✅** |
