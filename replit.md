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
- Dark theme support (toggle in header)
- Excel export for donor lists and kesim kağıdı format
- Statistics dashboard (active donors, total shares, required animals, empty slots)
- JSON backup/restore for all data
- Print A4 landscape pages matching Excel "Kesim Kağıdı" format with columns: HAYVAN (merged vertically), SIRA, VEKALET, VEKALETİ VEREN, ADINA KESİLEN, CİNSİ, NOTLAR
- Data persisted in localStorage with backward-compatible migration

Data model (Donation):
- `id`, `name` (adına kesilen), `description` (vekaleti veren), `donationType` (cinsi), `shareCount`, `vekalet` (vekalet no), `notes` (notlar), `excluded?`, `tags?`

Data model (AnimalGroup):
- `id`, `animalNo`, `donations[]`, `colorTag?` (green/orange/red), `locked?`, `notes?`

Key files:
- `src/lib/types.ts` - TypeScript types (Donation, AnimalGroup, KesimAlani, ColorTag)
- `src/lib/storage.ts` - localStorage persistence with data migration, backup/restore
- `src/lib/grouping.ts` - Auto-grouping algorithm (bin-packing, name-based effective shares)
- `src/lib/useHistory.ts` - Snapshot-based undo/redo hook (80 steps, structuredClone)
- `src/lib/useTheme.ts` - Dark theme toggle hook
- `src/pages/home.tsx` - Home page with kesim alanı list, settings (logo, backup)
- `src/pages/kesim-alani.tsx` - Main editing page with donor table, animal groups, stats, export
- `src/pages/print.tsx` - Print-optimized A4 landscape view matching Excel design

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
- App setup: `src/app.ts` — mounts CORS, JSON/urlencoded parsing, routes at `/api`
- Routes: `src/routes/index.ts` mounts sub-routers; `src/routes/health.ts` exposes `GET /health` (full path: `/api/health`)
- Depends on: `@workspace/db`, `@workspace/api-zod`
- `pnpm --filter @workspace/api-server run dev` — run the dev server
- `pnpm --filter @workspace/api-server run build` — production esbuild bundle (`dist/index.cjs`)
- Build bundles an allowlist of deps (express, cors, pg, drizzle-orm, zod, etc.) and externalizes the rest

### `lib/db` (`@workspace/db`)

Database layer using Drizzle ORM with PostgreSQL. Exports a Drizzle client instance and schema models.

- `src/index.ts` — creates a `Pool` + Drizzle instance, exports schema
- `src/schema/index.ts` — barrel re-export of all models
- `src/schema/<modelname>.ts` — table definitions with `drizzle-zod` insert schemas (no models definitions exist right now)
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
