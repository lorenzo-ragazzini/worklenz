#!/usr/bin/env bash

# optional: fix permissions if needed
set -euo pipefail
sudo chown -R postgres worklenz-backend/database/sql

sudo -u postgres psql -v ON_ERROR_STOP=1 <<'PSQL'
SELECT pg_terminate_backend(pid) FROM pg_stat_activity WHERE datname='worklenz_db' AND pid<>pg_backend_pid();
DROP DATABASE IF EXISTS worklenz_db;
CREATE DATABASE worklenz_db;

DO $$
BEGIN
   IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname='worklenz_user') THEN
      CREATE ROLE worklenz_user WITH LOGIN PASSWORD 'worklenz';
   ELSE
      ALTER ROLE worklenz_user WITH LOGIN PASSWORD 'worklenz';
   END IF;
END
$$;

GRANT ALL PRIVILEGES ON DATABASE worklenz_db TO worklenz_user;

\c worklenz_db

GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA public TO worklenz_user;
GRANT ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA public TO worklenz_user;
GRANT ALL PRIVILEGES ON ALL FUNCTIONS IN SCHEMA public TO worklenz_user;

ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL PRIVILEGES ON TABLES TO worklenz_user;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL PRIVILEGES ON SEQUENCES TO worklenz_user;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT EXECUTE ON FUNCTIONS TO worklenz_user;

\dt
\du worklenz_user
PSQL

BASEDIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
SQL_DIR="${BASEDIR}/worklenz-backend/database/sql"
DB="worklenz_db"
HOST="localhost"
FILES=(0_extensions.sql 1_tables.sql indexes.sql 4_functions.sql triggers.sql 3_views.sql 2_dml.sql 5_database_user.sql)

for f in "${FILES[@]}"; do
  if [ ! -f "${SQL_DIR}/${f}" ]; then
    echo "Missing ${SQL_DIR}/${f}" >&2
    exit 1
  fi
done

echo "You may be prompted for your sudo password once..."
sudo -v

# Build and run all psql invocations under a single sudo call (one password prompt)
cmds=""
for f in "${FILES[@]}"; do
  cmds+="psql -d \"${DB}\" -f \"${SQL_DIR}/${f}\" || exit \$?; "
done

sudo -u postgres bash -c "set -e; ${cmds}"
sudo chown -R lorenzo worklenz-backend/database/sql