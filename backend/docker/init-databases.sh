#!/usr/bin/env bash
set -euo pipefail

# This normally runs once when the PostgreSQL volume is first initialized.
# Keeping it idempotent also makes a manual rerun safe.
psql --username "$POSTGRES_USER" --dbname postgres <<'SQL'
SELECT 'CREATE DATABASE industrial_documents'
WHERE NOT EXISTS (
    SELECT FROM pg_database WHERE datname = 'industrial_documents'
)
\gexec

SELECT 'CREATE DATABASE industrial_knowledge'
WHERE NOT EXISTS (
    SELECT FROM pg_database WHERE datname = 'industrial_knowledge'
)
\gexec
SQL
