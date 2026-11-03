#!/usr/bin/env bash
# One-time setup of Rehearsal on this machine: the Python environment, .env, the console, the local
# database and your admin sign-in. Run it again at any time: each step is skipped when it is already done.
#
#   scripts/setup.sh                      # set everything up
#   scripts/setup.sh you@example.com      # also create your console login (asks for a password)
#
# Needs Python 3.11-3.13, Docker (running), and Node 22+ with pnpm for the one-time console build.
# On Windows, run it from Git Bash or inside WSL 2. See SETUP.md.
set -euo pipefail
cd "$(dirname "$0")/.."

say() { printf '\n==> %s\n' "$*"; }
die() { printf '\nsetup: %s\n' "$*" >&2; exit 1; }

say "Checking the tools"
PY=""
for c in python3.13 python3.12 python3.11 python3 python py; do
  if command -v "$c" >/dev/null 2>&1 && "$c" -c 'import sys; sys.exit(not (3, 11) <= sys.version_info[:2] <= (3, 13))' 2>/dev/null; then
    PY="$c"; break
  fi
done
[ -n "$PY" ] || die "install Python 3.11, 3.12 or 3.13, then run this again"
command -v docker >/dev/null 2>&1 || die "install Docker (Docker Desktop on Windows and macOS), then run this again"
docker info >/dev/null 2>&1 || die "Docker is installed but not running: start it, then run this again"
echo "Python: $("$PY" --version 2>&1), Docker: $(docker --version)"

if [ ! -d .venv ]; then
  say "Creating the Python environment in .venv"
  "$PY" -m venv .venv
fi
if [ -d .venv/bin ]; then BIN=.venv/bin; else BIN=.venv/Scripts; fi
VPY="$BIN/python"
if ! "$VPY" -c 'import rehearsal, fastapi, alembic, mcp' 2>/dev/null; then
  say "Installing Rehearsal and its server dependencies (a few minutes)"
  "$VPY" -m pip install --quiet --upgrade pip
  "$VPY" -m pip install --quiet -e './rehearsal/py[server,dev,mcp]'
fi

if [ ! -f .env ]; then
  say "Creating .env with a new session secret"
  secret=$("$VPY" -c 'import secrets, sys; sys.stdout.write(secrets.token_hex(32))')
  sed "s/^REHEARSAL_SESSION_SECRET=.*/REHEARSAL_SESSION_SECRET=$secret/" .env.example > .env
fi

if [ ! -f web/out/index.html ]; then
  command -v pnpm >/dev/null 2>&1 || die "install Node 22+ and pnpm (npm install -g pnpm), then run this again"
  say "Building the console (one time, a few minutes)"
  (cd web && pnpm install --frozen-lockfile && pnpm build)
fi

say "Starting the database (PostgreSQL in Docker on 127.0.0.1:5433) and migrating it"
"$BIN/rehearsal" up

say "Signing this machine in as the workspace admin"
# Reuses the saved key while the database still accepts it; otherwise creates a workspace and an admin key.
# The key goes straight to ~/.config/rehearsal/config.json and is never printed.
PROJECT=$("$VPY" - <<'PY'
import sys
from rehearsal.api.auth import bootstrap, verify_key
from rehearsal.config import settings
from rehearsal.sdk.client import save_login, saved_login

url, login = settings().public_url, saved_login()
principal = verify_key(login.get("api_key", "")) if login.get("url") == url else None
if principal is None:
    if login.get("url") and login.get("url") != url:
        print(f"Replacing this machine's saved sign-in for {login['url']}", file=sys.stderr)
    project_id, key = bootstrap()
    save_login(url, key)
else:
    project_id = principal.project_id
sys.stdout.write(project_id)
PY
)
echo "Workspace project: $PROJECT"

if [ -n "${1:-}" ]; then
  say "Creating the console login $1"
  "$BIN/rehearsal" users add "$1" --project "$PROJECT"
fi

if ! grep -qE '^MODEL_API_KEY=.+' .env; then
  printf '\nNext: put your Meta Model API key (from https://dev.meta.ai) in .env as MODEL_API_KEY=...\n'
fi
case "$(uname -s)" in
  MINGW*|MSYS*|CYGWIN*)
    printf '\nOn Windows: world builds fetch deep source trees. Run once: git config --global core.longpaths true\n'
    printf 'WSL 2 is the tested way to run workers on Windows; see SETUP.md.\n' ;;
esac

cat <<EOF

Setup done. Start Rehearsal in two terminals, from this folder:

  $BIN/rehearsal serve      # API and console on http://localhost:7800
  $BIN/rehearsal worker     # builds and evaluations

Then build a world and evaluate an agent on it:  scripts/run-world.sh vikunja
The docs site:  cd docs && pnpm install --frozen-lockfile && pnpm dev   # http://localhost:7801
EOF
[ -n "${1:-}" ] || echo "Console login for the browser:  scripts/setup.sh you@example.com"
