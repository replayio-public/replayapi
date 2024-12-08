#!/bin/bash
set -ex
cd "$(dirname "$0")"/..
exec npx --yes tsx main.ts $*
