'use strict';
/**
 * Antigravity Native Chinese (qixian-agy-zh) — Engine 2: Zero-Dependency CDP Auto-Attach Guard
 *
 * When the user clicks the original `/Applications/Antigravity.app`, opens an `antigravity://`
 * deep link, or restarts after an official `electron-updater` auto-update:
 *   1. Antigravity writes `<userData>/DevToolsActivePort` (`dist/main.js:134, 284`).
 *   2. macOS `LaunchAgent` (`WatchPaths`), Windows Watcher, or Antigravity Sidecar (`sidecar.json`)
 *      wakes up `cdp-daemon.mjs`.
 *   3. `cdp-daemon.mjs` connects to `ws://127.0.0.1:<port><wsPath>` using Node 22+ built-in
 *      `WebSocket` (or built-in `node:http` RFC 6455 client fallback for Node 18/20 — zero npm deps!),
 *      attaches to all local UI targets via `Target.setAutoAttach`, registers
 *      `Page.addScriptToEvaluateOnNewDocument`, and evaluates `zh-engine.js` immediately.
 *   4. Any frame already localized at Frame 0 by Engine 1 (`dataset.agyZhEngine === 'preload'`)
 *      is skipped automatically!
 *   5. In `--guard` mode (macOS `WatchPaths`), once Antigravity closes its WebSocket, the daemon
 *      exits cleanly -> **0% idle CPU and 0 background memory when Antigravity isn't running!**
 */

import fs from 'node:fs';
import os from 'node:os';
import net from 'node:net';
import http from 'node:http';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { checkForLocalizationUpdate, applyHotDictionaryUpdate } from './updater.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DICT_PATH = path.join(__dirname, 'zh-dict.json');
const ENGINE_PATH = path.join(__dirname, 'zh-engine.js');
const GEMINI_UI_PATH = path.join(__dirname, 'gemini-ui.js');
const DATA_DIR =
  process.env.AGY_ZH_DATA_DIR || path.join(os.homedir(), '.gemini', 'antigravity-zh');
const OVERRIDE_DICT_PATH = path.join(DATA_DIR, 'zh-dict.override.json');
const STATE_FILE = path.join(DATA_DIR, 'lang-state.json');
const UI_STATE_FILE = path.join(DATA_DIR, 'ui-state.json');
const LOCK_FILE = path.join(DATA_DIR, 'cdp-daemon.lock');

/**
 * Minimal RFC 6455 WebSocket client over `node:http` so even Node 18/20 without global `WebSocket`
 * works with ZERO `node_modules` dependencies! Uses native `globalThis.WebSocket` when available.
 */
class MinimalLoopbackWs {
  constructor(url) {
    this.url = url;
    this.listeners = { open: [], message: [], close: [], error: [] };
    this._socket = null;
    this._buf = Buffer.alloc(0);
    this._connect();
  }

  addEventListener(type, fn) {
    if (this.listeners[type]) this.listeners[type].push(fn);
  }

  _emit(type, payload) {
    for (const fn of this.listeners[type] || []) {
      try {
        fn(payload);
      } catch (_) {}
    }
  }

  _connect() {
    const parsed = new URL(this.url);
    const key = crypto.randomBytes(16).toString('base64');
    const req = http.request({
      hostname: parsed.hostname || '127.0.0.1',
      port: Number(parsed.port),
      path: parsed.pathname + parsed.search,
      method: 'GET',
      headers: {
        Connection: 'Upgrade',
        Upgrade: 'websocket',
        'Sec-WebSocket-Version': '13',
        'Sec-WebSocket-Key': key,
      },
    });

    req.on('upgrade', (_res, socket, head) => {
      this._socket = socket;
      socket.setNoDelay(true);
      if (head && head.length) this._onData(head);
      socket.on('data', (chunk) => this._onData(chunk));
      socket.on('close', () => this._emit('close', {}));
      socket.on('error', (err) => this._emit('error', err));
      this._emit('open', {});
    });

    req.on('response', (res) => {
      res.resume();
      this._emit('error', new Error(`Unexpected HTTP ${res.statusCode}`));
      this._emit('close', {});
    });

    req.on('error', (err) => {
      this._emit('error', err);
      this._emit('close', {});
    });

    req.end();
  }

