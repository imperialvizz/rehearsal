#!/usr/bin/env bash
# Build a practice world from one catalog application and evaluate a starter agent on it.
#
#   scripts/run-world.sh            # Vikunja, the default (the lightest application)
#   scripts/run-world.sh kanboard   # any name from: rehearsal apps list, or the table in SETUP.md
#
# Needs scripts/setup.sh done, a model key in .env, and `rehearsal serve` and `rehearsal worker` running.
# A first build takes 1 to 3 hours and spends model budget on your keys; the evaluation spends some more.
# A world that is already built is reused.
set -euo pipefail
cd "$(dirname "$0")/.."

die() { printf '\nrun-world: %s\n' "$*" >&2; exit 1; }

APP="${1:-vikunja}"
if [ -d .venv/bin ]; then BIN=.venv/bin; else BIN=.venv/Scripts; fi
RH="$BIN/rehearsal"
VPY="$BIN/python"
[ -x "$VPY" ] || [ -x "$VPY.exe" ] || die "run scripts/setup.sh first"
# Reads JSON on stdin and writes one Python expression of it (d) with no newline, so Windows adds no \r.
pick() { "$VPY" -c "import json, sys; d = json.load(sys.stdin); sys.stdout.write(str($1))"; }

URL=$("$VPY" -c 'import sys; from rehearsal.config import settings; sys.stdout.write(settings().public_url)')
curl -sf "$URL/v1/health" >/dev/null || die "no server at $URL. Start '$RH serve' and '$RH worker' in two terminals first."
grep -qE '^MODEL_API_KEY=.+' .env ||
  die "put MODEL_API_KEY (from https://dev.meta.ai) in .env, then restart '$RH worker'"

"$RH" apps import-catalog >/dev/null
APP_ID=$("$RH" apps list | pick "next((a['id'] for a in d if a['name'] == '$APP'), '')")
[ -n "$APP_ID" ] || die "no application named '$APP'. Names: $("$RH" apps list | pick "', '.join(a['name'] for a in d)")"

published() {
  "$RH" worlds list | pick "next((v['id'] for w in d if w['application_id'] == '$APP_ID' for v in reversed(w['versions']) if v['status'] == 'published'), '')"
}
WV=$(published)

if [ -n "$WV" ]; then
  echo "Reusing the published world of $APP: $WV"
  read -r -p "Evaluate a starter agent on it? This spends model budget. [y/N] " ok
else
  echo "No world of $APP yet. Building one takes 1 to 3 hours and spends model budget; the evaluation after it spends more."
  read -r -p "Build the world and evaluate a starter agent? [y/N] " ok
fi
case "$ok" in y|Y|yes) ;; *) echo "Nothing started."; exit 0 ;; esac

if [ -z "$WV" ]; then
  "$RH" build "$APP_ID" --watch
  WV=$(published)
  [ -n "$WV" ] || die "the build ended without a published world. Read the worker's terminal, and '$RH worlds list'."
  echo "Published world: $WV"
fi

PROFILE=$("$RH" profiles create starter-agent | pick "d['id']")
echo "Agent profile: $PROFILE"
"$RH" eval "$WV" --profile "$PROFILE" --split dev --watch

cat <<EOF

Done. Open $URL to read the run: each episode's actions, messages, and which checks failed.
Next steps:
  $RH runs episode EPISODE_ID                         # one episode, from the terminal
  $RH factory $WV --name support-agent --watch        # let Rehearsal write and prove an agent for this world
EOF
