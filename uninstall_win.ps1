# ==============================================================================
#  🧹 Antigravity Native Chinese (qixian-agy-zh) — Windows 一键无痕卸载脚本
# ==============================================================================
$ErrorActionPreference = "SilentlyContinue"

Get-CimInstance Win32_Process | Where-Object {
    $_.CommandLine -match "guard_win\.ps1" -or $_.CommandLine -match "cdp-daemon\.mjs"
} | ForEach-Object { Stop-Process -Id $_.ProcessId -Force }

Remove-Item (Join-Path ([Environment]::GetFolderPath("Desktop")) "Antigravity 中文版.lnk") -Force
Remove-Item (Join-Path ([Environment]::GetFolderPath("Programs")) "Antigravity 中文版.lnk") -Force
Remove-Item (Join-Path ([Environment]::GetFolderPath("Startup")) "AGY-ZH-Guard.lnk") -Force
Remove-Item (Join-Path $HOME ".gemini\skills\agy-zh") -Recurse -Force
Remove-Item (Join-Path $HOME ".gemini\antigravity-zh") -Recurse -Force

Write-Host "✅ 已无痕卸载 Antigravity 汉化组件，原版 Antigravity 已完全恢复英文原厂状态！" -ForegroundColor Green
