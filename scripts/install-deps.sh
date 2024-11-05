#!/bin/bash
cd "$(dirname "$0")"/..
yarn

# clone devtools and use yalc to hook up packages we depend on
git -C .. clone https://github.com/replayio/devtools.git
export REPLAY_DIR=$(pwd)/..
yarn publish-devtools
yarn link-devtools
