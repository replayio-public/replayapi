#!/bin/bash
cd "$(dirname "$0")"/..
npx --yes tsx main.ts $*
