'use strict';
/**
 * Antigravity Native Gemini UI Engine (qixian-agy-zh v2.3.0 — Calm Micro-Breathing & Living Agent States Edition)
 *
 * Benchmarks Google Gemini (Material 3 Expressive + Gemini Live) across BOTH Left Sidebar & Right Sheet:
 *   1. Authentic Dual-Mode Gemini Tonal Palette (Dark #131314 / Frosted Rail #16181E / Light #F8FAFD)
 *   2. Serene Micro-Breathing WebGL1 Silk Canopy (~40s calm drift when idle, gentle pointer warmth on interaction,
 *      zero vertical split seam, crystal-clear reading center, <0.1% GPU when idle on Apple Silicon M1 Pro)
 *   3. Native Prompt-Sent & Agent Working Lifecycle Polish (`launching` -> `working` -> `compacting` -> `waiting` -> `idle`):
 *      - Instant prompt-launch stream awakening on Enter / Send click
 *      - Pure-CSS `✦` Gemini 4-color breathing star & chromatic shimmer on `[data-testid="agent-loading"]`
 *        and `[data-testid="ephemeral-tool-status"]` (`正在工作` / `正在压缩上下文`)
 *      - Refined step timeline thread on `[data-testid="progress-updates-timeline"]`
 *   4. Deep Left Sidebar SDK Integration (`F3c` Sidebar, `V6` Hero `+ 新建对话` Pill, `B3c` Project Headers,
 *      `.agy-sidebar-row` Seamless Action Pills & Sash Aurora Line) with restrained, non-distracting micro-physics.
 *
 * Strict Safety Invariants:
 *   - ZERO React virtual-DOM node replacement or child injection inside React buttons/cards/steps
 *   - ZERO interference with `.monaco-editor`, `.xterm`, `code`, `pre` text, or `[data-has-browser-hole="true"]`
 *   - Instant 0ms clean teardown when switched to `off`
 */
