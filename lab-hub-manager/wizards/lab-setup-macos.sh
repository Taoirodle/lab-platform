#!/bin/sh
# ============================================================
#  L.A.B — Setup Wizard (macOS)
#  Signs you in, reads how you use this Mac, sends the report to your L.A.B
#  agents, shows your personalization. Reads app names + file-type counts +
#  specs only — never file contents; nothing leaves your home network.
#  Run:  curl -fsSL http://192.168.1.115:8090/app/wizard/mac -o lab-setup.sh && sh lab-setup.sh
# ============================================================
SERVER="${LAB_SERVER:-http://192.168.1.115:8090}"
printf "\n  ┌─ L.A.B SETUP (macOS) ─┐\n  │  Your home, handled.  │\n  └───────────────────────┘\n\n"

printf "  Have an account? (y=sign in / n=create): "; read MODE
printf "  Your name: "; read NAME
printf "  PIN (4-8 digits): "; read PIN
PATH_EP="/api/accounts"; [ "$MODE" = "y" ] && PATH_EP="/api/accounts/login"
ACCT=$(curl -s -X POST "$SERVER$PATH_EP" -H 'Content-Type: application/json' -d "{\"name\":\"$NAME\",\"pin\":\"$PIN\"}")
AID=$(printf '%s' "$ACCT" | sed -n 's/.*"id":"\{0,1\}\([0-9]*\)"\{0,1\}.*/\1/p')
[ -z "$AID" ] && { echo "  ✗ sign-in failed: $ACCT"; exit 1; }
echo "  ✓ Signed in (account $AID)"

echo "  Reading how you use this Mac..."
APPS=$(ls /Applications 2>/dev/null | sed 's/\.app$//' | head -120 | sed 's/"/\\"/g' | awk '{printf "\"%s\",",$0}' | sed 's/,$//')
TYPES=$(find "$HOME/Documents" "$HOME/Downloads" "$HOME/Desktop" "$HOME/Pictures" -type f 2>/dev/null | sed -n 's/.*\.\([A-Za-z0-9]*\)$/\1/p' | tr 'A-Z' 'a-z' | sort | uniq -c | sort -rn | head -15 | awk '{printf "{\"ext\":\".%s\",\"count\":%s},",$2,$1}' | sed 's/,$//')
CPU=$(sysctl -n machdep.cpu.brand_string 2>/dev/null)
RAM=$(( $(sysctl -n hw.memsize 2>/dev/null) / 1073741824 ))
HOST=$(scutil --get ComputerName 2>/dev/null || hostname)

REPORT="{\"os\":\"macOS\",\"hostname\":\"$HOST\",\"specs\":{\"cpu\":\"$CPU\",\"ramGB\":$RAM},\"apps\":[$APPS],\"fileTypes\":[$TYPES]}"
echo "  Sending to your L.A.B agents..."
RES=$(curl -s -X POST "$SERVER/api/wizard/profile" -H 'Content-Type: application/json' -d "{\"account_id\":$AID,\"report\":$REPORT}")
echo "  ── YOUR PERSONALIZED L.A.B ──"
printf '%s\n' "$RES" | sed -n 's/.*"archetype":"\([^"]*\)".*/  Archetype : \1/p'
printf '%s\n' "$RES" | sed -n 's/.*"report":"\([^"]*\)".*/\n  \1\n/p'
# leave a note for the app: read on first launch → personalised + signed in immediately
PID=$(printf '%s' "$RES" | sed -n 's/.*"id":"\([^"]*\)".*/\1/p'); SAFE=$(printf '%s' "$NAME" | sed 's/"/\\"/g')
mkdir -p "$HOME/Library/Application Support/LAB" && printf '{"id":"%s","account_id":%s,"account_name":"%s","server":"%s"}\n' "$PID" "$AID" "$SAFE" "$SERVER" > "$HOME/Library/Application Support/LAB/profile.json"

echo "  Checking for your app build..."
if curl -fsSL "$SERVER/app/download/mac?arch=$(uname -m)" -o "$HOME/Downloads/L.A.B-Hub.dmg" 2>/dev/null; then
  echo "  ✓ Downloaded to ~/Downloads/L.A.B-Hub.dmg — open it and drag L.A.B Hub to Applications."
  printf "  Open it now? [Y/n] "; read GO; case "$GO" in n|N) ;; *) open "$HOME/Downloads/L.A.B-Hub.dmg" ;; esac
else
  echo "  · The native macOS build isn't published yet. Your profile is saved for when it lands."
fi
printf "\n  Done. Welcome to the L.A.B.\n\n"
