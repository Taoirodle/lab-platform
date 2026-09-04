#!/usr/bin/env bash
# L.A.B — endpoint smoke test against a running manager.
#   scripts/smoke.sh                      # defaults to the LAN server
#   scripts/smoke.sh http://100.x.y.z:8090
S=${1:-http://192.168.1.115:8090}
pass=0; fail=0
chk() {
  local want=$1 method=$2 path=$3 data=${4:-} code
  if [ -n "$data" ]; then code=$(curl -s -m 20 -o /dev/null -w '%{http_code}' -X "$method" "$S$path" -H 'Content-Type: application/json' -d "$data")
  else code=$(curl -s -m 20 -o /dev/null -w '%{http_code}' -X "$method" "$S$path"); fi
  if [ "$code" = "$want" ]; then pass=$((pass + 1)); printf 'PASS %-6s %-44s %s\n' "$method" "$path" "$code"
  else fail=$((fail + 1)); printf 'FAIL %-6s %-44s %s (want %s)\n' "$method" "$path" "$code" "$want"; fi
}
chk 200 GET  /api/health
chk 200 GET  /api/identity
chk 200 GET  /api/app/targets
chk 200 GET  /api/app/version
chk 200 GET  /api/shared/todos
chk 200 GET  /api/shared/events
chk 200 GET  "/api/calendar/events?from=2026-01-01&to=2026-12-31"
chk 200 GET  /api/calendar/feeds
chk 200 GET  /api/calendar/family.ics
chk 200 GET  /api/family/stats
chk 200 GET  /api/store/apps
chk 200 GET  /api/hub/generations
chk 200 GET  /api/kiosk/rooms
chk 200 GET  /api/kiosk/summary
chk 200 GET  /api/conductor/entities
chk 200 GET  /api/conductor/scenes
chk 200 GET  /api/conductor/automations
chk 200 GET  /api/accounts
chk 200 GET  /api/generations
chk 200 GET  /api/usage/devices
chk 400 GET  /api/usage/summary
chk 400 POST /api/usage/ingest '{}'
chk 400 POST /api/calendar/feeds '{"url":"nope"}'
chk 401 POST /api/accounts/login '{"name":"nobody","pin":"0000"}'
chk 200 GET  /hub/
chk 200 GET  /kiosk/
chk 200 GET  /admin/
chk 200 GET  /
echo "$pass passed, $fail failed"
[ "$fail" -eq 0 ]
