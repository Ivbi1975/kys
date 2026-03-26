#!/bin/bash
set -e

if [ -z "$DATABASE_URL" ]; then
  echo "ERROR: DATABASE_URL is not set. Cannot run post-merge setup."
  exit 1
fi

pnpm install --frozen-lockfile
pnpm --filter db push

if command -v psql &> /dev/null; then
  echo "Ensuring materialized view exists..."
  psql "$DATABASE_URL" -f lib/db/drizzle/0007_project_stats_materialized_view.sql
  echo "Materialized view ensured."
else
  echo "WARNING: psql not found. Skipping materialized view check."
  echo "Run manually: psql \$DATABASE_URL -f lib/db/drizzle/0007_project_stats_materialized_view.sql"
fi
