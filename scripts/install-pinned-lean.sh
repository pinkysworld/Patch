#!/usr/bin/env bash
set -euo pipefail

LEAN_TOOLCHAIN="${PATCH_LEAN_TOOLCHAIN:-leanprover/lean4:v4.30.0}"
ELAN_INIT_URL="https://elan.lean-lang.org/elan-init.sh"
INSTALLER="$(mktemp -t patch-elan-init.XXXXXX.sh)"
trap 'rm -f "$INSTALLER"' EXIT

curl --proto '=https' --tlsv1.2 --fail --show-error --silent --location "$ELAN_INIT_URL" --output "$INSTALLER"
test -s "$INSTALLER"
FIRST_LINE="$(head -n 1 "$INSTALLER")"
case "$FIRST_LINE" in
  '#!'*) ;;
  *) echo 'Elan installer download did not look like an executable script.' >&2; exit 1 ;;
esac

sh "$INSTALLER" -y --default-toolchain none
if [ -n "${GITHUB_PATH:-}" ]; then
  echo "$HOME/.elan/bin" >> "$GITHUB_PATH"
else
  export PATH="$HOME/.elan/bin:$PATH"
fi
"$HOME/.elan/bin/elan" toolchain install "$LEAN_TOOLCHAIN"
"$HOME/.elan/bin/lean" --version
