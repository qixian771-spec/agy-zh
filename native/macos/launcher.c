/*
 * Antigravity Native Chinese (qixian-agy-zh) — Pure Apple Silicon (arm64) Mach-O Launcher
 *
 * Compiled as native `arm64` on M-series Macs (`clang -arch arm64 -O2`) so macOS never prompts
 * for Rosetta 2! Delegates launch via `/usr/bin/open --env ... -a "/Applications/Antigravity.app"`
 * so `launchd` spawns Google's signed `Antigravity.app` under its own Apple Developer ID & TCC
 * Responsible Process (`com.google.antigravity`) while loading `hook-main.cjs` at millisecond 0.
 */
#include <stdio.h>
#include <stdlib.h>
#include <string.h>
#include <unistd.h>
#include <sys/stat.h>
#include <sys/wait.h>

static int file_exists(const char *path) {
    struct stat st;
    return path && stat(path, &st) == 0;
}

static int is_antigravity_running(void) {
    int status = system("/usr/bin/pgrep -x Antigravity >/dev/null 2>&1");
    return WIFEXITED(status) && WEXITSTATUS(status) == 0;
}

int main(int argc, char *argv[]) {
    const char *home = getenv("HOME");
    if (!home) home = "";

    char app_path[1024] = "/Applications/Antigravity.app";
    if (!file_exists(app_path)) {
        snprintf(app_path, sizeof(app_path), "%s/Applications/Antigravity.app", home);
    }
    if (!file_exists(app_path)) {
        system("/usr/bin/osascript -e 'display alert \"未检测到 Antigravity.app\" message \"请先将官方 Google Antigravity 拖入 /Applications 应用程序目录后再打开「Antigravity 中文版」。\" as warning' >/dev/null 2>&1");
        return 1;
    }

    char hook_path[1024];
    snprintf(hook_path, sizeof(hook_path), "%s/.gemini/antigravity-zh/core/hook-main.cjs", home);

    if (is_antigravity_running()) {
        /* Antigravity is already open: focus window & run Engine 2 one-shot CDP localization immediately */
        pid_t pid = fork();
        if (pid == 0) {
            char runner[1024], daemon_js[1024];
            snprintf(runner, sizeof(runner), "%s/.gemini/antigravity-zh/scripts/run_node.sh", home);
            snprintf(daemon_js, sizeof(daemon_js), "%s/.gemini/antigravity-zh/core/cdp-daemon.mjs", home);
            if (file_exists(runner) && file_exists(daemon_js)) {
                execl("/bin/bash", "bash", runner, daemon_js, "--once", (char *)NULL);
            }
            _exit(0);
        }
        execl("/usr/bin/open", "open", "-a", app_path, (char *)NULL);
        return 0;
    }

    if (file_exists(hook_path)) {
        char node_opt_env[1200];
        snprintf(node_opt_env, sizeof(node_opt_env), "NODE_OPTIONS=--require \"%s\"", hook_path);
        execl(
            "/usr/bin/open",
            "open",
            "--env", node_opt_env,
            "--env", "AGY_ZH_LANG=zh-CN",
            "-a", app_path,
            "--args", "--lang=zh-CN",
            (char *)NULL
        );
    }

    execl("/usr/bin/open", "open", "-a", app_path, "--args", "--lang=zh-CN", (char *)NULL);
    return 0;
}
