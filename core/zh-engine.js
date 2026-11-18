/**
 * Antigravity Native Chinese (qixian-agy-zh) — Pure-JS Zero-Flash DOM Localization Engine
 *
 * Works identically across:
 *   1. Engine 1: Electron Main/Session Preload (`preload-zh.cjs`, isolated world, 0 CSP issues, Frame-0)
 *   2. Engine 2: Local CDP Auto-Attach Guard (`cdp-daemon.mjs`, main world fallback)
 *   3. Node.js Unit/Integration Tests (`tests/test_agy_zh.mjs`)
 */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) {
    module.exports = factory();
  } else {
    root.__AGY_ZH_MODULE__ = factory();
  }
})(typeof globalThis !== 'undefined' ? globalThis : window, function () {
  'use strict';

  const TRANSLATABLE_ATTRS = ['placeholder', 'title', 'aria-label'];

  const SKIP_TAGS = new Set([
    'SCRIPT',
    'STYLE',
    'NOSCRIPT',
    'CODE',
    'PRE',
    'KBD',
    'SAMP',
    'TEXTAREA',
    'SVG',
    'MATH',
    'CANVAS',
    'VIDEO',
    'AUDIO',
    'IFRAME',
    'OBJECT',
    'EMBED',
  ]);

  const EXCLUDED_CONTAINER_SELECTOR = [
    '[data-agy-zh-ignore]',
    '[data-slot]',
    '[contenteditable="true"]',
    '[contenteditable="plaintext-only"]',
    '[contenteditable=""]',
    '.monaco-editor',
    '.monaco-diff-editor',
    '.xterm',
    '.xterm-screen',
    '.cm-editor',
    '.CodeMirror',
    '.shiki',
    '.prismjs',
    '.hljs',
    '.katex',
    'mjx-container',
  ].join(',');

  /**
   * Builds a fast O(1) exact Map + compiled RegExp list from dictionary JSON.
   */
  function createTranslator(dictData, overrideData) {
    const exactMap = new Map();
    const compiledPatterns = [];

    const baseExact = (dictData && dictData.exact) || {};
    for (const [k, v] of Object.entries(baseExact)) {
      if (k && typeof v === 'string' && v.length > 0) {
        exactMap.set(k, v);
      }
    }

    if (overrideData && overrideData.exact && typeof overrideData.exact === 'object') {
      for (const [k, v] of Object.entries(overrideData.exact)) {
        if (k && typeof v === 'string' && v.length > 0) {
          exactMap.set(k, v);
        }
      }
    }

    const allPatterns = [
      ...((overrideData && Array.isArray(overrideData.patterns) && overrideData.patterns) || []),
      ...((dictData && Array.isArray(dictData.patterns) && dictData.patterns) || []),
    ];

    for (const item of allPatterns) {
      if (!item || typeof item.re !== 'string' || typeof item.zh !== 'string') continue;
      try {
        compiledPatterns.push({
          re: new RegExp(item.re),
          zh: item.zh,
          onlyMenus: Boolean(item.onlyMenus),
        });
      } catch (_) {
        // Ignore malformed custom regex in user override file
      }
    }

    function translateCore(core, options) {
      if (!core || core.length < 2) return null;
      const direct = exactMap.get(core);
      if (direct !== undefined) return direct;

      // Normalize curly apostrophe / ellipsis variants if present
      if (core.includes('\u2019') || core.includes('\u2026')) {
        const norm = core.replace(/\u2019/g, "'").replace(/\u2026/g, '...');
        const normHit = exactMap.get(norm);
        if (normHit !== undefined) return normHit;
      }

      if (core.length > 120) return null;
      // Fast bailout if already predominantly CJK and not matching exact
      if (/^[\u4e00-\u9fff\s0-9.,:;!?()\-]+$/.test(core)) return null;
      // Never regex-rewrite URLs or Unix/Windows file paths
      if (/^(?:https?:\/\/|file:\/\/|\/[A-Za-z0-9._-]+|[A-Za-z]:\\)/.test(core)) return null;

      const allowMenuPatterns = Boolean(options && options.isMenu);
      for (let i = 0; i < compiledPatterns.length; i++) {
        const p = compiledPatterns[i];
        if (p.onlyMenus && !allowMenuPatterns) continue;
        if (p.re.test(core)) {
          return core.replace(p.re, p.zh);
        }
      }
      return null;
    }

    function translatePreservingWhitespace(raw, options) {
      if (typeof raw !== 'string' || raw.length < 2) return null;
      const m = /^(\s*)([\s\S]*?)(\s*)$/.exec(raw);
      if (!m) return null;
      const core = m[2];
      if (!core) return null;
      const zh = translateCore(core, options);
      if (!zh || zh === core) return null;
      return m[1] + zh + m[3];
    }

    return {
      exactMap,
      compiledPatterns,
      translateCore,
      translatePreservingWhitespace,
      meta: (dictData && dictData.meta) || {},
    };
  }

  /**
   * Checks whether an Element (or its ancestors) is a code block, terminal, editor, or ignored region.
   */
  function shouldSkipElement(el) {
    if (!el || el.nodeType !== 1) return true;
    if (SKIP_TAGS.has(el.tagName)) return true;
    if (el.isContentEditable) return true;
    if (typeof el.closest === 'function') {
      try {
        if (el.closest(EXCLUDED_CONTAINER_SELECTOR)) return true;
      } catch (_) {
        // Ignore selector quirks on exotic custom elements
      }
    }
    return false;
  }

  /**
   * Initializes live DOM localization + instant Cmd/Ctrl+Shift+L toggle in a browser/Electron frame.
   */
  function initAgyZhEngine(config) {
    const cfg = config || {};
    const doc = cfg.document || (typeof document !== 'undefined' ? document : null);
    const win = cfg.window || (typeof window !== 'undefined' ? window : null);
    if (!doc || !win) return null;

    const mode = cfg.mode || 'preload';
    const rootEl = doc.documentElement;

    const isSupplement = mode === 'cdp-supplement' || Boolean(cfg.supplementPreload);

    // If Engine 2 (CDP) attaches to a page already localized at Frame-0 by Engine 1 (Preload), skip unless supplementing newer dict!
    if (mode === 'cdp' && !isSupplement && rootEl && rootEl.dataset && rootEl.dataset.agyZhEngine === 'preload') {
      return { skipped: true, reason: 'already-preload' };
    }
    if (win.__AGY_ZH_INSTANCE__) {
      if (cfg.dict) {
        win.__AGY_ZH_INSTANCE__.reloadDictionary(cfg.dict, cfg.overrideDict);
      }
      return win.__AGY_ZH_INSTANCE__;
    }

    let translator = createTranslator(cfg.dict || {}, cfg.overrideDict || null);

    const STORAGE_KEY = 'agy_zh_lang_pref_v1';
    let currentLang = cfg.initialLang || (rootEl && rootEl.dataset && rootEl.dataset.agyZhLang) || 'zh-CN';
    try {
      const saved = win.localStorage && win.localStorage.getItem(STORAGE_KEY);
      if (saved === 'en' || saved === 'zh-CN') {
        currentLang = saved;
      }
    } catch (_) {
      // data: URLs or sandboxed frames disallow localStorage; safe to ignore
    }

    const textMeta = new WeakMap(); // Text -> { orig: string, zh: string }
    const attrMeta = new WeakMap(); // Element -> Map<attrName, { orig: string, zh: string }>
    const trackedTextRefs = [];
    const trackedAttrRefs = [];
    const observedRoots = new WeakSet();
    const hasWeakRef = typeof WeakRef === 'function';

    let origDocTitle = null;
    let zhDocTitle = null;
    let isMutatingInternally = false;
    let pendingNodes = new Set();
    let rafScheduled = false;

    function stampRootDataset() {
      const html = doc.documentElement;
      if (!html || !html.dataset) return;
      if (!isSupplement && (mode === 'preload' || !html.dataset.agyZhEngine)) {
        html.dataset.agyZhEngine = mode;
      }
      if (!isSupplement) {
        html.dataset.agyZhLang = currentLang;
      }
      if (translator.meta && translator.meta.dictVersion) {
        html.dataset.agyZhDictVer = String(translator.meta.dictVersion);
      }
    }

    function trackText(node) {
      if (hasWeakRef) {
        trackedTextRefs.push(new WeakRef(node));
      } else {
        trackedTextRefs.push({ deref: () => node });
      }
    }

    function trackAttrEl(el) {
      if (hasWeakRef) {
        trackedAttrRefs.push(new WeakRef(el));
      } else {
        trackedAttrRefs.push({ deref: () => el });
      }
    }

    function processTextNode(node) {
      if (!node || node.nodeType !== 3) return;
      const parent = node.parentElement;
      if (!parent) return;
      // Never touch text inside <input> / <option> value-sensitive controls if skipped
      if (parent.tagName === 'INPUT' || shouldSkipElement(parent)) return;

      const val = node.nodeValue;
      if (!val || val.length < 2) return;

      const existing = textMeta.get(node);
      if (currentLang === 'en') {
        if (existing && val === existing.zh) {
          isMutatingInternally = true;
          node.nodeValue = existing.orig;
          isMutatingInternally = false;
        }
        return;
      }

      // Already showing our translated string
      if (existing && val === existing.zh) return;

      const sourceText = existing && val === existing.orig ? existing.orig : val;
      const zh = translator.translatePreservingWhitespace(sourceText);
      if (!zh || zh === val) return;

      if (!existing) {
        trackText(node);
      }
      textMeta.set(node, { orig: sourceText, zh });
      isMutatingInternally = true;
      node.nodeValue = zh;
      isMutatingInternally = false;
    }

    function processElementAttrs(el) {
      if (!el || el.nodeType !== 1) return;
      // Allow <input placeholder/title/aria-label> even though <input> text is skipped!
      if (el.tagName !== 'INPUT' && shouldSkipElement(el)) return;
      if (el.closest && el.closest('[data-agy-zh-ignore]')) return;

      let map = attrMeta.get(el);
      for (let i = 0; i < TRANSLATABLE_ATTRS.length; i++) {
        const attr = TRANSLATABLE_ATTRS[i];
        if (!el.hasAttribute(attr)) continue;
        const val = el.getAttribute(attr);
        if (!val || val.length < 2) continue;

        const rec = map && map.get(attr);
        if (currentLang === 'en') {
          if (rec && val === rec.zh) {
            isMutatingInternally = true;
            el.setAttribute(attr, rec.orig);
            isMutatingInternally = false;
          }
          continue;
        }

        if (rec && val === rec.zh) continue;
        const sourceText = rec && val === rec.orig ? rec.orig : val;
        const zh = translator.translatePreservingWhitespace(sourceText);
        if (!zh || zh === val) continue;

        if (!map) {
          map = new Map();
          attrMeta.set(el, map);
          trackAttrEl(el);
        }
        map.set(attr, { orig: sourceText, zh });
        isMutatingInternally = true;
        el.setAttribute(attr, zh);
        isMutatingInternally = false;
      }
    }

    function processDocTitle() {
      if (typeof doc.title !== 'string' || !doc.title) return;
      if (currentLang === 'en') {
        if (origDocTitle && doc.title === zhDocTitle) {
          doc.title = origDocTitle;
        }
        return;
      }
      if (zhDocTitle && doc.title === zhDocTitle) return;
      const zh = translator.translatePreservingWhitespace(doc.title);
      if (zh && zh !== doc.title) {
        origDocTitle = doc.title;
        zhDocTitle = zh;
        doc.title = zh;
      }
    }

    function walkSubtree(rootNode) {
      if (!rootNode) return;
      if (rootNode.nodeType === 3) {
        processTextNode(rootNode);
        return;
      }
      if (rootNode.nodeType !== 1 && rootNode.nodeType !== 9 && rootNode.nodeType !== 11) {
        return;
      }
      if (rootNode.nodeType === 1) {
        if (rootNode.tagName === 'INPUT') {
          processElementAttrs(rootNode);
          return;
        }
        if (shouldSkipElement(rootNode)) return;
        processElementAttrs(rootNode);
        if (rootNode.shadowRoot) {
          observeRoot(rootNode.shadowRoot);
          walkSubtree(rootNode.shadowRoot);
        }
      }

      // Walk descendants efficiently
      const walker = doc.createTreeWalker(
        rootNode,
        1 | 4 /* SHOW_ELEMENT | SHOW_TEXT */
      );
      let curr = walker.nextNode();
      while (curr) {
        if (curr.nodeType === 3) {
          processTextNode(curr);
        } else if (curr.nodeType === 1) {
          processElementAttrs(curr);
          if (curr.shadowRoot) {
            observeRoot(curr.shadowRoot);
            walkSubtree(curr.shadowRoot);
          }
        }
        curr = walker.nextNode();
      }
    }

    function restoreOriginalEnglish() {
      isMutatingInternally = true;
      try {
        for (let i = trackedTextRefs.length - 1; i >= 0; i--) {
          const node = trackedTextRefs[i].deref();
          if (!node) {
            trackedTextRefs.splice(i, 1);
            continue;
          }
          const rec = textMeta.get(node);
          if (rec && node.nodeValue === rec.zh) {
            node.nodeValue = rec.orig;
          }
        }
        for (let i = trackedAttrRefs.length - 1; i >= 0; i--) {
          const el = trackedAttrRefs[i].deref();
          if (!el) {
            trackedAttrRefs.splice(i, 1);
            continue;
          }
          const map = attrMeta.get(el);
          if (!map) continue;
          for (const [attr, rec] of map.entries()) {
            if (el.getAttribute(attr) === rec.zh) {
              el.setAttribute(attr, rec.orig);
            }
          }
        }
        processDocTitle();
      } finally {
        isMutatingInternally = false;
      }
    }

    function flushPending() {
      rafScheduled = false;
      if (currentLang !== 'zh-CN') {
        pendingNodes.clear();
        return;
      }
      const batch = Array.from(pendingNodes);
      pendingNodes.clear();
      for (let i = 0; i < batch.length; i++) {
        walkSubtree(batch[i]);
      }
      processDocTitle();
    }

    function scheduleFlush() {
      if (rafScheduled) return;
      rafScheduled = true;
      const sched = win.requestAnimationFrame || ((fn) => setTimeout(fn, 16));
      sched(flushPending);
    }

    function observeRoot(targetRoot) {
      if (!targetRoot || observedRoots.has(targetRoot) || typeof win.MutationObserver !== 'function') {
        return;
      }
      observedRoots.add(targetRoot);
      const observer = new win.MutationObserver((mutations) => {
        if (isMutatingInternally || currentLang !== 'zh-CN') return;
        for (let i = 0; i < mutations.length; i++) {
          const m = mutations[i];
          if (m.type === 'characterData') {
            pendingNodes.add(m.target);
          } else if (m.type === 'attributes') {
            pendingNodes.add(m.target);
          } else if (m.type === 'childList') {
            for (let j = 0; j < m.addedNodes.length; j++) {
              pendingNodes.add(m.addedNodes[j]);
            }
          }
        }
        if (pendingNodes.size > 0) {
          // If document is still in initial parse/render, translate synchronously for 0-flash Frame 0!
          if (doc.readyState === 'loading') {
            flushPending();
          } else {
            scheduleFlush();
          }
        }
      });

      observer.observe(targetRoot, {
        childList: true,
        subtree: true,
        characterData: true,
        attributes: true,
        attributeFilter: TRANSLATABLE_ATTRS,
      });
    }

    function showBadgeToast(text) {
      if (!doc.body) return;
      // Only show in top-level window so sidecar iframes don't show duplicate badges
      try {
        if (win.self !== win.top) return;
      } catch (_) {}

      let badge = doc.getElementById('agy-zh-toggle-toast');
      if (!badge) {
        badge = doc.createElement('div');
        badge.id = 'agy-zh-toggle-toast';
        badge.setAttribute('data-agy-zh-ignore', 'true');
        badge.style.cssText = [
          'position:fixed',
          'top:16px',
          'right:18px',
          'z-index:2147483647',
          'padding:8px 14px',
          'border-radius:999px',
          'background:rgba(15,23,42,0.88)',
          'backdrop-filter:blur(14px)',
          '-webkit-backdrop-filter:blur(14px)',
          'border:1px solid rgba(56,189,248,0.42)',
          'box-shadow:0 10px 28px rgba(0,0,0,0.45)',
          'color:#F8FAFC',
          'font:600 12.5px/1.3 -apple-system,BlinkMacSystemFont,"PingFang SC","Microsoft YaHei",sans-serif',
          'letter-spacing:0.02em',
          'pointer-events:none',
          'opacity:0',
          'transform:translateY(-8px)',
          'transition:opacity 180ms ease,transform 180ms ease',
        ].join(';');
        doc.body.appendChild(badge);
      }
      badge.textContent = text;
      badge.style.opacity = '1';
      badge.style.transform = 'translateY(0)';
      clearTimeout(badge.__hideTimer);
      badge.__hideTimer = setTimeout(() => {
        badge.style.opacity = '0';
        badge.style.transform = 'translateY(-8px)';
      }, 1500);
    }

    function showUpdateNotification(info) {
      if (!doc.body || !info || !info.latestVersion) return;
      try {
        if (win.self !== win.top) return;
      } catch (_) {}

      const dismissedKey = 'agy_zh_dismissed_ver_' + info.latestVersion;
      try {
        if (win.localStorage && win.localStorage.getItem(dismissedKey) === '1' && !info.manual) {
          return;
        }
      } catch (_) {}

      let card = doc.getElementById('agy-zh-ota-card');
      if (card) card.remove();

      card = doc.createElement('div');
      card.id = 'agy-zh-ota-card';
      card.setAttribute('data-agy-zh-ignore', 'true');
      card.style.cssText = [
        'position:fixed',
        'right:18px',
        'bottom:18px',
        'z-index:2147483647',
        'width:336px',
        'padding:14px 16px',
        'border-radius:14px',
        'background:linear-gradient(145deg,rgba(15,23,42,0.95),rgba(17,24,39,0.96))',
        'backdrop-filter:blur(16px)',
        '-webkit-backdrop-filter:blur(16px)',
        'border:1px solid rgba(99,102,241,0.48)',
        'box-shadow:0 16px 40px rgba(0,0,0,0.55)',
        'color:#F8FAFC',
        'font:400 12.5px/1.5 -apple-system,BlinkMacSystemFont,"PingFang SC","Microsoft YaHei",sans-serif',
      ].join(';');

      const title = doc.createElement('div');
      title.style.cssText = 'font-weight:700;font-size:13.5px;margin-bottom:4px;color:#38BDF8;display:flex;justify-content:space-between;align-items:center;';
      title.textContent = `✨ 发现汉化新版本 v${info.latestVersion}`;

      const desc = doc.createElement('div');
      desc.style.cssText = 'color:#CBD5E1;font-size:12px;margin-bottom:11px;';
      desc.textContent = info.notes || `当前版本 v${info.currentVersion || '1.0.0'}，词库或引擎已有新版本可一键热更新。`;

      const btnRow = doc.createElement('div');
      btnRow.style.cssText = 'display:flex;gap:8px;justify-content:flex-end;';

      const btnLater = doc.createElement('button');
      btnLater.textContent = '稍后提醒';
      btnLater.style.cssText = 'padding:5px 11px;border-radius:8px;border:1px solid rgba(148,163,184,0.3);background:transparent;color:#94A3B8;font-size:12px;cursor:pointer;';
      btnLater.onclick = () => {
        try {
          win.localStorage && win.localStorage.setItem(dismissedKey, '1');
        } catch (_) {}
        card.remove();
      };

      const btnUpgrade = doc.createElement('button');
      btnUpgrade.textContent = '⚡ 一键热更词库';
      btnUpgrade.style.cssText = 'padding:5px 12px;border-radius:8px;border:none;background:linear-gradient(135deg,#0EA5E9,#6366F1);color:#FFF;font-weight:600;font-size:12px;cursor:pointer;';
      btnUpgrade.onclick = () => {
        btnUpgrade.textContent = '正在热更新...';
        btnUpgrade.disabled = true;
        doc.dispatchEvent(new win.CustomEvent('agy-zh:request-hot-update', { detail: info }));
        if (typeof cfg.onRequestHotUpdate === 'function') {
          Promise.resolve(cfg.onRequestHotUpdate(info))
            .then((res) => {
              card.remove();
              if (res && res.dict) {
                reloadDictionary(res.dict, res.overrideDict);
              }
              showBadgeToast(`✅ 已无感热更至 v${info.latestVersion}`);
            })
            .catch(() => {
              card.remove();
              if (info.releaseUrl) {
                win.open(info.releaseUrl, '_blank', 'noopener,noreferrer');
              }
            });
        } else if (info.releaseUrl) {
          card.remove();
          win.open(info.releaseUrl, '_blank', 'noopener,noreferrer');
        }
      };

      btnRow.appendChild(btnLater);
      btnRow.appendChild(btnUpgrade);
      card.appendChild(title);
      card.appendChild(desc);
      card.appendChild(btnRow);
      doc.body.appendChild(card);
    }

    function setLanguage(nextLang, silent) {
      if (nextLang !== 'zh-CN' && nextLang !== 'en') return currentLang;
      currentLang = nextLang;
      try {
        win.localStorage && win.localStorage.setItem(STORAGE_KEY, currentLang);
      } catch (_) {}
      stampRootDataset();

      if (currentLang === 'en') {
        restoreOriginalEnglish();
        if (!silent) showBadgeToast('🌐 Switched to Original English (⌘⇧L / Ctrl+Shift+L)');
      } else {
        if (doc.documentElement) walkSubtree(doc.documentElement);
        processDocTitle();
        if (!silent) showBadgeToast('🌐 已切换为简体中文 (⌘⇧L / Ctrl+Shift+L)');
      }

      if (typeof cfg.onLanguageChanged === 'function') {
        try {
          cfg.onLanguageChanged(currentLang);
        } catch (_) {}
      }
      return currentLang;
    }

    function toggleLanguage(silent) {
      return setLanguage(currentLang === 'zh-CN' ? 'en' : 'zh-CN', silent);
    }

    function reloadDictionary(newDict, newOverride) {
      // First restore original English so re-translation picks up updated entries cleanly
      const wasZh = currentLang === 'zh-CN';
      if (wasZh) restoreOriginalEnglish();
      translator = createTranslator(newDict || {}, newOverride || null);
      if (wasZh && doc.documentElement) {
        walkSubtree(doc.documentElement);
        processDocTitle();
      }
    }

    // Keyboard shortcut: Cmd+Shift+L (macOS) / Ctrl+Shift+L (Windows/Linux)
    if (!isSupplement) {
      win.addEventListener(
        'keydown',
        (e) => {
          const isMod = (e.metaKey || e.ctrlKey) && e.shiftKey && !e.altKey;
          if (isMod && (e.key === 'L' || e.key === 'l' || e.code === 'KeyL')) {
            e.preventDefault();
            e.stopPropagation();
            toggleLanguage(false);
          }
        },
        true
      );

      // Cross-world DOM events (dispatched by Main Process Menu or CDP Daemon)
      doc.addEventListener('agy-zh:toggle', () => toggleLanguage(false));
      doc.addEventListener('agy-zh:set-zh', () => setLanguage('zh-CN', false));
      doc.addEventListener('agy-zh:set-en', () => setLanguage('en', false));
      doc.addEventListener('agy-zh:update-notify', (ev) => {
        if (ev && ev.detail) showUpdateNotification(ev.detail);
      });
    } else if (doc.documentElement && typeof win.MutationObserver === 'function') {
      const langSyncObs = new win.MutationObserver(() => {
        const attrLang = doc.documentElement?.dataset?.agyZhLang;
        if ((attrLang === 'zh-CN' || attrLang === 'en') && attrLang !== currentLang) {
          setLanguage(attrLang, true);
        }
      });
      langSyncObs.observe(doc.documentElement, {
        attributes: true,
        attributeFilter: ['data-agy-zh-lang'],
      });
    }

    // Cross-frame sync when localStorage changes in another tab/pane
    win.addEventListener('storage', (ev) => {
      if (ev && ev.key === STORAGE_KEY && (ev.newValue === 'zh-CN' || ev.newValue === 'en')) {
        if (ev.newValue !== currentLang) {
          setLanguage(ev.newValue, true);
        }
      }
    });

    function bootstrapDom() {
      stampRootDataset();
      observeRoot(doc);
      if (currentLang === 'zh-CN' && doc.documentElement) {
        walkSubtree(doc.documentElement);
        processDocTitle();
      }
    }

    if (doc.documentElement) {
      bootstrapDom();
    } else {
      doc.addEventListener('readystatechange', bootstrapDom, { once: true });
      win.addEventListener('DOMContentLoaded', bootstrapDom, { once: true });
    }
    win.addEventListener('DOMContentLoaded', () => {
      stampRootDataset();
      if (currentLang === 'zh-CN' && doc.documentElement) {
        walkSubtree(doc.documentElement);
        processDocTitle();
      }
    });

    const api = {
      mode,
      getLanguage: () => currentLang,
      setLanguage,
      toggleLanguage,
      reloadDictionary,
      showUpdateNotification,
      translateNow: () => {
        if (currentLang === 'zh-CN' && doc.documentElement) {
          walkSubtree(doc.documentElement);
          processDocTitle();
        }
      },
    };
    win.__AGY_ZH_INSTANCE__ = api;
    return api;
  }

  return {
    createTranslator,
    shouldSkipElement,
    initAgyZhEngine,
  };
});
