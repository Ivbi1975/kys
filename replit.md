# Workspace

## Overview

pnpm workspace monorepo using TypeScript. Each package manages its own dependencies.

## Stack

- **Monorepo tool**: pnpm workspaces
- **Node.js version**: 24
- **Package manager**: pnpm
- **TypeScript version**: 5.9
- **API framework**: Express 5
- **Database**: PostgreSQL + Drizzle ORM
- **Validation**: Zod (`zod/v4`), `drizzle-zod`
- **API codegen**: Orval (from OpenAPI spec)
- **Build**: esbuild (CJS bundle)

## Structure

```text
artifacts-monorepo/
├── artifacts/              # Deployable applications
│   ├── api-server/         # Express API server
│   └── hisse-kagidi/       # Kurban Hisse Kağıdı - React + Vite web app
├── lib/                    # Shared libraries
│   ├── api-spec/           # OpenAPI spec + Orval codegen config
│   ├── api-client-react/   # Generated React Query hooks
│   ├── api-zod/            # Generated Zod schemas from OpenAPI
│   └── db/                 # Drizzle ORM schema + DB connection
├── scripts/                # Utility scripts (single workspace package)
│   └── src/                # Individual .ts scripts, run via `pnpm --filter @workspace/scripts run <script>`
├── pnpm-workspace.yaml     # pnpm workspace (artifacts/*, lib/*, lib/integrations/*, scripts)
├── tsconfig.base.json      # Shared TS options (composite, bundler resolution, es2022)
├── tsconfig.json           # Root TS project references
└── package.json            # Root package with hoisted devDeps
```

## Artifacts

### Kurban Hisse Kağıdı (`artifacts/hisse-kagidi`)

Frontend-only React + Vite app for managing Kurban Bayramı share certificates. Features:
- Create cutting areas (kesim alanları)
- Add donors via manual entry, Excel upload (.xlsx/.xls/.csv), or copy-paste with column mapping
- Multi-select checkboxes for bulk deletion and bulk editing of donors
- Same-name auto-count: if a name appears N times, effectiveShare=N is used
- Smart auto-grouping: distributes donors into groups of 7 (one animal per group) using bin-packing
- Drag-and-drop between animal groups
- Sort by any column
- Undo/Redo system with history panel (Ctrl+Z/Ctrl+Y, up to 80 steps with Turkish descriptions)
- Animal group color tags (green/orange/red) with filtering
- Animal group locking (prevents accidental changes)
- Animal group notes
- Dark theme support with three modes: Açık (light), Koyu (dark), Sistem (system auto-detect) — settable via header toggle or Settings > Tema
- Excel export for donor lists (with both Bağışçılar + Hayvan Grupları sheets) and kesim kağıdı format (with cell merges + column widths)
- Excel export on print page matching visible column layout with HAYVAN cell merges
- PDF export on print page (opens browser print dialog for Save as PDF)
- Statistics dashboard — kesim detail: active donors, excluded count, total shares, required animals, empty slots, occupancy % (doluluk)
- Statistics dashboard — home page: each card shows bağışçı/hisse/hayvan/grup/doluluk; summary row for all areas when 2+ exist
- Share distribution panel (bar chart showing count of 1-7 share donors)
- Group composition panel (shows share combinations per group like "3+2+1+1")
- Ungrouped donor tracking (clickable orange counter filters donor list to show only unassigned donors)
- JSON backup/restore for all data
- Print A4 landscape pages matching Excel "Kesim Kağıdı" format with columns: HAYVAN (merged vertically), SIRA, VEKALET, VEKALETİ VEREN, ADINA KESİLEN, CİNSİ, NOTLAR
- Flexible workspace layout: multi-column grid (1/2/3 columns), column hide/show popover, compact mode, fullscreen mode (ESC to exit), collapse all/expand all, column drag-and-drop reorder, resizable split pane between donor list and animal groups — all preferences saved to localStorage via `useWorkspacePreferences` hook
- Mobile responsive: tab-based navigation (Bağışçı Listesi / Hayvan Grupları) on mobile instead of split pane, compact header with save button, responsive stat cards (2-col grid on mobile), toolbar buttons adapt to screen size
- Donor list hide/show toggle (panel collapses, groups reflow to full width) — desktop only
- Group split (scissors icon, divides filled donors into two renumbered groups)
- Group merge (checkbox selection + toolbar, handles 7-share overflow into new groups)
- Manual swap mode (ArrowLeftRight icon, preview dialog before executing)
- Auto conflict resolver ("Otomatik Çöz" button, optimally consolidates same-vekalet donors by choosing the target group with most existing matches to minimize swaps)
- Cross-kesim-alanı basket (kese): basket items persist in localStorage per project, visible when navigating between KAs; items from other KAs shown with blue badges; transfer donors to another KA in same project via "Başka KA'ya taşı" dropdown; group-level "Tümünü Sepete Ekle" button in group header (shopping bag icon); "Bağışçı Listesine Ekle" button for foreign basket items — adds donors to current KA's donor list with confirmation dialog, auto-removes from source KA, logs all transfers to DB
- Donation transfer log: `donation_transfers` DB table tracks all cross-KA donor movements (from/to KA names, donor info, timestamps, removal status); viewable on project detail page via "Aktarımlar Logu" button
- Custom tag system: global tag definitions (name + color) managed in Settings, assignable to donors via popover, displayed as colored badges, included in backup/restore, orphaned tags cleaned on deletion
- Advanced filtering: filter donor list by cinsi (dropdown), hisse range (min/max), status (active/excluded), tags (multi-select) — combinable filters with active count badge and clear button
- Data persisted in PostgreSQL via API server (migrated from localStorage)
- One-time automatic localStorage → PostgreSQL migration on first load
- Soft delete for kesim alanları (trash/restore functionality with permanent delete option)
- Soft delete for donations (Bağış Çöp Kutusu): all deletion paths (single delete, bulk select delete, bulkDeleteByDesc, findDelete) use soft-delete API; deleted donations viewable in "Çöp Kutusu" dialog on kesim-alani page with restore and permanent-delete options; `deletedAt` column on donations table
- Kesim tracking public link system: generates a unique token per kesim alanı; public page at `/takip/:token` (no password required) shows animal groups with kesildi toggle checkboxes, progress bar, auto-refresh every 30s; "Takip Linki" button in kesim-alani header copies the tracking URL to clipboard; kesildi stats shown in both kesim-alani and proje-detay pages
- Toast notifications for all user actions (success/error feedback)
- AlertDialog for destructive operations (modern UI instead of browser confirm())
- Save button in header with last save timestamp (HH:MM:SS), auto-save on changes + manual save button
- Save status indicator in workspace header (saving/saved/error states)
- Creation date display on kesim alanı cards with relative time
- crypto.randomUUID() for all ID generation (collision-safe)
- Database indexes on foreign keys and unique constraints on join tables
- API base path uses import.meta.env.BASE_URL for proper artifact routing
- File size validation for logo uploads (max 5MB)
- Offline mode for tracking page: Service Worker via vite-plugin-pwa caches assets; IndexedDB stores tracking data and queues offline changes (kesildi toggles, notes); auto-sync when back online; offline banner with pending change counter; NetworkFirst caching strategy for API requests