  _onData(chunk) {
    this._buf = Buffer.concat([this._buf, chunk]);
    while (this._buf.length >= 2) {
      const b0 = this._buf[0];
      const b1 = this._buf[1];
      const opcode = b0 & 0x0f;
      const masked = (b1 & 0x80) !== 0;
      let len = b1 & 0x7f;
      let offset = 2;

      if (len === 126) {
        if (this._buf.length < 4) return;
        len = this._buf.readUInt16BE(2);
        offset = 4;
      } else if (len === 127) {
        if (this._buf.length < 10) return;
        len = Number(this._buf.readBigUInt64BE(2));
        offset = 10;
      }

      const maskLen = masked ? 4 : 0;
      if (this._buf.length < offset + maskLen + len) return;

      let payload = this._buf.subarray(offset + maskLen, offset + maskLen + len);
      if (masked) {
        const mask = this._buf.subarray(offset, offset + 4);
        payload = Buffer.from(payload);
        for (let i = 0; i < payload.length; i++) payload[i] ^= mask[i & 3];
      }
      this._buf = this._buf.subarray(offset + maskLen + len);

      if (opcode === 0x1) {
        this._emit('message', { data: payload.toString('utf8') });
      } else if (opcode === 0x8) {
        this.close();
        return;
      } else if (opcode === 0x9) {
        this._sendFrame(0x0a, payload); // Pong
      }
    }
  }

  _sendFrame(opcode, dataBuf) {
    if (!this._socket || this._socket.destroyed) return;
    const mask = crypto.randomBytes(4);
    const len = dataBuf.length;
    let header;
    if (len < 126) {
      header = Buffer.alloc(2);
      header[0] = 0x80 | opcode;
      header[1] = 0x80 | len;
    } else if (len < 65536) {
      header = Buffer.alloc(4);
      header[0] = 0x80 | opcode;
      header[1] = 0x80 | 126;
      header.writeUInt16BE(len, 2);
    } else {
      header = Buffer.alloc(10);
      header[0] = 0x80 | opcode;
      header[1] = 0x80 | 127;
      header.writeBigUInt64BE(BigInt(len), 2);
    }
    const maskedPayload = Buffer.allocUnsafe(len);
    for (let i = 0; i < len; i++) {
      maskedPayload[i] = dataBuf[i] ^ mask[i & 3];
    }
    this._socket.write(Buffer.concat([header, mask, maskedPayload]));
  }

  send(str) {
    this._sendFrame(0x01, Buffer.from(str, 'utf8'));
  }

  close() {
    if (this._socket && !this._socket.destroyed) {
      this._socket.end();
    }
  }
}

function openWebSocket(url) {
  if (typeof globalThis.WebSocket === 'function') {
    return new globalThis.WebSocket(url);
  }
  return new MinimalLoopbackWs(url);
}

/**
 * Candidate paths for Antigravity's `DevToolsActivePort` across macOS, Windows, and Linux.
 */
export function getActivePortCandidatePaths() {
  const home = os.homedir();
  const candidates = [];
  if (process.env.AGY_DEVTOOLS_ACTIVE_PORT_FILE) {
    candidates.push(process.env.AGY_DEVTOOLS_ACTIVE_PORT_FILE);
  }
  if (process.platform === 'darwin') {
    candidates.push(
      path.join(home, 'Library', 'Application Support', 'Antigravity', 'DevToolsActivePort'),
      path.join(home, 'Library', 'Application Support', 'Antigravity - Insiders', 'DevToolsActivePort')
    );
  } else if (process.platform === 'win32') {
    const appData = process.env.APPDATA || path.join(home, 'AppData', 'Roaming');
    candidates.push(
      path.join(appData, 'Antigravity', 'DevToolsActivePort'),
      path.join(appData, 'Antigravity - Insiders', 'DevToolsActivePort')
    );
  } else {
    const xdg = process.env.XDG_CONFIG_HOME || path.join(home, '.config');
    candidates.push(
      path.join(xdg, 'Antigravity', 'DevToolsActivePort'),
      path.join(xdg, 'Antigravity - Insiders', 'DevToolsActivePort')
    );
  }
  return candidates;
}

