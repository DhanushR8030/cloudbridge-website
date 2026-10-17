@echo off
cd /d "%~dp0"
echo Deploying CloudBridge website to Vercel (production)...
echo.
call npx --yes vercel@latest --prod --yes
echo.
if errorlevel 1 (
  echo DEPLOY FAILED - send a screenshot of this window to Claude.
) else (
  echo DONE - your live website is updated.
)
echo.
pause
