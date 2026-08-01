@echo off
setlocal
REM 以调试端口启动本机浏览器，供笔记 agent 通过 browser_* 工具接管。
REM 使用独立配置目录（.biji-browser），不影响正常浏览器使用；登录态保存在该目录。
REM
REM 默认只在本机(127.0.0.1)监听。若 bi-ji 服务跑在其它机器（如 Linux），需放开监听并放行防火墙：
REM   set BIJI_CDP_ADDR=0.0.0.0
REM   并在 Windows 防火墙放行 TCP %CDP_PORT% 入站。

set CDP_PORT=9222
set CDP_ADDR=%BIJI_CDP_ADDR%
if "%CDP_ADDR%"=="" set CDP_ADDR=127.0.0.1
set PROFILE=%USERPROFILE%\.biji-browser
if not exist "%PROFILE%" mkdir "%PROFILE%"

echo 正在以调试端口 %CDP_PORT%（监听 %CDP_ADDR%）启动浏览器，配置目录：%PROFILE%
echo 第一次使用请在弹出的窗口里登录你需要的网站，之后 agent 就能读取/操作这些页面。
echo 保持该浏览器窗口运行即可，不要手动关闭。

set LAUNCHED=
where msedge.exe >nul 2>nul
if not errorlevel 1 set LAUNCHED=msedge.exe
if not defined LAUNCHED where chrome.exe >nul 2>nul
if not errorlevel 1 if not defined LAUNCHED set LAUNCHED=chrome.exe
if not defined LAUNCHED (
  echo 未找到 msedge.exe / chrome.exe，请将浏览器加入 PATH 或手动用以下命令启动：
  echo   msedge --remote-debugging-port=%CDP_PORT% --remote-debugging-address=%CDP_ADDR% --user-data-dir="%PROFILE%"
  exit /b 1
)

start "" "%LAUNCHED%" --remote-debugging-port=%CDP_PORT% --remote-debugging-address=%CDP_ADDR% --user-data-dir="%PROFILE%" --no-first-run
endlocal