export function readDevToolsEndpoint() {
  for (const file of getActivePortCandidatePaths()) {
    try {
      if (!fs.existsSync(file)) continue;
      const lines = fs
        .readFileSync(file, 'utf8')
        .split(/\r?\n/)
        .map((s) => s.trim())
        .filter(Boolean);
      const port = Number.parseInt(lines[0], 10);
      const wsPath = lines[1] || '/devtools/browser';
      if (Number.isInteger(port) && port > 0 && port < 65536) {
        return { file, port, wsPath, wsUrl: `ws://127.0.0.1:${port}${wsPath}` };
      }
    } catch (_) {}
  }
  return null;
}

export function isLocalAntigravityTargetUrl(rawUrl) {
  if (!rawUrl || typeof rawUrl !== 'string') return false;
  if (
    rawUrl.startsWith('plugin://') ||
    rawUrl.startsWith('data:text/html') ||
    rawUrl.startsWith('agy-app://')
  ) {
    return true;
  }
  try {
    const u = new URL(rawUrl);
    if (
      (u.protocol === 'http:' || u.protocol === 'https:') &&
      (u.hostname === '127.0.0.1' || u.hostname === 'localhost' || u.hostname === '[::1]')
    ) {
      return true;
    }
  } catch (_) {}
  return false;
}

export function buildInjectionPayload() {
  const engineCode = fs.readFileSync(ENGINE_PATH, 'utf8');
  const geminiUiCode = fs.existsSync(GEMINI_UI_PATH) ? fs.readFileSync(GEMINI_UI_PATH, 'utf8') : '';
  const dictObj = JSON.parse(fs.readFileSync(DICT_PATH, 'utf8'));
  let overrideObj = null;
  let initialLang = 'zh-CN';
  let initialUiState = null;

  try {
    if (fs.existsSync(OVERRIDE_DICT_PATH)) {
      overrideObj = JSON.parse(fs.readFileSync(OVERRIDE_DICT_PATH, 'utf8'));
    }
  } catch (_) {}

  try {
    if (fs.existsSync(STATE_FILE)) {
      const st = JSON.parse(fs.readFileSync(STATE_FILE, 'utf8'));
      if (st?.lang === 'en' || st?.lang === 'zh-CN') initialLang = st.lang;
    }
  } catch (_) {}

  try {
    if (fs.existsSync(UI_STATE_FILE)) {
      initialUiState = JSON.parse(fs.readFileSync(UI_STATE_FILE, 'utf8'));
    }
  } catch (_) {}

  return `(function(){
  if (typeof window === 'undefined' || typeof document === 'undefined') return 'no-dom';
  const loc = window.location;
  if (!loc) return 'no-loc';
  const proto = loc.protocol || '';
  const host = loc.hostname || '';
  const ok = proto === 'plugin:' || proto === 'data:' || proto === 'agy-app:' ||
    ((proto === 'http:' || proto === 'https:') && (host === '127.0.0.1' || host === 'localhost' || host === '[::1]'));
  if (!ok) return 'skipped-origin';
  const rootDs = (document.documentElement && document.documentElement.dataset) || {};
  const alreadyPreload = rootDs.agyZhEngine === 'preload';
  const targetDictVer = ${JSON.stringify(String(dictObj?.meta?.dictVersion || '2.3.0'))};
  const needsDictSupplement = alreadyPreload && rootDs.agyZhDictVer !== targetDictVer;
  if (!alreadyPreload || needsDictSupplement) {
    if (!window.__AGY_ZH_MODULE__) {
      ${engineCode}
    }
    const mod = window.__AGY_ZH_MODULE__;
    if (mod && typeof mod.initAgyZhEngine === 'function') {
      mod.initAgyZhEngine({
        mode: alreadyPreload ? 'cdp-supplement' : 'cdp',
        supplementPreload: alreadyPreload,
        dict: ${JSON.stringify(dictObj)},
        overrideDict: ${JSON.stringify(overrideObj)},
        initialLang: ${JSON.stringify(initialLang)}
      });
    }
  }
  if (!window.__AGY_GEMINI_UI_MODULE__ || window.__AGY_GEMINI_UI_MODULE__.VERSION !== '2.3.0') {
    ${geminiUiCode}
  }
  const uiMod = window.__AGY_GEMINI_UI_MODULE__;
  if (uiMod && typeof uiMod.initAgyGeminiUi === 'function') {
    uiMod.initAgyGeminiUi({
      initialState: ${JSON.stringify(initialUiState)}
    });
  }
  return alreadyPreload ? 'upgraded-ui-on-preload' : 'injected-cdp';
})();`;
}

