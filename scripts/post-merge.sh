#!/bin/bash
set -e
pnpm install --frozen-lockfile
pnpm --filter db push

echo "Ensuring materialized view exists..."
psql "$DATABASE_URL" -f lib/db/drizzle/0007_project_stats_materialized_view.sql
echo "Materialized view ensured."
