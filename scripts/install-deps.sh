#!/bin/bash
set -ex

cd "$(dirname "$0")"/..

export COREPACK_ENABLE_DOWNLOAD_PROMPT=0
corepack enable
yarn

# clone devtools and use yalc to hook up packages we depend on
git -C .. clone https://github.com/replayio/devtools.git
export REPLAY_DIR=$(pwd)/..
yarn publish-devtools
yarn link-devtools
