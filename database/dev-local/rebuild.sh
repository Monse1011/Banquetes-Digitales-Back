#!/usr/bin/env bash
# Uso: rebuild.sh <nombre_bd>   Recrea la BD en el contenedor banquetes-db aplicando migraciones + parches.
set -u
DB="${1:-banquetes_db}"
HERE="$(cd "$(dirname "$0")" && pwd)"
BACK="${BACK_DIR:-$(cd "$HERE/../.." && pwd)}"
PSQL=(docker exec -i banquetes-db psql -q -U banquetes -v ON_ERROR_STOP=1)
docker exec banquetes-db psql -q -U banquetes -d postgres -c "DROP DATABASE IF EXISTS $DB WITH (FORCE)" -c "CREATE DATABASE $DB" || exit 1
FILES=(
  "$BACK/database.sql"
  "$BACK/database/increment-2/assignment.sql"
  "$BACK/database/increment-2/assigned-resources.sql"
  "$BACK/database/increment-2/audit-logs.sql"
  "$BACK/database/increment-2/derived-information.sql"
  "$BACK/database/increment-2/proposals.sql"
  "$BACK/database/increment-3/00-align-schema-dad-v3.sql"
  "$BACK/database/increment-3/01-reservation-request-status-v3.sql"
  "$BACK/database/increment-3/02-proposals-v3.sql"
  "$BACK/database/increment-3/03-derived-information-v3.sql"
  "$BACK/database/increment-3/04-proposal-resources.sql"
  "$BACK/database/increment-3/05-proposal-adjustments.sql"
  "$HERE/05b-pre-status-history.sql"
  "$BACK/database/increment-3/06-request-status-history.sql"
  "$BACK/database/increment-3/07-event-closure.sql"
  "$BACK/database/increment-3/08-widen-status-columns.sql"
  "$HERE/10-dev-compat.sql"
)
[ -f "$HERE/20-seed.sql" ] && [ "${SEED:-1}" = "1" ] && FILES+=("$HERE/20-seed.sql")
for f in "${FILES[@]}"; do
  out=$("${PSQL[@]}" -d "$DB" < "$f" 2>&1 | grep -v "^NOTICE\|^DETAIL:  drop\|^$")
  if echo "$out" | grep -q "ERROR"; then echo "FAILED: $f"; echo "$out" | head -8; exit 1; fi
done
echo "OK: $DB"
