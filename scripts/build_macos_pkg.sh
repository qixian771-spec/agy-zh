#!/usr/bin/env bash
# ==============================================================================
#  🍎 Antigravity Native Chinese — Pure Apple Silicon (arm64) .pkg Builder
#  Builds `AGY-ZH-Mac-AppleSilicon.pkg` with `hostArchitectures="arm64"` so macOS
#  Sequoia / Tahoe NEVER triggers any Intel / Rosetta 2 deprecation prompt!
# ==============================================================================
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
VERSION="$(node -e "console.log(JSON.parse(require('fs').readFileSync('$ROOT_DIR/plugin.json','utf8')).version)")"
BUILD_TMP="$(mktemp -d)"
PAYLOAD_DIR="$BUILD_TMP/payload/Library/Application Support/AGY-ZH-Installer"
SCRIPTS_DIR="$BUILD_TMP/scripts"
OUT_DIR="${1:-$ROOT_DIR/dist}"

mkdir -p "$PAYLOAD_DIR" "$SCRIPTS_DIR" "$OUT_DIR"

rsync -a \
  --exclude='.git' \
  --exclude='.github' \
  --exclude='dist' \
  --exclude='node_modules' \
  --exclude='*.pkg' \
  --exclude='*.zip' \
  "$ROOT_DIR/" "$PAYLOAD_DIR/"

# Pre-compile pure arm64 Mach-O launcher if running on macOS
if [ "$(uname -s)" = "Darwin" ] && command -v clang >/dev/null 2>&1; then
  mkdir -p "$PAYLOAD_DIR/bin"
  clang -arch arm64 -O2 "$ROOT_DIR/native/macos/launcher.c" -o "$PAYLOAD_DIR/bin/Antigravity-ZH-arm64"
  chmod 755 "$PAYLOAD_DIR/bin/Antigravity-ZH-arm64"
  codesign --force --sign - "$PAYLOAD_DIR/bin/Antigravity-ZH-arm64" >/dev/null 2>&1 || true
fi

cat > "$SCRIPTS_DIR/postinstall" <<'POST'
#!/usr/bin/env bash
set -euo pipefail
CONSOLE_USER="$(stat -f '%Su' /dev/console 2>/dev/null || echo "${USER:-}")"
if [ -n "$CONSOLE_USER" ] && [ "$CONSOLE_USER" != "root" ]; then
  USER_HOME="$(dscl . -read "/Users/$CONSOLE_USER" NFSHomeDirectory 2>/dev/null | awk '{print $2}')"
  SRC="/Library/Application Support/AGY-ZH-Installer"
  if [ -d "$SRC" ] && [ -n "$USER_HOME" ]; then
    su - "$CONSOLE_USER" -c "bash \"$SRC/install_mac.command\""
    if [ -x "$SRC/bin/Antigravity-ZH-arm64" ] && [ -d "/Applications/Antigravity 中文版.app" ]; then
      cp -f "$SRC/bin/Antigravity-ZH-arm64" "/Applications/Antigravity 中文版.app/Contents/MacOS/Antigravity-ZH"
      chown -R "$CONSOLE_USER:staff" "/Applications/Antigravity 中文版.app" || true
      codesign --force --deep --sign - "/Applications/Antigravity 中文版.app" >/dev/null 2>&1 || true
    fi
  fi
fi
exit 0
POST
chmod 755 "$SCRIPTS_DIR/postinstall"

COMP_PKG="$BUILD_TMP/component.pkg"
DIST_XML="$BUILD_TMP/Distribution.xml"
FINAL_PKG="$OUT_DIR/AGY-ZH-Mac-AppleSilicon-v${VERSION}.pkg"

pkgbuild \
  --root "$BUILD_TMP/payload" \
  --scripts "$SCRIPTS_DIR" \
  --identifier "com.qixian.antigravity.zh.pkg" \
  --version "$VERSION" \
  --install-location "/" \
  "$COMP_PKG"

cat > "$DIST_XML" <<XML
<?xml version="1.0" encoding="utf-8"?>
<installer-gui-script minSpecVersion="2">
  <title>Antigravity 原生无损汉化版 (Apple Silicon M系列芯片专属 v${VERSION})</title>
  <options customize="never" require-scripts="true" hostArchitectures="arm64"/>
  <choices-outline>
    <line choice="default">
      <line choice="com.qixian.antigravity.zh.pkg"/>
    </line>
  </choices-outline>
  <choice id="default"/>
  <choice id="com.qixian.antigravity.zh.pkg" visible="false">
    <pkg-ref id="com.qixian.antigravity.zh.pkg"/>
  </choice>
  <pkg-ref id="com.qixian.antigravity.zh.pkg" version="${VERSION}" onConclusion="none">component.pkg</pkg-ref>
</installer-gui-script>
XML

productbuild \
  --distribution "$DIST_XML" \
  --package-path "$BUILD_TMP" \
  "$FINAL_PKG"

rm -rf "$BUILD_TMP"
echo "✅ Built pure Apple Silicon arm64 installer: $FINAL_PKG"
