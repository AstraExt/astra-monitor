#!/bin/bash

EXTENSION_DIR=$(dirname "$0") # Assumes pack.sh is in the main directory
cd "$EXTENSION_DIR"

# generate pot file
find . -name '*.js' -exec xgettext --from-code=UTF-8 --package-name=AstraMonitor --package-version=1 --copyright-holder="Lju" --output=po/monitor@astraext.pot {} +