#!/usr/bin/env bash
# Antigravity Native Chinese (qixian-agy-zh) — Zero-Dependency Pure arm64 Node Runner
# Automatically prefers native Apple Silicon (arm64) Node.js, or falls back to Antigravity's
# own built-in `Antigravity Helper` (`ELECTRON_RUN_AS_NODE=1`, LSUIElement=true, 0 Dock bounce!).
set -euo pipefail

export PATH="/opt/homebrew/bin:/usr/local/bin:/usr/bin:/bin:/usr/sbin:/sbin:${PATH:-}"

if [ "$(uname -s)" = "Darwin" ]; then
  IS_ARM64="$(/usr/sbin/sysctl -n hw.optional.arm64 2>/dev/null || echo 0)"

  # 1. Prefer Antigravity's built-in Helper binary as Node 22+ (guaranteed matching arch, 0 Dock icon, 0 external install!)
  for AGY_APP in "/Applications/Antigravity.app" "$HOME/Applications/Antigravity.app" "/Applications/Antigravity - Insiders.app"; do
    HELPER="$AGY_APP/Contents/Frameworks/Antigravity Helper.app/Contents/MacOS/Antigravity Helper"
    if [ -x "$HELPER" ]; then
      if [ "$IS_ARM64" = "1" ]; then
        ELECTRON_RUN_AS_NODE=1 exec /usr/bin/arch -arm64 "$HELPER" "$@"
      else
        ELECTRON_RUN_AS_NODE=1 exec "$HELPER" "$@"
      fi
    fi
  done

  # 2. Fallback to system Node.js (enforcing arm64 on Apple Silicon)
  for CAND in /opt/homebrew/bin/node /usr/local/bin/node "$(command -v node 2>/dev/null || true)"; do
    if [ -n "$CAND" ] && [ -x "$CAND" ]; then
      if [ "$IS_ARM64" = "1" ]; then
        if /usr/bin/arch -arm64 "$CAND" -e "process.exit(0)" >/dev/null 2>&1; then
          exec /usr/bin/arch -arm64 "$CAND" "$@"
        fi
      else
        exec "$CAND" "$@"
      fi
    fi
  done
fi

# Linux / generic POSIX
if command -v node >/dev/null 2>&1; then
  exec node "$@"
fi

for LINUX_BIN in "/opt/Antigravity/antigravity" "/usr/share/antigravity/antigravity" "$HOME/.local/share/Antigravity/antigravity"; do
  if [ -x "$LINUX_BIN" ]; then
    ELECTRON_RUN_AS_NODE=1 exec "$LINUX_BIN" "$@"
  fi
done

echo "[AGY-ZH] Error: Neither Antigravity Helper nor Node.js runtime was found." >&2
exit 1
