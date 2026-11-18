---
name: agy-zh
description: Manage Google Antigravity Desktop App's native Simplified Chinese localization (`qixian-agy-zh`), check OTA dictionary/version updates, add custom translation overrides, or scan installed Antigravity.app for newly added untranslated UI strings.
---

# 🌐 Antigravity Native Chinese (`/agy-zh`) Skill

Use this skill whenever the user asks to:
1. Check or toggle Antigravity's Chinese localization (`~/.gemini/antigravity-zh`).
2. Add or customize specific UI term translations (`~/.gemini/antigravity-zh/zh-dict.override.json`).
3. Check for remote dictionary/plugin updates (`core/updater.mjs`).
4. Scan their local `/Applications/Antigravity.app` (or Windows `Antigravity`) after an official app update to discover newly added untranslated strings (`scripts/scan_untranslated.mjs`).

## Key Paths
- **Installed Runtime Root**: `~/.gemini/antigravity-zh`
- **Built-in Curated Dictionary**: `~/.gemini/antigravity-zh/core/zh-dict.json` (`1,630+` exact strings + `51` dynamic patterns)
- **User Custom Override Dictionary** (survives OTA updates!): `~/.gemini/antigravity-zh/zh-dict.override.json`
- **Instant Live Toggle Shortcut**: `Cmd + Shift + L` (macOS) / `Ctrl + Shift + L` (Windows/Linux)

## Common Commands

### 1. Scan Installed `Antigravity.app` for New Untranslated Strings
```bash
node ~/.gemini/antigravity-zh/scripts/scan_untranslated.mjs --json /tmp/agy_zh_scan.json
```

### 2. Apply Custom Term Override (`zh-dict.override.json`)
Add or merge entries under `"userExact"` and `"exact"` inside `~/.gemini/antigravity-zh/zh-dict.override.json`:
```json
{
  "userExact": {
    "Side Question": "支线提问"
  },
  "exact": {
    "Side Question": "支线提问"
  }
}
```

### 3. Hot-Reload / Trigger One-Shot CDP Localization on Running App
```bash
~/.gemini/antigravity-zh/scripts/run_node.sh ~/.gemini/antigravity-zh/core/cdp-daemon.mjs --once
```