function isPortAlive(port, timeoutMs = 800) {
  return new Promise((resolve) => {
    const sock = net.connect({ host: '127.0.0.1', port });
    const done = (ok) => {
      sock.destroy();
      resolve(ok);
    };
    sock.setTimeout(timeoutMs);
    sock.once('connect', () => done(true));
    sock.once('timeout', () => done(false));
    sock.once('error', () => done(false));
  });
}

function acquireSingleInstanceLock() {
  try {
    fs.mkdirSync(DATA_DIR, { recursive: true });
    if (fs.existsSync(LOCK_FILE)) {
      const prevPid = Number.parseInt(fs.readFileSync(LOCK_FILE, 'utf8').trim(), 10);
      if (prevPid && prevPid !== process.pid) {
        try {
          process.kill(prevPid, 0);
          return false; // Another daemon instance is already alive!
        } catch (_) {
          // Stale lockfile
        }
      }
    }
    fs.writeFileSync(LOCK_FILE, String(process.pid), 'utf8');
    const cleanup = () => {
      try {
        if (fs.existsSync(LOCK_FILE) && fs.readFileSync(LOCK_FILE, 'utf8').trim() === String(process.pid)) {
          fs.unlinkSync(LOCK_FILE);
        }
      } catch (_) {}
    };
    process.on('exit', cleanup);
    process.on('SIGINT', () => {
      cleanup();
      process.exit(0);
    });
    process.on('SIGTERM', () => {
      cleanup();
      process.exit(0);
    });
    return true;
  } catch (_) {
    return true;
  }
}

