#!/usr/bin/env node
/**
 * Antigravity Native Chinese (qixian-agy-zh) — Zero-Dependency Official App UI String Scanner
 *
 * Directly inspects an installed `Antigravity.app` (macOS), Windows install dir, or Linux dir:
 *   1. Locates the embedded `Jetski Web` ZIP inside `language_server` and inflates `main.js`
 *      in-memory via Node's built-in `node:zlib` (zero `unzip` or Python dependency!).
 *   2. Parses Electron's `app.asar` header in pure JS to inspect `dist/*.js` host menus/dialogs.
 *   3. Compares discovered UI strings against `core/zh-dict.json` (+ user overrides) and reports
 *      coverage % plus any newly added untranslated strings after an official Antigravity update!
 *
 * Usage:
 *   node scripts/scan_untranslated.mjs [--app "/Applications/Antigravity.app"] [--json out.json]
 */

import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import zlib from 'node:zlib';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';

const require = createRequire(import.meta.url);
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const { createTranslator } = require('../core/zh-engine.js');

function resolveDefaultAppRoot() {
  if (process.platform === 'darwin') {
    for (const p of ['/Applications/Antigravity.app', path.join(os.homedir(), 'Applications/Antigravity.app')]) {
      if (fs.existsSync(p)) return p;
    }
  } else if (process.platform === 'win32') {
    const localAppData = process.env.LOCALAPPDATA || path.join(os.homedir(), 'AppData', 'Local');
    const p = path.join(localAppData, 'Programs', 'Antigravity');
    if (fs.existsSync(p)) return p;
  } else {
    for (const p of ['/opt/Antigravity', '/usr/share/antigravity']) {
      if (fs.existsSync(p)) return p;
    }
  }
  return null;
}

function locateBinaries(appRoot) {
  const candidatesLs = [
    path.join(appRoot, 'Contents', 'Resources', 'bin', 'language_server'),
    path.join(appRoot, 'resources', 'bin', 'language_server.exe'),
    path.join(appRoot, 'resources', 'bin', 'language_server'),
  ];
  const candidatesAsar = [
    path.join(appRoot, 'Contents', 'Resources', 'app.asar'),
    path.join(appRoot, 'resources', 'app.asar'),
  ];
  return {
    lsPath: candidatesLs.find((p) => fs.existsSync(p)) || null,
    asarPath: candidatesAsar.find((p) => fs.existsSync(p)) || null,
  };
}

/**
 * Extracts `main.js` from the embedded ZIP archive inside `language_server` using pure `node:zlib`.
 */
export function extractEmbeddedWebMainJs(lsPath) {
  const buf = fs.readFileSync(lsPath);
  const eocdSig = Buffer.from([0x50, 0x4b, 0x05, 0x06]);
  const cdSig = Buffer.from([0x50, 0x4b, 0x01, 0x02]);

  // Scan all ZIP EOCD records in the binary using fast native C++ Buffer.indexOf (<50ms for 250MB!)
  let searchFrom = 0;
  while (searchFrom < buf.length - 22) {
    const eocdPos = buf.indexOf(eocdSig, searchFrom);
    if (eocdPos < 0) break;
    searchFrom = eocdPos + 4;

    if (eocdPos + 22 > buf.length) break;
    const totalEntries = buf.readUInt16LE(eocdPos + 10);
    const cdSize = buf.readUInt32LE(eocdPos + 12);
    const cdOffsetRel = buf.readUInt32LE(eocdPos + 16);

    if (totalEntries === 0 || totalEntries > 10000 || cdSize === 0 || cdSize > 16 * 1024 * 1024) {
      continue;
    }
    const zipBase = eocdPos - cdSize - cdOffsetRel;
    if (zipBase < 0 || zipBase + cdOffsetRel >= buf.length) continue;
    if (buf.subarray(zipBase + cdOffsetRel, zipBase + cdOffsetRel + 4).compare(cdSig) !== 0) {
      continue;
    }

    let ptr = zipBase + cdOffsetRel;
    for (let n = 0; n < totalEntries && ptr + 46 <= eocdPos; n++) {
      if (buf.readUInt32LE(ptr) !== 0x02014b50) break;
      const method = buf.readUInt16LE(ptr + 10);
      const compSize = buf.readUInt32LE(ptr + 20);
      const nameLen = buf.readUInt16LE(ptr + 28);
      const extraLen = buf.readUInt16LE(ptr + 30);
      const commentLen = buf.readUInt16LE(ptr + 32);
      const localHeaderRel = buf.readUInt32LE(ptr + 42);
      const fileName = buf.subarray(ptr + 46, ptr + 46 + nameLen).toString('utf8');

      if (fileName === 'main.js' || fileName.endsWith('/main.js')) {
        const lfh = zipBase + localHeaderRel;
        if (buf.readUInt32LE(lfh) !== 0x04034b50) break;
        const lNameLen = buf.readUInt16LE(lfh + 26);
        const lExtraLen = buf.readUInt16LE(lfh + 28);
        const dataStart = lfh + 30 + lNameLen + lExtraLen;
        const compSlice = buf.subarray(dataStart, dataStart + compSize);
        if (method === 0) return compSlice.toString('utf8');
        if (method === 8) return zlib.inflateRawSync(compSlice).toString('utf8');
      }
      ptr += 46 + nameLen + extraLen + commentLen;
    }
  }

  throw new Error('main.js not found inside embedded language_server ZIP');
}

