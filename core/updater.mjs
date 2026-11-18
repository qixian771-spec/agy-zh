/**
 * Antigravity Native Chinese (qixian-agy-zh) — Multi-Segment Version Comparator & OTA Dictionary Updater
 *
 * Supports multi-segment version comparisons like `1.1.1` vs `2.1` (`compareVersions('1.1.1', '2.1') < 0`),
 * silent background checks with graceful offline/403 fallback, and 1-click hot dictionary patching to
 * `~/.gemini/antigravity-zh/zh-dict.override.json`.
 */
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import https from 'node:https';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export const DEFAULT_REPO = 'qixian772/agy-zh';
export const DATA_DIR =
  process.env.AGY_ZH_DATA_DIR || path.join(os.homedir(), '.gemini', 'antigravity-zh');
export const OVERRIDE_DICT_PATH = path.join(DATA_DIR, 'zh-dict.override.json');
export const UPDATE_CACHE_PATH = path.join(DATA_DIR, 'update-check-cache.json');

/**
 * Parses a version string such as "v2.1", "1.1.1", "2.1.0-beta.1" into numeric segments.
 * Example:
 *   compareVersions("1.1.1", "2.1")   -> -1  (2.1 is newer!)
 *   compareVersions("2.1.0", "2.1")   ->  0  (equal)
 *   compareVersions("2.2", "2.1.9")   ->  1  (2.2 is newer!)
 */
export function parseVersionSegments(ver) {
  if (typeof ver !== 'string' && typeof ver !== 'number') return [0];
  const cleaned = String(ver).trim().replace(/^[vV]/, '');
  const [mainPart, prePart] = cleaned.split('-', 2);
  const nums = mainPart
    .split('.')
    .map((seg) => {
      const m = /^(\d+)/.exec(seg.trim());
      return m ? Number.parseInt(m[1], 10) : 0;
    });
  return { nums: nums.length ? nums : [0], prerelease: prePart || null };
}

export function compareVersions(vA, vB) {
  const a = parseVersionSegments(vA);
  const b = parseVersionSegments(vB);
  const maxLen = Math.max(a.nums.length, b.nums.length);
  for (let i = 0; i < maxLen; i++) {
    const na = i < a.nums.length ? a.nums[i] : 0;
    const nb = i < b.nums.length ? b.nums[i] : 0;
    if (na < nb) return -1;
    if (na > nb) return 1;
  }
  // Stable release > prerelease of same numeric tuple (e.g. 1.0.0 > 1.0.0-beta.1)
  if (a.prerelease && !b.prerelease) return -1;
  if (!a.prerelease && b.prerelease) return 1;
  if (a.prerelease && b.prerelease && a.prerelease !== b.prerelease) {
    return a.prerelease < b.prerelease ? -1 : 1;
  }
  return 0;
}

export function isRemoteNewer(currentVersion, remoteVersion) {
  if (!remoteVersion) return false;
  return compareVersions(currentVersion || '0.0.0', remoteVersion) < 0;
}

export function readLocalVersion() {
  try {
    const pluginJsonPath = path.resolve(__dirname, '..', 'plugin.json');
    const pkg = JSON.parse(fs.readFileSync(pluginJsonPath, 'utf8'));
    return pkg.version || '1.0.0';
  } catch {
    return '1.0.0';
  }
}

export function readLocalDictVersion() {
  try {
    if (fs.existsSync(OVERRIDE_DICT_PATH)) {
      const ov = JSON.parse(fs.readFileSync(OVERRIDE_DICT_PATH, 'utf8'));
      if (ov?.meta?.dictVersion) return ov.meta.dictVersion;
    }
    const dictPath = path.resolve(__dirname, 'zh-dict.json');
    const d = JSON.parse(fs.readFileSync(dictPath, 'utf8'));
    return d?.meta?.dictVersion || '1.0.0';
  } catch {
    return '1.0.0';
  }
}

function fetchJson(url, timeoutMs = 6000) {
  if (typeof globalThis.fetch === 'function') {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), timeoutMs);
    return globalThis
      .fetch(url, {
        signal: ctrl.signal,
        headers: {
          Accept: 'application/json',
          'User-Agent': 'qixian-agy-zh-updater/1.0',
        },
      })
      .then(async (res) => {
        clearTimeout(timer);
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        return res.json();
      })
      .catch((err) => {
        clearTimeout(timer);
        throw err;
      });
  }

  return new Promise((resolve, reject) => {
    const req = https.get(
      url,
      {
        timeout: timeoutMs,
        headers: {
          Accept: 'application/json',
          'User-Agent': 'qixian-agy-zh-updater/1.0',
        },
      },
      (res) => {
        if (!res.statusCode || res.statusCode < 200 || res.statusCode >= 300) {
          res.resume();
          reject(new Error(`HTTP ${res.statusCode}`));
          return;
        }
        let body = '';
        res.setEncoding('utf8');
        res.on('data', (chunk) => (body += chunk));
        res.on('end', () => {
          try {
            resolve(JSON.parse(body));
          } catch (e) {
            reject(e);
          }
        });
      }
    );
    req.on('error', reject);
    req.on('timeout', () => {
      req.destroy(new Error('Request timeout'));
    });
  });
}

