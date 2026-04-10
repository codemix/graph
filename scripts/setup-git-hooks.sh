#!/usr/bin/env sh

set -eu

if ! command -v git >/dev/null 2>&1; then
  exit 0
fi

if ! git rev-parse --show-toplevel >/dev/null 2>&1; then
  exit 0
fi

repo_root="$(git rev-parse --show-toplevel)"
cd "$repo_root"

current_hooks_path="$(git config --get core.hooksPath || true)"
if [ "$current_hooks_path" = ".githooks" ]; then
  exit 0
fi

git config core.hooksPath .githooks
echo "Configured Git hooks to use .githooks"
