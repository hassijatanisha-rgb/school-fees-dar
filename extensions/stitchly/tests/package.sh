#!/bin/sh
# Builds stitchly.zip for upload: everything except store/, tests/ and the zip itself.
set -e
cd "$(dirname "$0")/.."
rm -f stitchly.zip
zip -r -X -q stitchly.zip manifest.json background.js config.js license.js result.html result.js result.css \
  options.html options.js options.css ui.css lib page icons
unzip -l stitchly.zip
