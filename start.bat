@echo off
setlocal EnableExtensions
cd /d "%~dp0"

set "REPO_URL=https://github.com/nafing/ai_hub.git"
set "BRANCH=main"

echo ==^> ai_hub — update ^& start
echo     root: %CD%

where git >nul 2>&1
if errorlevel 1 (
  echo ERROR: 'git' is not installed or not on PATH.
  exit /b 1
)

where node >nul 2>&1
if errorlevel 1 (
  echo ERROR: 'node' is not installed or not on PATH.
  exit /b 1
)

where pnpm >nul 2>&1
if errorlevel 1 (
  where corepack >nul 2>&1
  if errorlevel 1 (
    echo ERROR: 'pnpm' is not installed. Install pnpm or enable corepack.
    exit /b 1
  )
  echo ==^> Enabling pnpm via corepack
  call corepack enable
  call corepack prepare pnpm@9.0.0 --activate
)

if not exist ".git\" (
  echo ERROR: Not a git repository. Clone first:
  echo   git clone %REPO_URL%
  exit /b 1
)

git remote get-url origin >nul 2>&1
if errorlevel 1 (
  git remote add origin "%REPO_URL%"
) else (
  git remote set-url origin "%REPO_URL%"
)

echo ==^> Fetching %BRANCH% from origin
git fetch origin %BRANCH%
if errorlevel 1 (
  echo ERROR: git fetch failed.
  exit /b 1
)

echo ==^> Updating working tree ^(autostash^)
git pull --ff-only --autostash origin %BRANCH%
if errorlevel 1 (
  echo WARNING: git pull failed ^(local commits diverged?^). Continuing with current tree.
)

if not exist ".env" if exist ".env.example" (
  echo ==^> Creating .env from .env.example
  copy /y ".env.example" ".env" >nul
)

echo ==^> Installing dependencies
call pnpm install
if errorlevel 1 (
  echo ERROR: pnpm install failed.
  exit /b 1
)

echo ==^> Starting app ^(client + server^)
call pnpm run dev
exit /b %ERRORLEVEL%
