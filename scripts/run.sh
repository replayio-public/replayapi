#!/bin/bash
set -e
cd "$(dirname "$0")"/..
exec npx --yes tsx -r tsconfig-paths/register main.ts $*