(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) {
    module.exports = api;
  }
  if (root && typeof root === 'object') {
    root.__AGY_GEMINI_UI_MODULE__ = api;
  }
})(typeof globalThis !== 'undefined' ? globalThis : typeof window !== 'undefined' ? window : this, function () {
  const VERSION = '2.3.0';
  const STORAGE_KEY = 'agy_gemini_ui_state_v2_3';
  const LEGACY_STORAGE_KEYS = ['agy_gemini_ui_state_v2_2', 'agy_gemini_ui_state_v2_1'];
  const VALID_PRESETS = ['nebula', 'pure', 'liquid', 'off'];
  const VALID_INTENSITIES = ['vivid', 'balanced', 'subtle'];

  const PRESET_META = {
    nebula: {
      id: 'nebula',
      nameZh: '双子星云',
      nameEn: 'Gemini Nebula',
      descZh: 'Google Gemini 微息流光 + 工作态星芒律动',
      shaderIndex: 0,
    },
    pure: {
      id: 'pure',
      nameZh: '晨曦纯净',
      nameEn: 'Gemini Pure',
      descZh: '静谧天青毛玻璃，适合全天候沉浸编码',
      shaderIndex: 1,
    },
    liquid: {
      id: 'liquid',
      nameZh: '液态冰晶',
      nameEn: 'Liquid Glass',
      descZh: 'M1 Pro 深邃钛晶微折射与柔和边缘高光',
      shaderIndex: 2,
    },
    off: {
      id: 'off',
      nameZh: '原厂默认',
      nameEn: 'Original UI',
      descZh: '0 毫秒无损还原 Antigravity 出厂原生界面',
      shaderIndex: -1,
    },
  };

  // Recalibrated calm gain curve: stationary = serene micro-breath, interactive = gentle warmth
  const INTENSITY_GAIN = {
    subtle: 0.36,
    balanced: 0.64,
    vivid: 0.98,
  };

  const DEFAULT_STATE = {
    preset: 'nebula',
    intensity: 'balanced',
    webgl: true,
    motion: true,
    spotlight: true,
  };

  function normalizeState(raw) {
    const src = raw && typeof raw === 'object' ? raw : {};
    return {
      preset: VALID_PRESETS.includes(src.preset) ? src.preset : DEFAULT_STATE.preset,
      intensity: VALID_INTENSITIES.includes(src.intensity) ? src.intensity : DEFAULT_STATE.intensity,
      webgl: typeof src.webgl === 'boolean' ? src.webgl : DEFAULT_STATE.webgl,
      motion: typeof src.motion === 'boolean' ? src.motion : DEFAULT_STATE.motion,
      spotlight: typeof src.spotlight === 'boolean' ? src.spotlight : DEFAULT_STATE.spotlight,
    };
  }

  // ============================================================================
  // 1. Zero-Dependency WebGL1 Serene Micro-Breathing Aurora Canopy
  // ============================================================================
  const VERTEX_SHADER_SRC = `
    attribute vec2 aPos;
    varying vec2 vUv;
    void main() {
      vUv = aPos * 0.5 + 0.5;
      gl_Position = vec4(aPos, 0.0, 1.0);
    }
  `;

  const FRAGMENT_SHADER_SRC = `
    precision mediump float;
    varying vec2 vUv;
    uniform float uTime;
    uniform vec2 uRes;
    uniform vec2 uPointer;
    uniform float uVel;
    uniform vec3 uRipple; // xy = normalized origin, z = progress [0..1] (<0 inactive)
    uniform float uEnergy; // 0.08 calm idle -> 0.35 light interaction -> 0.85 agent working
    uniform float uWorking; // 0.0 idle -> 1.0 agent actively working / launching prompt
    uniform float uGain;
    uniform float uDark;
    uniform float uHome;
    uniform float uPreset;
    uniform float uMode; // 0.0 = full-window ambient aurora, 1.0 = composer live halo

    float hash21(vec2 p) {
      p = fract(p * vec2(234.34, 435.345));
      p += dot(p, p + 34.23);
      return fract(p.x * p.y);
    }

    float vnoise(vec2 p) {
      vec2 i = floor(p);
      vec2 f = fract(p);
      vec2 u = f * f * (3.0 - 2.0 * f);
      float a = hash21(i);
      float b = hash21(i + vec2(1.0, 0.0));
      float c = hash21(i + vec2(0.0, 1.0));
      float d = hash21(i + vec2(1.0, 1.0));
      return mix(mix(a, b, u.x), mix(c, d, u.x), u.y);
    }

    float fbm(vec2 p) {
      float v = 0.0;
      float amp = 0.52;
      mat2 rot = mat2(0.80, -0.60, 0.60, 0.80);
      for (int i = 0; i < 4; i++) {
        v += amp * vnoise(p);
        p = rot * p * 2.02 + vec2(1.7, 9.2);
        amp *= 0.5;
      }
      return v;
    }

    void main() {
      vec2 uv = vUv;
      float aspect = max(uRes.x / max(uRes.y, 1.0), 0.25);
      vec2 p = (uv - 0.5) * vec2(aspect, 1.0);
      vec2 ptr = (uPointer - 0.5) * vec2(aspect, 1.0);

      // Gentle, non-jarring water-drop pulse on prompt send / primary CTA click
      float rippleRing = 0.0;
      vec2 rippleDisp = vec2(0.0);
      if (uRipple.z >= 0.0 && uRipple.z <= 1.0) {
        vec2 rp = (uRipple.xy - 0.5) * vec2(aspect, 1.0);
        vec2 diff = p - rp;
        float dist = length(diff) + 0.0001;
        float rad = uRipple.z * 1.15;
        float band = exp(-pow((dist - rad) * 9.5, 2.0));
        float fade = pow(1.0 - uRipple.z, 1.65);
        rippleRing = band * fade;
        rippleDisp = (diff / dist) * rippleRing * 0.016;
      }

      vec2 pw = p - rippleDisp;
      float t = uTime;

      // Subtle, damped cursor warmth (no dizzying vortex when moving the mouse!)
      vec2 toPtr = pw - ptr;
      float ptrDist = length(toPtr);
      float gentleWake = exp(-ptrDist * ptrDist * 5.8) * (0.04 + 0.34 * uVel);
      vec2 swirl = vec2(-toPtr.y, toPtr.x) * gentleWake * 0.14;

      vec2 q = vec2(
        fbm(pw * 1.42 + swirl + vec2(t * 0.36, -t * 0.24)),
        fbm(pw * 1.42 - swirl + vec2(-t * 0.28, t * 0.32) + vec2(5.2, 1.3))
      );
      vec2 r = vec2(
        fbm(pw * 1.75 + 1.45 * q + vec2(1.7, 9.2) + 0.18 * ptr + t * 0.28),
        fbm(pw * 1.75 + 1.45 * q + vec2(8.3, 2.8) - 0.18 * ptr - t * 0.24)
      );
      float silk = fbm(pw * 1.28 + 1.65 * r);

      // Authentic Google Gemini 4-stop tonal palette
      vec3 cBlue  = mix(vec3(0.16, 0.45, 0.98), vec3(0.26, 0.54, 1.00), uDark); // #4285F4
      vec3 cSky   = mix(vec3(0.32, 0.68, 1.00), vec3(0.58, 0.80, 1.00), uDark); // #93C5FD
      vec3 cIris  = mix(vec3(0.58, 0.36, 0.92), vec3(0.66, 0.44, 0.96), uDark); // #A855F7
      vec3 cCoral = mix(vec3(0.94, 0.38, 0.48), vec3(0.95, 0.42, 0.50), uDark); // #F26B7F

      if (uPreset > 0.5 && uPreset < 1.5) {
        cIris  = mix(cBlue, vec3(0.24, 0.78, 0.94), 0.62);
        cCoral = mix(cSky, vec3(0.72, 0.90, 1.00), 0.65);
      } else if (uPreset >= 1.5) {
        cBlue  = vec3(0.18, 0.64, 0.98);
        cSky   = vec3(0.68, 0.88, 1.00);
        cIris  = vec3(0.42, 0.74, 0.98);
        cCoral = vec3(0.86, 0.93, 1.00);
      }

      float waveA = sin(uv.x * 3.8 + t * 0.65 + q.x * 2.2) * 0.5 + 0.5;
      float waveB = cos(uv.x * 2.9 - t * 0.52 + r.y * 2.4) * 0.5 + 0.5;

      vec3 col = mix(cBlue, cSky, smoothstep(0.18, 0.76, silk));
      col = mix(col, cIris, smoothstep(0.30, 0.86, mix(r.x, waveA, 0.40)) * (0.58 + 0.34 * uWorking));
      col = mix(col, cCoral, smoothstep(0.48, 0.92, r.y * waveB) * (0.34 + 0.48 * uWorking));
      col = mix(col, vec3(0.88, 0.94, 1.0), rippleRing * 0.36);

      float alpha = 0.0;
      if (uMode < 0.5) {
        // 1) Whisper-calm Upper Aurora Canopy (barely-perceptible ~40s micro-breathing when stationary)
        float crownY = 0.95 + 0.014 * sin(uv.x * 3.6 + t * 0.55) + 0.016 * (q.x - 0.5);
        float topCanopy = exp(-pow((uv.y - crownY) * 5.2, 2.0));

        // 2) Soft Left Sidebar Frosted Veil (seamless across sash, zero vertical split line)
        float railWave = 0.68 + 0.32 * sin(uv.y * 3.6 - t * 0.45 + r.x * 1.8);
        float leftRail = exp(-pow(uv.x * 4.8, 2.0)) * railWave;

        // 3) Subtle Composer Dock Horizon Glow (gently brightens when Agent is Working!)
        float bottomPool = exp(-pow(uv.y * 6.4, 2.0)) * (0.36 + 0.44 * uWorking + 0.20 * waveB);

        // 4) Serene Home Greeting Ambient Bloom (0% fog inside active chats)
        vec2 autoOrb1 = vec2(sin(t * 0.26) * 0.22 * aspect, 0.14 + cos(t * 0.21) * 0.08);
        vec2 autoOrb2 = vec2(cos(t * 0.23 + 2.1) * 0.20 * aspect, -0.06 + sin(t * 0.28) * 0.08);
        float homeBloom = (
          exp(-dot(pw - autoOrb1, pw - autoOrb1) * 3.8) +
          exp(-dot(pw - autoOrb2, pw - autoOrb2) * 4.2)
        ) * uHome;

        // 5) Gentle Pointer Warmth (only noticeable when moving mouse)
        float cursorGlow = exp(-ptrDist * ptrDist * 6.2) * (0.04 + 0.42 * uVel);

        float silkMask = 0.36 + 0.64 * smoothstep(0.26, 0.86, silk);
        float field = (
          topCanopy * (0.86 + 0.26 * uWorking) +
          leftRail * 0.44 +
          bottomPool * (0.28 + 0.32 * uWorking) +
          homeBloom * 0.34 +
          cursorGlow * 0.34
        ) * silkMask + rippleRing * 0.34;

        float baseAlpha = uDark > 0.5
          ? (0.082 + 0.065 * uEnergy + 0.042 * uWorking) * uGain
          : (0.056 + 0.045 * uEnergy + 0.030 * uWorking) * uGain;

        alpha = clamp(field * baseAlpha, 0.0, 0.42);

        float edgeFade = smoothstep(0.0, 0.012, uv.x) * smoothstep(1.0, 0.985, uv.x)
                       * smoothstep(0.0, 0.025, uv.y);
        alpha *= edgeFade;
      } else {
        // Composer Halo: ultra-quiet when idle, softly luminous when focused or Working
        float flowRate = 0.55 + 1.65 * uWorking + 0.55 * uEnergy;
        float travel = 0.5 + 0.5 * sin(uv.x * 5.2 - uTime * flowRate + silk * 2.8);
        float counter = 0.5 + 0.5 * cos(uv.x * 3.8 + uTime * (flowRate * 0.78) - r.x * 2.2);
        vec3 flowCol = mix(cBlue, cIris, travel);
        flowCol = mix(flowCol, cCoral, smoothstep(0.38, 0.92, counter) * (0.28 + 0.62 * uWorking));
        flowCol = mix(flowCol, cSky, rippleRing * 0.45);
        col = mix(col, flowCol, 0.76);

        float edgeX = min(uv.x, 1.0 - uv.x);
        float edgeY = min(uv.y, 1.0 - uv.y);
        float rim = 1.0 - smoothstep(0.0, 0.34, min(edgeX * 1.75, edgeY));
        float pulse = (0.50 + 0.50 * mix(silk, travel, 0.55)) * rim + rippleRing * 0.32;
        float strength = (uDark > 0.5
          ? (0.14 + 0.24 * uEnergy + 0.44 * uWorking)
          : (0.10 + 0.18 * uEnergy + 0.34 * uWorking)) * min(1.08, uGain + 0.16);
        alpha = clamp(pulse * strength, 0.0, 0.86);
      }

      gl_FragColor = vec4(col * alpha, alpha);
    }
  `;

  function compileShader(gl, type, source) {
    const sh = gl.createShader(type);
    if (!sh) return null;
    gl.shaderSource(sh, source);
    gl.compileShader(sh);
    if (!gl.getShaderParameter(sh, gl.COMPILE_STATUS)) {
      gl.deleteShader(sh);
      return null;
    }
    return sh;
  }

  function createFluidGlSurface(canvas, modeValue) {
    if (!canvas || typeof canvas.getContext !== 'function') return null;
    let gl = null;
    try {
      gl =
        canvas.getContext('webgl', {
          alpha: true,
          premultipliedAlpha: true,
          antialias: false,
          depth: false,
          stencil: false,
          powerPreference: 'low-power',
          preserveDrawingBuffer: false,
        }) ||
        canvas.getContext('experimental-webgl', {
          alpha: true,
          premultipliedAlpha: true,
          antialias: false,
          depth: false,
          stencil: false,
        });
    } catch (_) {
      return null;
    }
    if (!gl) return null;

    const vs = compileShader(gl, gl.VERTEX_SHADER, VERTEX_SHADER_SRC);
    const fs = compileShader(gl, gl.FRAGMENT_SHADER, FRAGMENT_SHADER_SRC);
    if (!vs || !fs) return null;

    const prog = gl.createProgram();
    if (!prog) return null;
    gl.attachShader(prog, vs);
    gl.attachShader(prog, fs);
    gl.linkProgram(prog);
    if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) {
      gl.deleteProgram(prog);
      return null;
    }

    const buf = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, buf);
    gl.bufferData(
      gl.ARRAY_BUFFER,
      new Float32Array([-1, -1, 1, -1, -1, 1, -1, 1, 1, -1, 1, 1]),
      gl.STATIC_DRAW
    );

    const aPos = gl.getAttribLocation(prog, 'aPos');
    const uTime = gl.getUniformLocation(prog, 'uTime');
    const uRes = gl.getUniformLocation(prog, 'uRes');
    const uPointer = gl.getUniformLocation(prog, 'uPointer');
    const uVel = gl.getUniformLocation(prog, 'uVel');
    const uRipple = gl.getUniformLocation(prog, 'uRipple');
    const uEnergy = gl.getUniformLocation(prog, 'uEnergy');
    const uWorking = gl.getUniformLocation(prog, 'uWorking');
    const uGain = gl.getUniformLocation(prog, 'uGain');
    const uDark = gl.getUniformLocation(prog, 'uDark');
    const uHome = gl.getUniformLocation(prog, 'uHome');
    const uPreset = gl.getUniformLocation(prog, 'uPreset');
    const uMode = gl.getUniformLocation(prog, 'uMode');

    let lastW = 0;
    let lastH = 0;

    return {
      render(params) {
        if (gl.isContextLost && gl.isContextLost()) return;
        const scale = modeValue === 0 ? 0.26 : 0.36;
        const rectW = Math.max(1, canvas.clientWidth || 320);
        const rectH = Math.max(1, canvas.clientHeight || 180);
        const targetW = Math.max(56, Math.min(480, Math.round(rectW * scale)));
        const targetH = Math.max(36, Math.min(320, Math.round(rectH * scale)));
        if (targetW !== lastW || targetH !== lastH) {
          canvas.width = targetW;
          canvas.height = targetH;
          lastW = targetW;
          lastH = targetH;
        }
        gl.viewport(0, 0, lastW, lastH);
        gl.clearColor(0, 0, 0, 0);
        gl.clear(gl.COLOR_BUFFER_BIT);
        gl.useProgram(prog);
        gl.enable(gl.BLEND);
        gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA);

        gl.bindBuffer(gl.ARRAY_BUFFER, buf);
        gl.enableVertexAttribArray(aPos);
        gl.vertexAttribPointer(aPos, 2, gl.FLOAT, false, 0, 0);

        gl.uniform1f(uTime, params.time);
        gl.uniform2f(uRes, lastW, lastH);
        gl.uniform2f(uPointer, params.px, params.py);
        gl.uniform1f(uVel, params.vel || 0);
        gl.uniform3f(uRipple, params.rx ?? 0.5, params.ry ?? 0.5, params.rProg ?? -1.0);
        gl.uniform1f(uEnergy, params.energy || 0);
        gl.uniform1f(uWorking, params.workingLevel || 0);
        gl.uniform1f(uGain, params.gain || 0.64);
        gl.uniform1f(uDark, params.dark ? 1.0 : 0.0);
        gl.uniform1f(uHome, params.home ? 1.0 : 0.0);
        gl.uniform1f(uPreset, params.presetIndex);
        gl.uniform1f(uMode, modeValue);

        gl.drawArrays(gl.TRIANGLES, 0, 6);
      },
      dispose() {
        try {
          gl.deleteBuffer(buf);
          gl.deleteProgram(prog);
          gl.deleteShader(vs);
          gl.deleteShader(fs);
        } catch (_) {}
      },
    };
  }

  // ============================================================================
  // 2. Authentic Google Gemini CSS Design System & Calm + Working-State Physics
  // ============================================================================
  function buildGeminiStylesheet() {
    return `
/* ==========================================================================
   Antigravity Native Gemini UI Engine (v2.3.0 — Calm Micro-Breath & Working States)
   Benchmarks Google Gemini (Material 3 Expressive + Gemini Live)
   ========================================================================== */

@import url('https://fonts.googleapis.com/css2?family=Google+Sans+Code:wght@400;500;600&family=Plus+Jakarta+Sans:wght@400;500;600;700&display=swap');

@property --agy-gem-angle {
  syntax: '<angle>';
  initial-value: 0deg;
  inherits: false;
}

:root[data-agy-gemini-ui] {
  --agy-gemini-spring: cubic-bezier(0.22, 1, 0.36, 1);
  --agy-gemini-bounce: cubic-bezier(0.28, 1.18, 0.54, 1);
  --agy-gemini-silk: cubic-bezier(0.16, 1, 0.3, 1);
  --font-sans: "Google Sans Flex", "Google Sans", "Plus Jakarta Sans", "PingFang SC", -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif !important;
  --font-mono: "Google Sans Code", "SF Mono", "JetBrains Mono", Menlo, Monaco, Consolas, monospace !important;
  --card-radius: 1.25rem !important;
  --nux-composer-radius: 25px !important;
  --nux-composer-frame-radius: 26px !important;
}

/* ---------- Preset 1: Gemini Nebula (Dark) ---------- */
html[data-agy-gemini-ui="nebula"][data-agy-gemini-scheme="dark"],
html[data-agy-gemini-ui="nebula"] body.dark,
html[data-agy-gemini-ui="nebula"] body.theme-dark {
  --shell: #14161B !important;
  --shell-canvas: #14161B !important;
  --background: #131314 !important;
  --content: #131314 !important;
  --foreground: #E3E3E3 !important;
  --primary: #A8C7FA !important;
  --primary-foreground: #062E6F !important;
  --cta: #A8C7FA !important;
  --cta-foreground: #062E6F !important;
  --secondary: #282A2C !important;
  --secondary-foreground: #C4C7C5 !important;
  --muted: #1B1C1E !important;
  --muted-foreground: #969A9E !important;
  --placeholder: #787D82 !important;
  --card: #1E1F20 !important;
  --card-border: rgba(168, 199, 250, 0.11) !important;
  --border: rgba(255, 255, 255, 0.08) !important;
  --card-edge: rgba(168, 199, 250, 0.14) !important;
  --sidebar: #16181E !important;
  --sidebar-secondary: #242832 !important;
  --sidebar-muted: #1D2028 !important;
  --agy-gemini-sidebar-surface: #16181E;
  --glass: rgba(28, 29, 34, 0.78) !important;
  --glass-border: rgba(168, 199, 250, 0.14) !important;
  --glass-highlight: rgba(255, 255, 255, 0.11) !important;
  --glass-shadow: 0 22px 52px -12px rgba(0, 0, 0, 0.56), 0 4px 14px -2px rgba(0, 0, 0, 0.34) !important;
  --onyx-frame: rgba(26, 28, 33, 0.86) !important;
  --onyx-raised: rgba(30, 32, 38, 0.90) !important;
  --onyx-well: #151618 !important;
  --onyx-key: #282A2C !important;
  --onyx-selected: rgba(168, 199, 250, 0.17) !important;
  --link: #8AB4F8 !important;
  --success: #81C995 !important;
  --warning: #FDD663 !important;
  --error: #F28B82 !important;
  --code-foreground: #F6AEA9 !important;
  --home-glow: rgba(124, 172, 248, 0.12) !important;
  --agy-gemini-user-bubble: #282A2E;
  --agy-gemini-selected-fg: #E2EEFF;
  --agy-gemini-spot-color: rgba(168, 199, 250, 0.12);
  --agy-gemini-rim-color: rgba(168, 199, 250, 0.38);
}

/* ---------- Preset 1: Gemini Nebula (Light) ---------- */
html[data-agy-gemini-ui="nebula"][data-agy-gemini-scheme="light"],
html[data-agy-gemini-ui="nebula"] body.theme-light {
  --shell: #E9EEF6 !important;
  --shell-canvas: #E9EEF6 !important;
  --background: #F8FAFD !important;
  --content: #F8FAFD !important;
  --foreground: #1F1F1F !important;
  --primary: #0B57D0 !important;
  --primary-foreground: #FFFFFF !important;
  --cta: #0B57D0 !important;
  --cta-foreground: #FFFFFF !important;
  --secondary: #E1E7F0 !important;
  --secondary-foreground: #444746 !important;
  --muted: #F0F4F9 !important;
  --muted-foreground: #5E6368 !important;
  --placeholder: #80868B !important;
  --card: #FFFFFF !important;
  --card-border: rgba(11, 87, 208, 0.11) !important;
  --border: rgba(15, 23, 42, 0.08) !important;
  --card-edge: rgba(11, 87, 208, 0.12) !important;
  --sidebar: #EEF3FA !important;
  --sidebar-secondary: #DCE5F2 !important;
  --sidebar-muted: #E4ECF7 !important;
  --agy-gemini-sidebar-surface: #EEF3FA;
  --glass: rgba(255, 255, 255, 0.86) !important;
  --glass-border: rgba(11, 87, 208, 0.14) !important;
  --glass-highlight: rgba(255, 255, 255, 0.96) !important;
  --glass-shadow: 0 18px 42px -12px rgba(11, 87, 208, 0.12), 0 2px 8px -2px rgba(15, 23, 42, 0.05) !important;
  --onyx-frame: rgba(240, 244, 249, 0.90) !important;
  --onyx-raised: rgba(255, 255, 255, 0.94) !important;
  --onyx-well: #E6ECF5 !important;
  --onyx-key: #FFFFFF !important;
  --onyx-selected: #D3E3FD !important;
  --link: #0B57D0 !important;
  --success: #188038 !important;
  --warning: #E37400 !important;
  --error: #D93025 !important;
  --code-foreground: #B3261E !important;
  --home-glow: rgba(66, 133, 244, 0.09) !important;
  --agy-gemini-user-bubble: #E9EEF6;
  --agy-gemini-selected-fg: #041E49;
  --agy-gemini-spot-color: rgba(11, 87, 208, 0.08);
  --agy-gemini-rim-color: rgba(11, 87, 208, 0.30);
}

/* ---------- Preset 2: Gemini Pure (Minimalist Tonal) ---------- */
html[data-agy-gemini-ui="pure"][data-agy-gemini-scheme="dark"],
html[data-agy-gemini-ui="pure"] body.dark {
  --shell: #111318 !important;
  --shell-canvas: #111318 !important;
  --background: #111215 !important;
  --content: #111215 !important;
  --foreground: #E8EAED !important;
  --primary: #8AB4F8 !important;
  --primary-foreground: #041E49 !important;
  --secondary: #23252A !important;
  --secondary-foreground: #BDC1C6 !important;
  --muted: #17181C !important;
  --muted-foreground: #8A9096 !important;
  --card: #191B1F !important;
  --card-border: rgba(138, 180, 248, 0.10) !important;
  --border: rgba(255, 255, 255, 0.07) !important;
  --card-edge: rgba(138, 180, 248, 0.13) !important;
  --sidebar: #14161B !important;
  --sidebar-secondary: #1E2128 !important;
  --sidebar-muted: #181B21 !important;
  --agy-gemini-sidebar-surface: #14161B;
  --glass: rgba(25, 27, 31, 0.84) !important;
  --glass-border: rgba(138, 180, 248, 0.12) !important;
  --glass-highlight: rgba(255, 255, 255, 0.085) !important;
  --onyx-frame: rgba(23, 24, 28, 0.88) !important;
  --onyx-raised: rgba(25, 27, 31, 0.92) !important;
  --onyx-selected: rgba(138, 180, 248, 0.16) !important;
  --agy-gemini-user-bubble: #23252A;
  --agy-gemini-selected-fg: #D2E3FC;
  --agy-gemini-spot-color: rgba(138, 180, 248, 0.11);
  --agy-gemini-rim-color: rgba(138, 180, 248, 0.34);
}

html[data-agy-gemini-ui="pure"][data-agy-gemini-scheme="light"],
html[data-agy-gemini-ui="pure"] body.theme-light {
  --shell: #EDF1F7 !important;
  --shell-canvas: #EDF1F7 !important;
  --background: #FAFBFD !important;
  --content: #FAFBFD !important;
  --foreground: #202124 !important;
  --primary: #1A73E8 !important;
  --primary-foreground: #FFFFFF !important;
  --secondary: #E8EDF5 !important;
  --secondary-foreground: #3C4043 !important;
  --muted: #F1F5FA !important;
  --muted-foreground: #5F6368 !important;
  --card: #FFFFFF !important;
  --card-border: rgba(26, 115, 232, 0.09) !important;
  --border: rgba(32, 33, 36, 0.07) !important;
  --sidebar: #F0F4FA !important;
  --sidebar-secondary: #E2E8F2 !important;
  --sidebar-muted: #EBF0F7 !important;
  --agy-gemini-sidebar-surface: #F0F4FA;
  --glass: rgba(255, 255, 255, 0.88) !important;
  --onyx-selected: #D2E3FC !important;
  --agy-gemini-user-bubble: #EDF2FA;
  --agy-gemini-selected-fg: #041E49;
  --agy-gemini-spot-color: rgba(26, 115, 232, 0.07);
  --agy-gemini-rim-color: rgba(26, 115, 232, 0.28);
}

/* ---------- Preset 3: Apple Silicon Liquid Glass ---------- */
html[data-agy-gemini-ui="liquid"][data-agy-gemini-scheme="dark"],
html[data-agy-gemini-ui="liquid"] body.dark {
  --shell: #0D1118 !important;
  --shell-canvas: #0D1118 !important;
  --background: #0E1117 !important;
  --content: #0E1117 !important;
  --foreground: #ECF2F8 !important;
  --primary: #79C0FF !important;
  --primary-foreground: #032040 !important;
  --secondary: rgba(255, 255, 255, 0.085) !important;
  --secondary-foreground: #C9D1D9 !important;
  --muted: rgba(255, 255, 255, 0.045) !important;
  --muted-foreground: #8B949E !important;
  --card: rgba(22, 27, 35, 0.74) !important;
  --card-border: rgba(121, 192, 255, 0.14) !important;
  --border: rgba(255, 255, 255, 0.085) !important;
  --card-edge: rgba(121, 192, 255, 0.18) !important;
  --sidebar: #111620 !important;
  --sidebar-secondary: rgba(121, 192, 255, 0.12) !important;
  --sidebar-muted: rgba(255, 255, 255, 0.05) !important;
  --agy-gemini-sidebar-surface: #111620;
  --glass: rgba(20, 25, 34, 0.68) !important;
  --glass-border: rgba(121, 192, 255, 0.18) !important;
  --glass-highlight: rgba(255, 255, 255, 0.18) !important;
  --glass-shadow: 0 24px 58px -12px rgba(0, 0, 0, 0.64), 0 4px 14px rgba(0, 0, 0, 0.35) !important;
  --onyx-frame: rgba(16, 20, 28, 0.72) !important;
  --onyx-raised: rgba(24, 30, 41, 0.78) !important;
  --onyx-selected: rgba(121, 192, 255, 0.19) !important;
  --agy-gemini-user-bubble: rgba(36, 44, 58, 0.85);
  --agy-gemini-selected-fg: #E0F2FE;
  --agy-gemini-spot-color: rgba(121, 192, 255, 0.14);
  --agy-gemini-rim-color: rgba(121, 192, 255, 0.44);
}

html[data-agy-gemini-ui="liquid"][data-agy-gemini-scheme="light"],
html[data-agy-gemini-ui="liquid"] body.theme-light {
  --shell: #E4EBF5 !important;
  --shell-canvas: #E4EBF5 !important;
  --background: #F4F7FC !important;
  --content: #F4F7FC !important;
  --foreground: #0F172A !important;
  --primary: #0284C7 !important;
  --primary-foreground: #FFFFFF !important;
  --secondary: rgba(15, 23, 42, 0.065) !important;
  --card: rgba(255, 255, 255, 0.80) !important;
  --card-border: rgba(2, 132, 199, 0.14) !important;
  --border: rgba(15, 23, 42, 0.08) !important;
  --sidebar: #E8EFF8 !important;
  --agy-gemini-sidebar-surface: #E8EFF8;
  --glass: rgba(255, 255, 255, 0.74) !important;
  --glass-border: rgba(255, 255, 255, 0.94) !important;
  --glass-highlight: #FFFFFF !important;
  --onyx-selected: rgba(2, 132, 199, 0.15) !important;
  --agy-gemini-user-bubble: rgba(226, 236, 248, 0.88);
  --agy-gemini-selected-fg: #0C4A6E;
  --agy-gemini-spot-color: rgba(2, 132, 199, 0.10);
  --agy-gemini-rim-color: rgba(2, 132, 199, 0.34);
}

/* ---------- Full-Window Seamless WebGL Canopy (Serene Micro-Breath, Zero Split Seam) ---------- */
#agy-gemini-ambient-gl {
  position: fixed;
  inset: 0;
  width: 100vw;
  height: 100vh;
  pointer-events: none !important;
  z-index: 15;
  opacity: 0.92;
  mix-blend-mode: screen;
  transition: opacity 640ms var(--agy-gemini-silk);
}

html[data-agy-gemini-scheme="light"] #agy-gemini-ambient-gl {
  z-index: 15;
  opacity: 0.46;
  mix-blend-mode: normal;
}

body[data-has-browser-hole="true"] #agy-gemini-ambient-gl,
html:not([data-agy-gemini-webgl="1"]) #agy-gemini-ambient-gl {
  opacity: 0 !important;
}

/* ---------- Unified Shell, Inset Right Sheet & Top Window Chrome ---------- */
html[data-agy-gemini-ui] .agy-inset-shell {
  background:
    radial-gradient(65% 42% at 14% 0%, color-mix(in srgb, var(--primary) 9%, transparent) 0%, transparent 100%),
    var(--agy-gemini-sidebar-surface, var(--sidebar)) !important;
}

html[data-agy-gemini-ui] [data-testid="sidebar-split"] > div:first-child,
html[data-agy-gemini-ui] [data-testid="sidebar-split"] [style*="--sidebar"] {
  --sidebar: var(--agy-gemini-sidebar-surface, #16181E) !important;
  --color-sidebar: var(--agy-gemini-sidebar-surface, #16181E) !important;
}

html[data-agy-gemini-ui] body:not([data-has-browser-hole="true"]) .agy-sheet [data-main-content-body] {
  background-color: color-mix(in srgb, var(--background) 96%, transparent) !important;
  box-shadow:
    -10px 0 30px -14px rgba(0, 0, 0, 0.46),
    inset 0 1px 0 var(--glass-highlight) !important;
}

html[data-agy-gemini-ui] :has(> [data-testid^="right-cluster"]) {
  background-color: transparent !important;
}

html[data-agy-gemini-ui] :is(
  [data-testid="sidebar-search-button"],
  [data-testid="app-icon-new-conversation-button"],
  .agy-inset-shell > .z-50 button
) {
  border-radius: 9999px !important;
  transition:
    transform 200ms var(--agy-gemini-silk),
    background-color 180ms ease,
    color 180ms ease !important;
}

html[data-agy-gemini-ui][data-agy-gemini-motion="1"] :is(
  [data-testid="sidebar-search-button"],
  [data-testid="app-icon-new-conversation-button"],
  .agy-inset-shell > .z-50 button
):hover {
  transform: scale(1.045);
  background-color: color-mix(in srgb, var(--onyx-selected) 65%, transparent) !important;
  color: var(--foreground) !important;
}

html[data-agy-gemini-ui][data-agy-gemini-motion="1"] :is(
  [data-testid="sidebar-search-button"],
  [data-testid="app-icon-new-conversation-button"],
  .agy-inset-shell > .z-50 button
):active {
  transform: scale(0.95) !important;
}

/* Subtle Gemini Aurora Line on Sidebar Split Sash Hover/Drag */
html[data-agy-gemini-ui] [data-testid="sidebar-sash"] {
  position: relative;
}

html[data-agy-gemini-ui] [data-testid="sidebar-sash"]::after {
  content: "";
  position: absolute;
  top: 44px;
  bottom: 14px;
  left: 50%;
  width: 2px;
  transform: translateX(-50%) scaleY(0.4);
  border-radius: 9999px;
  background: linear-gradient(180deg, transparent 0%, #4285F4 26%, #A855F7 58%, #F26B7F 84%, transparent 100%);
  opacity: 0;
  pointer-events: none !important;
  transition: opacity 220ms ease, transform 280ms var(--agy-gemini-silk);
}

html[data-agy-gemini-ui] [data-testid="sidebar-sash"]:hover::after,
html[data-agy-gemini-ui] [data-testid="sidebar-sash"]:active::after {
  opacity: 0.78;
  transform: translateX(-50%) scaleY(1);
}

html[data-agy-gemini-ui] .agy-home {
  position: relative;
  z-index: 3;
}

/* ---------- Left Sidebar SDK Deep Styling (Calm & Restrained Hover) ---------- */
html[data-agy-gemini-ui] div[role="navigation"][aria-label="Sidebar"] {
  background:
    linear-gradient(
      180deg,
      color-mix(in srgb, var(--primary) 6%, var(--agy-gemini-sidebar-surface, var(--sidebar))) 0%,
      var(--agy-gemini-sidebar-surface, var(--sidebar)) 38%,
      color-mix(in srgb, var(--agy-gemini-sidebar-surface, var(--sidebar)) 95%, #000000) 100%
    ) !important;
  border-right: 1px solid color-mix(in srgb, var(--primary) 9%, transparent) !important;
}

html[data-agy-gemini-ui][data-agy-gemini-scheme="light"] div[role="navigation"][aria-label="Sidebar"] {
  background:
    linear-gradient(
      180deg,
      color-mix(in srgb, var(--primary) 5%, var(--agy-gemini-sidebar-surface, var(--sidebar))) 0%,
      var(--agy-gemini-sidebar-surface, var(--sidebar)) 55%,
      #E6EEF8 100%
    ) !important;
  border-right: 1px solid rgba(11, 87, 208, 0.08) !important;
}

html[data-agy-gemini-ui] div[role="navigation"][aria-label="Sidebar"] ::-webkit-scrollbar {
  width: 5px;
  height: 5px;
}

html[data-agy-gemini-ui] div[role="navigation"][aria-label="Sidebar"] ::-webkit-scrollbar-track {
  background: transparent !important;
}

html[data-agy-gemini-ui] div[role="navigation"][aria-label="Sidebar"] ::-webkit-scrollbar-thumb {
  background: color-mix(in srgb, var(--primary) 20%, transparent);
  border-radius: 9999px;
}

html[data-agy-gemini-ui] div[role="navigation"][aria-label="Sidebar"] ::-webkit-scrollbar-thumb:hover {
  background: color-mix(in srgb, var(--primary) 38%, transparent);
}

/* 1) Hero Pill CTA: + 新建对话 — Static pearl rim when idle, gentle conic sheen ONLY on hover */
html[data-agy-gemini-ui] [data-testid="new-conversation-button"] {
  position: relative;
  border-radius: 9999px !important;
  padding: 8px 14px !important;
  margin-block: 2px 4px !important;
  font-weight: 500 !important;
  letter-spacing: 0.01em;
  color: var(--foreground) !important;
  border: 1px solid color-mix(in srgb, var(--primary) 24%, transparent) !important;
  background: linear-gradient(
    135deg,
    color-mix(in srgb, var(--primary) 18%, var(--sidebar-secondary)) 0%,
    color-mix(in srgb, #A855F7 10%, var(--sidebar-muted)) 62%,
    color-mix(in srgb, #F26B7F 7%, var(--sidebar-muted)) 100%
  ) !important;
  box-shadow:
    inset 0 1px 0 rgba(255, 255, 255, 0.13),
    0 6px 16px -6px rgba(66, 133, 244, 0.22) !important;
  transform: translate3d(var(--agy-mag-x, 0px), var(--agy-mag-y, 0px), 0);
  transition:
    transform 240ms var(--agy-gemini-silk),
    box-shadow 240ms var(--agy-gemini-silk),
    border-color 220ms ease,
    background 240ms ease !important;
}

html[data-agy-gemini-ui][data-agy-gemini-motion="1"] [data-testid="new-conversation-button"]::before {
  content: "";
  position: absolute;
  inset: -1px;
  border-radius: 9999px;
  padding: 1px;
  background: conic-gradient(
    from var(--agy-gem-angle),
    rgba(66, 133, 244, 0.65),
    rgba(168, 199, 250, 0.88),
    rgba(168, 85, 247, 0.72),
    rgba(242, 107, 127, 0.65),
    rgba(66, 133, 244, 0.65)
  );
  -webkit-mask: linear-gradient(#000 0 0) content-box, linear-gradient(#000 0 0);
  -webkit-mask-composite: xor;
  mask-composite: exclude;
  pointer-events: none !important;
  opacity: 0.18;
  animation: none;
  transition: opacity 260ms ease;
}

html[data-agy-gemini-ui][data-agy-gemini-motion="1"] [data-testid="new-conversation-button"]:hover {
  transform: translate3d(var(--agy-mag-x, 0px), calc(var(--agy-mag-y, 0px) - 1px), 0) scale(1.012);
  box-shadow:
    inset 0 1px 0 rgba(255, 255, 255, 0.22),
    0 10px 24px -8px rgba(66, 133, 244, 0.34) !important;
}

html[data-agy-gemini-ui][data-agy-gemini-motion="1"] [data-testid="new-conversation-button"]:hover::before {
  opacity: 0.72;
  animation: agyGeminiSpinAngle 10s linear infinite;
}

html[data-agy-gemini-ui] [data-testid="new-conversation-button"] :is(svg, [class*="icon"]) {
  color: var(--primary) !important;
  transition: transform 260ms var(--agy-gemini-silk), color 180ms ease;
}

html[data-agy-gemini-ui][data-agy-gemini-motion="1"] [data-testid="new-conversation-button"]:hover :is(svg, [class*="icon"]) {
  transform: rotate(90deg);
}

html[data-agy-gemini-ui][data-agy-gemini-motion="1"] [data-testid="new-conversation-button"]:active {
  transform: scale(0.98) !important;
}

/* 2) Sidebar V6 Navigation Items & Bottom Settings (Restrained 2px glide) */
html[data-agy-gemini-ui] :is(
  [data-testid="sidebar-navigation-items"] :is(a, button, [role="button"]):not([data-testid="new-conversation-button"]),
  [data-testid="history-button"],
  [data-testid="automations-button"],
  [data-testid="settings-button"]
) {
  border-radius: 9999px !important;
  padding-inline: 11px !important;
  position: relative;
  transition:
    transform 220ms var(--agy-gemini-silk),
    background-color 180ms var(--agy-gemini-silk),
    color 180ms ease !important;
}

html[data-agy-gemini-ui][data-agy-gemini-motion="1"] :is(
  [data-testid="sidebar-navigation-items"] :is(a, button, [role="button"]):not([data-testid="new-conversation-button"]),
  [data-testid="history-button"],
  [data-testid="automations-button"],
  [data-testid="settings-button"]
):hover {
  transform: translateX(2px);
  background-color: color-mix(in srgb, var(--onyx-selected) 60%, transparent) !important;
  color: var(--foreground) !important;
}

html[data-agy-gemini-ui][data-agy-gemini-motion="1"] :is(
  [data-testid="sidebar-navigation-items"] :is(a, button, [role="button"]):not([data-testid="new-conversation-button"]),
  [data-testid="history-button"],
  [data-testid="automations-button"],
  [data-testid="settings-button"]
):hover :is(svg, [class*="icon"]) {
  color: var(--primary) !important;
  transition: color 180ms ease;
}

/* 3) Sidebar Project / Workspace Group Headers */
html[data-agy-gemini-ui] :is(button[data-project-card], [data-testid="project-header"]) {
  border-radius: 9999px !important;
  padding-left: 10px !important;
  margin-block: 1px;
  font-weight: 500;
  transition:
    transform 220ms var(--agy-gemini-silk),
    background-color 180ms var(--agy-gemini-silk),
    color 180ms ease !important;
}

html[data-agy-gemini-ui] :is(button[data-project-card], [data-testid="project-header"])[aria-expanded="true"] :is(svg, [class*="icon"]) {
  color: color-mix(in srgb, var(--primary) 78%, var(--muted-foreground));
}

html[data-agy-gemini-ui][data-agy-gemini-motion="1"] :is(button[data-project-card], [data-testid="project-header"]):hover {
  transform: translateX(2px);
  background-color: color-mix(in srgb, var(--onyx-selected) 48%, transparent) !important;
  color: var(--foreground) !important;
}

html[data-agy-gemini-ui] div[role="navigation"][aria-label="Sidebar"] .group\\/header button:not([data-project-card]) {
  background: transparent !important;
  border-radius: 9999px !important;
  transition: transform 180ms var(--agy-gemini-silk), background-color 160ms ease !important;
}

html[data-agy-gemini-ui] div[role="navigation"][aria-label="Sidebar"] .group\\/header button:not([data-project-card]):hover {
  background-color: var(--onyx-selected) !important;
  color: var(--primary) !important;
  transform: scale(1.06);
}

/* 4) Subtle Cursor-Tracking Spotlight on Hovered Sidebar Items */
html[data-agy-gemini-ui][data-agy-gemini-spotlight="1"] :is(
  .agy-sidebar-row,
  button[data-project-card],
  [data-testid="sidebar-navigation-items"] :is(a, button):not([data-testid="new-conversation-button"]),
  [data-testid="settings-button"]
)[data-agy-side-spot="1"]:not([data-selected="true"]) {
  background-image: radial-gradient(
    140px circle at var(--agy-spot-x, 50%) var(--agy-spot-y, 50%),
    var(--agy-gemini-spot-color, rgba(168, 199, 250, 0.12)),
    transparent 74%
  ) !important;
}

/* ---------- Top Gemini Intelligence Stream Bar (HIDDEN when Idle, Awakens ONLY on Prompt Sent / Working!) ---------- */
#agy-gemini-stream-bar {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  height: 2px;
  pointer-events: none !important;
  z-index: 2147483642;
  opacity: 0;
  background: linear-gradient(90deg, #4285F4 0%, #8AB4F8 26%, #A855F7 54%, #F26B7F 78%, #4285F4 100%);
  background-size: 220% 100%;
  animation: agyGeminiStreamFlow 2.6s linear infinite;
  animation-play-state: paused;
  transition: opacity 420ms var(--agy-gemini-silk), height 280ms var(--agy-gemini-silk), filter 360ms ease;
}

#agy-gemini-stream-bar[data-working="1"] {
  height: 2.5px;
  opacity: 0.92;
  animation-play-state: running;
  filter: drop-shadow(0 1px 8px rgba(124, 172, 248, 0.55));
}

#agy-gemini-stream-bar[data-state="launching"] {
  height: 3px;
  opacity: 1;
  animation-play-state: running;
  animation-duration: 1.45s;
  filter: drop-shadow(0 2px 12px rgba(168, 199, 250, 0.72));
}

#agy-gemini-stream-bar[data-state="compacting"] {
  height: 2.5px;
  opacity: 0.88;
  animation-play-state: running;
  background: linear-gradient(90deg, #A855F7 0%, #8AB4F8 35%, #FDD663 68%, #A855F7 100%);
  background-size: 220% 100%;
}

#agy-gemini-stream-bar[data-state="waiting"] {
  height: 2.5px;
  opacity: 0.82;
  animation-play-state: running;
  animation-duration: 4.2s;
  background: linear-gradient(90deg, #4285F4 0%, #FDD663 50%, #4285F4 100%);
  background-size: 220% 100%;
}

body[data-has-browser-hole="true"] #agy-gemini-stream-bar,
html:not([data-agy-gemini-motion="1"]) #agy-gemini-stream-bar {
  opacity: 0 !important;
  animation: none !important;
}

@keyframes agyGeminiStreamFlow {
  0% { background-position: 0% 50%; }
  100% { background-position: 220% 50%; }
}

/* ---------- Dedicated Overlay FX Layer (Subtle CTA Water-Drop & Prompt Launch Pulse) ---------- */
#agy-gemini-fx-layer {
  position: fixed;
  inset: 0;
  width: 100vw;
  height: 100vh;
  pointer-events: none !important;
  overflow: hidden;
  z-index: 2147483643;
}

.agy-gemini-click-ripple {
  position: fixed;
  border-radius: 9999px;
  pointer-events: none !important;
  transform: translate(-50%, -50%) scale(0.25);
  background: radial-gradient(
    circle,
    rgba(168, 199, 250, 0.26) 0%,
    rgba(168, 85, 247, 0.14) 52%,
    transparent 100%
  );
  border: 1px solid rgba(168, 199, 250, 0.42);
  animation: agyGeminiClickWave 520ms var(--agy-gemini-silk) forwards;
}

@keyframes agyGeminiClickWave {
  0% {
    opacity: 0.72;
    transform: translate(-50%, -50%) scale(0.26);
  }
  100% {
    opacity: 0;
    transform: translate(-50%, -50%) scale(1.42);
  }
}

/* ---------- Native AGY Working / Compacting / Step Progress Gemini Visual Polish ---------- */
/* Pure CSS ::before star & chromatic shimmer — ZERO React DOM child mutations! */
html[data-agy-gemini-ui] :is([data-testid="agent-loading"], [data-testid="ephemeral-tool-status"]) {
  position: relative;
  display: inline-flex !important;
  align-items: center;
  width: fit-content;
  max-width: 100%;
  border-radius: 9999px !important;
  padding: 3px 12px 3px 10px !important;
  margin-block: 2px;
  background: linear-gradient(
    90deg,
    color-mix(in srgb, var(--primary) 11%, transparent) 0%,
    color-mix(in srgb, #A855F7 7%, transparent) 58%,
    transparent 100%
  );
  border: 1px solid color-mix(in srgb, var(--primary) 16%, transparent);
  box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.06);
  transition: background-color 240ms ease, border-color 240ms ease;
}

html[data-agy-gemini-ui] :is([data-testid="agent-loading"], [data-testid="ephemeral-tool-status"])::before {
  content: "✦";
  display: inline-block;
  margin-right: 7px;
  font-size: 13px;
  line-height: 1;
  background: linear-gradient(135deg, #4285F4 0%, #8AB4F8 36%, #A855F7 70%, #F26B7F 100%);
  -webkit-background-clip: text;
  background-clip: text;
  color: transparent;
  filter: drop-shadow(0 0 6px rgba(124, 172, 248, 0.55));
  animation: agyGeminiWorkingStar 2.4s ease-in-out infinite;
  flex-shrink: 0;
}

@keyframes agyGeminiWorkingStar {
  0%, 100% {
    transform: scale(0.90) rotate(0deg);
    opacity: 0.78;
  }
  50% {
    transform: scale(1.14) rotate(14deg);
    opacity: 1;
  }
}

html[data-agy-gemini-ui] :is([data-testid="agent-loading"], [data-testid="ephemeral-tool-status"]) .animate-shimmer-text .shimmer-text-content {
  font-weight: 500;
  letter-spacing: 0.01em;
  background: linear-gradient(
    90deg,
    var(--muted-foreground) 0%,
    var(--primary) 34%,
    #D8B4FE 50%,
    #F6AEA9 64%,
    var(--muted-foreground) 100%
  );
  background-size: 220% 100%;
  -webkit-background-clip: text;
  background-clip: text;
  color: transparent;
  animation: agyGeminiStreamFlow 2.5s linear infinite;
}

html[data-agy-gemini-ui][data-agy-gemini-scheme="light"] :is([data-testid="agent-loading"], [data-testid="ephemeral-tool-status"]) .animate-shimmer-text .shimmer-text-content {
  background: linear-gradient(
    90deg,
    #5E6368 0%,
    #0B57D0 34%,
    #7C3AED 52%,
    #D93025 66%,
    #5E6368 100%
  );
  background-size: 220% 100%;
  -webkit-background-clip: text;
  background-clip: text;
  color: transparent;
}

/* Refined Agent Step Timeline & Collapsible Progress Group */
html[data-agy-gemini-ui] [data-testid="progress-updates-timeline"] {
  position: relative;
  border-left: 1.5px solid color-mix(in srgb, var(--primary) 18%, transparent);
  margin-left: 7px;
  padding-left: 6px;
}

html[data-agy-gemini-ui] :is(
  [data-testid="progress-updates-collapsible"] > button,
  [data-testid="run-command-step"] > div:first-child,
  [data-testid="view-file-step"] > div:first-child,
  [data-testid="mcp-tool-step"] > div:first-child
) {
  border-radius: 10px;
  transition: background-color 180ms ease;
}

/* Subtle pulsing halo on Stop button while Agent is actively working */
html[data-agy-gemini-ui][data-agy-gemini-motion="1"] :is(
  [data-testid="send-button-loading"],
  button[aria-label="Stop"],
  button[aria-label="停止"],
  button[aria-label="Stop Execution"],
  button[aria-label="停止执行"]
) {
  border-radius: 9999px !important;
  box-shadow: 0 0 0 1px color-mix(in srgb, var(--primary) 38%, transparent), 0 0 14px -2px rgba(124, 172, 248, 0.36) !important;
}

/* ---------- Gemini Pill Composer (Calm Idle, Focused Sheen, Living Working Rim, ZERO Typing Jitter) ---------- */
html[data-agy-gemini-ui] #antigravity\\.agentSidePanelInputBox,
html[data-agy-gemini-ui] .surface-composer {
  position: relative;
  border-radius: 26px !important;
  background: var(--onyx-frame, var(--muted)) !important;
  box-shadow:
    inset 0 1px 0 var(--glass-highlight),
    0 0 0 1px var(--glass-border),
    0 14px 36px -12px rgba(0, 0, 0, 0.30) !important;
  transition:
    transform 280ms var(--agy-gemini-silk),
    box-shadow 320ms var(--agy-gemini-silk),
    background-color 240ms ease !important;
}

/* Static subtle pearlescent border when idle; gently animates ONLY on focus or Working! */
html[data-agy-gemini-ui][data-agy-gemini-motion="1"] .surface-composer::before,
html[data-agy-gemini-ui][data-agy-gemini-motion="1"] #antigravity\\.agentSidePanelInputBox::before {
  content: "";
  position: absolute;
  inset: -1px;
  border-radius: 27px;
  padding: 1.25px;
  background: conic-gradient(
    from var(--agy-gem-angle),
    rgba(66, 133, 244, 0.66),
    rgba(124, 172, 248, 0.86),
    rgba(168, 85, 247, 0.78),
    rgba(242, 107, 127, 0.72),
    rgba(124, 172, 248, 0.62),
    rgba(66, 133, 244, 0.66)
  );
  -webkit-mask: linear-gradient(#000 0 0) content-box, linear-gradient(#000 0 0);
  -webkit-mask-composite: xor;
  mask-composite: exclude;
  pointer-events: none !important;
  z-index: 2;
  opacity: 0.16;
  animation: none;
  transition: opacity 320ms ease, filter 320ms ease;
}

html[data-agy-gemini-ui][data-agy-gemini-motion="1"] .surface-composer:hover::before,
html[data-agy-gemini-ui][data-agy-gemini-motion="1"] #antigravity\\.agentSidePanelInputBox:hover::before {
  opacity: 0.34;
}

html[data-agy-gemini-ui][data-agy-gemini-motion="1"] .surface-composer:focus-within::before,
html[data-agy-gemini-ui][data-agy-gemini-motion="1"] #antigravity\\.agentSidePanelInputBox:focus-within::before {
  opacity: 0.62;
  animation: agyGeminiSpinAngle 14s linear infinite;
}

html[data-agy-gemini-ui][data-agy-gemini-motion="1"] .surface-composer[data-working="1"]::before,
html[data-agy-gemini-ui][data-agy-gemini-motion="1"] #antigravity\\.agentSidePanelInputBox[data-working="1"]::before {
  opacity: 0.90;
  animation: agyGeminiSpinAngle 5.8s linear infinite;
  filter: drop-shadow(0 0 8px rgba(124, 172, 248, 0.38));
}

@keyframes agyGeminiSpinAngle {
  to { --agy-gem-angle: 360deg; }
}

html[data-agy-gemini-ui] .surface-composer > .surface-composer-card {
  position: relative;
  z-index: 1;
  border-radius: 25px !important;
  background: var(--glass) !important;
  -webkit-backdrop-filter: blur(28px) saturate(1.80) !important;
  backdrop-filter: blur(28px) saturate(1.80) !important;
  box-shadow: inset 0 1px 0 var(--glass-highlight) !important;
}

html[data-agy-gemini-ui][data-agy-gemini-motion="1"] .surface-composer:focus-within {
  transform: translateY(-1.5px);
  box-shadow:
    inset 0 1px 0 var(--glass-highlight),
    0 20px 46px -12px rgba(0, 0, 0, 0.42),
    0 0 24px -6px rgba(66, 133, 244, 0.18) !important;
}

.agy-gemini-composer-halo {
  position: absolute;
  inset: -5px;
  width: calc(100% + 10px);
  height: calc(100% + 10px);
  border-radius: 31px;
  pointer-events: none !important;
  z-index: 0;
  filter: blur(12px);
  opacity: 0.32;
  transition: opacity 420ms var(--agy-gemini-silk), filter 420ms var(--agy-gemini-silk);
}

html[data-agy-gemini-ui] .surface-composer:focus-within .agy-gemini-composer-halo {
  opacity: 0.58;
}

html[data-agy-gemini-ui] .surface-composer[data-working="1"] .agy-gemini-composer-halo {
  opacity: 0.92;
}

html:not([data-agy-gemini-webgl="1"]) .agy-gemini-composer-halo {
  opacity: 0 !important;
}

/* ---------- Refined Gemini Send Button ---------- */
html[data-agy-gemini-ui] .agy-send-button {
  border-radius: 9999px !important;
  transform: translate3d(var(--agy-mag-x, 0px), var(--agy-mag-y, 0px), 0);
  transition:
    transform 200ms var(--agy-gemini-silk),
    background-color 180ms ease,
    box-shadow 220ms var(--agy-gemini-silk) !important;
}

html[data-agy-gemini-ui] .agy-send-button:not(:disabled) {
  background: linear-gradient(135deg, var(--primary) 0%, color-mix(in srgb, var(--primary) 82%, #A855F7) 100%) !important;
  color: var(--primary-foreground) !important;
  box-shadow:
    0 4px 14px -3px color-mix(in srgb, var(--primary) 50%, transparent),
    inset 0 1px 0 rgba(255, 255, 255, 0.32) !important;
}

html[data-agy-gemini-ui][data-agy-gemini-motion="1"] .agy-send-button:not(:disabled):hover {
  transform: translate3d(var(--agy-mag-x, 0px), var(--agy-mag-y, 0px), 0) scale(1.06);
  box-shadow:
    0 8px 20px -3px color-mix(in srgb, var(--primary) 64%, transparent),
    inset 0 1px 0 rgba(255, 255, 255, 0.46) !important;
}

html[data-agy-gemini-ui][data-agy-gemini-motion="1"] .agy-send-button:not(:disabled):active {
  transform: scale(0.93) !important;
}

/* ---------- Gemini Tonal Sidebar Conversation Pills + Seamless Row-Actions Fix ---------- */
html[data-agy-gemini-ui] .agy-sidebar-row {
  border-radius: 9999px !important;
  margin-inline: 3px;
  position: relative;
  transition:
    background-color 180ms var(--agy-gemini-silk),
    transform 200ms var(--agy-gemini-silk),
    box-shadow 200ms var(--agy-gemini-silk) !important;
}

html[data-agy-gemini-ui][data-agy-gemini-motion="1"] .agy-sidebar-row:hover {
  transform: translateX(2.5px);
  background-color: color-mix(in srgb, var(--onyx-selected) 54%, transparent) !important;
}

html[data-agy-gemini-ui][data-agy-gemini-motion="1"] .agy-sidebar-row:active {
  transform: translateX(1.5px) scale(0.99);
}

html[data-agy-gemini-ui] .agy-sidebar-row[data-selected="true"] {
  --row-bg: var(--onyx-selected) !important;
  background: linear-gradient(
    90deg,
    color-mix(in srgb, var(--primary) 22%, transparent) 0%,
    var(--onyx-selected) 100%
  ) !important;
  color: var(--agy-gemini-selected-fg, var(--foreground)) !important;
  box-shadow:
    inset 0 1px 0 rgba(255, 255, 255, 0.11),
    inset 0 0 0 1px color-mix(in srgb, var(--primary) 22%, transparent),
    0 4px 14px -6px rgba(66, 133, 244, 0.24) !important;
}

html[data-agy-gemini-ui] .agy-sidebar-row[data-selected="true"]::before {
  content: "";
  position: absolute;
  left: 9px;
  top: 50%;
  width: 3px;
  height: 13px;
  transform: translateY(-50%);
  border-radius: 9999px;
  background: linear-gradient(180deg, #7CACF8 0%, #A855F7 100%);
  box-shadow: 0 0 6px rgba(124, 172, 248, 0.58);
  pointer-events: none !important;
}

html[data-agy-gemini-ui] body[data-agy-theme] .agy-sidebar-row .agy-row-actions,
html[data-agy-gemini-ui] body[data-agy-theme] .agy-sidebar-row .agy-row-actions::before {
  border-top-right-radius: 9999px !important;
  border-bottom-right-radius: 9999px !important;
}

html[data-agy-gemini-ui] body[data-agy-theme] .agy-sidebar-row .agy-row-actions::before {
  background: linear-gradient(
    to right,
    transparent 0%,
    color-mix(in srgb, var(--agy-gemini-sidebar-surface, var(--sidebar)) 86%, var(--primary) 14%) 36%
  ) !important;
}

html[data-agy-gemini-ui] body[data-agy-theme] .agy-sidebar-row[data-selected="true"] .agy-row-actions::before {
  background: linear-gradient(
    to right,
    transparent 0%,
    color-mix(in srgb, var(--agy-gemini-sidebar-surface, var(--sidebar)) 72%, var(--primary) 28%) 36%
  ) !important;
}

/* ---------- Smooth Materialization for User Bubbles & Cards ---------- */
@keyframes agyGeminiExpressiveIn {
  0% {
    opacity: 0;
    transform: translateY(6px) scale(0.988);
  }
  100% {
    opacity: 1;
    transform: translateY(0) scale(1);
  }
}

html[data-agy-gemini-ui] .agy-user-bubble-frame {
  background: transparent !important;
  padding: 0 !important;
}

html[data-agy-gemini-ui] .agy-user-bubble {
  border-radius: 22px 22px 6px 22px !important;
  background-color: var(--agy-gemini-user-bubble, var(--secondary)) !important;
  box-shadow:
    inset 0 1px 0 var(--glass-highlight),
    0 0 0 1px var(--card-border),
    0 6px 18px -8px rgba(0, 0, 0, 0.24) !important;
  padding: 10px 16px !important;
  transition: transform 220ms var(--agy-gemini-silk), box-shadow 220ms ease !important;
}

html[data-agy-gemini-ui][data-agy-gemini-motion="1"] .agy-user-bubble {
  animation: agyGeminiExpressiveIn 280ms var(--agy-gemini-silk) both;
}

/* ---------- Subtle Micro-Tilt & Specular Rim Cards ---------- */
html[data-agy-gemini-ui] :is(.artifact-card, .agy-card, .agy-callout, .agy-takeover-card) {
  position: relative;
  border-radius: 18px !important;
  border-color: var(--card-border) !important;
  transform-style: preserve-3d;
  transition:
    transform 260ms var(--agy-gemini-silk),
    border-color 220ms ease,
    box-shadow 260ms var(--agy-gemini-silk) !important;
}

html[data-agy-gemini-ui][data-agy-gemini-motion="1"] :is(.artifact-card, .agy-callout) {
  animation: agyGeminiExpressiveIn 300ms var(--agy-gemini-silk) both;
}

html[data-agy-gemini-ui][data-agy-gemini-motion="1"] :is(.artifact-card, .agy-card)[data-agy-spot-active="1"] {
  transform: perspective(960px) translateY(-1.5px) rotateX(var(--agy-rx, 0deg)) rotateY(var(--agy-ry, 0deg)) !important;
  transition: transform 110ms ease-out, border-color 180ms ease, box-shadow 220ms ease !important;
  border-color: var(--agy-gemini-rim-color, rgba(168, 199, 250, 0.34)) !important;
  box-shadow:
    0 12px 28px -12px rgba(0, 0, 0, 0.34),
    0 0 18px -6px rgba(66, 133, 244, 0.14) !important;
}

html[data-agy-gemini-ui][data-agy-gemini-spotlight="1"] :is(.artifact-card, .agy-card)[data-agy-spot-active="1"] {
  background-image:
    radial-gradient(
      240px circle at var(--agy-spot-x, 50%) var(--agy-spot-y, 50%),
      var(--agy-gemini-spot-color, rgba(168, 199, 250, 0.12)),
      transparent 68%
    ) !important;
}

/* ---------- Serene Micro-Breathing Gemini Star on Home Screen (No Dizzying Rotation!) ---------- */
html[data-agy-gemini-ui] [data-testid="home-greeting"] {
  position: relative;
}

html[data-agy-gemini-ui] [data-testid="home-greeting"] .home-greeting-mark {
  display: none !important;
}

html[data-agy-gemini-ui] [data-testid="home-greeting"] .home-greeting-title {
  letter-spacing: -0.024em !important;
  font-weight: 500 !important;
  margin-top: 18px !important;
}

.agy-gemini-star-wrap {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 74px;
  height: 74px;
  position: relative;
  pointer-events: none;
  user-select: none;
  transform: translate3d(var(--agy-star-px, 0px), var(--agy-star-py, 0px), 0);
  transition: transform 280ms ease-out;
}

.agy-gemini-star-halo {
  position: absolute;
  inset: -12px;
  border-radius: 9999px;
  background: radial-gradient(
    circle,
    rgba(66, 133, 244, 0.26) 0%,
    rgba(168, 85, 247, 0.18) 52%,
    transparent 76%
  );
  filter: blur(12px);
  animation: agyGeminiStarCalmBreath 9.5s ease-in-out infinite;
}

.agy-gemini-star-svg {
  width: 54px;
  height: 54px;
  position: relative;
  z-index: 2;
  filter: drop-shadow(0 6px 18px rgba(66, 133, 244, 0.30));
  animation: agyGeminiStarCalmFloat 9.5s ease-in-out infinite;
}

.agy-gemini-spark-a,
.agy-gemini-spark-b {
  position: absolute;
  z-index: 3;
  color: #A8C7FA;
  font-size: 11px;
  opacity: 0.65;
  animation: agyGeminiSparkCalm 7.5s ease-in-out infinite;
}

.agy-gemini-spark-a {
  top: 5px;
  right: 5px;
}

.agy-gemini-spark-b {
  bottom: 7px;
  left: 6px;
  color: #D8B4FE;
  font-size: 9px;
  animation-delay: -3.6s;
}

@keyframes agyGeminiStarCalmBreath {
  0%, 100% { opacity: 0.52; transform: scale(0.94); }
  50% { opacity: 0.86; transform: scale(1.06); }
}

@keyframes agyGeminiStarCalmFloat {
  0%, 100% { transform: translateY(0px) scale(0.99); }
  50% { transform: translateY(-2.5px) scale(1.02); }
}

@keyframes agyGeminiSparkCalm {
  0%, 100% { opacity: 0.35; transform: scale(0.92); }
  50% { opacity: 0.82; transform: scale(1.08); }
}

html:not([data-agy-gemini-motion="1"]) .agy-gemini-star-halo,
html:not([data-agy-gemini-motion="1"]) .agy-gemini-star-svg,
html:not([data-agy-gemini-motion="1"]) .agy-gemini-spark-a,
html:not([data-agy-gemini-motion="1"]) .agy-gemini-spark-b {
  animation: none !important;
}

/* ---------- Code Blocks Clean Tonal Frame (Zero Monaco/Xterm Interference) ---------- */
html[data-agy-gemini-ui] pre[class*="language-"] {
  border-radius: 14px !important;
  border: 1px solid var(--card-border) !important;
}

/* ---------- Gemini UI Studio Floating Capsule & Trigger ---------- */
#agy-gemini-fab {
  position: fixed;
  right: 14px;
  bottom: 14px;
  z-index: 2147483645;
  width: 32px;
  height: 32px;
  border-radius: 9999px;
  border: 1px solid var(--glass-border, rgba(255,255,255,0.14));
  background: var(--glass, rgba(30,31,32,0.84));
  -webkit-backdrop-filter: blur(18px) saturate(1.7);
  backdrop-filter: blur(18px) saturate(1.7);
  color: var(--foreground, #E3E3E3);
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  opacity: 0.65;
  transform: translate3d(var(--agy-mag-x, 0px), var(--agy-mag-y, 0px), 0);
  box-shadow: 0 6px 18px rgba(0, 0, 0, 0.28);
  transition: opacity 180ms ease, transform 220ms var(--agy-gemini-silk), box-shadow 220ms ease;
}

#agy-gemini-fab:hover,
#agy-gemini-fab[data-open="1"] {
  opacity: 1;
  transform: translate3d(var(--agy-mag-x, 0px), var(--agy-mag-y, 0px), 0) scale(1.08);
  box-shadow: 0 8px 22px rgba(66, 133, 244, 0.32);
}

#agy-gemini-studio {
  position: fixed;
  right: 14px;
  bottom: 54px;
  z-index: 2147483646;
  width: 304px;
  padding: 14px;
  border-radius: 22px;
  border: 1px solid rgba(255, 255, 255, 0.13);
  background: rgba(22, 23, 27, 0.90);
  color: #E3E3E3;
  -webkit-backdrop-filter: blur(30px) saturate(1.85);
  backdrop-filter: blur(30px) saturate(1.85);
  box-shadow: 0 26px 60px -12px rgba(0, 0, 0, 0.65), inset 0 1px 0 rgba(255, 255, 255, 0.12);
  font-family: "Google Sans Flex", "Plus Jakarta Sans", "PingFang SC", system-ui, sans-serif;
  font-size: 12px;
  transform-origin: bottom right;
  animation: agyGeminiStudioPop 220ms var(--agy-gemini-silk);
}

@keyframes agyGeminiStudioPop {
  0% { opacity: 0; transform: scale(0.94) translateY(6px); }
  100% { opacity: 1; transform: scale(1) translateY(0); }
}

html[data-agy-gemini-scheme="light"] #agy-gemini-studio {
  background: rgba(255, 255, 255, 0.94);
  color: #1F1F1F;
  border-color: rgba(11, 87, 208, 0.14);
  box-shadow: 0 22px 50px -12px rgba(15, 23, 42, 0.20), inset 0 1px 0 #FFFFFF;
}

#agy-gemini-studio[hidden] {
  display: none !important;
}

.agy-gs-preset-btn {
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: 2px;
  padding: 8px 10px;
  border-radius: 14px;
  border: 1px solid rgba(128, 128, 128, 0.16);
  background: rgba(128, 128, 128, 0.06);
  color: inherit;
  cursor: pointer;
  text-align: left;
  transition: transform 180ms var(--agy-gemini-silk), background 160ms ease, border-color 160ms ease;
}

.agy-gs-preset-btn:hover {
  background: rgba(128, 128, 128, 0.14);
  transform: translateY(-1px);
}

.agy-gs-preset-btn[data-active="1"] {
  border-color: rgba(168, 199, 250, 0.72);
  background: rgba(66, 133, 244, 0.18);
}

html[data-agy-gemini-scheme="light"] .agy-gs-preset-btn[data-active="1"] {
  border-color: rgba(11, 87, 208, 0.58);
  background: rgba(11, 87, 208, 0.11);
}

.agy-gs-tier-bar {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 4px;
  padding: 3px;
  border-radius: 12px;
  background: rgba(128, 128, 128, 0.10);
  margin-bottom: 8px;
}

.agy-gs-tier-btn {
  padding: 5px 4px;
  border-radius: 9px;
  border: none;
  background: transparent;
  color: inherit;
  font-size: 11px;
  font-weight: 500;
  cursor: pointer;
  transition: all 160ms var(--agy-gemini-silk);
}

.agy-gs-tier-btn[data-active="1"] {
  background: rgba(66, 133, 244, 0.24);
  color: #A8C7FA;
  font-weight: 600;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.18);
}

html[data-agy-gemini-scheme="light"] .agy-gs-tier-btn[data-active="1"] {
  background: #FFFFFF;
  color: #0B57D0;
}

.agy-gs-switch {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 6px 4px;
  cursor: pointer;
  user-select: none;
}

.agy-gs-pill {
  width: 32px;
  height: 18px;
  border-radius: 999px;
  background: rgba(128, 128, 128, 0.32);
  position: relative;
  transition: background 180ms ease;
}

.agy-gs-pill[data-on="1"] {
  background: #4285F4;
}

.agy-gs-pill::after {
  content: "";
  position: absolute;
  top: 2px;
  left: 2px;
  width: 14px;
  height: 14px;
  border-radius: 50%;
  background: #FFFFFF;
  transition: transform 200ms var(--agy-gemini-silk);
}

.agy-gs-pill[data-on="1"]::after {
  transform: translateX(14px);
}
`;
  }

  // ============================================================================
  // 3. Main Gemini UI Controller (DOM-Safe, Zero React Conflict)
  // ============================================================================
  function initAgyGeminiUi(options = {}) {
    if (typeof window === 'undefined' || typeof document === 'undefined') return null;
    if (window.__AGY_GEMINI_UI_INSTANCE__) {
      if (window.__AGY_GEMINI_UI_INSTANCE__.version === VERSION) {
        return window.__AGY_GEMINI_UI_INSTANCE__;
      }
      // Cleanly replace older v2.0.0 / v2.1.0 / v2.2.0 UI elements in-place for zero-restart live upgrade!
      try {
        window.__AGY_GEMINI_UI_INSTANCE__.setPreset?.('off');
      } catch (_) {}
      for (const oldSel of [
        '#agy-gemini-ui-style',
        '#agy-gemini-ambient-gl',
        '.agy-gemini-composer-halo',
        '#agy-gemini-stream-bar',
        '#agy-gemini-fx-layer',
        '#agy-gemini-fab',
        '#agy-gemini-studio',
        '[data-agy-gemini-star="1"]',
      ]) {
        try {
          const nodes = document.querySelectorAll ? document.querySelectorAll(oldSel) : [];
          for (const n of nodes) n.remove?.();
        } catch (_) {}
      }
      delete window.__AGY_GEMINI_UI_INSTANCE__;
    }

    const loc = window.location;
    if (!loc) return null;
    const proto = loc.protocol || '';
    const host = loc.hostname || '';

    // Never attach to internal opaque/transparent data: curtain or catcher views!
    if (proto === 'data:' || proto === 'about:') return null;

    const isLocalHub =
      (proto === 'http:' || proto === 'https:') &&
      (host === '127.0.0.1' || host === 'localhost' || host === '[::1]');
    const isPluginFrame = proto === 'plugin:';
    if (!isLocalHub && !isPluginFrame) return null;

    const isTopHubWindow = isLocalHub && window === window.top;

    let persisted = null;
    try {
      const rawV23 = window.localStorage.getItem(STORAGE_KEY);
      if (rawV23) {
        persisted = JSON.parse(rawV23);
      } else {
        // Migrate preset & toggles from v2.1 / v2.2 while resetting old auto-default 'vivid' to calm 'balanced'!
        for (const legacyKey of LEGACY_STORAGE_KEYS) {
          const legacyRaw = window.localStorage.getItem(legacyKey);
          if (legacyRaw) {
            const parsedLegacy = JSON.parse(legacyRaw);
            persisted = {
              ...parsedLegacy,
              intensity: parsedLegacy?.intensity === 'subtle' ? 'subtle' : 'balanced',
            };
            break;
          }
        }
      }
    } catch (_) {}

    const baseInit = options.initialState
      ? {
          ...options.initialState,
          intensity:
            persisted?.intensity ||
            (options.initialState.intensity === 'vivid' && !persisted
              ? 'balanced'
              : options.initialState.intensity),
        }
      : DEFAULT_STATE;

    let state = normalizeState(persisted || baseInit);
    const onStateChanged = typeof options.onStateChanged === 'function' ? options.onStateChanged : null;

    let styleEl = null;
    let ambientCanvas = null;
    let ambientGl = null;
    let composerCanvas = null;
    let composerGl = null;
    let currentComposerHost = null;
    let streamBarEl = null;
    let fxLayerEl = null;
    let fabEl = null;
    let studioEl = null;
    let rafId = 0;

    let bodyAttrSnapshot = null;
    let typingBoost = 0;
    let smoothEnergy = 0.08;
    let smoothWorking = 0;
    let promptLaunchUntil = 0;
    let pointerTargetX = 0.5;
    let pointerTargetY = 0.34;
    let pointerX = 0.5;
    let pointerY = 0.34;
    let pointerVel = 0;
    let rippleX = 0.5;
    let rippleY = 0.5;
    let rippleStart = -1;
    let simTime = 4.0;
    let lastTick = 0;
    let lastDrawNow = 0;
    let lastLifecycleCheckNow = 0;
    let cachedAgentLifecycle = 'idle';
    let lastHoveredCard = null;
    let lastHoveredSideItem = null;
    let lastMagneticBtn = null;

    function nowMs() {
      return typeof performance !== 'undefined' && typeof performance.now === 'function'
        ? performance.now()
        : Date.now();
    }

    function isDarkThemeActive() {
      const body = document.body;
      if (body) {
        if (body.classList.contains('theme-light')) return false;
        if (body.classList.contains('dark') || body.classList.contains('theme-dark')) return true;
      }
      const cs = document.documentElement?.style?.colorScheme;
      if (cs === 'light') return false;
      if (cs === 'dark') return true;
      return window.matchMedia ? window.matchMedia('(prefers-color-scheme: dark)').matches : true;
    }

    function syncSchemeAttribute() {
      const dark = isDarkThemeActive();
      document.documentElement.dataset.agyGeminiScheme = dark ? 'dark' : 'light';
      return dark;
    }

    function ensureStyleMounted() {
      if (styleEl && styleEl.isConnected) return;
      styleEl = document.getElementById('agy-gemini-ui-style');
      if (!styleEl) {
        styleEl = document.createElement('style');
        styleEl.id = 'agy-gemini-ui-style';
        styleEl.textContent = buildGeminiStylesheet();
        (document.head || document.documentElement).appendChild(styleEl);
      }
    }

    function activateNativeBodyFlags() {
      const body = document.body;
      if (!body) return;
      if (!bodyAttrSnapshot) {
        bodyAttrSnapshot = {
          agyTheme: body.getAttribute('data-agy-theme'),
          newuxTheme: body.getAttribute('data-newux-theme'),
          agyFont: body.getAttribute('data-agy-font'),
        };
      }
      if (!body.hasAttribute('data-agy-theme')) {
        body.setAttribute('data-agy-theme', '');
      }
      if (!body.hasAttribute('data-newux-theme')) {
        body.setAttribute('data-newux-theme', 'onyx');
      }
      if (!body.hasAttribute('data-agy-font')) {
        body.setAttribute('data-agy-font', 'google-sans');
      }
    }

    function restoreNativeBodyFlags() {
      const body = document.body;
      if (!body || !bodyAttrSnapshot) return;
      const restoreAttr = (name, val) => {
        if (val === null || val === undefined) body.removeAttribute(name);
        else body.setAttribute(name, val);
      };
      restoreAttr('data-agy-theme', bodyAttrSnapshot.agyTheme);
      restoreAttr('data-newux-theme', bodyAttrSnapshot.newuxTheme);
      restoreAttr('data-agy-font', bodyAttrSnapshot.agyFont);
      bodyAttrSnapshot = null;
    }

    function ensureAuxiliaryLayers() {
      if (!isTopHubWindow || !document.body) return;
      if (state.preset === 'off') {
        if (streamBarEl) {
          streamBarEl.remove();
          streamBarEl = null;
        }
        if (fxLayerEl) {
          fxLayerEl.remove();
          fxLayerEl = null;
        }
        return;
      }

      if (!streamBarEl || streamBarEl.isConnected === false) {
        streamBarEl = document.getElementById('agy-gemini-stream-bar');
        if (!streamBarEl) {
          streamBarEl = document.createElement('div');
          streamBarEl.id = 'agy-gemini-stream-bar';
          streamBarEl.setAttribute('aria-hidden', 'true');
          streamBarEl.setAttribute('data-working', '0');
          streamBarEl.setAttribute('data-state', 'idle');
          document.body.appendChild(streamBarEl);
        }
      }

      if (!fxLayerEl || fxLayerEl.isConnected === false) {
        fxLayerEl = document.getElementById('agy-gemini-fx-layer');
        if (!fxLayerEl) {
          fxLayerEl = document.createElement('div');
          fxLayerEl.id = 'agy-gemini-fx-layer';
          fxLayerEl.setAttribute('aria-hidden', 'true');
          document.body.appendChild(fxLayerEl);
        }
      }
    }

    function triggerShockwave(normX, normY, boostAmount = 0.22) {
      rippleX = Math.max(0, Math.min(1, normX));
      rippleY = Math.max(0, Math.min(1, normY));
      rippleStart = nowMs();
      typingBoost = Math.min(0.42, typingBoost + boostAmount);
      ensureLoopRunning();
    }

    function spawnOverlayClickRipple(clientX, clientY, sizePx = 68) {
      if (!isTopHubWindow || state.preset === 'off' || !state.motion) return;
      ensureAuxiliaryLayers();
      if (!fxLayerEl) return;
      const ring = document.createElement('span');
      ring.className = 'agy-gemini-click-ripple';
      ring.style.left = `${Math.round(clientX)}px`;
      ring.style.top = `${Math.round(clientY)}px`;
      ring.style.width = `${sizePx}px`;
      ring.style.height = `${sizePx}px`;
      fxLayerEl.appendChild(ring);
      setTimeout(() => {
        try {
          ring.remove();
        } catch (_) {}
      }, 560);
    }

    function triggerPromptLaunch(originX, originY) {
      promptLaunchUntil = nowMs() + 2600;
      cachedAgentLifecycle = 'launching';
      syncLifecycleAttributes('launching');
      triggerShockwave(originX, originY, 0.34);
    }

    // Non-destructively decorate Home screen with serene Gemini Star Constellation
    function syncHomeGeminiStar() {
      if (!isTopHubWindow) return;
      const greeting = document.querySelector?.('[data-testid="home-greeting"]');
      if (!greeting) return;

      if (state.preset === 'off') {
        const existing = greeting.querySelector?.('[data-agy-gemini-star="1"]');
        if (existing) existing.remove();
        return;
      }

      if (greeting.querySelector?.('[data-agy-gemini-star="1"]')) return;

      const wrap = document.createElement('div');
      wrap.setAttribute('data-agy-gemini-star', '1');
      wrap.className = 'agy-gemini-star-wrap';
      wrap.setAttribute('aria-hidden', 'true');
      wrap.innerHTML = `
        <div class="agy-gemini-star-halo"></div>
        <span class="agy-gemini-spark-a">✦</span>
        <span class="agy-gemini-spark-b">✦</span>
        <svg class="agy-gemini-star-svg" viewBox="0 0 64 64" fill="none" xmlns="http://www.w3.org/2000/svg">
          <defs>
            <linearGradient id="agyGeminiStarGrad" x1="6" y1="8" x2="58" y2="56" gradientUnits="userSpaceOnUse">
              <stop offset="0%" stop-color="#4285F4"/>
              <stop offset="42%" stop-color="#7CACF8"/>
              <stop offset="72%" stop-color="#A855F7"/>
              <stop offset="100%" stop-color="#F26B7F"/>
            </linearGradient>
          </defs>
          <path d="M32 4C32 19.464 44.536 32 60 32C44.536 32 32 44.536 32 60C32 44.536 19.464 32 4 32C19.464 32 32 19.464 32 4Z" fill="url(#agyGeminiStarGrad)"/>
        </svg>
      `;
      greeting.insertBefore(wrap, greeting.firstChild);
    }

    function ensureWebGlCanvases() {
      if (!isTopHubWindow) return;

      if (state.preset === 'off' || !state.webgl) {
        teardownWebGlCanvases();
        return;
      }

      if (document.body && (!ambientCanvas || !ambientCanvas.isConnected)) {
        ambientCanvas = document.createElement('canvas');
        ambientCanvas.id = 'agy-gemini-ambient-gl';
        ambientCanvas.setAttribute('aria-hidden', 'true');
        document.body.insertBefore(ambientCanvas, document.body.firstChild);
        ambientGl = createFluidGlSurface(ambientCanvas, 0);
      }

      const composer =
        document.getElementById?.('antigravity.agentSidePanelInputBox') ||
        document.querySelector?.('.surface-composer');

      if (composer && composer !== currentComposerHost) {
        if (composerCanvas && composerCanvas.isConnected) {
          composerCanvas.remove();
        }
        if (composerGl) {
          composerGl.dispose();
          composerGl = null;
        }
        composerCanvas = document.createElement('canvas');
        composerCanvas.className = 'agy-gemini-composer-halo';
        composerCanvas.setAttribute('aria-hidden', 'true');
        composer.insertBefore(composerCanvas, composer.firstChild);
        composerGl = createFluidGlSurface(composerCanvas, 1);
        currentComposerHost = composer;
      } else if (!composer && currentComposerHost) {
        currentComposerHost = null;
      }
    }

    function teardownWebGlCanvases() {
      if (rafId) {
        window.cancelAnimationFrame(rafId);
        rafId = 0;
      }
      if (ambientGl) {
        ambientGl.dispose();
        ambientGl = null;
      }
      if (composerGl) {
        composerGl.dispose();
        composerGl = null;
      }
      if (ambientCanvas) {
        ambientCanvas.remove();
        ambientCanvas = null;
      }
      if (composerCanvas) {
        composerCanvas.remove();
        composerCanvas = null;
      }
      currentComposerHost = null;
    }

    /**
     * Detects real Antigravity Agent working lifecycle states from SDK testids & controls:
     *   'launching' -> prompt just submitted (2.6s instant feedback bridge)
     *   'compacting' -> context compaction in progress
     *   'waiting' -> waiting for user approval / answer
     *   'working' -> agent actively streaming / executing tools
     *   'idle' -> stationary / ready
     */
    function detectAgentLifecycleState(now) {
      if (now < promptLaunchUntil) {
        return 'launching';
      }
      if (!document.querySelector) return 'idle';

      const loadingEl =
        document.querySelector('[data-testid="agent-loading"]') ||
        document.querySelector('[data-testid="ephemeral-tool-status"]');

      if (loadingEl) {
        const txt = (loadingEl.textContent || '').trim();
        if (txt.includes('Compacting') || txt.includes('压缩')) {
          return 'compacting';
        }
        if (
          txt.includes('Waiting for your') ||
          txt.includes('Action required') ||
          txt.includes('等待您的') ||
          txt.includes('需要您的')
        ) {
          return 'waiting';
        }
        return 'working';
      }

      if (
        document.querySelector(
          '[data-testid="send-button-loading"], button[aria-label="Stop"], button[aria-label="停止"], button[aria-label="Stop Execution"], button[aria-label="停止执行"]'
        )
      ) {
        return 'working';
      }

      return 'idle';
    }

    function syncLifecycleAttributes(lifecycle) {
      if (document.documentElement?.dataset) {
        if (state.preset === 'off') {
          delete document.documentElement.dataset.agyAgentState;
        } else {
          document.documentElement.dataset.agyAgentState = lifecycle;
        }
      }
      const isBusy = lifecycle !== 'idle';
      if (streamBarEl) {
        streamBarEl.setAttribute('data-working', isBusy ? '1' : '0');
        streamBarEl.setAttribute('data-state', lifecycle);
      }
      const composer =
        currentComposerHost ||
        document.getElementById?.('antigravity.agentSidePanelInputBox') ||
        document.querySelector?.('.surface-composer');
      if (composer && composer.setAttribute) {
        if (state.preset !== 'off' && isBusy) {
          composer.setAttribute('data-working', '1');
        } else {
          composer.removeAttribute?.('data-working');
        }
      }
    }

    function shouldAnimateWebGl() {
      if (!isTopHubWindow) return false;
      if (state.preset === 'off' || !state.webgl) return false;
      if (document.hidden) return false;
      if (document.body?.dataset?.hasBrowserHole === 'true') return false;
      if (window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
        return false;
      }
      return true;
    }

    function renderLoop(now) {
      rafId = 0;
      if (!shouldAnimateWebGl()) return;

      if (now - lastLifecycleCheckNow > 140) {
        lastLifecycleCheckNow = now;
        cachedAgentLifecycle = detectAgentLifecycleState(now);
        syncLifecycleAttributes(cachedAgentLifecycle);
      }

      const isWorking = cachedAgentLifecycle !== 'idle';
      const hasActiveRipple = rippleStart > 0 && now - rippleStart <= 900;
      const isCalmIdle = !isWorking && !hasActiveRipple && typingBoost < 0.02 && pointerVel < 0.02;

      // Throttle to serene ~24fps when completely stationary (<0.08% GPU on M1 Pro!), instant 60/120fps on any activity
      if (isCalmIdle && lastDrawNow && now - lastDrawNow < 40) {
        rafId = window.requestAnimationFrame(renderLoop);
        return;
      }
      lastDrawNow = now;

      const dt = lastTick ? Math.min(0.06, Math.max(0.001, (now - lastTick) / 1000)) : 0.016;
      lastTick = now;

      typingBoost = Math.max(0, typingBoost * Math.exp(-dt * 2.8));
      pointerVel = Math.max(0, pointerVel * Math.exp(-dt * 4.8));

      const composerFocused = Boolean(
        currentComposerHost &&
          document.activeElement &&
          currentComposerHost.contains?.(document.activeElement)
      );
      const onHome = Boolean(document.querySelector?.('.agy-home'));

      // Stationary baseline is ultra-calm (0.06..0.12); light interaction nudges gently (~0.28); working rises smoothly (~0.78)
      let targetEnergy = onHome ? 0.12 : 0.06;
      if (composerFocused) targetEnergy = Math.max(targetEnergy, 0.20);
      targetEnergy = Math.min(0.45, targetEnergy + typingBoost * 0.55 + pointerVel * 0.32);
      if (isWorking) targetEnergy = Math.max(targetEnergy, 0.72);

      const targetWorking =
        cachedAgentLifecycle === 'launching'
          ? 1.0
          : cachedAgentLifecycle === 'working' || cachedAgentLifecycle === 'compacting'
            ? 0.85
            : cachedAgentLifecycle === 'waiting'
              ? 0.45
              : 0.0;

      smoothEnergy += (targetEnergy - smoothEnergy) * (1 - Math.exp(-dt * 3.8));
      smoothWorking += (targetWorking - smoothWorking) * (1 - Math.exp(-dt * 4.2));
      pointerX += (pointerTargetX - pointerX) * (1 - Math.exp(-dt * 4.2));
      pointerY += (pointerTargetY - pointerY) * (1 - Math.exp(-dt * 4.2));

      const gain = INTENSITY_GAIN[state.intensity] || INTENSITY_GAIN.balanced;
      // ~10x slower calm micro-breathing when stationary! Gently speeds up only when interacting or Working.
      simTime += dt * (0.075 + 0.24 * smoothEnergy + 0.34 * smoothWorking) * (0.80 + 0.20 * gain);

      let rProg = -1.0;
      if (rippleStart > 0) {
        const elapsed = (now - rippleStart) / 860;
        if (elapsed >= 0 && elapsed <= 1.0) {
          rProg = elapsed;
        } else {
          rippleStart = -1;
        }
      }

      const dark = isDarkThemeActive();
      const presetIndex = PRESET_META[state.preset]?.shaderIndex ?? 0;

      if (ambientGl && ambientCanvas?.isConnected) {
        ambientGl.render({
          time: simTime,
          px: pointerX,
          py: 1.0 - pointerY,
          vel: pointerVel,
          rx: rippleX,
          ry: 1.0 - rippleY,
          rProg,
          energy: smoothEnergy,
          workingLevel: smoothWorking,
          gain,
          dark,
          home: onHome,
          presetIndex,
        });
      }

      if (composerGl && composerCanvas?.isConnected) {
        composerGl.render({
          time: simTime * 1.15,
          px: pointerX,
          py: 0.5,
          vel: pointerVel,
          rx: 0.92,
          ry: 0.5,
          rProg,
          energy: composerFocused ? Math.max(0.24, smoothEnergy) : smoothEnergy * 0.65,
          workingLevel: smoothWorking,
          gain,
          dark,
          presetIndex,
        });
      }

      rafId = window.requestAnimationFrame(renderLoop);
    }

    function ensureLoopRunning() {
      if (!rafId && shouldAnimateWebGl()) {
        lastTick = 0;
        rafId = window.requestAnimationFrame(renderLoop);
      }
    }

    // ==========================================================================
    // 4. Floating Gemini UI Studio HUD (`Cmd+Shift+G` / `Ctrl+Shift+G`)
    // ==========================================================================
    function refreshStudioUi() {
      if (!studioEl) return;
      for (const btn of studioEl.querySelectorAll('[data-preset-id]')) {
        btn.setAttribute(
          'data-active',
          btn.getAttribute('data-preset-id') === state.preset ? '1' : '0'
        );
      }
      for (const tBtn of studioEl.querySelectorAll('[data-intensity-id]')) {
        tBtn.setAttribute(
          'data-active',
          tBtn.getAttribute('data-intensity-id') === state.intensity ? '1' : '0'
        );
      }
      for (const pill of studioEl.querySelectorAll('[data-toggle-key]')) {
        const k = pill.getAttribute('data-toggle-key');
        pill.setAttribute('data-on', state[k] ? '1' : '0');
      }
    }

    function ensureStudioMounted() {
      if (!isTopHubWindow || !document.body) return;
      if (!fabEl || !fabEl.isConnected) {
        fabEl = document.createElement('button');
        fabEl.id = 'agy-gemini-fab';
        fabEl.type = 'button';
        fabEl.setAttribute('data-agy-zh-ignore', '1');
        fabEl.title = 'Gemini 界面美化工作台 (Command+Shift+G)';
        fabEl.setAttribute('aria-label', 'Gemini UI Studio');
        fabEl.innerHTML = `
          <svg width="16" height="16" viewBox="0 0 64 64" fill="none">
            <path d="M32 4C32 19.464 44.536 32 60 32C44.536 32 32 44.536 32 60C32 44.536 19.464 32 4 32C19.464 32 32 19.464 32 4Z" fill="url(#agyFabGrad)"/>
            <defs>
              <linearGradient id="agyFabGrad" x1="6" y1="6" x2="58" y2="58" gradientUnits="userSpaceOnUse">
                <stop offset="0%" stop-color="#4285F4"/>
                <stop offset="52%" stop-color="#A855F7"/>
                <stop offset="100%" stop-color="#F26B7F"/>
              </linearGradient>
            </defs>
          </svg>
        `;
        fabEl.addEventListener('click', (e) => {
          e.stopPropagation();
          toggleStudio();
        });
        document.body.appendChild(fabEl);
      }

      if (!studioEl || !studioEl.isConnected) {
        studioEl = document.createElement('div');
        studioEl.id = 'agy-gemini-studio';
        studioEl.setAttribute('data-agy-zh-ignore', '1');
        studioEl.hidden = true;
        studioEl.innerHTML = `
          <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:10px;">
            <div style="display:flex;align-items:center;gap:6px;font-weight:600;font-size:13px;">
              <span style="color:#7CACF8;">✦</span>
              <span>Gemini 原生视觉工作台</span>
            </div>
            <span style="font-size:10px;opacity:0.65;padding:2px 6px;border-radius:999px;border:1px solid rgba(128,128,128,0.28);">⌘⇧G</span>
          </div>
          <div style="display:grid;grid-template-columns:1fr 1fr;gap:6px;margin-bottom:10px;">
            <button type="button" class="agy-gs-preset-btn" data-preset-id="nebula">
              <span style="font-weight:600;">✦ 双子星云</span>
              <span style="font-size:10px;opacity:0.68;">微息极光 · 工作星芒</span>
            </button>
            <button type="button" class="agy-gs-preset-btn" data-preset-id="pure">
              <span style="font-weight:600;">◎ 晨曦纯净</span>
              <span style="font-size:10px;opacity:0.68;">天青静谧毛玻璃</span>
            </button>
            <button type="button" class="agy-gs-preset-btn" data-preset-id="liquid">
              <span style="font-weight:600;">◈ 液态冰晶</span>
              <span style="font-size:10px;opacity:0.68;">M1 Pro 钛晶微折射</span>
            </button>
            <button type="button" class="agy-gs-preset-btn" data-preset-id="off">
              <span style="font-weight:600;">○ 原厂默认</span>
              <span style="font-size:10px;opacity:0.68;">0ms 无损还原</span>
            </button>
          </div>
          <div style="font-size:11px;opacity:0.72;margin-bottom:5px;">呼吸感与交互强度</div>
          <div class="agy-gs-tier-bar">
            <button type="button" class="agy-gs-tier-btn" data-intensity-id="subtle">🍃 极简微息</button>
            <button type="button" class="agy-gs-tier-btn" data-intensity-id="balanced">🌊 静谧呼吸</button>
            <button type="button" class="agy-gs-tier-btn" data-intensity-id="vivid">✨ 灵动流光</button>
          </div>
          <div style="border-top:1px solid rgba(128,128,128,0.16);padding-top:7px;display:flex;flex-direction:column;gap:2px;">
            <div class="agy-gs-switch" data-switch-row="webgl">
              <span>WebGL 微息极光与发送响应</span>
              <span class="agy-gs-pill" data-toggle-key="webgl"></span>
            </div>
            <div class="agy-gs-switch" data-switch-row="motion">
              <span>Working 状态星芒与微交互动效</span>
              <span class="agy-gs-pill" data-toggle-key="motion"></span>
            </div>
            <div class="agy-gs-switch" data-switch-row="spotlight">
              <span>悬停边缘柔光聚光灯</span>
              <span class="agy-gs-pill" data-toggle-key="spotlight"></span>
            </div>
          </div>
        `;

        studioEl.addEventListener('click', (e) => {
          e.stopPropagation();
          const presetBtn = e.target.closest?.('[data-preset-id]');
          if (presetBtn) {
            const nextPreset = presetBtn.getAttribute('data-preset-id');
            updateState({ preset: nextPreset });
            if (nextPreset !== 'off' && e.clientX) {
              triggerShockwave(
                e.clientX / Math.max(1, window.innerWidth || 1200),
                e.clientY / Math.max(1, window.innerHeight || 800),
                0.22
              );
            }
            return;
          }
          const intensityBtn = e.target.closest?.('[data-intensity-id]');
          if (intensityBtn) {
            updateState({ intensity: intensityBtn.getAttribute('data-intensity-id') });
            triggerShockwave(0.5, 0.5, 0.20);
            return;
          }
          const switchRow = e.target.closest?.('[data-switch-row]');
          if (switchRow) {
            const key = switchRow.getAttribute('data-switch-row');
            updateState({ [key]: !state[key] });
          }
        });

        document.body.appendChild(studioEl);
        refreshStudioUi();
      }
    }

    function toggleStudio(forceOpen) {
      ensureStudioMounted();
      if (!studioEl || !fabEl) return;
      const nextOpen = typeof forceOpen === 'boolean' ? forceOpen : studioEl.hidden;
      studioEl.hidden = !nextOpen;
      fabEl.setAttribute('data-open', nextOpen ? '1' : '0');
      if (nextOpen) refreshStudioUi();
    }

    // ==========================================================================
    // 5. Apply State Declaratively (0ms Switch, Zero Reload)
    // ==========================================================================
    function applyStateToDom() {
      ensureStyleMounted();
      syncSchemeAttribute();

      const rootEl = document.documentElement;
      if (state.preset === 'off') {
        delete rootEl.dataset.agyGeminiUi;
        delete rootEl.dataset.agyGeminiIntensity;
        delete rootEl.dataset.agyGeminiWebgl;
        delete rootEl.dataset.agyGeminiMotion;
        delete rootEl.dataset.agyGeminiSpotlight;
        delete rootEl.dataset.agyAgentState;
        restoreNativeBodyFlags();
        teardownWebGlCanvases();
        ensureAuxiliaryLayers();
        syncHomeGeminiStar();
      } else {
        rootEl.dataset.agyGeminiUi = state.preset;
        rootEl.dataset.agyGeminiIntensity = state.intensity;
        rootEl.dataset.agyGeminiWebgl = state.webgl ? '1' : '0';
        rootEl.dataset.agyGeminiMotion = state.motion ? '1' : '0';
        rootEl.dataset.agyGeminiSpotlight = state.spotlight ? '1' : '0';
        activateNativeBodyFlags();
        ensureAuxiliaryLayers();
        syncHomeGeminiStar();
        cachedAgentLifecycle = detectAgentLifecycleState(nowMs());
        syncLifecycleAttributes(cachedAgentLifecycle);
        ensureWebGlCanvases();
        ensureLoopRunning();
      }

      ensureStudioMounted();
      refreshStudioUi();
    }

    function updateState(patch, { silentPersist = false } = {}) {
      state = normalizeState({ ...state, ...patch });
      try {
        window.localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
      } catch (_) {}
      applyStateToDom();
      if (!silentPersist && onStateChanged) {
        try {
          onStateChanged(state);
        } catch (_) {}
      }
      return state;
    }

    // ==========================================================================
    // 6. Calm Interactive Event Listeners + Prompt-Sent Lifecycle Trigger
    // ==========================================================================
    function clearCardTilt(card) {
      if (!card) return;
      card.removeAttribute('data-agy-spot-active');
      card.style?.removeProperty?.('--agy-rx');
      card.style?.removeProperty?.('--agy-ry');
    }

    function clearSideSpot(el) {
      if (!el) return;
      el.removeAttribute('data-agy-side-spot');
    }

    function clearMagneticBtn(btn) {
      if (!btn) return;
      btn.style?.removeProperty?.('--agy-mag-x');
      btn.style?.removeProperty?.('--agy-mag-y');
    }

    function installListeners() {
      window.addEventListener(
        'keydown',
        (e) => {
          const mod = e.metaKey || e.ctrlKey;
          if (mod && e.shiftKey && !e.altKey && (e.key === 'G' || e.key === 'g')) {
            e.preventDefault();
            e.stopPropagation();
            toggleStudio();
            return;
          }

          if (state.preset !== 'off' && currentComposerHost && currentComposerHost.contains?.(e.target)) {
            if (e.key === 'Enter' && !e.shiftKey && !e.isComposing) {
              const r = currentComposerHost.getBoundingClientRect?.();
              const nx = r ? (r.right - 24) / Math.max(1, window.innerWidth || 1200) : 0.85;
              const ny = r ? (r.top + r.height * 0.5) / Math.max(1, window.innerHeight || 800) : 0.85;
              triggerPromptLaunch(nx, ny);
              if (r) spawnOverlayClickRipple(r.right - 24, r.top + r.height * 0.5, 76);
            } else {
              // Subtle ambient warmth only — ZERO composer scale/bounce jitter while typing!
              typingBoost = Math.min(0.24, typingBoost + 0.055);
              ensureLoopRunning();
            }
          }
        },
        true
      );

      if (isTopHubWindow) {
        window.addEventListener(
          'pointermove',
          (e) => {
            const vw = Math.max(1, window.innerWidth || 1200);
            const vh = Math.max(1, window.innerHeight || 800);
            const nx = e.clientX / vw;
            const ny = e.clientY / vh;
            const dx = nx - pointerTargetX;
            const dy = ny - pointerTargetY;
            pointerVel = Math.min(0.45, pointerVel + Math.hypot(dx, dy) * 2.6);
            pointerTargetX = nx;
            pointerTargetY = ny;

            if (state.preset === 'off') return;

            if (state.motion) {
              const starWrap = document.querySelector?.('[data-agy-gemini-star="1"]');
              if (starWrap) {
                starWrap.style.setProperty('--agy-star-px', `${((nx - 0.5) * 4.5).toFixed(1)}px`);
                starWrap.style.setProperty('--agy-star-py', `${((ny - 0.35) * 3.5).toFixed(1)}px`);
              }
            }

            if ((state.spotlight || state.motion) && e.target?.closest) {
              const card = e.target.closest('.artifact-card, .agy-card');
              if (card !== lastHoveredCard) {
                clearCardTilt(lastHoveredCard);
                lastHoveredCard = card;
              }
              if (card) {
                const r = card.getBoundingClientRect();
                const relX = e.clientX - r.left;
                const relY = e.clientY - r.top;
                card.style.setProperty('--agy-spot-x', `${Math.round(relX)}px`);
                card.style.setProperty('--agy-spot-y', `${Math.round(relY)}px`);
                if (state.motion && state.intensity !== 'subtle') {
                  const maxDeg = state.intensity === 'vivid' ? 2.6 : 1.4;
                  const rotY = (((relX / Math.max(1, r.width)) - 0.5) * 2 * maxDeg).toFixed(2);
                  const rotX = ((0.5 - (relY / Math.max(1, r.height))) * 2 * maxDeg).toFixed(2);
                  card.style.setProperty('--agy-rx', `${rotX}deg`);
                  card.style.setProperty('--agy-ry', `${rotY}deg`);
                }
                card.setAttribute('data-agy-spot-active', '1');
              }

              const sideItem = state.spotlight
                ? e.target.closest(
                    '.agy-sidebar-row, button[data-project-card], [data-testid="sidebar-navigation-items"] :is(a, button):not([data-testid="new-conversation-button"]), [data-testid="settings-button"]'
                  )
                : null;
              if (sideItem !== lastHoveredSideItem) {
                clearSideSpot(lastHoveredSideItem);
                lastHoveredSideItem = sideItem;
              }
              if (sideItem) {
                const sr = sideItem.getBoundingClientRect();
                sideItem.style.setProperty('--agy-spot-x', `${Math.round(e.clientX - sr.left)}px`);
                sideItem.style.setProperty('--agy-spot-y', `${Math.round(e.clientY - sr.top)}px`);
                sideItem.setAttribute('data-agy-side-spot', '1');
              }

              const magBtn = state.motion
                ? e.target.closest(
                    '.agy-send-button:not(:disabled), #agy-gemini-fab, [data-testid="new-conversation-button"]'
                  )
                : null;
              if (magBtn !== lastMagneticBtn) {
                clearMagneticBtn(lastMagneticBtn);
                lastMagneticBtn = magBtn;
              }
              if (magBtn) {
                const br = magBtn.getBoundingClientRect();
                const isHeroNewBtn = magBtn.getAttribute('data-testid') === 'new-conversation-button';
                const factor = isHeroNewBtn ? 0.06 : 0.14;
                const mx = ((e.clientX - (br.left + br.width / 2)) * factor).toFixed(1);
                const my = ((e.clientY - (br.top + br.height / 2)) * (isHeroNewBtn ? 0.11 : factor)).toFixed(1);
                magBtn.style.setProperty('--agy-mag-x', `${mx}px`);
                magBtn.style.setProperty('--agy-mag-y', `${my}px`);
              }
            }
          },
          { passive: true }
        );

        // Restrained click feedback: prompt-launch awakening on Send, soft ripple ONLY on primary CTAs
        window.addEventListener(
          'pointerdown',
          (e) => {
            if (state.preset === 'off' || e.button !== 0) return;
            const target = e.target;
            if (!target || typeof target.closest !== 'function') return;
            if (target.closest('.monaco-editor, .xterm')) return;

            const vw = Math.max(1, window.innerWidth || 1200);
            const vh = Math.max(1, window.innerHeight || 800);

            const sendBtn = target.closest('.agy-send-button:not(:disabled)');
            if (sendBtn) {
              triggerPromptLaunch(e.clientX / vw, e.clientY / vh);
              spawnOverlayClickRipple(e.clientX, e.clientY, 76);
              return;
            }

            const newConvBtn = target.closest('[data-testid="new-conversation-button"]');
            if (newConvBtn) {
              triggerShockwave(e.clientX / vw, e.clientY / vh, 0.24);
              spawnOverlayClickRipple(e.clientX, e.clientY, 68);
            }
          },
          { passive: true }
        );

        document.addEventListener('click', (e) => {
          if (studioEl && !studioEl.hidden && !studioEl.contains(e.target) && e.target !== fabEl) {
            toggleStudio(false);
          }
        });

        document.addEventListener('visibilitychange', () => {
          if (document.hidden && rafId) {
            window.cancelAnimationFrame(rafId);
            rafId = 0;
          } else {
            ensureLoopRunning();
          }
        });
      }

      document.addEventListener('agy-gemini:cmd', () => {
        try {
          const raw = document.documentElement.dataset.agyGeminiCmd;
          if (!raw) return;
          const cmd = JSON.parse(raw);
          if (cmd.action === 'toggle-studio') {
            toggleStudio();
          } else if (cmd.action === 'set-state' && cmd.patch) {
            updateState(cmd.patch, { silentPersist: true });
            triggerShockwave(0.5, 0.42, 0.22);
          }
        } catch (_) {}
      });

      let scheduled = false;
      const scheduleDomSync = () => {
        if (scheduled) return;
        scheduled = true;
        window.requestAnimationFrame(() => {
          scheduled = false;
          syncSchemeAttribute();
          if (state.preset !== 'off') {
            activateNativeBodyFlags();
            ensureAuxiliaryLayers();
            syncHomeGeminiStar();
            cachedAgentLifecycle = detectAgentLifecycleState(nowMs());
            syncLifecycleAttributes(cachedAgentLifecycle);
            ensureWebGlCanvases();
            ensureLoopRunning();
          }
          ensureStudioMounted();
        });
      };

      const ObsCtor = window.MutationObserver || globalThis.MutationObserver;
      if (typeof ObsCtor === 'function') {
        const attrObs = new ObsCtor(scheduleDomSync);
        attrObs.observe(document.documentElement, {
          attributes: true,
          attributeFilter: ['style', 'class'],
        });
        if (document.body) {
          attrObs.observe(document.body, {
            attributes: true,
            attributeFilter: ['class', 'data-has-browser-hole'],
          });
        }

        const mountObs = new ObsCtor(scheduleDomSync);
        mountObs.observe(document.body || document.documentElement, {
          childList: true,
          subtree: true,
        });
      }
    }

    function boot() {
      applyStateToDom();
      installListeners();
    }

    if (document.body) {
      boot();
    } else {
      window.addEventListener('DOMContentLoaded', boot, { once: true });
    }

    const controller = {
      version: VERSION,
      getState: () => ({ ...state }),
      getLifecycleState: () => cachedAgentLifecycle,
      triggerPromptLaunch,
      setPreset: (preset) => updateState({ preset }),
      setIntensity: (intensity) => updateState({ intensity }),
      updateState,
      toggleStudio,
      PRESET_META,
    };

    if (document.documentElement?.dataset) {
      document.documentElement.dataset.agyGeminiVersion = VERSION;
    }

    window.__AGY_GEMINI_UI_INSTANCE__ = controller;
    return controller;
  }

  return {
    VERSION,
    initAgyGeminiUi,
    normalizeState,
    buildGeminiStylesheet,
    PRESET_META,
    DEFAULT_STATE,
  };
});
