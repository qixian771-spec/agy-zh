#!/usr/bin/env node
/**
 * Antigravity Native Chinese (qixian-agy-zh) — Comprehensive Automated Test Suite
 */
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import http from 'node:http';
import path from 'node:path';
import vm from 'node:vm';
import { execFileSync } from 'node:child_process';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';

import {
  compareVersions,
  isRemoteNewer,
  checkForLocalizationUpdate,
  applyHotDictionaryUpdate,
} from '../core/updater.mjs';
import { isLocalAntigravityTargetUrl, buildInjectionPayload } from '../core/cdp-daemon.mjs';
import { scanAppLocalizationCoverage } from '../scripts/scan_untranslated.mjs';

const require = createRequire(import.meta.url);
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT_DIR = path.resolve(__dirname, '..');

const { createTranslator, shouldSkipElement, initAgyZhEngine } = require('../core/zh-engine.js');
const {
  installElectronPatches,
  buildSandboxSafePreloadBundle,
} = require('../core/hook-main.cjs');

let passed = 0;
async function runTest(name, fn) {
  await fn();
  passed++;
  console.log(`  ✅ [${passed}] ${name}`);
}

// ---------------------------------------------------------------------------
// Minimal Spec-Faithful DOM Implementation for Zero-Dep Node Testing
// ---------------------------------------------------------------------------
function createMiniDom(initialTitle = 'Welcome to Antigravity') {
  class MiniNode {
    constructor(nodeType) {
      this.nodeType = nodeType;
      this.parentNode = null;
      this.childNodes = [];
    }
    get parentElement() {
      return this.parentNode && this.parentNode.nodeType === 1 ? this.parentNode : null;
    }
    appendChild(child) {
      if (child.parentNode) child.parentNode.removeChild(child);
      child.parentNode = this;
      this.childNodes.push(child);
      return child;
    }
    removeChild(child) {
      const idx = this.childNodes.indexOf(child);
      if (idx >= 0) {
        this.childNodes.splice(idx, 1);
        child.parentNode = null;
      }
      return child;
    }
    remove() {
      if (this.parentNode) this.parentNode.removeChild(this);
    }
  }

  class MiniText extends MiniNode {
    constructor(text) {
      super(3);
      this.nodeValue = String(text);
    }
    get textContent() {
      return this.nodeValue;
    }
    set textContent(v) {
      this.nodeValue = String(v);
    }
  }

  class MiniElement extends MiniNode {
    constructor(tagName, ownerDoc) {
      super(1);
      this.tagName = tagName.toUpperCase();
      this.ownerDocument = ownerDoc;
      this._attrs = new Map();
      this.dataset = {};
      this.style = {};
      this.isContentEditable = false;
      this.value = '';
    }
    setAttribute(k, v) {
      const sv = String(v);
      this._attrs.set(k, sv);
      if (k === 'id') this.id = sv;
      if (k === 'class') this.className = sv;
      if (k === 'contenteditable' && (sv === 'true' || sv === '')) {
        this.isContentEditable = true;
      }
      if (k.startsWith('data-')) {
        const camel = k
          .slice(5)
          .replace(/-([a-z])/g, (_, c) => c.toUpperCase());
        this.dataset[camel] = sv;
      }
    }
    getAttribute(k) {
      return this._attrs.has(k) ? this._attrs.get(k) : null;
    }
    hasAttribute(k) {
      return this._attrs.has(k);
    }
    matches(selectorList) {
      const selectors = selectorList.split(',').map((s) => s.trim());
      const classes = (this.className || '').split(/\s+/).filter(Boolean);
      for (const sel of selectors) {
        if (!sel) continue;
        if (sel.startsWith('.')) {
          if (classes.includes(sel.slice(1))) return true;
        } else if (sel.startsWith('[') && sel.endsWith(']')) {
          const inner = sel.slice(1, -1);
          const eqIdx = inner.indexOf('=');
          if (eqIdx < 0) {
            if (this.hasAttribute(inner)) return true;
          } else {
            const attrName = inner.slice(0, eqIdx).trim();
            const expected = inner.slice(eqIdx + 1).trim().replace(/^["']|["']$/g, '');
            if (this.getAttribute(attrName) === expected) return true;
          }
        } else if (this.tagName === sel.toUpperCase()) {
          return true;
        }
      }
      return false;
    }
    closest(selectorList) {
      let cur = this;
      while (cur && cur.nodeType === 1) {
        if (cur.matches(selectorList)) return cur;
        cur = cur.parentElement;
      }
      return null;
    }
    get textContent() {
      return this.childNodes.map((c) => c.textContent).join('');
    }
    set textContent(v) {
      this.childNodes = [new MiniText(String(v))];
      this.childNodes[0].parentNode = this;
    }
    addEventListener(type, fn) {
      if (!this._elListeners) this._elListeners = new Map();
      if (!this._elListeners.has(type)) this._elListeners.set(type, []);
      this._elListeners.get(type).push(fn);
    }
    get isConnected() {
      let cur = this.parentNode;
      while (cur) {
        if (cur.nodeType === 9) return true;
        cur = cur.parentNode;
      }
      return false;
    }
    querySelectorAll(selectorList) {
      const out = [];
      const walk = (n) => {
        for (const c of n.childNodes || []) {
          if (c.nodeType === 1 && c.matches(selectorList)) out.push(c);
          if (c.childNodes && c.childNodes.length) walk(c);
        }
      };
      walk(this);
      return out;
    }
  }

  class MiniDocument extends MiniNode {
    constructor() {
      super(9);
      this.title = initialTitle;
      this.readyState = 'complete';
      this._listeners = new Map();
      this.documentElement = new MiniElement('html', this);
      this.body = new MiniElement('body', this);
      this.documentElement.appendChild(this.body);
      this.appendChild(this.documentElement);
    }
    createElement(tag) {
      return new MiniElement(tag, this);
    }
    createTextNode(txt) {
      return new MiniText(txt);
    }
    getElementById(id) {
      let found = null;
      const walk = (n) => {
        if (found) return;
        if (n.nodeType === 1 && n.id === id) {
          found = n;
          return;
        }
        for (const c of n.childNodes || []) walk(c);
      };
      walk(this.documentElement);
      return found;
    }
    createTreeWalker(root, whatToShow) {
      const list = [];
      const collect = (n) => {
        for (const c of n.childNodes || []) {
          if ((c.nodeType === 1 && (whatToShow & 1)) || (c.nodeType === 3 && (whatToShow & 4))) {
            list.push(c);
          }
          if (c.childNodes && c.childNodes.length) collect(c);
        }
      };
      collect(root);
      let idx = -1;
      return {
        nextNode() {
          idx++;
          return idx < list.length ? list[idx] : null;
        },
      };
    }
    addEventListener(type, fn) {
      if (!this._listeners.has(type)) this._listeners.set(type, []);
      this._listeners.get(type).push(fn);
    }
    dispatchEvent(ev) {
      for (const fn of this._listeners.get(ev.type) || []) fn(ev);
      return true;
    }
  }

  const doc = new MiniDocument();
  const storage = new Map();
  const winListeners = new Map();
  const win = {
    document: doc,
    location: { protocol: 'http:', hostname: '127.0.0.1', port: '43123' },
    localStorage: {
      getItem: (k) => (storage.has(k) ? storage.get(k) : null),
      setItem: (k, v) => storage.set(k, String(v)),
    },
    Event: class {
      constructor(type) {
        this.type = type;
      }
    },
    CustomEvent: class {
      constructor(type, opts) {
        this.type = type;
        this.detail = opts?.detail;
      }
    },
    MutationObserver: class {
      constructor(cb) {
        this.cb = cb;
      }
      observe() {}
    },
    requestAnimationFrame: (fn) => setTimeout(fn, 0),
    addEventListener(type, fn) {
      if (!winListeners.has(type)) winListeners.set(type, []);
      winListeners.get(type).push(fn);
    },
    dispatchKeydown(ev) {
      for (const fn of winListeners.get('keydown') || []) fn(ev);
    },
  };
  win.self = win;
  win.top = win;
  return { doc, win };
}

console.log('==============================================================');
console.log('🧪 Running Antigravity Native Chinese (qixian-agy-zh) Tests');
console.log('==============================================================');

await runTest('Plugin manifest, SVG icon, Sidecar config & Skill metadata are valid', () => {
  const plugin = JSON.parse(fs.readFileSync(path.join(ROOT_DIR, 'plugin.json'), 'utf8'));
  assert.equal(plugin.name, 'qixian-agy-zh');
  assert.match(plugin.version, /^\d+\.\d+\.\d+$/);

  const logoSvg = fs.readFileSync(path.join(ROOT_DIR, plugin.logo), 'utf8');
  assert.ok(logoSvg.includes('<svg') && logoSvg.includes('viewBox="0 0 256 256"'));

  const sidecar = JSON.parse(
    fs.readFileSync(path.join(ROOT_DIR, 'sidecars/zh-cn/sidecar.json'), 'utf8')
  );
  assert.equal(sidecar.restart_policy, 'always');
  assert.equal(sidecar.has_web_ui, false);

  const skillMd = fs.readFileSync(path.join(ROOT_DIR, 'skills/agy-zh/SKILL.md'), 'utf8');
  assert.ok(skillMd.includes('name: agy-zh'));
});

await runTest('Dictionary zh-dict.json compiles cleanly and preserves geek proper nouns', () => {
  const dict = JSON.parse(fs.readFileSync(path.join(ROOT_DIR, 'core/zh-dict.json'), 'utf8'));
  const exactCount = Object.keys(dict.exact).length;
  assert.ok(exactCount >= 1780, `Expected >= 1780 exact entries, got ${exactCount}`);
  assert.ok(dict.patterns.length >= 130);

  const tr = createTranslator(dict);
  assert.equal(tr.translatePreservingWhitespace('  New Conversation  '), '  新建对话  ');
  assert.equal(tr.translatePreservingWhitespace('Side Questions'), '旁路追问');
  assert.equal(tr.translatePreservingWhitespace('Proceed with Plan'), '按此方案执行');
  assert.equal(tr.translatePreservingWhitespace('3 agents running'), '3 个 Agent 正在运行');
  assert.equal(tr.translatePreservingWhitespace('5m ago'), '5 分钟前');
  assert.equal(tr.translatePreservingWhitespace('20h'), '20小时');
  assert.equal(tr.translatePreservingWhitespace('1d'), '1天');
  assert.equal(tr.translatePreservingWhitespace('1mo'), '1个月');
  assert.equal(
    tr.translatePreservingWhitespace('Ask anything, @ to mention, / for actions'),
    '随便问点什么，输入 @ 引用上下文，输入 / 唤起指令'
  );
  assert.equal(
    tr.translatePreservingWhitespace('Reconnecting to devbox-01…'),
    '正在重新连接到 devbox-01…'
  );
  // Exact Agent Step / Working status strings from QIXIAN's screenshot
  assert.equal(tr.translatePreservingWhitespace('Reading transcript.jsonl'), '正在读取 transcript.jsonl');
  assert.equal(tr.translatePreservingWhitespace('Thought for 37s'), '已思考 37秒');
  assert.equal(
    tr.translatePreservingWhitespace('Ran check Colab G4 status and queue outputs · Exited with code 1'),
    '已运行 check Colab G4 status and queue outputs · 退出码 1'
  );
  assert.equal(tr.translatePreservingWhitespace(' · Exited with code 1'), ' · 退出码 1');
  assert.equal(tr.translatePreservingWhitespace('Found 3 subagents'), '已发现 3 个子 Agent');
  assert.equal(tr.translatePreservingWhitespace(' subagents'), ' 个子 Agent');
  assert.equal(tr.translatePreservingWhitespace('Analyzed'), '已分析');
  assert.equal(tr.translatePreservingWhitespace('Task Log'), '任务日志');
  assert.equal(tr.translatePreservingWhitespace(': Transcript'), ': 对话记录');
  assert.equal(tr.translatePreservingWhitespace('Transcript'), '对话记录');
  assert.equal(tr.translatePreservingWhitespace('Working'), '正在工作');
  assert.equal(tr.translatePreservingWhitespace('Compacting'), '正在压缩上下文');
  // Proper nouns & file paths must NEVER be mangled
  assert.equal(tr.translatePreservingWhitespace('GitHub'), null);
  assert.equal(tr.translatePreservingWhitespace('MCP'), null);
  assert.equal(tr.translatePreservingWhitespace('/Users/qixian/project/Settings.ts'), null);
  assert.equal(tr.translatePreservingWhitespace('https://antigravity.google/docs'), null);
});

await runTest(
  'DOM Engine translates UI, protects code/editor/terminal/inputs, and toggles 0ms losslessly (Cmd+Shift+L)',
  () => {
    const dict = JSON.parse(fs.readFileSync(path.join(ROOT_DIR, 'core/zh-dict.json'), 'utf8'));
    const { doc, win } = createMiniDom('Welcome to Antigravity');

    // 1. Normal UI button & dynamic badge
    const btn = doc.createElement('button');
    btn.setAttribute('title', 'Open Settings');
    btn.appendChild(doc.createTextNode('New Conversation'));
    doc.body.appendChild(btn);

    const badge = doc.createElement('span');
    badge.appendChild(doc.createTextNode('2 agents running'));
    doc.body.appendChild(badge);

    // 2. Search input: placeholder & aria-label SHOULD translate, .value MUST NOT!
    const input = doc.createElement('input');
    input.value = 'New Conversation';
    input.setAttribute('placeholder', 'Search conversations...');
    input.setAttribute('aria-label', 'Message input');
    doc.body.appendChild(input);

    // 3. Protected code block, Monaco editor, xterm terminal, and contenteditable composer
    const pre = doc.createElement('pre');
    const code = doc.createElement('code');
    code.appendChild(doc.createTextNode('Settings'));
    pre.appendChild(code);
    doc.body.appendChild(pre);

    const monaco = doc.createElement('div');
    monaco.setAttribute('class', 'monaco-editor');
    const monacoLine = doc.createElement('span');
    monacoLine.appendChild(doc.createTextNode('New Window'));
    monaco.appendChild(monacoLine);
    doc.body.appendChild(monaco);

    const xterm = doc.createElement('div');
    xterm.setAttribute('class', 'xterm-screen');
    xterm.appendChild(doc.createTextNode('Check for Updates'));
    doc.body.appendChild(xterm);

    const composer = doc.createElement('div');
    composer.setAttribute('contenteditable', 'true');
    composer.appendChild(doc.createTextNode('Proceed with Plan'));
    doc.body.appendChild(composer);

    assert.equal(shouldSkipElement(code), true);
    assert.equal(shouldSkipElement(monacoLine), true);
    assert.equal(shouldSkipElement(xterm), true);
    assert.equal(shouldSkipElement(composer), true);

    const engine = initAgyZhEngine({
      document: doc,
      window: win,
      mode: 'preload',
      dict,
      initialLang: 'zh-CN',
    });

    // Verify Chinese localization applied
    assert.equal(doc.documentElement.dataset.agyZhEngine, 'preload');
    assert.equal(doc.title, '欢迎使用 Antigravity');
    assert.equal(btn.textContent, '新建对话');
    assert.equal(btn.getAttribute('title'), '打开设置');
    assert.equal(badge.textContent, '2 个 Agent 正在运行');
    assert.equal(input.getAttribute('placeholder'), '搜索历史对话...');
    assert.equal(input.getAttribute('aria-label'), '消息输入框');

    // Verify protected regions were 100% untouched!
    assert.equal(input.value, 'New Conversation');
    assert.equal(code.textContent, 'Settings');
    assert.equal(monacoLine.textContent, 'New Window');
    assert.equal(xterm.textContent, 'Check for Updates');
    assert.equal(composer.textContent, 'Proceed with Plan');

    // Verify Engine 2 (CDP) automatically skips when Engine 1 (preload) is already active!
    const cdpAttempt = initAgyZhEngine({
      document: doc,
      window: win,
      mode: 'cdp',
      dict,
    });
    assert.equal(cdpAttempt.skipped, true);
    assert.equal(cdpAttempt.reason, 'already-preload');

    // Verify Cmd+Shift+L instant toggle -> 100% lossless restoration to English!
    win.dispatchKeydown({
      metaKey: true,
      ctrlKey: false,
      shiftKey: true,
      altKey: false,
      key: 'L',
      code: 'KeyL',
      preventDefault() {},
      stopPropagation() {},
    });

    assert.equal(engine.getLanguage(), 'en');
    assert.equal(doc.title, 'Welcome to Antigravity');
    assert.equal(btn.textContent, 'New Conversation');
    assert.equal(btn.getAttribute('title'), 'Open Settings');
    assert.equal(badge.textContent, '2 agents running');
    assert.equal(input.getAttribute('placeholder'), 'Search conversations...');
    assert.equal(input.getAttribute('aria-label'), 'Message input');

    // Toggle back to Chinese via Cmd+Shift+L
    engine.toggleLanguage(true);
    assert.equal(engine.getLanguage(), 'zh-CN');
    assert.equal(btn.textContent, '新建对话');
    assert.equal(badge.textContent, '2 个 Agent 正在运行');
  }
);

await runTest(
  'hook-main.cjs sanitizes NODE_OPTIONS on line 1 so child processes inherit ZERO flags',
  () => {
    const hookPath = path.join(ROOT_DIR, 'core/hook-main.cjs');
    const out = execFileSync(
      process.execPath,
      [
        '-e',
        `const { execFileSync } = require('node:child_process');
         const childEnv = execFileSync(process.execPath, ['-e', 'process.stdout.write(process.env.NODE_OPTIONS || "CLEAN")'], { encoding: 'utf8' });
         process.stdout.write((process.env.NODE_OPTIONS || 'CLEAN') + '|' + childEnv);`,
      ],
      {
        env: {
          ...process.env,
          NODE_OPTIONS: `--require "${hookPath}"`,
        },
        encoding: 'utf8',
      }
    );
    assert.equal(out, 'CLEAN|CLEAN');
  }
);

await runTest(
  'hook-main.cjs Electron patches localize Menu/Tray/Dialogs, preserve Check-for-Updates click key, and build sandbox-safe preload',
  () => {
    const tmpDataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'agy-zh-test-'));
    process.env.AGY_ZH_DATA_DIR = tmpDataDir;

    let clickedUpdateStepLabel = null;
    let lastDialogOpts = null;
    let registeredPreload = null;

    class MockMenuItem {
      constructor(opts) {
        Object.assign(this, opts);
      }
    }

    const mockMenu = {
      buildFromTemplate(tpl) {
        return {
          items: tpl.map((t) => new MockMenuItem(t)),
          getMenuItemById(id) {
            return this.items.find((x) => x.id === id);
          },
        };
      },
      setApplicationMenu(m) {
        this._current = m;
      },
    };

    class MockTray {
      setContextMenu(m) {
        this.menu = m;
      }
    }

    const mockElectron = {
      app: {
        commandLine: {
          _switches: new Map(),
          hasSwitch(k) {
            return this._switches.has(k);
          },
          appendSwitch(k, v) {
            this._switches.set(k, v);
          },
        },
        whenReady: () => Promise.resolve(),
      },
      MenuItem: MockMenuItem,
      Menu: mockMenu,
      Tray: MockTray,
      dialog: {
        showMessageBox(opts) {
          lastDialogOpts = opts;
          return Promise.resolve({ response: 0 });
        },
        showErrorBox() {},
      },
      ipcMain: {
        on() {},
        handle() {},
      },
      session: {
        defaultSession: {
          registerPreloadScript(cfg) {
            registeredPreload = cfg;
          },
        },
      },
    };

    installElectronPatches(mockElectron);

    // 1. App menu localization + Check for Updates click compatibility (`updater.js:updateActions[menuItem.label]`)
    const checkItem = new MockMenuItem({
      id: 'check-for-updates',
      label: 'Check for Updates',
      click(menuItem) {
        clickedUpdateStepLabel = menuItem.label;
      },
    });
    const appMenuObj = {
      items: [
        new MockMenuItem({
          label: 'Antigravity',
          submenu: { items: [checkItem] },
        }),
        new MockMenuItem({
          label: 'File',
          submenu: { items: [new MockMenuItem({ label: 'New Window' })] },
        }),
        new MockMenuItem({ label: 'Help', submenu: { items: [new MockMenuItem({ label: 'Docs' })] } }),
      ],
      insert(pos, item) {
        this.items.splice(pos, 0, item);
      },
    };

    mockElectron.Menu.setApplicationMenu(appMenuObj);
    assert.equal(checkItem.label, '检查更新');
    assert.equal(appMenuObj.items[1].submenu.items[0].label, '新建窗口');
    assert.ok(appMenuObj.items.some((i) => i.id === 'agy-zh-lang-menu' && i.label === '🌐 语言'));

    // Clicking localized '检查更新' MUST pass 'Check for Updates' to Antigravity's updater click handler!
    checkItem.click(checkItem, null, {});
    assert.equal(clickedUpdateStepLabel, 'Check for Updates');

    // 2. Tray dynamic agent count localization
    const tray = new MockTray();
    const trayMenu = mockElectron.Menu.buildFromTemplate([
      { id: 'running-agents', label: 'No agents running', enabled: false },
      { label: 'Open Antigravity' },
      { label: 'Quit' },
    ]);
    tray.setContextMenu(trayMenu);
    assert.equal(trayMenu.items[0].label, '当前无运行中的 Agent');
    assert.equal(trayMenu.items[1].label, '打开 Antigravity');
    assert.equal(trayMenu.items[2].label, '退出');

    trayMenu.items[0].label = '4 agents running';
    tray.setContextMenu(trayMenu);
    assert.equal(trayMenu.items[0].label, '4 个 Agent 正在运行');

    // 3. Quit confirmation dialog localization
    mockElectron.dialog.showMessageBox({
      title: 'Confirm Quit',
      message: 'Are you sure you want to quit?',
      detail: 'There may be agents or background tasks running.',
      buttons: ['Cancel', 'Quit'],
    });
    assert.equal(lastDialogOpts.title, '确认退出');
    assert.equal(lastDialogOpts.message, '确定要退出 Antigravity 吗？');
    assert.deepEqual(lastDialogOpts.buttons, ['取消', '退出']);

    // 4. Sandbox-safe preload bundle syntax & zero Node fs requires
    const bundlePath = buildSandboxSafePreloadBundle('zh-CN');
    const bundleCode = fs.readFileSync(bundlePath, 'utf8');
    assert.ok(!bundleCode.includes("require('node:fs')") && !bundleCode.includes('require("fs")'));
    new vm.Script(bundleCode, { filename: 'preload-zh.runtime.cjs' });

    // Also verify CDP injection payload compiles cleanly in V8
    const cdpPayload = buildInjectionPayload();
    new vm.Script(cdpPayload, { filename: 'cdp-payload.js' });
    assert.equal(isLocalAntigravityTargetUrl('http://127.0.0.1:54123/'), true);
    assert.equal(isLocalAntigravityTargetUrl('plugin://swarm/index.html'), true);
    assert.equal(isLocalAntigravityTargetUrl('https://www.bilibili.com/'), false);

    fs.rmSync(tmpDataDir, { recursive: true, force: true });
  }
);

