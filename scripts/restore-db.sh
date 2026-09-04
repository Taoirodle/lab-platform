#!/usr/bin/env bash
# L.A.B — restore a backup into a fresh database and swap it in.
#   /srv/lab/scripts/restore-db.sh /srv/lab/backups/labbrain-2026-09-04.sql.gz
# The manager is stopped for the swap; the previous database is kept as labbrain_old_<epoch>.
set -euo pipefail
F=${1:?usage: restore-db.sh /srv/lab/backups/labbrain-YYYY-MM-DD.sql.gz}
[ -f "$F" ] || { echo "no such file: $F"; exit 1; }
sudo systemctl stop lab-manager
sudo docker exec lab-postgres psql -U lab -d postgres -q -c "DROP DATABASE IF EXISTS labbrain_restore;" -c "CREATE DATABASE labbrain_restore OWNER lab;"
gunzip -c "$F" | sudo docker exec -i lab-postgres psql -U lab -d labbrain_restore -q
sudo docker exec lab-postgres psql -U lab -d postgres -q -c "ALTER DATABASE labbrain RENAME TO labbrain_old_$(date +%s);" -c "ALTER DATABASE labbrain_restore RENAME TO labbrain;"
sudo systemctl start lab-manager
echo "restored from $F — previous database kept as labbrain_old_*"
