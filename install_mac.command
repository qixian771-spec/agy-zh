#!/usr/bin/env bash
# ==============================================================================
#  🌐✨ Antigravity Native Chinese + Gemini UI (qixian-agy-zh v2.3.0)
#  macOS Apple Silicon (M1/M2/M3/M4 arm64) 原生双擎无损汉化 + Gemini 静谧微息与工作态流光引擎
#  • 0 字节触碰 /Applications/Antigravity.app（100% 保留苹果签名与麦克风/录屏权限）
#  • 纯血 arm64 启动器（绝不触发 macOS 英特尔/Rosetta 淘汰弹窗！）
#  • v2.3 升级：40s 静谧微息 WebGL、发送提示词与 Working 星芒律动、Agent 步骤流 100% 深度汉化
# ==============================================================================
set -euo pipefail

export PATH="/opt/homebrew/bin:/usr/local/bin:/usr/bin:/bin:/usr/sbin:/sbin"
SRC_DIR="$(cd "$(dirname "$0")" && pwd)"
INSTALL_DIR="$HOME/.gemini/antigravity-zh"
SKILL_DST="$HOME/.gemini/skills/agy-zh"
LAUNCH_AGENTS_DIR="$HOME/Library/LaunchAgents"
PLIST_PATH="$LAUNCH_AGENTS_DIR/com.qixian.agy-zh.guard.plist"
AGY_USER_DATA="$HOME/Library/Application Support/Antigravity"

echo "================================================================"
echo "  🌐✨ Antigravity 原生汉化 + Gemini 微息流光引擎 (v2.3.0) — 安装"
echo "================================================================"

# 1. 硬件级识别 Apple Silicon (M1/M2/M3/M4)，彻底免疫 Rosetta 伪装环境
if [ "$(/usr/sbin/sysctl -n hw.optional.arm64 2>/dev/null || echo 0)" = "1" ]; then
  ARCH="arm64"
else
  ARCH="$(uname -m)"
fi
echo "🔍 检测到本机芯片架构: $ARCH"

# 2. 定位官方 Antigravity.app（绝不修改其内部任何文件！）
ORIG_APP=""
for CAND in "/Applications/Antigravity.app" "$HOME/Applications/Antigravity.app"; do
  if [ -d "$CAND" ]; then
    ORIG_APP="$CAND"
    break
  fi
done

if [ -z "$ORIG_APP" ]; then
  echo "⚠️  暂未在 /Applications 检测到 Antigravity.app，仍将为您预装汉化引擎与启动器。"
else
  echo "✅ 已识别官方原版应用: $ORIG_APP (保持 0 字节无损原厂签名)"
fi

# 3. 同步核心汉化引擎与 v2.1.0 深度动效引擎到 ~/.gemini/antigravity-zh
mkdir -p "$INSTALL_DIR"
rm -f "$INSTALL_DIR/preload-zh.runtime.cjs" "$INSTALL_DIR/ui-state.json" 2>/dev/null || true
if [ "$SRC_DIR" != "$INSTALL_DIR" ]; then
  rsync -a \
    --exclude='.git' \
    --exclude='.github' \
    --exclude='node_modules' \
    --exclude='*.pkg' \
    --exclude='*.zip' \
    --exclude='zh-dict.override.json' \
    "$SRC_DIR/" "$INSTALL_DIR/"
fi
chmod +x "$INSTALL_DIR/scripts/run_node.sh" "$INSTALL_DIR/scripts/scan_untranslated.mjs" 2>/dev/null || true
[ -f "$INSTALL_DIR/uninstall_mac.command" ] && chmod +x "$INSTALL_DIR/uninstall_mac.command" || true

# 4. 生成纯血 Apple Silicon (arm64)「Antigravity 中文版.app」启动器
if [ -w "/Applications" ]; then
  ZH_APP="/Applications/Antigravity 中文版.app"
else
  mkdir -p "$HOME/Applications"
  ZH_APP="$HOME/Applications/Antigravity 中文版.app"
fi

rm -rf "$ZH_APP"
mkdir -p "$ZH_APP/Contents/MacOS" "$ZH_APP/Contents/Resources"

if [ -f "$INSTALL_DIR/assets/icon-zh.icns" ]; then
  cp -f "$INSTALL_DIR/assets/icon-zh.icns" "$ZH_APP/Contents/Resources/icon-zh.icns"
elif [ -n "$ORIG_APP" ] && [ -f "$ORIG_APP/Contents/Resources/icon.icns" ]; then
  cp -f "$ORIG_APP/Contents/Resources/icon.icns" "$ZH_APP/Contents/Resources/icon-zh.icns"
fi

cat > "$ZH_APP/Contents/Info.plist" <<'PLIST'
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
  <key>CFBundleDevelopmentRegion</key>
  <string>zh_CN</string>
  <key>CFBundleDisplayName</key>
  <string>Antigravity 中文版</string>
  <key>CFBundleExecutable</key>
  <string>Antigravity-ZH</string>
  <key>CFBundleIconFile</key>
  <string>icon-zh</string>
  <key>CFBundleIdentifier</key>
  <string>com.qixian.antigravity.zh</string>
  <key>CFBundleInfoDictionaryVersion</key>
  <string>6.0</string>
  <key>CFBundleName</key>
  <string>Antigravity 中文版</string>
  <key>CFBundlePackageType</key>
  <string>APPL</string>
  <key>CFBundleShortVersionString</key>
  <string>2.3.0</string>
  <key>CFBundleVersion</key>
  <string>230</string>
  <key>LSMinimumSystemVersion</key>
  <string>12.0</string>
  <key>LSArchitecturePriority</key>
  <array>
    <string>arm64</string>
  </array>
  <key>LSUIElement</key>
  <true/>
  <key>NSHighResolutionCapable</key>
  <true/>
