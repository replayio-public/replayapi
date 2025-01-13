# Copyright 2020-2024 Record Replay Inc.

# NOTE: This will crash with `Unknown pointer passed to callback napi_set_named_property`
set -e
TS_NODE_COMPILER_OPTIONS='{"jsx":"react"}' TS_NODE_TRANSPILE_ONLY=true replay-node -r ts-node/register -r tsconfig-paths/register '../packages/replay-data/src/recordingData/mytest.ts'