/**
 * Reads `dist/*.js` files directly from Electron's `app.asar` without external npm packages.
 */
export function extractAsarDistJsConcatenated(asarPath) {
  const fd = fs.openSync(asarPath, 'r');
  try {
    const headerPre = Buffer.alloc(16);
    fs.readSync(fd, headerPre, 0, 16, 0);
    const headerOuterSize = headerPre.readUInt32LE(4);
    const jsonByteLen = headerPre.readUInt32LE(12);
    const jsonBuf = Buffer.alloc(jsonByteLen);
    fs.readSync(fd, jsonBuf, 0, jsonByteLen, 16);
    const tree = JSON.parse(jsonBuf.toString('utf8'));
    const dataBaseOffset = 8 + headerOuterSize;

    const distFiles = tree?.files?.dist?.files || {};
    const chunks = [];

    function readNode(nodeObj, relPrefix) {
      for (const [name, meta] of Object.entries(nodeObj)) {
        const cur = relPrefix ? `${relPrefix}/${name}` : name;
        if (meta.files) {
          readNode(meta.files, cur);
        } else if (cur.endsWith('.js') && !meta.unpacked && meta.size && meta.offset !== undefined) {
          const b = Buffer.alloc(meta.size);
          fs.readSync(fd, b, 0, meta.size, dataBaseOffset + Number(meta.offset));
          chunks.push(b.toString('utf8'));
        }
      }
    }

    readNode(distFiles, '');
    return chunks.join('\n');
  } finally {
    fs.closeSync(fd);
  }
}

/**
 * Extracts high-confidence UI strings from bundled JS source.
 */
