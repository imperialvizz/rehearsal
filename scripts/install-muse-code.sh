#!/usr/bin/env bash
# Add Rehearsal to Meta's Muse Code: the Rehearsal skill, and the Rehearsal MCP server from this clone.
#
#   bash scripts/install-muse-code.sh
#
# Needs scripts/setup.sh done (it installs Rehearsal in .venv and signs this machine in) and Muse Code's `muse`
# command. The MCP server runs this clone's `rehearsal mcp`, so Muse Code reaches your local server with the saved
# sign-in. Run it again after you move the clone. Your Muse Code settings are copied to settings.json.bak first.
set -euo pipefail
cd "$(dirname "$0")/.."

die() { printf '\ninstall-muse-code: %s\n' "$*" >&2; exit 1; }

if [ -d .venv/bin ]; then BIN=.venv/bin; else BIN=.venv/Scripts; fi
VPY="$BIN/python"
[ -x "$VPY" ] || [ -x "$VPY.exe" ] || die "run scripts/setup.sh first"
command -v muse >/dev/null 2>&1 || die "install Muse Code first, so that the muse command is on your PATH"
SETTINGS="${MUSE_SETTINGS:-$HOME/.config/muse/settings.json}"

if ! "$VPY" -c 'import mcp' 2>/dev/null; then
  printf '==> Installing the MCP server package\n'
  "$VPY" -m pip install --quiet 'mcp>=1.9,<2'  # the version range of rehearsal-kit's mcp extra
fi

printf '==> Installing the Rehearsal skill\n'
muse skills install agent-plugin/providers/muse-code/skills/rehearsal --scope user

printf '==> Adding the Rehearsal MCP server to %s\n' "$SETTINGS"
"$VPY" - "$SETTINGS" "$BIN" <<'PY'
import json
import shutil
import sys
from pathlib import Path

path, bin_dir = Path(sys.argv[1]), Path(sys.argv[2]).resolve()
command = next((str(p) for p in (bin_dir / "rehearsal.exe", bin_dir / "rehearsal") if p.exists()), None)
if command is None:
    sys.exit(f"no rehearsal command in {bin_dir}: run scripts/setup.sh first")
settings = {"schema_version": 1}
if path.is_file():
    settings = json.loads(path.read_text(encoding="utf-8") or "{}")
    shutil.copyfile(path, path.with_name(path.name + ".bak"))
# "optional": Muse Code warns, and does not stop a session, when the server cannot start
settings.setdefault("mcp_servers", {})["rehearsal"] = {"transport": "stdio", "command": command, "args": ["mcp"], "mode": "optional"}
path.parent.mkdir(parents=True, exist_ok=True)
path.write_text(json.dumps(settings, indent=4) + "\n", encoding="utf-8")
print(f"rehearsal -> {command} mcp")
PY

cat <<'EOF'

Done. Start a new Muse Code session and ask: "Show my Rehearsal workspace status."
Keep `rehearsal serve` running: the tools call it with this machine's saved sign-in.
EOF
