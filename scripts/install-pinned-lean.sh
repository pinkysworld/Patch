#!/usr/bin/env bash
set -euo pipefail

LEAN_TOOLCHAIN="${PATCH_LEAN_TOOLCHAIN:-leanprover/lean4:v4.30.0}"
ELAN_INIT_URL="https://elan.lean-lang.org/elan-init.sh"
INSTALLER="$(mktemp -t patch-elan-init.XXXXXX.sh)"
trap 'rm -f "$INSTALLER"' EXIT

# Hosted CI occasionally sees short-lived TLS/connection resets while fetching
# the pinned Lean bootstrap. Retry bounded transient transport failures, but
# still fail closed for persistent download or installer problems.
curl --proto '=https' --tlsv1.2 --fail --show-error --silent --location \
  --connect-timeout 15 --retry 4 --retry-delay 2 --retry-max-time 60 --retry-all-errors \
  "$ELAN_INIT_URL" --output "$INSTALLER"
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

for attempt in 1 2 3; do
  if "$HOME/.elan/bin/elan" toolchain install "$LEAN_TOOLCHAIN"; then
    break
  fi
  if [ "$attempt" -eq 3 ]; then
    echo "Failed to install pinned Lean toolchain after $attempt attempts." >&2
    exit 1
  fi
  sleep $((attempt * 3))
done

"$HOME/.elan/bin/elan" run "$LEAN_TOOLCHAIN" lean --version
