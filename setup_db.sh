#!/usr/bin/env bash

# optional: fix permissions if needed
# sudo chown -R postgres worklenz-backend/database/sql
set -euo pipefail

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
  cmds+="psql -d '${DB}' -h '${HOST}' -f '${SQL_DIR}/${f}' || exit \$?; "
done

sudo -u postgres bash -c "set -e; ${cmds}"