</dict>
</plist>
PLIST

BIN_OUT="$ZH_APP/Contents/MacOS/Antigravity-ZH"
COMPILED_NATIVE=0
if command -v clang >/dev/null 2>&1 && [ -f "$INSTALL_DIR/native/macos/launcher.c" ]; then
  if [ "$ARCH" = "arm64" ]; then
    clang -arch arm64 -O2 "$INSTALL_DIR/native/macos/launcher.c" -o "$BIN_OUT" 2>/dev/null && COMPILED_NATIVE=1 || true
  else
    clang -O2 "$INSTALL_DIR/native/macos/launcher.c" -o "$BIN_OUT" 2>/dev/null && COMPILED_NATIVE=1 || true
  fi
fi

if [ "$COMPILED_NATIVE" -ne 1 ]; then
  cat > "$BIN_OUT" <<'SH'
#!/bin/sh
APP="/Applications/Antigravity.app"
[ -d "$APP" ] || APP="$HOME/Applications/Antigravity.app"
if [ ! -d "$APP" ]; then
  /usr/bin/osascript -e 'display alert "未检测到 Antigravity.app" message "请先安装官方 Google Antigravity 至应用程序目录。" as warning' >/dev/null 2>&1
  exit 1
fi
HOOK="$HOME/.gemini/antigravity-zh/core/hook-main.cjs"
if /usr/bin/pgrep -x Antigravity >/dev/null 2>&1; then
  "$HOME/.gemini/antigravity-zh/scripts/run_node.sh" "$HOME/.gemini/antigravity-zh/core/cdp-daemon.mjs" --once >/dev/null 2>&1 &
  exec /usr/bin/open -a "$APP"
fi
if [ -f "$HOOK" ]; then
  exec /usr/bin/open --env "NODE_OPTIONS=--require \"$HOOK\"" --env "AGY_ZH_LANG=zh-CN" -a "$APP" --args --lang=zh-CN
fi
exec /usr/bin/open -a "$APP" --args --lang=zh-CN
SH
fi

chmod 755 "$BIN_OUT"
xattr -cr "$ZH_APP" 2>/dev/null || true
codesign --force --deep --sign - "$ZH_APP" >/dev/null 2>&1 || true
echo "✅ 已生成原生启动器: $ZH_APP"

# 5. 注册 0% CPU 事件驱动兜底守护 (WatchPaths 监听 DevToolsActivePort)
#    即使直接点击原版 Antigravity 图标、浏览器唤起深链或官方自动升级重启，也自动秒切中文！
mkdir -p "$LAUNCH_AGENTS_DIR" "$AGY_USER_DATA"
launchctl bootout "gui/$(id -u)" "$PLIST_PATH" >/dev/null 2>&1 || launchctl unload "$PLIST_PATH" >/dev/null 2>&1 || true

cat > "$PLIST_PATH" <<PLIST
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
  <key>Label</key>
  <string>com.qixian.agy-zh.guard</string>
  <key>ProgramArguments</key>
  <array>
    <string>/bin/bash</string>
    <string>$INSTALL_DIR/scripts/run_node.sh</string>
    <string>$INSTALL_DIR/core/cdp-daemon.mjs</string>
  </array>
  <key>WatchPaths</key>
  <array>
    <string>$AGY_USER_DATA/DevToolsActivePort</string>
  </array>
  <key>RunAtLoad</key>
  <true/>
  <key>StandardOutPath</key>
  <string>/tmp/agy-zh-guard.log</string>
  <key>StandardErrorPath</key>
  <string>/tmp/agy-zh-guard.log</string>
</dict>
</plist>
PLIST

launchctl bootstrap "gui/$(id -u)" "$PLIST_PATH" >/dev/null 2>&1 || launchctl load "$PLIST_PATH" >/dev/null 2>&1 || true
echo "✅ 已开启事件驱动自动汉化守护 (平时 0% CPU 静默待命)"

# 6. 挂载 /agy-zh 本地技能
mkdir -p "$SKILL_DST"
cp -f "$INSTALL_DIR/skills/agy-zh/SKILL.md" "$SKILL_DST/SKILL.md"

# 7. 如果当前 Antigravity 正在运行，立即对已打开窗口执行热汉化 + Gemini 视觉引擎挂载！
if /usr/bin/pgrep -x Antigravity >/dev/null 2>&1; then
  echo "⚡ 检测到 Antigravity 正在运行，正在对当前窗口实时挂载中文与 Gemini 流光 UI..."
  "$INSTALL_DIR/scripts/run_node.sh" "$INSTALL_DIR/core/cdp-daemon.mjs" --once >/dev/null 2>&1 || true
fi

echo ""
echo "================================================================"
echo "  🎉 Antigravity 原生汉化 + Gemini 静谧微息流光引擎 (v2.3.0) 安装完成！"
echo "  • 40s 静谧微息 WebGL + 发送提示词/Working 四色星芒律动 + 步骤流 100% 汉化已生效！"
echo "  • 推荐日常启动：在「应用程序 / 启动台」点击【Antigravity 中文版】"
echo "  • 视觉美化工作台：按【Command + Shift + G】切换预设与 3 档呼吸强度"
echo "  • 语言秒切快捷键：按【Command + Shift + L】0 毫秒秒切中/英文"
echo "  • 如需恢复原厂设置：双击运行 $INSTALL_DIR/uninstall_mac.command"
echo "================================================================"
