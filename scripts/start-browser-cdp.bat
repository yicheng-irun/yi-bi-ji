@echo off
REM Start Edge/Chrome with CDP debugging for bi-ji browser_* tools.
REM Profile lives in %USERPROFILE%\.biji-browser (logins persist there).
REM Default listens on 127.0.0.1 only. For remote access set first:
REM   set BIJI_CDP_ADDR=0.0.0.0   (then allow the port in firewall)

set PROFILE=%USERPROFILE%\.biji-browser
if not exist "%PROFILE%" mkdir "%PROFILE%"

set CDP_ADDR=%BIJI_CDP_ADDR%
if "%CDP_ADDR%"=="" set CDP_ADDR=127.0.0.1

set BROWSER=
if exist "%ProgramFiles(x86)%\Microsoft\Edge\Application\msedge.exe" set BROWSER="%ProgramFiles(x86)%\Microsoft\Edge\Application\msedge.exe"
if not defined BROWSER if exist "%ProgramFiles%\Microsoft\Edge\Application\msedge.exe" set BROWSER="%ProgramFiles%\Microsoft\Edge\Application\msedge.exe"
if not defined BROWSER if exist "%LocalAppData%\Microsoft\Edge\Application\msedge.exe" set BROWSER="%LocalAppData%\Microsoft\Edge\Application\msedge.exe"
if not defined BROWSER if exist "%ProgramFiles(x86)%\Google\Chrome\Application\chrome.exe" set BROWSER="%ProgramFiles(x86)%\Google\Chrome\Application\chrome.exe"
if not defined BROWSER if exist "%ProgramFiles%\Google\Chrome\Application\chrome.exe" set BROWSER="%ProgramFiles%\Google\Chrome\Application\chrome.exe"

if not defined BROWSER (
  echo [bi-ji] Edge/Chrome not found.
  echo   Start it manually:
  echo   msedge --remote-debugging-port=9222 --user-data-dir="%PROFILE%"
  pause
  exit /b 1
)

start "" %BROWSER% --remote-debugging-port=9222 --remote-debugging-address=%CDP_ADDR% --user-data-dir="%PROFILE%" --no-first-run
echo [bi-ji] Browser started. CDP on port 9222 (listen %CDP_ADDR%). Log in to your sites in that window; keep it open.
pause
