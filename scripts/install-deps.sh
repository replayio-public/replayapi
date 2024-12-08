#!/bin/bash
set -ex

REPLAY_DIR="$(dirname "$0")/../.."

# Clone devtools if not already present.
if [ ! -d "$REPLAY_DIR/devtools" ]; then
    git -C "$REPLAY_DIR/devtools" clone https://github.com/replayio/devtools.git
fi
cd "$REPLAY_DIR/devtools"
# nvm use
yarn install

# Init replayapi.
cd "$REPLAY_DIR/replayapi"

export COREPACK_ENABLE_DOWNLOAD_PROMPT=0
corepack enable
yarn

export REPLAY_DIR=$(pwd)/..
yarn yalc-all
