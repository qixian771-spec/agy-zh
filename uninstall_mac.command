#!/usr/bin/env bash
# ==============================================================================
#  🧹 Antigravity Native Chinese (qixian-agy-zh) — Mac 1秒无痕卸载恢复原版脚本
# ==============================================================================
set -euo pipefail

PLIST_PATH="$HOME/Library/LaunchAgents/com.qixian.agy-zh.guard.plist"
INSTALL_DIR="$HOME/.gemini/antigravity-zh"
SKILL_DST="$HOME/.gemini/skills/agy-zh"

echo "================================================================"
echo "  🧹 正在卸载 Antigravity 中文汉化组件并恢复原厂状态..."
echo "================================================================"

launchctl bootout "gui/$(id -u)" "$PLIST_PATH" >/dev/null 2>&1 || launchctl unload "$PLIST_PATH" >/dev/null 2>&1 || true
rm -f "$PLIST_PATH"
pkill -f "cdp-daemon.mjs" 2>/dev/null || true

rm -rf "/Applications/Antigravity 中文版.app" \
       "$HOME/Applications/Antigravity 中文版.app" \
       "$SKILL_DST" \
       "$INSTALL_DIR" 2>/dev/null || true

echo "✅ 已 100% 清理完毕！官方 /Applications/Antigravity.app 从未被改动，重启后即为纯英文原厂状态。"