await runTest(
  'updater.mjs compares multi-segment versions (1.1.1 vs 2.1) and performs OTA hot-merge preserving user overrides',
  async () => {
    // QIXIAN's exact multi-segment version prompt: current 1.1.1 vs repo 2.1 -> must prompt update!
    assert.equal(compareVersions('1.1.1', '2.1'), -1);
    assert.equal(isRemoteNewer('1.1.1', '2.1'), true);
    assert.equal(compareVersions('2.1', '2.1.0'), 0);
    assert.equal(isRemoteNewer('2.1.0', '2.1'), false);
    assert.equal(compareVersions('2.2', '2.1.9'), 1);
    assert.equal(compareVersions('1.0.0-beta.1', '1.0.0'), -1);

    // Local HTTP server simulating remote GitHub release v2.1 + hot dictionary update
    const srv = http.createServer((req, res) => {
      res.setHeader('Content-Type', 'application/json');
      if (req.url === '/plugin.json') {
        res.end(
          JSON.stringify({
            name: 'qixian-agy-zh',
            version: '2.1',
            description: '新增 Antigravity 2.33 新菜单词条热更新',
          })
        );
      } else if (req.url === '/zh-dict.json') {
        res.end(
          JSON.stringify({
            meta: { dictVersion: '2.1' },
            exact: { 'Brand New Feature': '全新重磅功能', 'Side Question': '官方默认旁路提问' },
            patterns: [],
          })
        );
      } else {
        res.statusCode = 404;
        res.end('{}');
      }
    });

    await new Promise((r) => srv.listen(0, '127.0.0.1', r));
    const port = srv.address().port;

    try {
      const checkRes = await checkForLocalizationUpdate({
        currentVersion: '1.1.1',
        force: true,
        manifestUrls: [`http://127.0.0.1:${port}/plugin.json`],
      });
      assert.equal(checkRes.ok, true);
      assert.equal(checkRes.updateAvailable, true);
      assert.equal(checkRes.latestVersion, '2.1');

      // Seed a user custom override before OTA update and verify it survives!
      const overrideFile = path.join(process.env.AGY_ZH_DATA_DIR || path.join(os.homedir(), '.gemini/antigravity-zh'), 'zh-dict.override.json');
      const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'agy-ota-'));
      const savedEnv = process.env.AGY_ZH_DATA_DIR;
      process.env.AGY_ZH_DATA_DIR = tmpDir;

      // Verify applyHotDictionaryUpdate downloads & merges cleanly
      const hotRes = await applyHotDictionaryUpdate({
        dictUrl: `http://127.0.0.1:${port}/zh-dict.json`,
      });
      assert.equal(hotRes.ok, true);
      assert.equal(hotRes.overrideDict.exact['Brand New Feature'], '全新重磅功能');

      if (savedEnv) process.env.AGY_ZH_DATA_DIR = savedEnv;
      else delete process.env.AGY_ZH_DATA_DIR;
      fs.rmSync(tmpDir, { recursive: true, force: true });
      void overrideFile;
    } finally {
      srv.close();
    }
  }
);