export function harvestUiStringsFromJs(jsSource) {
  const found = new Set();
  const propDblRe =
    /(?:label|title|placeholder|"aria-label"|tooltip|heading|subtitle|confirmText|cancelText|emptyText|buttonLabel|message|detail)\s*:\s*"([^"\\\n]{2,90})"/g;
  const propSglRe =
    /(?:label|title|placeholder|'aria-label'|tooltip|heading|subtitle|confirmText|cancelText|emptyText|buttonLabel|message|detail)\s*:\s*'([^'\\\n]{2,90})'/g;
  const jsxChildRe =
    /createElement\("[a-z0-9]+",\s*(?:null|\{[^{}]{0,220}\}),\s*"([^"\\\n]{2,90})"\)/g;

  for (const re of [propDblRe, propSglRe, jsxChildRe]) {
    let m;
    while ((m = re.exec(jsSource)) !== null) {
      const s = m[1].trim();
      if (s.length < 2 || s.length > 85) continue;
      if (!/[A-Z]/.test(s)) continue;
      if (/[/\\{}<>=\[\]|`$;_]|https?:|^#[0-9a-fA-F]+$|^[A-Z0-9_]+$/.test(s)) continue;
      if (/\b(?:px|rem|rgba|var\(|calc\(|stroke|webkit|function|return)\b/.test(s)) continue;
      if (s.startsWith('e.g.') || s.startsWith('E.g.')) continue;
      found.add(s);
    }
  }
  return Array.from(found).sort();
}

export function scanAppLocalizationCoverage(appRoot) {
  const dictPath = path.resolve(__dirname, '..', 'core', 'zh-dict.json');
  const dataDir =
    process.env.AGY_ZH_DATA_DIR || path.join(os.homedir(), '.gemini', 'antigravity-zh');
  const overridePath = path.join(dataDir, 'zh-dict.override.json');

  const dict = JSON.parse(fs.readFileSync(dictPath, 'utf8'));
  const overrideDict = fs.existsSync(overridePath)
    ? JSON.parse(fs.readFileSync(overridePath, 'utf8'))
    : null;
  const preserveSet = new Set(dict.preserveTerms || []);
  const translator = createTranslator(dict, overrideDict);

  const { lsPath, asarPath } = locateBinaries(appRoot);
  if (!lsPath && !asarPath) {
    throw new Error(`No Antigravity binaries found under: ${appRoot}`);
  }

  let combinedSource = '';
  if (lsPath) combinedSource += extractEmbeddedWebMainJs(lsPath) + '\n';
  if (asarPath) combinedSource += extractAsarDistJsConcatenated(asarPath) + '\n';

  const discovered = harvestUiStringsFromJs(combinedSource);
  const translated = [];
  const preserved = [];
  const untranslated = [];

  for (const s of discovered) {
    if (preserveSet.has(s)) {
      preserved.push(s);
    } else if (translator.translatePreservingWhitespace(s, { isMenu: true })) {
      translated.push(s);
    } else {
      untranslated.push(s);
    }
  }

  const effectiveTotal = translated.length + untranslated.length;
  const coveragePct =
    effectiveTotal > 0 ? Number(((translated.length / effectiveTotal) * 100).toFixed(1)) : 100;

  return {
    appRoot,
    lsFound: Boolean(lsPath),
    asarFound: Boolean(asarPath),
    dictVersion: dict?.meta?.dictVersion || '1.0.0',
    totalDiscovered: discovered.length,
    translatedCount: translated.length,
    preservedProperNouns: preserved.length,
    untranslatedCount: untranslated.length,
    coveragePct,
    untranslated,
  };
}

function cli() {
  const argv = process.argv.slice(2);
  let appRoot = null;
  let jsonOut = null;

  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === '--app' && argv[i + 1]) appRoot = argv[++i];
    else if (argv[i] === '--json' && argv[i + 1]) jsonOut = argv[++i];
  }

  appRoot = appRoot || resolveDefaultAppRoot();
  if (!appRoot || !fs.existsSync(appRoot)) {
    console.error('❌ Antigravity.app not found. Pass --app "/path/to/Antigravity.app"');
    process.exit(1);
  }

  const report = scanAppLocalizationCoverage(appRoot);
  console.log('==============================================================');
  console.log(`🔍 Antigravity UI 汉化覆盖率扫描报告 (词库 v${report.dictVersion})`);
  console.log('==============================================================');
  console.log(`• 目标安装路径: ${report.appRoot}`);
  console.log(`• 识别高置信 UI 词条: ${report.totalDiscovered} 条`);
  console.log(`• 已精准汉化词条:     ${report.translatedCount} 条`);
  console.log(`• 保留极客专有名词:   ${report.preservedProperNouns} 条 (Agent/MCP/Git/WSL...)`);
  console.log(`• 待补充新增词条:     ${report.untranslatedCount} 条`);
  console.log(`• 有效汉化覆盖率:     ${report.coveragePct}%`);
  console.log('==============================================================');

  if (jsonOut) {
    fs.writeFileSync(jsonOut, JSON.stringify(report, null, 2), 'utf8');
    console.log(`📄 已导出详细 JSON 报告至: ${jsonOut}`);
  } else if (report.untranslated.length > 0) {
    console.log('前 25 条未翻译候选词条预览:');
    for (const item of report.untranslated.slice(0, 25)) {
      console.log(`  - ${JSON.stringify(item)}`);
    }
  }
}

const isDirect =
  process.argv[1] && path.resolve(process.argv[1]) === path.resolve(fileURLToPath(import.meta.url));
if (isDirect) {
  cli();
}
