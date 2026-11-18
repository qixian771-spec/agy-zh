# ==============================================================================
#  ✨ Antigravity Native Chinese + Gemini UI (qixian-agy-zh v2.0.0) — Windows 一键安装器
# ==============================================================================
$ErrorActionPreference = "Stop"

$SrcDir = Split-Path -Parent $MyInvocation.MyCommand.Definition
$InstallDir = Join-Path $HOME ".gemini\antigravity-zh"
$SkillDst = Join-Path $HOME ".gemini\skills\agy-zh"

Write-Host "================================================================" -ForegroundColor Cyan
Write-Host "  ✨ Antigravity 原生汉化 + Gemini UI (v2.0.0) — Windows 一键安装" -ForegroundColor Cyan
Write-Host "================================================================" -ForegroundColor Cyan

# 1. 定位官方 Antigravity.exe（0 字节修改原程序）
$Candidates = @(
    (Join-Path $env:LOCALAPPDATA "Programs\Antigravity\Antigravity.exe"),
    (Join-Path $env:ProgramFiles "Antigravity\Antigravity.exe")
)
$AgyExe = $Candidates | Where-Object { Test-Path $_ } | Select-Object -First 1
if (-not $AgyExe) {
    $AgyExe = Join-Path $env:LOCALAPPDATA "Programs\Antigravity\Antigravity.exe"
    Write-Host "⚠️ 暂未检测到 Antigravity.exe，已按默认路径预配置: $AgyExe" -ForegroundColor Yellow
} else {
    Write-Host "✅ 已识别官方 Antigravity 程序: $AgyExe" -ForegroundColor Green
}

# 2. 复制核心汉化文件到 ~/.gemini/antigravity-zh
New-Item -ItemType Directory -Force -Path $InstallDir | Out-Null
$ExcludeNames = @(".git", ".github", "node_modules", "zh-dict.override.json")
Get-ChildItem -Path $SrcDir -Force | Where-Object { $ExcludeNames -notcontains $_.Name } | ForEach-Object {
    if ($SrcDir -ne $InstallDir) {
        Copy-Item -Path $_.FullName -Destination $InstallDir -Recurse -Force
    }
}

# 3. 生成无黑框静默启动脚本 launch_agy_zh.vbs (Engine 1) + 兜底守护 guard_win.vbs (Engine 2)
$HookPath = Join-Path $InstallDir "core\hook-main.cjs"
$DaemonPath = Join-Path $InstallDir "core\cdp-daemon.mjs"
$LauncherVbs = Join-Path $InstallDir "launch_agy_zh.vbs"
$GuardPs1 = Join-Path $InstallDir "guard_win.ps1"
$GuardVbs = Join-Path $InstallDir "guard_win.vbs"

$VbsContent = @"
Set sh = CreateObject("WScript.Shell")
Set env = sh.Environment("PROCESS")
env("NODE_OPTIONS") = "--require ""$HookPath"""
env("AGY_ZH_LANG") = "zh-CN"
sh.Run """$AgyExe"" --lang=zh-CN", 1, False
"@
Set-Content -Path $LauncherVbs -Value $VbsContent -Encoding UTF8

$GuardPs1Content = @"
`$AgyExe = "$AgyExe"
`$DaemonJs = "$DaemonPath"
`$WatchDir = Join-Path `$env:APPDATA "Antigravity"
New-Item -ItemType Directory -Force -Path `$WatchDir | Out-Null

function Invoke-CdpOnce {
    if (Test-Path `$AgyExe) {
        `$env:ELECTRON_RUN_AS_NODE = "1"
        Start-Process -FilePath `$AgyExe -ArgumentList @("`"`$DaemonJs`"", "--once") -WindowStyle Hidden
    } elseif (Get-Command node -ErrorAction SilentlyContinue) {
        Start-Process -FilePath "node" -ArgumentList @("`"`$DaemonJs`"", "--once") -WindowStyle Hidden
    }
}

Invoke-CdpOnce
`$Watcher = New-Object System.IO.FileSystemWatcher `$WatchDir, "DevToolsActivePort"
`$Watcher.EnableRaisingEvents = `$true
while (`$true) {
    `$res = `$Watcher.WaitForChanged([System.IO.WatcherChangeTypes]::Created -bor [System.IO.WatcherChangeTypes]::Changed, 60000)
    if (-not `$res.TimedOut) {
        Start-Sleep -Milliseconds 400
        Invoke-CdpOnce
    }
}
"@
Set-Content -Path $GuardPs1 -Value $GuardPs1Content -Encoding UTF8

$GuardVbsContent = @"
Set sh = CreateObject("WScript.Shell")
sh.Run "powershell.exe -NoProfile -WindowStyle Hidden -ExecutionPolicy Bypass -File ""$GuardPs1""", 0, False
"@
Set-Content -Path $GuardVbs -Value $GuardVbsContent -Encoding UTF8

# 4. 创建桌面与开始菜单【Antigravity 中文版】快捷方式 + 开机事件监听守护
$WshShell = New-Object -ComObject WScript.Shell
$DesktopLnk = Join-Path ([Environment]::GetFolderPath("Desktop")) "Antigravity 中文版.lnk"
$StartMenuLnk = Join-Path ([Environment]::GetFolderPath("Programs")) "Antigravity 中文版.lnk"
$StartupGuardLnk = Join-Path ([Environment]::GetFolderPath("Startup")) "AGY-ZH-Guard.lnk"

foreach ($LnkPath in @($DesktopLnk, $StartMenuLnk)) {
    $Shortcut = $WshShell.CreateShortcut($LnkPath)
    $Shortcut.TargetPath = "wscript.exe"
    $Shortcut.Arguments = """$LauncherVbs"""
    if (Test-Path $AgyExe) { $Shortcut.IconLocation = "$AgyExe,0" }
    $Shortcut.Description = "Google Antigravity 原生汉化 + Gemini UI (Ctrl+Shift+L 秒切中英 / Ctrl+Shift+G 视觉工作台)"
    $Shortcut.Save()
}

$GuardShortcut = $WshShell.CreateShortcut($StartupGuardLnk)
$GuardShortcut.TargetPath = "wscript.exe"
$GuardShortcut.Arguments = """$GuardVbs"""
$GuardShortcut.Description = "Antigravity Native Chinese & Gemini UI Fallback Guard"
$GuardShortcut.Save()

# 5. 同步 /agy-zh 技能并立即对当前窗口执行热汉化与视觉挂载
New-Item -ItemType Directory -Force -Path $SkillDst | Out-Null
Copy-Item -Path (Join-Path $InstallDir "skills\agy-zh\SKILL.md") -Destination (Join-Path $SkillDst "SKILL.md") -Force

Start-Process -FilePath "wscript.exe" -ArgumentList """$GuardVbs"""

Write-Host ""
Write-Host "================================================================" -ForegroundColor Green
Write-Host "  🎉 Antigravity 原生汉化 + Gemini UI (v2.0.0) 安装完成！" -ForegroundColor Green
Write-Host "  • 桌面已生成【Antigravity 中文版】快捷方式（含原生双菜单）"
Write-Host "  • 快捷键【Ctrl + Shift + G】打开 Gemini 视觉工作台（4 大预设）"
Write-Host "  • 快捷键【Ctrl + Shift + L】随时 0 毫秒无刷新秒切中/英文！"
Write-Host "================================================================" -ForegroundColor Green
