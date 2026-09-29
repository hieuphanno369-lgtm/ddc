#!/bin/sh
# P5-B Task 5 - pg_dump 1 lan/ngay (cron 02:00, docs/DEPLOY.md muc 10-11). Chay trong container
# postgres:16-alpine (busybox sh) HOAC Ubuntu that - chi dung POSIX sh, khong dung bashism.
# Doc bien ket noi CHUAN LIBPQ (PGHOST/PGPORT/PGUSER/PGPASSWORD/PGDATABASE) - KHONG nhan mat khau
# qua doi so dong lenh, khong bao gio in gia tri bi mat/URL ket noi ra log.
set -eu
umask 077

: "${PGHOST:?PGHOST bat buoc}"
: "${PGPORT:?PGPORT bat buoc}"
: "${PGUSER:?PGUSER bat buoc}"
: "${PGPASSWORD:?PGPASSWORD bat buoc}"
: "${PGDATABASE:?PGDATABASE bat buoc}"

BACKUP_DIR="${BACKUP_DIR:-/backups}"
BACKUP_KEEP_DAYS="${BACKUP_KEEP_DAYS:-14}"

case "$BACKUP_KEEP_DAYS" in
  ''|*[!0-9]*)
    echo "BACKUP_KEEP_DAYS phai la so nguyen >= 1" >&2
    exit 2
    ;;
esac
if [ "$BACKUP_KEEP_DAYS" -lt 1 ]; then
  echo "BACKUP_KEEP_DAYS phai la so nguyen >= 1" >&2
  exit 2
fi

mkdir -p "$BACKUP_DIR"

log() {
  ts=$(date -u +%Y-%m-%dT%H:%M:%SZ)
  printf '{"ts":"%s","event":"%s"%s}\n' "$ts" "$1" "${2:-}"
}

log_err() {
  ts=$(date -u +%Y-%m-%dT%H:%M:%SZ)
  printf '{"ts":"%s","event":"%s"%s}\n' "$ts" "$1" "${2:-}" >&2
}

STAMP=$(date -u +%Y%m%dT%H%M%SZ)
NAME="${PGDATABASE}_${STAMP}.dump"
PARTIAL="$BACKUP_DIR/${NAME}.partial"
FINAL="$BACKUP_DIR/${NAME}"
LOCK_DIR="$BACKUP_DIR/.lock"

cleanup() {
  rm -f "$PARTIAL"
  rmdir "$LOCK_DIR" 2>/dev/null || true
}
trap cleanup EXIT

if ! mkdir "$LOCK_DIR" 2>/dev/null; then
  log_err backup.failed ',"reason":"lock_busy"'
  exit 3
fi

log backup.start ",\"file\":\"$NAME\""

pg_dump --format=custom --no-owner --no-privileges --file="$PARTIAL"

if ! pg_restore --list "$PARTIAL" > /dev/null; then
  log_err backup.failed ',"reason":"corrupt_dump"'
  exit 1
fi

mv "$PARTIAL" "$FINAL"
BYTES=$(wc -c < "$FINAL" | tr -d ' ')
(cd "$BACKUP_DIR" && sha256sum "$NAME" > "${NAME}.sha256")

find "$BACKUP_DIR" -maxdepth 1 -name "${PGDATABASE}_*.dump*" -mtime "+$BACKUP_KEEP_DAYS" -delete

log backup.done ",\"file\":\"$NAME\",\"bytes\":$BYTES"
