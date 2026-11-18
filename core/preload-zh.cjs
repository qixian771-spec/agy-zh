'use strict';
/**
 * Antigravity Native Chinese (qixian-agy-zh) — Engine 1: Frame-0 Preload Script
 *
 * Runs inside Electron's isolated preload world on `session.defaultSession`.
 * - Mutates DOM Text nodes & UI attributes directly without `<script>` tag injection
 *   (100% immune to strict CSP like `default-src 'none'` on Wizard / Disconnected pages).
 * - Marks `document.documentElement.dataset.agyZhEngine = 'preload'` so Engine 2 (CDP Guard)
 *   detects Engine 1 and skips redundant evaluation.
 * - Strictly restricts itself to Antigravity's own UI origins (loopback Hub, `plugin://`, `data:`, etc.).
 */

const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

function isAntigravityUiLocation(loc) {
  if (!loc) return false;
  const proto = loc.protocol || '';
  const host = loc.hostname || '';
  if (proto === 'plugin:' || proto === 'data:' || proto === 'about:' || proto === 'agy-app:') {
    return true;
  }
  if ((proto === 'http:' || proto === 'https:') && (host === '127.0.0.1' || host === 'localhost' || host === '[::1]')) {
    return true;
  }
  return false;
}

(function bootstrapPreload() {
  if (typeof window === 'undefined' || typeof document === 'undefined') return;
  if (!isAntigravityUiLocation(window.location)) return;

  const coreDir = __dirname;
  const dataDir =
    process.env.AGY_ZH_DATA_DIR || path.join(os.homedir(), '.gemini', 'antigravity-zh');
  const dictPath = path.join(coreDir, 'zh-dict.json');
  const overridePath = path.join(dataDir, 'zh-dict.override.json');
  const statePath = path.join(dataDir, 'lang-state.json');

  let dict = {};
  let overrideDict = null;
  let initialLang = 'zh-CN';

  try {
    dict = JSON.parse(fs.readFileSync(dictPath, 'utf8'));
  } catch (_) {}

  try {
    if (fs.existsSync(overridePath)) {
      overrideDict = JSON.parse(fs.readFileSync(overridePath, 'utf8'));
    }
  } catch (_) {}

  try {
    if (fs.existsSync(statePath)) {
      const st = JSON.parse(fs.readFileSync(statePath, 'utf8'));
      if (st && (st.lang === 'en' || st.lang === 'zh-CN')) {
        initialLang = st.lang;
      }
    }
  } catch (_) {}

  let ipcRenderer = null;
  try {
    ipcRenderer = require('electron').ipcRenderer;
  } catch (_) {}

  const uiStatePath = path.join(dataDir, 'ui-state.json');
  let initialUiState = null;
  try {
    if (fs.existsSync(uiStatePath)) {
      initialUiState = JSON.parse(fs.readFileSync(uiStatePath, 'utf8'));
    }
  } catch (_) {}

  const { initAgyZhEngine } = require('./zh-engine.js');
  const { initAgyGeminiUi } = require('./gemini-ui.js');

  initAgyZhEngine({
    mode: 'preload',
    dict,
    overrideDict,
    initialLang,
    onLanguageChanged(nextLang) {
      try {
        fs.mkdirSync(dataDir, { recursive: true });
        fs.writeFileSync(
          statePath,
          JSON.stringify({ lang: nextLang, updatedAt: Date.now() }),
          'utf8'
        );
      } catch (_) {}
    },
    async onRequestHotUpdate() {
      if (ipcRenderer) {
        const res = await ipcRenderer.invoke('agy-zh:hot-update');
        return { dict, overrideDict: res?.overrideDict || null };
      }
      return null;
    },
  });

  initAgyGeminiUi({
    initialState: initialUiState,
    onStateChanged(nextState) {
      try {
        fs.mkdirSync(dataDir, { recursive: true });
        fs.writeFileSync(
          uiStatePath,
          JSON.stringify({ ...nextState, updatedAt: Date.now() }),
          'utf8'
        );
      } catch (_) {}
    },
  });
})();