Data model (Donation):
- `id`, `name` (adına kesilen), `description` (vekaleti veren), `donationType` (cinsi), `shareCount`, `vekalet` (vekalet no), `notes` (notlar), `excluded?`, `tags?`

Data model (AnimalGroup):
- `id`, `animalNo`, `donations[]`, `colorTag?` (green/orange/red), `locked?`, `notes?`, `kesildi?` (boolean, tracks slaughter status)

Key files:
- `src/lib/types.ts` - TypeScript types (Donation, AnimalGroup, KesimAlani, ColorTag, CustomTag, Project, ProjectStats)
- `src/lib/api.ts` - API client functions for all CRUD operations (PostgreSQL backend), including project CRUD (fetchProjects, createProject, updateProject, deleteProject, restoreProject, fetchDeletedProjects) and moveKesimAlani
- `src/lib/storage.ts` - Print preferences (localStorage, UI-only settings)
- `src/lib/grouping.ts` - Mod 7 smart grouping algorithm (pre-splits into full 7-share animals, then pairs/triples remainders)
- `src/lib/useHistory.ts` - Snapshot-based undo/redo hook (80 steps, structuredClone)
- `src/lib/useTheme.ts` - Theme hook supporting light/dark/system modes with system preference detection
- `src/lib/useWorkspacePreferences.ts` - Workspace layout preferences hook (columnCount, hiddenColumns, compactMode, columnOrder, splitRatio) with localStorage persistence
- `src/pages/home.tsx` - Home page with project cards (collapsible), kesim alanı list grouped by project, project CRUD, move kesim alanı between projects, settings (logo, backup, theme selector, tag management)
- `src/pages/kesim-alani.tsx` - Main editing page entry point (imports hook + content + dialogs components)
- `src/components/kesim-alani/useKesimAlaniState.tsx` - All state, hooks, handlers, effects for kesim-alani page (~3800 lines)
- `src/components/kesim-alani/KesimAlaniContent.tsx` - Main content layout: donor table, animal groups, stats, export (~2700 lines)
- `src/components/kesim-alani/KesimAlaniDialogs.tsx` - All dialog/modal components for kesim-alani (~1400 lines)
- `src/pages/print.tsx` - Print-optimized A4 landscape view matching Excel design
- `src/pages/kesim-takip.tsx` - Public kesim tracking page (no auth), shows animal groups with kesildi toggle, offline mode with IndexedDB + Service Worker
- `src/pages/kesim-rapor.tsx` - Kesim report page (`/rapor/:id`), print-optimized PDF with stats, timeline, team breakdown, notes; accessible from kesim-alani "Rapor" button
- `src/lib/offlineStore.ts` - IndexedDB wrapper for offline tracking data cache and change queue
- `src/lib/useOfflineSync.ts` - React hook for offline-aware data loading, change queuing, and sync

