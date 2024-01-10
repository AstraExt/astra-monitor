#!/bin/bash
# pack.sh - Script to package GNOME extension into a zip file for distribution

# Check for necessary tools
command -v bash >/dev/null 2>&1 || { echo >&2 "Bash is required but it's not installed. Aborting."; exit 1; }
command -v glib-compile-schemas >/dev/null 2>&1 || { echo >&2 "glib-compile-schemas is required but it's not installed. Aborting."; exit 1; }
#command -v zip >/dev/null 2>&1 || { echo >&2 "zip is required but it's not installed. Aborting."; exit 1; }

# Paths and filenames
EXTENSION_DIR=$(dirname "$0") # Assumes pack.sh is in the main directory
DIST_DIR="${EXTENSION_DIR}/dist"
EXTENSION_NAME="AstraMonitor"

# Check if is in debug mode
# look for 'static debug = true;' inside ./src/utils/utils.js
if grep -q 'static debug = true;' "${EXTENSION_DIR}/src/utils/utils.js"; then
    echo "Debug mode is enabled in 'utils.js'. Disable it before packaging. Aborting."
    exit 1
fi

# Read VERSION from metadata.json
if [ -f "${EXTENSION_DIR}/metadata.json" ]; then
    VERSION=$(grep '"version"' "${EXTENSION_DIR}/metadata.json" | grep -o '[0-9]*')
    if [ -z "$VERSION" ]; then
        echo "Version not found in metadata.json"
        exit 1
    fi
else
    echo "metadata.json not found. Aborting."
    exit 1
fi

# Run schemas.sh
if [ -f "${EXTENSION_DIR}/schemas.sh" ]; then
    echo "Running schemas.sh..."
    bash "${EXTENSION_DIR}/schemas.sh" || { echo "schemas.sh failed. Aborting."; exit 1; }
else
    echo "schemas.sh not found. Aborting."
    exit 1
fi

# Run i18n.sh
if [ -f "${EXTENSION_DIR}/i18n.sh" ]; then
    echo "Running i18n.sh..."
    bash "${EXTENSION_DIR}/i18n.sh" || { echo "i18n.sh failed. Aborting."; exit 1; }
else
    echo "i18n.sh not found. Aborting."
    exit 1
fi

# Remove the previous build if any
rm -rf "monitor@astraext.github.io.shell-extension.zip"

# Create dist directory
mkdir -p "$DIST_DIR"

# Files and directories to include
INCLUDE_FILES="extension.js prefs.js metadata.json stylesheet.css README.md RELEASES.md LICENSE schemas icons po src"

# Copy files to dist directory
for file in $INCLUDE_FILES; do
    if [ -e "${EXTENSION_DIR}/${file}" ]; then
        cp -r "${EXTENSION_DIR}/${file}" "${DIST_DIR}/"
    else
        echo "File or directory ${file} not found. Aborting."
        rm -rf "$DIST_DIR"
        exit 1
    fi
done

# enter dist directory
cd "$DIST_DIR"

# Pack the extension
gnome-extensions pack --force \
    --podir=./po \
    --extra-source=./src \
    --extra-source=./icons \
    --extra-source=./LICENSE \
    --extra-source=./README.md \
    --extra-source=./RELEASES.md \
    .

# Check for errors
if [ $? -ne 0 ]; then
    echo "Failed to pack the extension"
    
    cd "${EXTENSION_DIR}"
    rm -rf "${DIST_DIR}"
    exit 1
fi

# Copy the packed extension to the main directory
mv "monitor@astraext.github.io.shell-extension.zip" "../monitor@astraext.github.io.shell-extension.zip"

# Return to the main directory
cd ..

# Clean up: remove the dist directory
rm -rf "${DIST_DIR}"

echo "Extension packaged into monitor@astraext.github.io.shell-extension.zip"
exit 0
