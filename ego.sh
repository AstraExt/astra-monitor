#!/bin/bash

# Function to log messages
log_message() {
    echo "[`date +"%Y-%m-%d %H:%M:%S"`] $1"
}

usage() {
    echo "Usage: bash ./ego.sh"
}

if [ "$#" -ne 0 ]; then
    usage
    exit 1
fi

EXTENSION_NAME="monitor@astraext.github.io"
EXTENSION_DIR=$(dirname "$(realpath "$0")")
DIST_DIR="${EXTENSION_DIR}/dist"
VENV_DIR="${EXTENSION_DIR}/venv"
PACKAGE_ZIP="${DIST_DIR}/${EXTENSION_NAME}.shell-extension.zip"

cleanup() {
    if [ -d "$DIST_DIR" ]; then
        log_message "Cleaning up dist directory..."
        rm -rf "$DIST_DIR"
    fi
}

trap cleanup EXIT

cd "$EXTENSION_DIR" || { log_message "Error: Failed to change directory to $EXTENSION_DIR"; exit 1; }

# Check if schemas are compiled
if [ ! -f ./schemas/gschemas.compiled ]; then
    command -v glib-compile-schemas >/dev/null 2>&1 || { log_message "Error: glib-compile-schemas is required but it's not installed. Aborting."; exit 1; }

    log_message "Compiling schemas..."
    glib-compile-schemas ./schemas
    if [ $? -ne 0 ]; then
        log_message "Failed to compile schemas"
        exit 1
    fi
fi

# Check if tsc is installed
command -v tsc >/dev/null 2>&1 || { log_message "Error: tsc is required but it's not installed. Aborting."; exit 1; }

# Compile TypeScript
log_message "Building typescript files..."
tsc
if [ $? -ne 0 ]; then
    log_message "Failed to compile TypeScript"
    exit 1
fi

# Check if gnome-extensions is installed
command -v gnome-extensions >/dev/null 2>&1 || { log_message "Error: gnome-extensions is required but it's not installed. Aborting."; exit 1; }

# Create dist directory
rm -rf "$DIST_DIR"
mkdir -p "$DIST_DIR"

if [ ! -d "${EXTENSION_DIR}/build" ]; then
    log_message "Error: build directory not found"
    exit 1
fi

# Copy build directory content to dist directory
cp -r "${EXTENSION_DIR}/build/"* "$DIST_DIR/"

# Files and directories to include
INCLUDE_FILES="metadata.json stylesheet.css README.md RELEASES.md LICENSE schemas icons po ROADMAP.md COMPARISON.md"

# Copy files to dist directory
for file in $INCLUDE_FILES; do
    if [ -e "${EXTENSION_DIR}/${file}" ]; then
        cp -r "${EXTENSION_DIR}/${file}" "$DIST_DIR/"
    else
        log_message "File or directory ${file} not found. Aborting."
        exit 1
    fi
done

# Enter dist directory
cd "$DIST_DIR" || { log_message "Error: Failed to change directory to $DIST_DIR"; exit 1; }

# Pack the extension
log_message "Packing extension..."
gnome-extensions pack --force \
    --podir=./po \
    --extra-source=./src \
    --extra-source=./icons \
    --extra-source=./LICENSE \
    --extra-source=./README.md \
    --extra-source=./RELEASES.md \
    --extra-source=./ROADMAP.md \
    --extra-source=./COMPARISON.md \
    .

if [ $? -ne 0 ]; then
    log_message "Failed to pack the extension"
    exit 1
fi

if [ ! -f "$PACKAGE_ZIP" ]; then
    log_message "Error: packed extension not found at $PACKAGE_ZIP"
    exit 1
fi

cd "$EXTENSION_DIR" || { log_message "Error: Failed to change directory to $EXTENSION_DIR"; exit 1; }

if [ ! -d "$VENV_DIR" ]; then
    if command -v virtualenv >/dev/null 2>&1; then
        log_message "Creating virtual environment with virtualenv..."
        virtualenv "$VENV_DIR"
    elif command -v python3 >/dev/null 2>&1; then
        log_message "Creating virtual environment with python3 -m venv..."
        python3 -m venv "$VENV_DIR"
    else
        log_message "Error: virtualenv or python3 is required but neither is installed. Aborting."
        exit 1
    fi

    if [ $? -ne 0 ]; then
        log_message "Failed to create virtual environment"
        exit 1
    fi
fi

if [ ! -f "${VENV_DIR}/bin/activate" ]; then
    log_message "Error: virtual environment activation script not found at ${VENV_DIR}/bin/activate"
    exit 1
fi

# shellcheck source=/dev/null
. "${VENV_DIR}/bin/activate"

log_message "Installing/updating shexli..."
pip install -U shexli
if [ $? -ne 0 ]; then
    log_message "Failed to install shexli"
    exit 1
fi

log_message "Running shexli on $PACKAGE_ZIP..."
shexli "$PACKAGE_ZIP"
SHEXLI_EXIT_CODE=$?

if [ $SHEXLI_EXIT_CODE -eq 0 ]; then
    log_message "shexli validation completed successfully"
else
    log_message "shexli validation failed"
fi

exit $SHEXLI_EXIT_CODE
