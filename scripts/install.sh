#!/usr/bin/env bash
# Installs the dsh-file-upload plugin into a DeepSeek Harness web profile.
#
# Usage (run from this release folder):
#   ./install.sh
#   DSH_HOME=/path/to/.dsh ./install.sh
#
# Idempotent: re-running repairs the package copy and never duplicates the
# patch row. Restart the Web GUI afterward (or refresh the browser tab).
set -euo pipefail

HERE="$(cd "$(dirname "$0")" && pwd)"
DSH_HOME="${DSH_HOME:-$HOME/.dsh}"
PROFILE_DIR="$DSH_HOME/profiles"
SCOPED="$PROFILE_DIR/node_modules/@deepseek-ai"
TARGET="$SCOPED/dsh-file-upload"
SRC="$HERE/plugin/dsh-file-upload"

echo "DSH home : $DSH_HOME"
echo "Target   : $TARGET"

if [ ! -f "$SRC/package.json" ]; then
	echo "ERROR: plugin source not found at $SRC — keep the whole release folder together." >&2
	exit 1
fi

# 1) Copy the plugin package into the profile's node_modules (real directory so
#    the host resolver finds it without any npm/pnpm install).
mkdir -p "$SCOPED"
rm -rf "$TARGET"
mkdir -p "$TARGET"
cp -R "$SRC"/. "$TARGET"/
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
