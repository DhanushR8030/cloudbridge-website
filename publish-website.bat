@echo off
cd /d "%~dp0"
echo Publishing CloudBridge website to GitHub (Vercel will deploy it automatically)...
echo.
git add -A
git commit -m "Add photos, 3D website page, 100+ projects and contact details"
git push origin main
echo.
if errorlevel 1 (
  echo PUBLISH FAILED - copy the message above and send it to Claude.
) else (
  echo DONE - Vercel is now deploying. The live site updates in about 1-2 minutes.
)
echo.
pause