async function attachAndLocalizeSession(endpoint, { once = false } = {}) {
  const scriptSource = buildInjectionPayload();

  return new Promise((resolve) => {
    const ws = openWebSocket(endpoint.wsUrl);
    let nextId = 1;
    const pending = new Map();
    const attachedSessions = new Set();

    function sendCdp(method, params = {}, sessionId = undefined) {
      const id = nextId++;
      const msg = sessionId ? { id, method, params, sessionId } : { id, method, params };
      return new Promise((res, rej) => {
        pending.set(id, { res, rej });
        try {
          ws.send(JSON.stringify(msg));
        } catch (err) {
          pending.delete(id);
          rej(err);
        }
      });
    }

    async function localizeTargetSession(sessionId, targetInfo) {
      if (!sessionId || attachedSessions.has(sessionId)) return;
      const tType = targetInfo?.type || '';
      if (tType !== 'page' && tType !== 'iframe' && tType !== 'webview' && tType !== 'other') {
        return;
      }
      attachedSessions.add(sessionId);
      try {
        await sendCdp('Page.enable', {}, sessionId).catch(() => {});
        await sendCdp('Runtime.enable', {}, sessionId).catch(() => {});
        await sendCdp(
          'Page.addScriptToEvaluateOnNewDocument',
          { source: scriptSource },
          sessionId
        ).catch(() => {});

        if (!targetInfo?.url || isLocalAntigravityTargetUrl(targetInfo.url)) {
          await sendCdp(
            'Runtime.evaluate',
            { expression: scriptSource, returnByValue: true },
            sessionId
          ).catch(() => {});
        }
      } catch (_) {}
    }

    ws.addEventListener('open', async () => {
      try {
        await sendCdp('Target.setDiscoverTargets', { discover: true });
        await sendCdp('Target.setAutoAttach', {
          autoAttach: true,
          waitForDebuggerOnStart: false,
          flatten: true,
        });

        const { targetInfos = [] } = await sendCdp('Target.getTargets');
        for (const t of targetInfos) {
          if (
            (t.type === 'page' || t.type === 'iframe') &&
            (!t.url || isLocalAntigravityTargetUrl(t.url))
          ) {
            try {
              const { sessionId } = await sendCdp('Target.attachToTarget', {
                targetId: t.targetId,
                flatten: true,
              });
              await localizeTargetSession(sessionId, t);
            } catch (_) {}
          }
        }

        if (once) {
          setTimeout(() => {
            ws.close();
            resolve(true);
          }, 350);
          return;
        }

        // Check for OTA updates once after attaching
        setTimeout(async () => {
          try {
            const info = await checkForLocalizationUpdate();
            if (info?.updateAvailable) {
              const notifyExpr = `document.dispatchEvent(new CustomEvent('agy-zh:update-notify', { detail: ${JSON.stringify(info)} }));`;
              for (const sid of attachedSessions) {
                sendCdp('Runtime.evaluate', { expression: notifyExpr }, sid).catch(() => {});
              }
            }
          } catch (_) {}
        }, 10000);
      } catch (_) {
        ws.close();
      }
    });

    ws.addEventListener('message', (ev) => {
      let msg;
      try {
        const raw = typeof ev.data === 'string' ? ev.data : Buffer.from(ev.data).toString('utf8');
        msg = JSON.parse(raw);
      } catch (_) {
        return;
      }

      if (msg.id && pending.has(msg.id)) {
        const { res, rej } = pending.get(msg.id);
        pending.delete(msg.id);
        if (msg.error) rej(new Error(msg.error.message || 'CDP error'));
        else res(msg.result || {});
        return;
      }

      if (msg.method === 'Target.attachedToTarget' && msg.params?.sessionId) {
        void localizeTargetSession(msg.params.sessionId, msg.params.targetInfo);
      } else if (msg.method === 'Target.detachedFromTarget' && msg.params?.sessionId) {
        attachedSessions.delete(msg.params.sessionId);
      } else if (
        msg.method === 'Target.targetInfoChanged' &&
        msg.params?.targetInfo &&
        isLocalAntigravityTargetUrl(msg.params.targetInfo.url)
      ) {
        sendCdp('Target.attachToTarget', {
          targetId: msg.params.targetInfo.targetId,
          flatten: true,
        })
          .then(({ sessionId }) => localizeTargetSession(sessionId, msg.params.targetInfo))
          .catch(() => {});
      }
    });

    ws.addEventListener('close', () => {
      for (const { rej } of pending.values()) rej(new Error('closed'));
      pending.clear();
      resolve(false);
    });

    ws.addEventListener('error', () => {});
  });
}

async function main() {
  const args = new Set(process.argv.slice(2));
  const isOnce = args.has('--once');
  const isSidecar = args.has('--sidecar');
  const isHotUpdate = args.has('--hot-update');

  if (isHotUpdate) {
    const res = await applyHotDictionaryUpdate();
    console.log(JSON.stringify(res));
    return;
  }

  if (!isOnce && !acquireSingleInstanceLock()) {
    process.exit(0);
  }

  // Wait briefly for DevToolsActivePort to appear on fresh launch
  for (let attempt = 0; attempt < (isOnce ? 8 : 20); attempt++) {
    const ep = readDevToolsEndpoint();
    if (ep && (await isPortAlive(ep.port))) {
      await attachAndLocalizeSession(ep, { once: isOnce });
      if (!isSidecar) {
        // In macOS LaunchAgent WatchPaths / Windows guard mode, exit cleanly when Antigravity quits -> 0% idle CPU!
        process.exit(0);
      }
      break;
    }
    await new Promise((r) => setTimeout(r, 500));
  }

  // In continuous `--sidecar` mode (managed by language_server), watch for reconnects cleanly
  if (isSidecar) {
    while (true) {
      const ep = readDevToolsEndpoint();
      if (ep && (await isPortAlive(ep.port))) {
        await attachAndLocalizeSession(ep, { once: false });
      }
      await new Promise((r) => setTimeout(r, 3000));
    }
  }
}

const isDirectRun =
  process.argv[1] && path.resolve(process.argv[1]) === path.resolve(fileURLToPath(import.meta.url));
if (isDirectRun) {
  main().catch(() => process.exit(0));
}
