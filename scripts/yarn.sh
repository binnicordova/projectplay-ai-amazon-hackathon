#!/bin/sh
# Yarn 4 for the tv/ workspace (run it from tv/). Node 25+ no longer bundles Corepack (friction F9),
# so fall back to npx, which fetches Corepack once; never a global Yarn 1, which breaks the workspace.
if command -v corepack >/dev/null 2>&1; then exec corepack yarn "$@"; fi
exec npx -y corepack yarn "$@"
