#!/bin/bash
set -ex

REPLAY_DIR="$(dirname "$0")/../.."

# Clone devtools if not already present.
if [ ! -d "$REPLAY_DIR/devtools" ]; then
    git clone https://github.com/replayio/devtools.git "$REPLAY_DIR/devtools"
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
