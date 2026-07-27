#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$ROOT"

REPO_URL="https://github.com/nafing/ai_hub.git"
BRANCH="main"

echo "==> ai_hub — update & start"
echo "    root: $ROOT"

need() {
  if ! command -v "$1" >/dev/null 2>&1; then
    echo "ERROR: '$1' is not installed or not on PATH." >&2
    exit 1
  fi
}

need git
need node

if ! command -v pnpm >/dev/null 2>&1; then
  if command -v corepack >/dev/null 2>&1; then
    echo "==> Enabling pnpm via corepack"
    corepack enable
    corepack prepare pnpm@9.0.0 --activate
  else
    echo "ERROR: 'pnpm' is not installed. Install pnpm or enable corepack." >&2
    exit 1
  fi
fi

if [ ! -d .git ]; then
  echo "ERROR: Not a git repository. Clone first:" >&2
  echo "  git clone $REPO_URL" >&2
  exit 1
fi

if ! git remote get-url origin >/dev/null 2>&1; then
  git remote add origin "$REPO_URL"
else
  git remote set-url origin "$REPO_URL"
fi

echo "==> Fetching $BRANCH from origin"
git fetch origin "$BRANCH"

echo "==> Updating working tree (autostash)"
if git pull --ff-only --autostash origin "$BRANCH"; then
  echo "    up to date / fast-forwarded"
else
  echo "WARNING: git pull failed (local commits diverged?). Continuing with current tree." >&2
fi

if [ ! -f .env ] && [ -f .env.example ]; then
  echo "==> Creating .env from .env.example"
  cp .env.example .env
fi

echo "==> Installing dependencies"
pnpm install

echo "==> Starting app (client + server)"
exec pnpm run dev
