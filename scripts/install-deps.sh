#!/bin/bash
set -ex

cd "$(dirname "$0")"/..

export COREPACK_ENABLE_DOWNLOAD_PROMPT=0
corepack enable
yarn

# Clone devtools if not already present.
if [ ! -d "../devtools" ]; then
    git -C .. clone https://github.com/replayio/devtools.git
fi

export REPLAY_DIR=$(pwd)/..
yarn yalc-all
