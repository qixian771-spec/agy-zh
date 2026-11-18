'use strict';
/**
 * Antigravity Native Chinese (qixian-agy-zh) — Engine 1: Electron Main-Process Preload Hook
 *
 * SECURITY & HYGIENE INVARIANTS:
 *   1. Line 1 immediately removes this hook from `process.env.NODE_OPTIONS` so NO child process
 *      (`language_server`, user terminals, MCP servers, `git`, `node`) ever inherits it!
 *   2. Zero bytes inside `/Applications/Antigravity.app` are modified — Apple Developer ID signature,
 *      Gatekeeper notarization, and macOS TCC permissions remain 100% intact.
 *   3. Synthesizes a self-contained sandbox-safe preload (`preload-zh.runtime.cjs`) with zero
 *      Node `fs`/relative `require` calls so Electron 44's `sandbox: true` renderers execute
 *      localization at Frame 0 with 0ms IPC block and 0 CSP issues!
 *   4. Registers preload ONLY on `session.defaultSession`, preserving `scriptJail`,
 *      `remoteWindowSecurity` SSH partitions, and external `<webview>` partitions untouched.
 */

// [STEP 1] Immediately sanitize NODE_OPTIONS before anything else executes!
(function sanitizeNodeOptions() {
  const raw = process.env.NODE_OPTIONS;
  if (!raw) return;
  const selfPath = __filename;
  const escaped = selfPath.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const cleaned = raw
    .replace(new RegExp(`(?:--require|-r)\\s+"${escaped}"`, 'g'), '')
    .replace(new RegExp(`(?:--require|-r)\\s+'${escaped}'`, 'g'), '')
    .replace(new RegExp(`(?:--require|-r)=?"?${escaped}"?`, 'g'), '')
    .replace(/--require\s+[^\s"']*hook-main\.cjs["']?/g, '')
    .trim()
    .replace(/\s{2,}/g, ' ');
  if (cleaned) {
    process.env.NODE_OPTIONS = cleaned;
  } else {
    delete process.env.NODE_OPTIONS;
  }
})();

const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const Module = require('node:module');
const { pathToFileURL } = require('node:url');

const CORE_DIR = __dirname;
const DICT_PATH = path.join(CORE_DIR, 'zh-dict.json');
const ENGINE_PATH = path.join(CORE_DIR, 'zh-engine.js');
const GEMINI_UI_PATH = path.join(CORE_DIR, 'gemini-ui.js');
const FALLBACK_PRELOAD_PATH = path.join(CORE_DIR, 'preload-zh.cjs');
const DATA_DIR =
  process.env.AGY_ZH_DATA_DIR || path.join(os.homedir(), '.gemini', 'antigravity-zh');
const OVERRIDE_DICT_PATH = path.join(DATA_DIR, 'zh-dict.override.json');
const STATE_FILE = path.join(DATA_DIR, 'lang-state.json');
const UI_STATE_FILE = path.join(DATA_DIR, 'ui-state.json');
const RUNTIME_PRELOAD_PATH = path.join(DATA_DIR, 'preload-zh.runtime.cjs');

const { createTranslator } = require('./zh-engine.js');
const { normalizeState: normalizeGeminiUiState, DEFAULT_STATE: DEFAULT_GEMINI_UI } = require('./gemini-ui.js');

function loadJsonSafe(p) {
  try {
    if (fs.existsSync(p)) {
      return JSON.parse(fs.readFileSync(p, 'utf8'));
    }
  } catch (_) {}
  return null;
}

function readPersistedLang() {
  const st = loadJsonSafe(STATE_FILE);
  if (st && (st.lang === 'en' || st.lang === 'zh-CN')) return st.lang;
  if (process.env.AGY_ZH_LANG === 'en') return 'en';
  return 'zh-CN';
}

function writePersistedLang(lang) {
  try {
    fs.mkdirSync(DATA_DIR, { recursive: true });
    fs.writeFileSync(STATE_FILE, JSON.stringify({ lang, updatedAt: Date.now() }), 'utf8');
  } catch (_) {}
}

function readPersistedUiState() {
  const raw = loadJsonSafe(UI_STATE_FILE);
  return normalizeGeminiUiState(raw || DEFAULT_GEMINI_UI);
}

function writePersistedUiState(nextUiState) {
  try {
    fs.mkdirSync(DATA_DIR, { recursive: true });
    fs.writeFileSync(
      UI_STATE_FILE,
      JSON.stringify({ ...normalizeGeminiUiState(nextUiState), updatedAt: Date.now() }),
      'utf8'
    );
  } catch (_) {}
}

/**
 * Builds a 100% self-contained preload bundle compatible with Electron 44 `sandbox: true` renderers
 * (no `require('fs')` or relative `require('./...')` inside the sandboxed renderer!).
 */
function buildSandboxSafePreloadBundle(initialLang, initialUiState) {
  try {
    const engineCode = fs.readFileSync(ENGINE_PATH, 'utf8');
    const geminiUiCode = fs.existsSync(GEMINI_UI_PATH) ? fs.readFileSync(GEMINI_UI_PATH, 'utf8') : '';
    const dictObj = loadJsonSafe(DICT_PATH) || {};
    const overrideObj = loadJsonSafe(OVERRIDE_DICT_PATH) || null;
    const uiStateObj = normalizeGeminiUiState(initialUiState || readPersistedUiState());

    const bundle = `'use strict';
// Auto-generated sandbox-safe Frame-0 preload bundle (qixian-agy-zh v2.0.0: Localization + Gemini UI)
(function () {
  if (typeof window === 'undefined' || typeof document === 'undefined') return;
  const loc = window.location;
  if (!loc) return;
  const proto = loc.protocol || '';
  const host = loc.hostname || '';
  const isAllowed =
    proto === 'plugin:' ||
    proto === 'data:' ||
    proto === 'about:' ||
    proto === 'agy-app:' ||
    ((proto === 'http:' || proto === 'https:') &&
      (host === '127.0.0.1' || host === 'localhost' || host === '[::1]'));
  if (!isAllowed) return;

  let ipcRenderer = null;
  try {
    ipcRenderer = require('electron').ipcRenderer;
  } catch (_) {}

  const moduleShim = { exports: {} };
  (function (module, exports) {
${engineCode}
  })(moduleShim, moduleShim.exports);

  const engineMod = moduleShim.exports;
  if (engineMod && typeof engineMod.initAgyZhEngine === 'function') {
    const DICT = ${JSON.stringify(dictObj)};
    const OVERRIDE_DICT = ${JSON.stringify(overrideObj)};
    const INITIAL_LANG = ${JSON.stringify(initialLang || 'zh-CN')};

    engineMod.initAgyZhEngine({
      mode: 'preload',
      dict: DICT,
      overrideDict: OVERRIDE_DICT,
      initialLang: INITIAL_LANG,
      onLanguageChanged(nextLang) {
        try {
          ipcRenderer && ipcRenderer.send('agy-zh:set-lang-state', nextLang);
        } catch (_) {}
      },
      async onRequestHotUpdate() {
        if (ipcRenderer) {
          const res = await ipcRenderer.invoke('agy-zh:hot-update');
          return { dict: DICT, overrideDict: (res && res.overrideDict) || null };
        }
        return null;
      }
    });
  }

  const uiShim = { exports: {} };
  (function (module, exports) {
${geminiUiCode}
  })(uiShim, uiShim.exports);

  const uiMod = uiShim.exports;
  if (uiMod && typeof uiMod.initAgyGeminiUi === 'function') {
    uiMod.initAgyGeminiUi({
      initialState: ${JSON.stringify(uiStateObj)},
      onStateChanged(nextState) {
        try {
          ipcRenderer && ipcRenderer.send('agy-gemini:set-ui-state', nextState);
        } catch (_) {}
      }
    });
  }
})();
`;
    fs.mkdirSync(DATA_DIR, { recursive: true });
    fs.writeFileSync(RUNTIME_PRELOAD_PATH, bundle, 'utf8');
    return RUNTIME_PRELOAD_PATH;
  } catch (_) {
    return FALLBACK_PRELOAD_PATH;
  }
}

// Map localized updater labels back to official English keys expected by dist/updater.js `updateActions`
const REVERSE_UPDATE_STEP = {
  检查更新: 'Check for Updates',
  '检查更新...': 'Check for Updates',
  '正在检查更新...': 'Checking for Updates...',
  '正在下载更新...': 'Downloading Update...',
  重启以完成更新: 'Restart to Update',
};

function installElectronPatches(electron) {
  if (!electron || !electron.app || electron.__agyZhPatched) {
    return electron;
  }
  electron.__agyZhPatched = true;

  let currentLang = readPersistedLang();
  let currentUiState = readPersistedUiState();
  let translator = createTranslator(loadJsonSafe(DICT_PATH) || {}, loadJsonSafe(OVERRIDE_DICT_PATH));

  const menuItemOrigLabels = new WeakMap();
  let lastAppMenu = null;
  let activeTray = null;
  let lastTrayMenu = null;

  function trMenuLabel(label) {
    if (typeof label !== 'string' || !label) return label;
    return translator.translatePreservingWhitespace(label, { isMenu: true }) || label;
  }

  // Ensure Chromium & AppKit standard menus use Simplified Chinese resources
  try {
    if (currentLang === 'zh-CN' && !electron.app.commandLine.hasSwitch('lang')) {
      electron.app.commandLine.appendSwitch('lang', 'zh-CN');
    }
  } catch (_) {}

  function localizeMenuItemInstance(item, skipTopLevelFileOnWin) {
    if (!item || typeof item !== 'object') return;
    if (
      item.id === 'agy-zh-lang-menu' ||
      item.id === 'agy-zh-ui-menu' ||
      String(item.id || '').startsWith('agy-zh-')
    ) {
      return;
    }

    if (typeof item.label === 'string' && item.label.length > 0) {
      if (!menuItemOrigLabels.has(item)) {
        menuItemOrigLabels.set(item, item.label);
      }
      const orig = menuItemOrigLabels.get(item);

      // Protect dist/menu.js check-for-updates click lookup (`updateActions[menuItem.label]`)
      if (item.id === 'check-for-updates' && typeof item.click === 'function' && !item.__agyZhClickWrapped) {
        const origClick = item.click;
        item.__agyZhClickWrapped = true;
        item.click = function (menuItem, browserWindow, event) {
          const engLabel = REVERSE_UPDATE_STEP[menuItem?.label] || orig || menuItem?.label;
          const proxyItem = Object.create(menuItem || {});
          Object.defineProperty(proxyItem, 'label', { value: engLabel, enumerable: true });
          return origClick.call(this, proxyItem, browserWindow, event);
        };
      }

      if (!(skipTopLevelFileOnWin && orig === 'File')) {
        item.label = currentLang === 'zh-CN' ? trMenuLabel(orig) : orig;
      }
    }

    if (item.submenu && Array.isArray(item.submenu.items)) {
      for (const sub of item.submenu.items) {
        localizeMenuItemInstance(sub, false);
      }
    }
  }

  function broadcastToRenderers(eventName, detailObj) {
    if (!electron.webContents || typeof electron.webContents.getAllWebContents !== 'function') {
      return;
    }
    const payload = detailObj ? JSON.stringify(detailObj) : 'null';
    const js =
      detailObj !== undefined
        ? `document.dispatchEvent(new CustomEvent(${JSON.stringify(eventName)}, { detail: ${payload} }));`
        : `document.dispatchEvent(new Event(${JSON.stringify(eventName)}));`;

    for (const wc of electron.webContents.getAllWebContents()) {
      try {
        if (!wc.isDestroyed()) {
          const url = wc.getURL() || '';
          if (
            url.startsWith('http://127.0.0.1:') ||
            url.startsWith('https://127.0.0.1:') ||
            url.startsWith('http://localhost:') ||
            url.startsWith('plugin://') ||
            url.startsWith('data:')
          ) {
            wc.executeJavaScript(js, true).catch(() => {});
          }
        }
      } catch (_) {}
    }
  }

  function broadcastGeminiUiCommand(cmdObj) {
    if (!electron.webContents || typeof electron.webContents.getAllWebContents !== 'function') {
      return;
    }
    const serialized = JSON.stringify(JSON.stringify(cmdObj));
    const js = `document.documentElement.dataset.agyGeminiCmd = ${serialized}; document.dispatchEvent(new Event("agy-gemini:cmd"));`;
    for (const wc of electron.webContents.getAllWebContents()) {
      try {
        if (!wc.isDestroyed()) {
          const url = wc.getURL() || '';
          if (
            url.startsWith('http://127.0.0.1:') ||
            url.startsWith('https://127.0.0.1:') ||
            url.startsWith('http://localhost:') ||
            url.startsWith('plugin://')
          ) {
            wc.executeJavaScript(js, true).catch(() => {});
          }
        }
      } catch (_) {}
    }
  }

  function applyGlobalUiPatch(patch) {
    currentUiState = normalizeGeminiUiState({ ...currentUiState, ...patch });
    writePersistedUiState(currentUiState);
    buildSandboxSafePreloadBundle(currentLang, currentUiState);
    refreshNativeMenus();
    broadcastGeminiUiCommand({ action: 'set-state', patch: currentUiState });
  }

  async function runManualUpdateCheck() {
    try {
      const updaterMod = await import(pathToFileURL(path.join(CORE_DIR, 'updater.mjs')).href);
      const info = await updaterMod.checkForLocalizationUpdate({ force: true });
      if (info && info.updateAvailable) {
        broadcastToRenderers('agy-zh:update-notify', { ...info, manual: true });
      } else if (electron.dialog) {
        electron.dialog.showMessageBox({
          type: 'info',
          title: '检查汉化与主题更新',
          message: `当前已是最新版本 (v${info?.currentVersion || '2.0.0'})`,
          detail: '本地词库、双擎无损汉化与 Gemini 视觉引擎均处于最新状态。',
          buttons: ['确定'],
        });
      }
    } catch (err) {
      if (electron.dialog) {
        electron.dialog.showMessageBox({
          type: 'info',
          title: '检查汉化与主题更新',
          message: '暂无法连接更新源，当前本地引擎运行正常',
          detail: String(err?.message || err),
          buttons: ['确定'],
        });
      }
    }
  }

  function buildLanguageMenuItem() {
    const MenuItem = electron.MenuItem;
    const Menu = electron.Menu;
    if (!MenuItem || !Menu) return null;

    const submenu = origBuildFromTemplate.call(Menu, [
      {
        id: 'agy-zh-opt-zh',
        label: '简体中文 (Simplified Chinese)',
        type: 'radio',
        checked: currentLang === 'zh-CN',
        click: () => applyGlobalLanguage('zh-CN'),
      },
      {
        id: 'agy-zh-opt-en',
        label: 'English (原版英文)',
        type: 'radio',
        checked: currentLang === 'en',
        click: () => applyGlobalLanguage('en'),
      },
      { type: 'separator' },
      {
        id: 'agy-zh-opt-toggle',
        label: '⚡ 一键切换中英文',
        accelerator: 'CmdOrCtrl+Shift+L',
        click: () => applyGlobalLanguage(currentLang === 'zh-CN' ? 'en' : 'zh-CN'),
      },
      {
        id: 'agy-zh-opt-update',
        label: '🔄 检查汉化与主题更新...',
        click: () => void runManualUpdateCheck(),
      },
      {
        id: 'agy-zh-opt-dir',
        label: '📂 打开自定义配置目录',
        click: () => {
          try {
            fs.mkdirSync(DATA_DIR, { recursive: true });
            electron.shell?.openPath(DATA_DIR);
          } catch (_) {}
        },
      },
    ]);

    return new MenuItem({
      id: 'agy-zh-lang-menu',
      label: currentLang === 'zh-CN' ? '🌐 语言' : '🌐 Language',
      submenu,
    });
  }

  function buildGeminiUiMenuItem() {
    const MenuItem = electron.MenuItem;
    const Menu = electron.Menu;
    if (!MenuItem || !Menu) return null;

    const submenu = origBuildFromTemplate.call(Menu, [
      {
        id: 'agy-zh-ui-nebula',
        label: '✦ 双子星云 (Gemini Nebula · 官方对标)',
        type: 'radio',
        checked: currentUiState.preset === 'nebula',
        click: () => applyGlobalUiPatch({ preset: 'nebula' }),
      },
      {
        id: 'agy-zh-ui-pure',
        label: '◎ 晨曦纯净 (Gemini Pure · 极简沉浸)',
        type: 'radio',
        checked: currentUiState.preset === 'pure',
        click: () => applyGlobalUiPatch({ preset: 'pure' }),
      },
      {
        id: 'agy-zh-ui-liquid',
        label: '◈ 液态冰晶 (Liquid Glass · M1 Pro)',
        type: 'radio',
        checked: currentUiState.preset === 'liquid',
        click: () => applyGlobalUiPatch({ preset: 'liquid' }),
      },
      {
        id: 'agy-zh-ui-off',
        label: '○ 原厂默认 (Original UI)',
        type: 'radio',
        checked: currentUiState.preset === 'off',
        click: () => applyGlobalUiPatch({ preset: 'off' }),
      },
      { type: 'separator' },
      {
        id: 'agy-zh-ui-int-vivid',
        label: '🔥 动效深度：灵动深邃 (默认推荐)',
        type: 'radio',
        checked: (currentUiState.intensity || 'vivid') === 'vivid',
        click: () => applyGlobalUiPatch({ intensity: 'vivid' }),
      },
      {
        id: 'agy-zh-ui-int-balanced',
        label: '🌊 动效深度：丝滑标准',
        type: 'radio',
        checked: currentUiState.intensity === 'balanced',
        click: () => applyGlobalUiPatch({ intensity: 'balanced' }),
      },
      {
        id: 'agy-zh-ui-int-subtle',
        label: '🍃 动效深度：极简克制',
        type: 'radio',
        checked: currentUiState.intensity === 'subtle',
        click: () => applyGlobalUiPatch({ intensity: 'subtle' }),
      },
      { type: 'separator' },
      {
        id: 'agy-zh-ui-webgl',
        label: '🌊 WebGL 流体极光与波纹冲击',
        type: 'checkbox',
        checked: Boolean(currentUiState.webgl),
        click: () => applyGlobalUiPatch({ webgl: !currentUiState.webgl }),
      },
      {
        id: 'agy-zh-ui-motion',
        label: '🪄 3D 磁吸倾斜与弹簧涟漪动效',
        type: 'checkbox',
        checked: Boolean(currentUiState.motion),
        click: () => applyGlobalUiPatch({ motion: !currentUiState.motion }),
      },
      {
        id: 'agy-zh-ui-spotlight',
        label: '💡 卡片边缘高光折射聚光灯',
        type: 'checkbox',
        checked: Boolean(currentUiState.spotlight),
        click: () => applyGlobalUiPatch({ spotlight: !currentUiState.spotlight }),
      },
      { type: 'separator' },
      {
        id: 'agy-zh-ui-studio',
        label: '🎛️ 打开 Gemini 视觉工作台',
        accelerator: 'CmdOrCtrl+Shift+G',
        click: () => broadcastGeminiUiCommand({ action: 'toggle-studio' }),
      },
    ]);

    return new MenuItem({
      id: 'agy-zh-ui-menu',
      label: currentLang === 'zh-CN' ? '✨ 界面美化' : '✨ Gemini UI',
      submenu,
    });
  }

  function refreshNativeMenus() {
    if (lastAppMenu && Array.isArray(lastAppMenu.items)) {
      for (const item of lastAppMenu.items) {
        if (item.id === 'agy-zh-lang-menu') {
          item.label = currentLang === 'zh-CN' ? '🌐 语言' : '🌐 Language';
          const zhOpt = item.submenu?.getMenuItemById?.('agy-zh-opt-zh');
          const enOpt = item.submenu?.getMenuItemById?.('agy-zh-opt-en');
          if (zhOpt) zhOpt.checked = currentLang === 'zh-CN';
          if (enOpt) enOpt.checked = currentLang === 'en';
        } else if (item.id === 'agy-zh-ui-menu') {
          item.label = currentLang === 'zh-CN' ? '✨ 界面美化' : '✨ Gemini UI';
          for (const p of ['nebula', 'pure', 'liquid', 'off']) {
            const pItem = item.submenu?.getMenuItemById?.(`agy-zh-ui-${p}`);
            if (pItem) pItem.checked = currentUiState.preset === p;
          }
          for (const tier of ['vivid', 'balanced', 'subtle']) {
            const tItem = item.submenu?.getMenuItemById?.(`agy-zh-ui-int-${tier}`);
            if (tItem) tItem.checked = (currentUiState.intensity || 'vivid') === tier;
          }
          for (const k of ['webgl', 'motion', 'spotlight']) {
            const kItem = item.submenu?.getMenuItemById?.(`agy-zh-ui-${k}`);
            if (kItem) kItem.checked = Boolean(currentUiState[k]);
          }
        } else {
          localizeMenuItemInstance(item, false);
        }
      }
      origSetApplicationMenu.call(electron.Menu, lastAppMenu);
    }
    if (activeTray && lastTrayMenu && Array.isArray(lastTrayMenu.items)) {
      for (const item of lastTrayMenu.items) {
        localizeMenuItemInstance(item, false);
      }
      origTraySetContextMenu.call(activeTray, lastTrayMenu);
    }
  }

  function applyGlobalLanguage(nextLang) {
    if (nextLang !== 'zh-CN' && nextLang !== 'en') return;
    currentLang = nextLang;
    writePersistedLang(currentLang);
    buildSandboxSafePreloadBundle(currentLang, currentUiState);
    refreshNativeMenus();
    broadcastToRenderers(currentLang === 'zh-CN' ? 'agy-zh:set-zh' : 'agy-zh:set-en');
  }

  const origBuildFromTemplate = electron.Menu?.buildFromTemplate;
  const origSetApplicationMenu = electron.Menu?.setApplicationMenu;

  if (electron.Menu && typeof origBuildFromTemplate === 'function') {
    electron.Menu.buildFromTemplate = function patchedBuildFromTemplate(template) {
      if (!Array.isArray(template) || currentLang !== 'zh-CN') {
        return origBuildFromTemplate.call(this, template);
      }
      const localized = template.map((entry) => localizeTemplateEntry(entry, trMenuLabel));
      const built = origBuildFromTemplate.call(this, localized);
      if (built && Array.isArray(built.items)) {
        for (let i = 0; i < Math.min(template.length, built.items.length); i++) {
          if (typeof template[i]?.label === 'string') {
            menuItemOrigLabels.set(built.items[i], template[i].label);
          }
        }
      }
      return built;
    };
  }

  if (electron.Menu && typeof origSetApplicationMenu === 'function') {
    electron.Menu.setApplicationMenu = function patchedSetApplicationMenu(menu) {
      if (!menu || !Array.isArray(menu.items)) {
        return origSetApplicationMenu.call(this, menu);
      }
      lastAppMenu = menu;
      const isWin = process.platform === 'win32';
      for (const item of menu.items) {
        localizeMenuItemInstance(item, isWin);
      }

      if (typeof menu.insert === 'function') {
        const hasLangMenu = menu.items.some((it) => it.id === 'agy-zh-lang-menu');
        if (!hasLangMenu) {
          const langMenu = buildLanguageMenuItem();
          if (langMenu) {
            const helpIdx = menu.items.findIndex((it) => {
              const orig = menuItemOrigLabels.get(it) || it.label;
              return orig === 'Help' || it.role?.toLowerCase() === 'help';
            });
            const insertPos = helpIdx >= 0 ? helpIdx : menu.items.length;
            menu.insert(insertPos, langMenu);
          }
        }

        const hasUiMenu = menu.items.some((it) => it.id === 'agy-zh-ui-menu');
        if (!hasUiMenu) {
          const uiMenu = buildGeminiUiMenuItem();
          if (uiMenu) {
            const helpIdx = menu.items.findIndex((it) => {
              const orig = menuItemOrigLabels.get(it) || it.label;
              return orig === 'Help' || it.role?.toLowerCase() === 'help';
            });
            const insertPos = helpIdx >= 0 ? helpIdx : menu.items.length;
            menu.insert(insertPos, uiMenu);
          }
        }
      }

      if (isWin) {
        setTimeout(() => {
          for (const item of menu.items) {
            localizeMenuItemInstance(item, false);
          }
          origSetApplicationMenu.call(electron.Menu, menu);
        }, 600);
      }

      return origSetApplicationMenu.call(this, menu);
    };
  }

  const origTraySetContextMenu = electron.Tray?.prototype?.setContextMenu;
  if (origTraySetContextMenu) {
    electron.Tray.prototype.setContextMenu = function patchedSetContextMenu(menu) {
      activeTray = this;
      lastTrayMenu = menu;
      if (menu && Array.isArray(menu.items)) {
        for (const item of menu.items) {
          if (item.id === 'running-agents' && typeof item.label === 'string') {
            if (!REVERSE_UPDATE_STEP[item.label] && !/Agent/.test(item.label)) {
              menuItemOrigLabels.set(item, item.label);
            }
          }
          localizeMenuItemInstance(item, false);
        }
      }
      return origTraySetContextMenu.call(this, menu);
    };
  }

  if (electron.dialog) {
    const origShowMessageBox = electron.dialog.showMessageBox;
    if (typeof origShowMessageBox === 'function') {
      electron.dialog.showMessageBox = function patchedShowMessageBox(winOrOpts, maybeOpts) {
        const hasWin = maybeOpts !== undefined;
        const opts = hasWin ? maybeOpts : winOrOpts;
        if (currentLang === 'zh-CN' && opts && typeof opts === 'object') {
          const nextOpts = { ...opts };
          if (typeof nextOpts.title === 'string') nextOpts.title = trMenuLabel(nextOpts.title);
          if (typeof nextOpts.message === 'string') nextOpts.message = trMenuLabel(nextOpts.message);
          if (typeof nextOpts.detail === 'string') nextOpts.detail = trMenuLabel(nextOpts.detail);
          if (Array.isArray(nextOpts.buttons)) {
            nextOpts.buttons = nextOpts.buttons.map((b) => trMenuLabel(b));
          }
          return hasWin
            ? origShowMessageBox.call(this, winOrOpts, nextOpts)
            : origShowMessageBox.call(this, nextOpts);
        }
        return origShowMessageBox.apply(this, arguments);
      };
    }

    const origShowErrorBox = electron.dialog.showErrorBox;
    if (typeof origShowErrorBox === 'function') {
      electron.dialog.showErrorBox = function patchedShowErrorBox(title, content) {
        if (currentLang === 'zh-CN') {
          return origShowErrorBox.call(this, trMenuLabel(title), trMenuLabel(content));
        }
        return origShowErrorBox.call(this, title, content);
      };
    }
  }

  if (electron.ipcMain) {
    electron.ipcMain.on('agy-zh:get-bootstrap', (event) => {
      event.returnValue = {
        dict: loadJsonSafe(DICT_PATH) || {},
        overrideDict: loadJsonSafe(OVERRIDE_DICT_PATH),
        initialLang: currentLang,
        initialUiState: currentUiState,
      };
    });

    electron.ipcMain.on('agy-zh:set-lang-state', (_event, nextLang) => {
      if (nextLang === 'zh-CN' || nextLang === 'en') {
        currentLang = nextLang;
        writePersistedLang(currentLang);
        buildSandboxSafePreloadBundle(currentLang, currentUiState);
        refreshNativeMenus();
      }
    });

    electron.ipcMain.on('agy-gemini:set-ui-state', (_event, nextUiState) => {
      if (nextUiState && typeof nextUiState === 'object') {
        currentUiState = normalizeGeminiUiState(nextUiState);
        writePersistedUiState(currentUiState);
        buildSandboxSafePreloadBundle(currentLang, currentUiState);
        refreshNativeMenus();
      }
    });

    electron.ipcMain.handle('agy-zh:hot-update', async () => {
      const updaterMod = await import(pathToFileURL(path.join(CORE_DIR, 'updater.mjs')).href);
      const res = await updaterMod.applyHotDictionaryUpdate();
      translator = createTranslator(loadJsonSafe(DICT_PATH) || {}, res.overrideDict);
      buildSandboxSafePreloadBundle(currentLang, currentUiState);
      refreshNativeMenus();
      return res;
    });
  }

  // Register sandbox-safe Frame-0 Preload on defaultSession ONLY!
  electron.app.whenReady().then(() => {
    try {
      const preloadFile = buildSandboxSafePreloadBundle(currentLang, currentUiState);
      const defSession = electron.session?.defaultSession;
      if (defSession && fs.existsSync(preloadFile)) {
        if (typeof defSession.registerPreloadScript === 'function') {
          defSession.registerPreloadScript({
            id: 'qixian-agy-zh-preload',
            type: 'frame',
            filePath: preloadFile,
          });
        } else if (typeof defSession.setPreloads === 'function') {
          const existing = typeof defSession.getPreloads === 'function' ? defSession.getPreloads() : [];
          if (!existing.includes(preloadFile)) {
            defSession.setPreloads([...existing, preloadFile]);
          }
        }
      }
    } catch (err) {
      console.warn('[AGY-ZH] Failed to register preload script:', err?.message || err);
    }

    // Non-blocking OTA dictionary / version check 12s after launch
    const otaTimer = setTimeout(async () => {
      try {
        const updaterMod = await import(pathToFileURL(path.join(CORE_DIR, 'updater.mjs')).href);
        const info = await updaterMod.checkForLocalizationUpdate();
        if (info && info.updateAvailable) {
          broadcastToRenderers('agy-zh:update-notify', info);
        }
      } catch (_) {}
    }, 12000);
    otaTimer.unref?.();
  });

  return electron;
}

function localizeTemplateEntry(entry, trFn) {
  if (!entry || typeof entry !== 'object') return entry;
  if (String(entry.id || '').startsWith('agy-zh-')) return entry;
  const copy = { ...entry };
  if (typeof copy.label === 'string') {
    copy.label = trFn(copy.label);
  }
  if (Array.isArray(copy.submenu)) {
    copy.submenu = copy.submenu.map((sub) => localizeTemplateEntry(sub, trFn));
  }
  return copy;
}

// Only hook inside an actual Electron main process (skip plain Node / ELECTRON_RUN_AS_NODE)
if (
  process.versions &&
  process.versions.electron &&
  process.env.ELECTRON_RUN_AS_NODE !== '1'
) {
  const origLoad = Module._load;
  Module._load = function agyZhModuleLoad(request, parent, isMain) {
    const loaded = origLoad.apply(this, arguments);
    if (request === 'electron' && loaded && typeof loaded === 'object' && loaded.app) {
      return installElectronPatches(loaded);
    }
    return loaded;
  };
}

module.exports = {
  installElectronPatches,
  buildSandboxSafePreloadBundle,
  REVERSE_UPDATE_STEP,
};