/**
 * Non-blocking check against GitHub raw `plugin.json` / Releases API.
 * Never throws on offline, proxy, or HTTP 403 conditions.
 */
export async function checkForLocalizationUpdate(options = {}) {
  const repo = options.repo || process.env.AGY_ZH_REPO || DEFAULT_REPO;
  const currentVersion = options.currentVersion || readLocalVersion();
  const force = Boolean(options.force);
  const checkIntervalMs = options.checkIntervalMs ?? 6 * 3600 * 1000;

  if (!force) {
    try {
      if (fs.existsSync(UPDATE_CACHE_PATH)) {
        const cached = JSON.parse(fs.readFileSync(UPDATE_CACHE_PATH, 'utf8'));
        if (cached && Date.now() - (cached.checkedAt || 0) < checkIntervalMs) {
          return {
            ...cached,
            currentVersion,
            updateAvailable: isRemoteNewer(currentVersion, cached.latestVersion),
            fromCache: true,
          };
        }
      }
    } catch {
      // Ignore corrupt cache
    }
  }

  const urls = options.manifestUrls || [
    `https://raw.githubusercontent.com/${repo}/main/plugin.json`,
    `https://api.github.com/repos/${repo}/releases/latest`,
  ];

  let latestVersion = null;
  let notes = '';
  let releaseUrl = `https://github.com/${repo}/releases/latest`;

  for (const url of urls) {
    try {
      const data = await fetchJson(url, options.timeoutMs || 5000);
      if (data && typeof data.version === 'string') {
        latestVersion = data.version.replace(/^[vV]/, '');
        notes = data.changelog || data.description || '';
        break;
      }
      if (data && typeof data.tag_name === 'string') {
        latestVersion = data.tag_name.replace(/^[vV]/, '');
        notes = typeof data.body === 'string' ? data.body.split('\n')[0].slice(0, 120) : '';
        if (data.html_url) releaseUrl = data.html_url;
        break;
      }
    } catch {
      // Try next endpoint quietly
    }
  }

  if (!latestVersion) {
    return {
      ok: false,
      updateAvailable: false,
      currentVersion,
      latestVersion: currentVersion,
      releaseUrl,
    };
  }

  const result = {
    ok: true,
    checkedAt: Date.now(),
    currentVersion,
    latestVersion,
    updateAvailable: isRemoteNewer(currentVersion, latestVersion),
    notes,
    releaseUrl,
    dictUrl: `https://raw.githubusercontent.com/${repo}/main/core/zh-dict.json`,
  };

  try {
    fs.mkdirSync(DATA_DIR, { recursive: true });
    fs.writeFileSync(UPDATE_CACHE_PATH, JSON.stringify(result, null, 2), 'utf8');
  } catch {
    // Non-fatal
  }

  return result;
}

/**
 * Downloads the latest `zh-dict.json` from GitHub and merges it with any user custom overrides
 * inside `~/.gemini/antigravity-zh/zh-dict.override.json` without losing user customizations!
 */
export async function applyHotDictionaryUpdate(options = {}) {
  const repo = options.repo || process.env.AGY_ZH_REPO || DEFAULT_REPO;
  const dictUrl =
    options.dictUrl || `https://raw.githubusercontent.com/${repo}/main/core/zh-dict.json`;

  const remoteDict = await fetchJson(dictUrl, options.timeoutMs || 8000);
  if (!remoteDict || typeof remoteDict.exact !== 'object') {
    throw new Error('Invalid remote zh-dict.json structure');
  }

  let existingUserExact = {};
  let existingUserPatterns = [];
  try {
    if (fs.existsSync(OVERRIDE_DICT_PATH)) {
      const prev = JSON.parse(fs.readFileSync(OVERRIDE_DICT_PATH, 'utf8'));
      if (prev?.userExact && typeof prev.userExact === 'object') {
        existingUserExact = prev.userExact;
      }
      if (Array.isArray(prev?.userPatterns)) {
        existingUserPatterns = prev.userPatterns;
      }
    }
  } catch {
    // Ignore
  }

  const mergedOverride = {
    meta: {
      ...(remoteDict.meta || {}),
      hotUpdatedAt: new Date().toISOString(),
    },
    userExact: existingUserExact,
    userPatterns: existingUserPatterns,
    exact: {
      ...remoteDict.exact,
      ...existingUserExact,
    },
    patterns: [...existingUserPatterns, ...(remoteDict.patterns || [])],
  };

  fs.mkdirSync(DATA_DIR, { recursive: true });
  fs.writeFileSync(OVERRIDE_DICT_PATH, JSON.stringify(mergedOverride, null, 2), 'utf8');

  return {
    ok: true,
    overridePath: OVERRIDE_DICT_PATH,
    dictVersion: mergedOverride.meta.dictVersion || 'latest',
    overrideDict: mergedOverride,
  };
}