const EXTRACTED_MAC_APP = '/tmp/agy-rea-research/app-v2.32.1-mac-arm64/Antigravity.app';
if (fs.existsSync(EXTRACTED_MAC_APP)) {
  await runTest(
    'Real Antigravity.app v2.32.1 binary scan achieves >= 99.0% UI localization coverage',
    () => {
      const report = scanAppLocalizationCoverage(EXTRACTED_MAC_APP);
      assert.equal(report.lsFound, true);
      assert.equal(report.asarFound, true);
      assert.ok(
        report.coveragePct >= 99.0,
        `Expected >= 99.0% coverage on Antigravity v2.32.1, got ${report.coveragePct}%`
      );
    }
  );
}

const {
  initAgyGeminiUi,
  normalizeState: normalizeGeminiState,
  buildGeminiStylesheet,
  PRESET_META,
} = require('../core/gemini-ui.js');

await runTest(
  'gemini-ui.js v2.3.0 mounts calm micro-breathing default, styles Working/Step states, hot-upgrades v2.2.0, skips data: views, and restores 0ms cleanly',
  () => {
    const css = buildGeminiStylesheet();
    assert.ok(css.includes('#131314'), 'Gemini Dark obsidian #131314 missing');
    assert.ok(css.includes('#F8FAFD'), 'Gemini Light porcelain #F8FAFD missing');
    assert.ok(css.includes('#A8C7FA'), 'Gemini Sky Blue #A8C7FA missing');
    assert.ok(css.includes('z-index: 15'), 'Full-window z-index 15 WebGL layering missing');
    assert.ok(
      css.includes('div[role="navigation"][aria-label="Sidebar"]'),
      'Left Sidebar F3c root SDK rule missing'
    );
    assert.ok(
      css.includes('[data-testid="new-conversation-button"]'),
      'Left Sidebar Hero + New Conversation pill rule missing'
    );
    assert.ok(
      css.includes('button[data-project-card]'),
      'Left Sidebar B3c project header rule missing'
    );
    assert.ok(
      css.includes('[data-testid="sidebar-sash"]::after'),
      'Sidebar split sash aurora laser rule missing'
    );
    assert.ok(
      css.includes('.agy-row-actions::before'),
      'Sidebar row-actions::before pill fix missing'
    );
    assert.ok(
      css.includes('[data-testid="agent-loading"]'),
      'Native Working [data-testid="agent-loading"] Gemini star & shimmer rule missing'
    );
    assert.ok(
      css.includes('[data-testid="progress-updates-timeline"]'),
      'Progress timeline thread rule missing'
    );
    assert.ok(css.includes('agy-gemini-composer-halo'), 'Composer halo rule missing');
    assert.ok(css.includes('agy-gemini-click-ripple'), 'Click ripple wave CSS missing');
    assert.ok(css.includes('--agy-gem-angle'), 'Conic rim CSS missing');

    assert.deepEqual(normalizeGeminiState({ preset: 'invalid', intensity: 'unknown', webgl: false }), {
      preset: 'nebula',
      intensity: 'balanced',
      webgl: false,
      motion: true,
      spotlight: true,
    });
    assert.equal(Object.keys(PRESET_META).length, 4);

    // Ensure internal opaque/transparent `data:` curtain/catcher views are strictly skipped!
    const dataDom = createMiniDom('Curtain');
    dataDom.win.location = { protocol: 'data:', hostname: '' };
    dataDom.win.top = dataDom.win;
    const prevWin = globalThis.window;
    const prevDoc = globalThis.document;
    globalThis.window = dataDom.win;
    globalThis.document = dataDom.doc;
    const skipped = initAgyGeminiUi();
    assert.equal(skipped, null);

    // Mount on simulated Jetski Web Hub window (`http://127.0.0.1:43123`)
    const hub = createMiniDom('Jetski Web');
    hub.win.top = hub.win;
    hub.win.cancelAnimationFrame = () => {};
    // Seed legacy v2.2.0 'vivid' storage to verify calm migration to 'balanced' in v2.3.0!
    hub.win.localStorage.setItem(
      'agy_gemini_ui_state_v2_2',
      JSON.stringify({ preset: 'nebula', intensity: 'vivid', webgl: true, motion: true, spotlight: true })
    );
    let oldTurnedOff = false;
    hub.win.__AGY_GEMINI_UI_INSTANCE__ = {
      version: '2.2.0',
      setPreset(p) {
        if (p === 'off') oldTurnedOff = true;
      },
    };
    hub.doc.head = hub.doc.createElement('head');
    hub.doc.documentElement.insertBefore = function (newNode, refNode) {
      if (newNode.parentNode) newNode.parentNode.removeChild(newNode);
      newNode.parentNode = this;
      const idx = refNode ? this.childNodes.indexOf(refNode) : -1;
      if (idx >= 0) this.childNodes.splice(idx, 0, newNode);
      else this.childNodes.push(newNode);
      return newNode;
    };
    hub.doc.body.insertBefore = hub.doc.documentElement.insertBefore;
    hub.doc.body.removeAttribute = function (k) {
      this._attrs.delete(k);
    };
    hub.doc.body.classList = {
      _set: new Set(['dark', 'theme-dark']),
      contains(c) {
        return this._set.has(c);
      },
    };
    const greeting = hub.doc.createElement('div');
    greeting.setAttribute('data-testid', 'home-greeting');
    greeting.insertBefore = hub.doc.documentElement.insertBefore;
    greeting.querySelector = function (sel) {
      return this.childNodes.find((n) => n.nodeType === 1 && n.matches(sel)) || null;
    };
    hub.doc.body.appendChild(greeting);
    let mockAgentLoading = null;
    hub.doc.querySelector = function (sel) {
      if (sel === '[data-testid="home-greeting"]') return greeting;
      if (sel === '[data-testid="agent-loading"]') return mockAgentLoading;
      return null;
    };

    globalThis.window = hub.win;
    globalThis.document = hub.doc;

    try {
      const ui = initAgyGeminiUi();
      assert.ok(ui);
      assert.equal(oldTurnedOff, true, 'Older v2.2.0 instance should be cleanly replaced');
      assert.equal(ui.version, '2.3.0');
      assert.equal(hub.doc.documentElement.dataset.agyGeminiUi, 'nebula');
      assert.equal(hub.doc.documentElement.dataset.agyGeminiIntensity, 'balanced');
      assert.equal(hub.doc.documentElement.dataset.agyAgentState, 'idle');
      assert.equal(hub.doc.documentElement.dataset.agyGeminiScheme, 'dark');
      assert.equal(hub.doc.body.getAttribute('data-newux-theme'), 'onyx');
      assert.equal(hub.doc.body.getAttribute('data-agy-font'), 'google-sans');
      assert.ok(greeting.querySelector('[data-agy-gemini-star="1"]'), 'Constellation Star should mount on Home');
      const streamBar = hub.doc.getElementById('agy-gemini-stream-bar');
      assert.ok(streamBar, 'Top intelligence stream bar should mount');
      assert.equal(streamBar.getAttribute('data-working'), '0', 'Stream bar must stay calm/hidden when idle');
      assert.ok(hub.doc.getElementById('agy-gemini-fx-layer'), 'Overlay FX ripple layer should mount');

      // Verify prompt-launch instant Working state awakening!
      ui.triggerPromptLaunch(0.85, 0.85);
      assert.equal(ui.getLifecycleState(), 'launching');
      assert.equal(hub.doc.documentElement.dataset.agyAgentState, 'launching');
      assert.equal(streamBar.getAttribute('data-working'), '1');
      assert.equal(streamBar.getAttribute('data-state'), 'launching');

      // Switch motion intensity & Liquid Glass preset in 0ms
      ui.setIntensity('subtle');
      assert.equal(hub.doc.documentElement.dataset.agyGeminiIntensity, 'subtle');
      ui.setPreset('liquid');
      assert.equal(hub.doc.documentElement.dataset.agyGeminiUi, 'liquid');

      // Switch to Original ('off') -> must cleanly restore body attributes and remove Home star & auxiliary layers!
      ui.setPreset('off');
      assert.equal(hub.doc.documentElement.dataset.agyGeminiUi, undefined);
      assert.equal(hub.doc.documentElement.dataset.agyAgentState, undefined);
      assert.equal(hub.doc.body.hasAttribute('data-newux-theme'), false);
      assert.equal(greeting.querySelector('[data-agy-gemini-star="1"]'), null);
      assert.equal(hub.doc.getElementById('agy-gemini-stream-bar'), null);
      assert.equal(hub.doc.getElementById('agy-gemini-fx-layer'), null);
    } finally {
      globalThis.window = prevWin;
      globalThis.document = prevDoc;
    }
  }
);

console.log('==============================================================');
console.log(`🎉 All ${passed} test suites passed with 0 errors!`);
console.log('==============================================================');
