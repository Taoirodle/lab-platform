#!/usr/bin/env bash
# L.A.B — nightly Postgres backup. Runs on lab-main-01 from cron:
#   17 3 * * * /srv/lab/scripts/backup-db.sh >> /srv/lab/backups/backup.log 2>&1
# Keeps the last $LAB_BACKUP_KEEP dumps (default 14). Restore with restore-db.sh.
set -euo pipefail
DIR=${LAB_BACKUP_DIR:-/srv/lab/backups}
KEEP=${LAB_BACKUP_KEEP:-14}
mkdir -p "$DIR"
OUT="$DIR/labbrain-$(date +%Y-%m-%d).sql.gz"
sudo docker exec lab-postgres pg_dump -U lab -d labbrain --no-owner | gzip -9 > "$OUT.part"
mv "$OUT.part" "$OUT"
ls -1t "$DIR"/labbrain-*.sql.gz | tail -n +$((KEEP + 1)) | xargs -r rm -f
echo "$(date -Iseconds) backup: $OUT ($(du -h "$OUT" | cut -f1))"
