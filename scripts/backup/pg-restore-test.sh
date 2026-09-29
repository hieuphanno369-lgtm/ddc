#!/bin/sh
# P5-B Task 5 - thu khoi phuc that vao 1 DB TAM (khong bao gio dung/xoa DB nguon PGDATABASE).
# Doi so 1 (tuy chon): file .dump; khong co thi lay file ${PGDATABASE}_*.dump moi nhat trong
# BACKUP_DIR. Can quyen CREATEDB voi PGUSER.
set -eu
umask 077

: "${PGHOST:?PGHOST bat buoc}"
: "${PGPORT:?PGPORT bat buoc}"
: "${PGUSER:?PGUSER bat buoc}"
: "${PGPASSWORD:?PGPASSWORD bat buoc}"
: "${PGDATABASE:?PGDATABASE bat buoc}"

BACKUP_DIR="${BACKUP_DIR:-/backups}"
KEEP_RESTORE_DB="${KEEP_RESTORE_DB:-0}"
ALLOW_EMPTY="${ALLOW_EMPTY:-0}"

log() {
  ts=$(date -u +%Y-%m-%dT%H:%M:%SZ)
  printf '{"ts":"%s","event":"%s"%s}\n' "$ts" "$1" "${2:-}"
}

fail() {
  ts=$(date -u +%Y-%m-%dT%H:%M:%SZ)
  printf '{"ts":"%s","event":"restore_test.failed","reason":"%s"}\n' "$ts" "$1" >&2
  exit 1
}

FILE="${1:-}"
if [ -z "$FILE" ]; then
  FILE=$(ls -t "$BACKUP_DIR"/"${PGDATABASE}"_*.dump 2>/dev/null | head -n1 || true)
fi
if [ -z "$FILE" ] || [ ! -f "$FILE" ]; then
  echo "khong tim thay file backup de khoi phuc" >&2
  exit 2
fi

SHA_FILE="${FILE}.sha256"
if [ -f "$SHA_FILE" ]; then
  DIR=$(dirname "$FILE")
  SHA_NAME=$(basename "$SHA_FILE")
  if ! (cd "$DIR" && sha256sum -c "$SHA_NAME" > /dev/null 2>&1); then
    echo "sha256 khong khop: $FILE" >&2
    exit 4
  fi
fi

RESTORE_DB="${PGDATABASE}_restore_test_$(date -u +%Y%m%d%H%M%S)"
case "$RESTORE_DB" in
  *_restore_test_*) : ;;
  *)
    echo "ten DB tam khong hop le (thieu _restore_test_)" >&2
    exit 5
    ;;
esac
if [ "$RESTORE_DB" = "$PGDATABASE" ]; then
  echo "ten DB tam trung DB nguon - dung lai" >&2
  exit 5
fi

cleanup() {
  if [ "$KEEP_RESTORE_DB" != "1" ]; then
    dropdb --if-exists --force "$RESTORE_DB" > /dev/null 2>&1 || true
  fi
}
trap cleanup EXIT

createdb "$RESTORE_DB"
pg_restore --no-owner --no-privileges --exit-on-error --single-transaction -d "$RESTORE_DB" "$FILE"

MIGRATIONS_DONE=$(psql -v ON_ERROR_STOP=1 -tAc \
  "select count(*) from _prisma_migrations where finished_at is not null and rolled_back_at is null" \
  -d "$RESTORE_DB") || fail "migrations_query"
MIGRATIONS_PENDING=$(psql -v ON_ERROR_STOP=1 -tAc \
  "select count(*) from _prisma_migrations where finished_at is null and rolled_back_at is null" \
  -d "$RESTORE_DB") || fail "migrations_query"
[ "${MIGRATIONS_DONE:-0}" -ge 1 ] || fail "no_finished_migrations"
[ "${MIGRATIONS_PENDING:-0}" -eq 0 ] || fail "pending_migrations"

TABLES_DB=$(psql -v ON_ERROR_STOP=1 -tAc \
  "select count(*) from information_schema.tables where table_schema='public' and table_type='BASE TABLE'" \
  -d "$RESTORE_DB") || fail "tables_query"
TABLES_DUMP=$(pg_restore --list "$FILE" | grep -Ec '^[0-9]+; [0-9]+ [0-9]+ TABLE public ') || fail "tables_list"
[ "$TABLES_DB" = "$TABLES_DUMP" ] || fail "table_count_mismatch"

TABLE_NAMES=$(psql -v ON_ERROR_STOP=1 -tAc \
  "select table_name from information_schema.tables where table_schema='public' and table_type='BASE TABLE' order by table_name" \
  -d "$RESTORE_DB") || fail "table_names_query"

echo "bang  so_dong_tam  so_dong_nguon"
TOTAL_ROWS=0
OLD_IFS=$IFS
IFS='
'
for t in $TABLE_NAMES; do
  [ -z "$t" ] && continue
  cnt_tam=$(psql -v ON_ERROR_STOP=1 -tAc "select count(*) from \"$t\"" -d "$RESTORE_DB") || fail "row_count_tam"
  cnt_nguon=$(psql -tAc "select count(*) from \"$t\"" -d "$PGDATABASE" 2>/dev/null || echo "?")
  TOTAL_ROWS=$((TOTAL_ROWS + cnt_tam))
  printf '%s  %s  %s\n' "$t" "$cnt_tam" "$cnt_nguon"
done
IFS=$OLD_IFS

if [ "$ALLOW_EMPTY" != "1" ] && [ "$TOTAL_ROWS" -le 0 ]; then
  fail "empty_restore"
fi

log restore_test.ok ",\"file\":\"$FILE\",\"tables\":$TABLES_DB,\"rows\":$TOTAL_ROWS"
