# ✨ Antigravity Native Chinese + Gemini UI (`qixian-agy-zh`)

> **Google Antigravity 桌面客户端「双擎无损原生汉化 + 对标 Gemini 静谧微息流光与工作态律动引擎」旗舰套件 (`v2.3.0`)**  
> **0 字节侵入官方安装包 · 100% 保留苹果公证签名与 TCC 权限 · 纯血 Apple Silicon (`arm64`) · `⌘⇧L` 秒切中英 · `⌘⇧G` 唤出 Gemini 视觉工作台**

---

## ✨ 为什么采用「双擎无损原生适配」架构？

市面上传统的 Electron 汉化/美化补丁习惯直接解包篡改 `/Applications/Antigravity.app/Contents/Resources/app.asar` 或 `language_server` 二进制，这在 macOS（尤其是 Apple Silicon M1/M2/M3/M4 新系统）上会带来三大致命痛点：
1. **破坏苹果 Developer ID 原厂签名**：导致 macOS 弹出「应用已损坏」拦截，且每次重启丢失麦克风、屏幕录制、辅助功能（TCC）与钥匙串权限；
2. **官方自动更新即失效**：Antigravity 每小时检测热更新，一旦静默升级就会把硬改文件覆盖回原版；
3. **混入 Intel 二进制触发 Rosetta 警告**：纯血 M 系列芯片 Mac 决不能混入裸 `x86_64` 可执行文件。

**`qixian-agy-zh v2.3.0` 通过 REA 逆向工程深度适配 `Antigravity App v2.32.1`（含左侧边栏 `F3c`/`V6`/`B3c`、右侧主视窗与全量 Cortex Agent 步骤渲染器），首创双擎无损协同架构：**

| 引擎层级 | 工作机制 | 覆盖范围与体验优势 |
| :--- | :--- | :--- |
| **🚀 引擎 1：主进程无损钩子**<br>(`core/hook-main.cjs` + 沙箱安全 `preload`) | 通过进程级作用域启动（第 1 行立即自我擦除环境变量，绝不污染 `language_server` 或子终端），在 Electron 44 `defaultSession` 注册第 0 帧沙箱安全 Preload | **0 毫秒无闪烁首屏原生中文 + Gemini UI**！完整汉化原生菜单栏/程序坞/托盘/弹窗/`Jetski Web` 主界面，并新增顶部原生 **`🌐 语言`** 与 **`✨ 界面美化`** 双菜单！ |
| **🛡️ 引擎 2：0% CPU 事件兜底守护**<br>(`core/cdp-daemon.mjs` + `WatchPaths` / `Sidecar`) | 监听 `DevToolsActivePort` 文件事件唤醒，平时 **0% CPU、0 驻留内存**；连接本地回环 CDP 自动挂载汉化与 Gemini UI 脚本（支持已打开窗口零重启热升级） | 哪怕直接点击**原版图标**、从浏览器唤起 `antigravity://` 链接、或官方自动更新重启后，界面依然**全自动秒切中文与 Gemini 视觉**！ |

---

## 🎨 v2.3 静谧微息与工作态升级：对标 Google Gemini 原生视觉体验 (`core/gemini-ui.js`)

- **🌙 40 秒静谧微息 WebGL1 丝绸极光 (`< 0.08%` M1 Pro 静止 GPU)**：
  - **静止态极度克制**：鼠标与键盘静止时自动降频至 `~40s` 超慢速微细呼吸（顶部流光条完全隐身、流光外框静止为温润珠光描边、无任何眩晕晃动）；轻移鼠标或输入时仅泛起克制的暖光微澜，敲字**零缩放抖动**。
  - **发送提示词 & 原生 `Working` 四色星芒律动**：按下回车或点击发送瞬间唤醒顶部 `2.5px` Gemini 四色流光条与输入舱呼吸光环；原生 `[data-testid="agent-loading"]` (`✦ 正在工作` / `✦ 正在压缩上下文` / `等待您的批准`) 自动挂载纯 CSS Gemini 四色呼吸星标与流光字色（0 侵入 React 虚拟 DOM）。
