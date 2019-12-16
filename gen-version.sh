#!/bin/sh

VERSION=$(jq .version package.json)
echo "export const VERSION = $VERSION;" > src/version.ts
