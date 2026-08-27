#!/usr/bin/env bash
# Installs the dsh-file-upload plugin into a DeepSeek Harness web profile.
# Works from either layout:
#   - the git checkout (this script lives in scripts/, the package root is ../)
#   - the release zip (this script sits at the zip root, package is plugin/dsh-file-upload)
#
# Usage:
#   ./scripts/install.sh            (from a git checkout)
#   ./install.sh                    (from an extracted release zip)
#   DSH_HOME=/path/to/.dsh ./scripts/install.sh
#
# Idempotent. Restart the Web GUI (or refresh the browser tab) afterward.
set -euo pipefail

HERE="$(cd "$(dirname "$0")" && pwd)"
DSH_HOME="${DSH_HOME:-$HOME/.dsh}"
PROFILE_DIR="$DSH_HOME/profiles"
SCOPED="$PROFILE_DIR/node_modules/@deepseek-ai"
TARGET="$SCOPED/dsh-file-upload"

# Locate the package root: the first directory containing package.json, in layout order.
# 1) release zip:  this script is at the zip root, package is plugin/dsh-file-upload
# 2) git checkout: this script is in scripts/, package root is the repo root (..)
# 3) fallback:     this script's own directory
find_src() {
	for cand in "$HERE/plugin/dsh-file-upload" "$(dirname "$HERE")" "$HERE"; do
		if [ -f "$cand/package.json" ]; then
			printf '%s' "$cand"
			return 0
		fi
	done
	return 1
}

if ! SRC="$(find_src)"; then
	echo "ERROR: plugin source not found — expected package.json next to or under this script." >&2
	exit 1
fi

echo "DSH home : $DSH_HOME"
echo "Source   : $SRC"
echo "Target   : $TARGET"

# 1) Copy the package files into the profile's node_modules (a real directory so
#    the host resolver finds it without any npm/pnpm install). Only the files the
#    plugin needs: package.json (with the dsh.client declaration) and lib/.
mkdir -p "$SCOPED"
rm -rf "$TARGET"
mkdir -p "$TARGET/lib"
cp -R "$SRC/package.json" "$TARGET/"
cp -R "$SRC/lib/." "$TARGET/lib/"
echo "[ok] Installed package into $TARGET"

# 2) Add the `file-upload` row to the web profile's patch layer.
append_row() {
	echo ""
	echo "# file-upload plugin"
	echo "- insert:"
	echo "    - id: file-upload"
	echo "      name: '@deepseek-ai/dsh-file-upload'"
}

PATCH="$PROFILE_DIR/web/cordis.patch.yml"
if [ -f "$PATCH" ]; then
	if grep -q "dsh-file-upload" "$PATCH"; then
		echo "[ok] file-upload row already present in $PATCH"
	else
		append_row >> "$PATCH"
		echo "[ok] Added file-upload row to $PATCH"
	fi
else
	echo "WARN: no web/cordis.patch.yml at $PATCH — start the web profile once with: dsh web" >&2
	echo "Then add the row below manually, or re-run this installer."
	append_row
fi

# 3) Next step.
echo ""
echo "Done. To apply it live:"
echo "  - If the web server is already running, reload the browser tab (http://127.0.0.1:3080)."
echo "  - Or restart it with: dsh web"