- **🎛️ `Cmd + Shift + G` 悬浮工作台 + 3 档呼吸强度**：内置 **`🍃 极简微息` / `🌊 静谧呼吸 (默认)` / `✨ 灵动流光`** 三档强度与四大主题预设，切回「原厂默认」**0.0ms 无损还原**。

---

## 🎯 原生汉化核心特性

- **📚 99.8% 实测词条覆盖率（含 Agent 步骤流全量汉化）**：基于 `Antigravity App v2.32.1` 真实前端包 (`12.06 MB main.js` + `language_server` + `app.asar`) 提取精校 **1,800+ 条精确 UI 词条 + 138 组动态正则**，完整覆盖 `正在读取 ...`、`已思考 37秒`、`已运行 ... · 退出码 1`、`已发现 3 个子 Agent`、`已分析 任务日志 / 对话记录`、`正在工作` 等全部动态状态！
- **🧑‍💻 极客地道译风 + 绝对代码安全**：精准保留 `Agent`、`MCP`、`Skill`、`Token`、`Git`、`SSH`、`WSL`、`Fork`、`PR` 等专有名词，严格隔离 `<code>`、`<pre>`、`<textarea>`、`.monaco-editor`、`.xterm` 终端，绝不误伤代码。
- **⚡ `Cmd + Shift + L` (`Ctrl + Shift + L`) 一键秒切中英**：基于 `WeakMap` + `WeakRef` 双向缓存，0 毫秒无刷新丝滑互切！
- **🔔 智能版本比对与词库 OTA 热更新**：支持 `1.1.1` vs `2.1` 多段版本号智能比对与一键无感热更词库。

---

## 🚀 30 秒极速安装

### 🍎 macOS（Apple Silicon M1/M2/M3/M4 原生推荐）

**方式一：终端 / 本地一键安装**
```bash
git clone https://github.com/qixian772/agy-zh.git
cd agy-zh
chmod +x install_mac.command
./install_mac.command
```
> 安装完成后：
> 1. 「应用程序 / 启动台」会自动出现拥有原版高清图标的 **【Antigravity 中文版】**（推荐放入程序坞日常点击，享受顶部原生 `🌐 语言` + `✨ 界面美化` 完整体验）；
> 2. 即使点击原版图标，后台 0% CPU 事件守护也会自动挂载汉化与 Gemini UI；
> 3. 随时按 **`Command + Shift + G`** 打开 Gemini 视觉工作台，按 **`Command + Shift + L`** 0 毫秒切换中/英文！

**方式二：Antigravity 官方插件商场命令**
```bash
agy plugin install https://github.com/qixian772/agy-zh
```

### 🪟 Windows 一键安装
双击仓库根目录下的 **`install_win.bat`**（或在 PowerShell 中运行 `.\install_win.ps1`）：
- 自动在桌面与开始菜单生成 **【Antigravity 中文版】** 快捷方式；
- 随时按 **`Ctrl + Shift + G`** 切换 Gemini 视觉主题，按 **`Ctrl + Shift + L`** 切换中/英文！

---

## 🧹 1 秒无痕恢复原厂英文

由于本方案 **0 字节修改官方客户端本身**，卸载只需 1 秒即可 100% 恢复出厂状态：
- **macOS**：双击运行 [`uninstall_mac.command`](./uninstall_mac.command)（或 `~/.gemini/antigravity-zh/uninstall_mac.command`）
- **Windows**：右键使用 PowerShell 运行 [`uninstall_win.ps1`](./uninstall_win.ps1)

---

## 🛠️ 开发者与自定义词库指南

- **自定义专属译名**：编辑 `~/.gemini/antigravity-zh/zh-dict.override.json`（OTA 更新时会自动保留您的个人覆盖词条）：
  ```json
  {
    "userExact": {
      "Side Question": "支线追问"
    },
    "exact": {
      "Side Question": "支线追问"
    }
  }
  ```
- **扫描新版官方客户端未翻译词条**：
  ```bash
  node scripts/scan_untranslated.mjs --app "/Applications/Antigravity.app"
  ```
- **运行自动化测试套件**：
  ```bash
  node tests/test_agy_zh.mjs
  ```

---

## 📄 开源协议

MIT License © 2026 [QIXIAN (`qixian772`)](https://github.com/qixian772)