## TypeScript & Composite Projects

Every package extends `tsconfig.base.json` which sets `composite: true`. The root `tsconfig.json` lists all packages as project references. This means:

- **Always typecheck from the root** — run `pnpm run typecheck` (which runs `tsc --build --emitDeclarationOnly`). This builds the full dependency graph so that cross-package imports resolve correctly. Running `tsc` inside a single package will fail if its dependencies haven't been built yet.
- **`emitDeclarationOnly`** — we only emit `.d.ts` files during typecheck; actual JS bundling is handled by esbuild/tsx/vite...etc, not `tsc`.
- **Project references** — when package A depends on package B, A's `tsconfig.json` must list B in its `references` array. `tsc --build` uses this to determine build order and skip up-to-date packages.

## Root Scripts

- `pnpm run build` — runs `typecheck` first, then recursively runs `build` in all packages that define it
- `pnpm run typecheck` — runs `tsc --build --emitDeclarationOnly` using project references

## Packages

### `artifacts/api-server` (`@workspace/api-server`)

Express 5 API server. Routes live in `src/routes/` and use `@workspace/api-zod` for request and response validation and `@workspace/db` for persistence.

- Entry: `src/index.ts` — reads `PORT`, starts Express
- App setup: `src/app.ts` — mounts compression, logging, helmet (security headers with CSP), rate limiting (200 req/min per IP), CORS, JSON/urlencoded parsing, routes at `/api`; trust proxy enabled for correct IP resolution
- Routes: `src/routes/index.ts` mounts sub-routers; `src/routes/health.ts` (`GET /api/healthz`); `src/routes/projects.ts` (project CRUD with aggregated stats, soft delete/restore); `src/routes/kesim-alanlari.ts` (full CRUD for kesim alanları with nested donation/animal-group endpoints, bulk updates, move between projects, zod-validated); `src/routes/tags.ts` (custom tag CRUD, zod-validated); `src/routes/settings.ts` (logo management, zod-validated); `src/routes/backup.ts` (export/import with transactions, zod-validated); `src/routes/ai-notes.ts` (AI classification with OpenAI integration)
- Depends on: `@workspace/db`, `@workspace/api-zod`
- `pnpm --filter @workspace/api-server run dev` — run the dev server
- `pnpm --filter @workspace/api-server run build` — production esbuild bundle (`dist/index.cjs`)
- Build bundles an allowlist of deps (express, cors, pg, drizzle-orm, zod, etc.) and externalizes the rest

### `lib/db` (`@workspace/db`)

Database layer using Drizzle ORM with PostgreSQL. Exports a Drizzle client instance and schema models.

- `src/index.ts` — creates a `Pool` + Drizzle instance, exports schema
- `src/schema/index.ts` — table definitions with Drizzle-Zod insert schemas: `projectsTable`, `kesimAlanlariTable` (with `projectId` FK to projects, `trackingToken` for public tracking links), `donationsTable` (with `deletedAt` for soft-delete, `aiCategories` text JSON array, `aiWarnings` text for AI classification persistence), `animalGroupsTable` (with `kesildi` boolean for slaughter tracking), `animalGroupDonationsTable`, `customTagsTable`, `donationTagsTable`, `donationTransfersTable` (cross-KA transfer audit log), `appSettingsTable`
- `drizzle/` — generated migration files
- `drizzle.config.ts` — Drizzle Kit config (requires `DATABASE_URL`, automatically provided by Replit)
- Exports: `.` (pool, db, schema), `./schema` (schema only)

Production migrations are handled by Replit when publishing. In development, we just use `pnpm --filter @workspace/db run push`, and we fallback to `pnpm --filter @workspace/db run push-force`.

### `lib/api-spec` (`@workspace/api-spec`)

Owns the OpenAPI 3.1 spec (`openapi.yaml`) and the Orval config (`orval.config.ts`). Running codegen produces output into two sibling packages:

1. `lib/api-client-react/src/generated/` — React Query hooks + fetch client
2. `lib/api-zod/src/generated/` — Zod schemas

Run codegen: `pnpm --filter @workspace/api-spec run codegen`

### `lib/api-zod` (`@workspace/api-zod`)

Generated Zod schemas from the OpenAPI spec (e.g. `HealthCheckResponse`). Used by `api-server` for response validation.

### `lib/api-client-react` (`@workspace/api-client-react`)

Generated React Query hooks and fetch client from the OpenAPI spec (e.g. `useHealthCheck`, `healthCheck`).

### `scripts` (`@workspace/scripts`)

Utility scripts package. Each script is a `.ts` file in `src/` with a corresponding npm script in `package.json`. Run scripts via `pnpm --filter @workspace/scripts run <script>`. Scripts can import any workspace package (e.g., `@workspace/db`) by adding it as a dependency in `scripts/package.json`.
