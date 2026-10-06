#!/usr/bin/env bash
# Builds snipkey.zip for the Chrome Web Store: everything except store/, tests/ and the zip itself.
set -euo pipefail
cd "$(dirname "$0")/.."
rm -f snipkey.zip
zip -r -X snipkey.zip . -x 'store/*' 'tests/*' 'snipkey.zip' '*.DS_Store' >/dev/null
unzip -l snipkey.zip
