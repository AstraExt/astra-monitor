#!/bin/bash
# pack.sh - Script to package GNOME extension into a zip file for distribution

# Check for necessary tools
command -v bash >/dev/null 2>&1 || { echo >&2 "Bash is required but it's not installed. Aborting."; exit 1; }
command -v glib-compile-schemas >/dev/null 2>&1 || { echo >&2 "glib-compile-schemas is required but it's not installed. Aborting."; exit 1; }

# Function to log messages
log_message() {
    echo "[`date +"%Y-%m-%d %H:%M:%S"`] $1"
}

# Paths and filenames
EXTENSION_DIR=$(dirname "$0") # Assumes pack.sh is in the main directory
DIST_DIR="${EXTENSION_DIR}/dist"
EXTENSION_NAME="monitor@astraext.github.io"

# Read VERSION from metadata.json
if [ -f "${EXTENSION_DIR}/metadata.json" ]; then
    VERSION=$(grep '"version"' "${EXTENSION_DIR}/metadata.json" | grep -o '[0-9]*')
    if [ -z "$VERSION" ]; then
        log_message "Version not found in metadata.json"
        exit 1
    fi
else
    log_message "metadata.json not found. Aborting."
    exit 1
fi

# Run schemas.sh
if [ -f "${EXTENSION_DIR}/schemas.sh" ]; then
    log_message "Running schemas.sh..."
    bash "${EXTENSION_DIR}/schemas.sh" || { log_message "schemas.sh failed. Aborting."; exit 1; }
else
    log_message "schemas.sh not found. Aborting."
    exit 1
fi

# Remove the previous build if any
rm -rf "monitor@astraext.github.io.shell-extension.zip"

# Clean up build directory
rm -r "build"

# Check if tsc is installed
command -v tsc >/dev/null 2>&1 || { log_message "Error: tsc is required but it's not installed. Aborting."; exit 1; }

# Compile TypeScript
log_message "Building typescript files..."
tsc

# Check for errors
if [ $? -ne 0 ]; then
    log_message "Failed to compile TypeScript"
    exit 1
fi

# Run i18n.sh
if [ -f "${EXTENSION_DIR}/i18n.sh" ]; then
    log_message "Running i18n.sh..."
    bash "${EXTENSION_DIR}/i18n.sh" || { log_message "i18n.sh failed. Aborting."; exit 1; }
else
    log_message "i18n.sh not found. Aborting."
    exit 1
fi

# Create dist directory
mkdir -p "$DIST_DIR"

# Copy build directory content to dist directory
cp -r "${EXTENSION_DIR}/build/"* "${DIST_DIR}/"

# Files and directories to include
INCLUDE_FILES="metadata.json stylesheet.css README.md RELEASES.md LICENSE schemas icons po"

# Copy files to dist directory
for file in $INCLUDE_FILES; do
    if [ -e "${EXTENSION_DIR}/${file}" ]; then
        cp -r "${EXTENSION_DIR}/${file}" "${DIST_DIR}/"
    else
        log_message "File or directory ${file} not found. Aborting."
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
    log_message "Failed to pack the extension"
    
    cd "${EXTENSION_DIR}"
    rm -rf "${DIST_DIR}"
    exit 1
fi

# Copy the packed extension to the main directory
mv "$EXTENSION_NAME.shell-extension.zip" "../$EXTENSION_NAME.shell-extension.zip"

# Return to the main directory
cd ..

# Clean up: remove the dist directory
rm -rf "${DIST_DIR}"

log_message "Extension packaged into $EXTENSION_NAME.shell-extension.zip"
exit 0
