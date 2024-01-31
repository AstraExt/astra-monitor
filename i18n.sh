#!/bin/bash

# Function to log messages
log_message() {
    echo "[`date +"%Y-%m-%d %H:%M:%S"`] $1"
}

# Set the directory of the script as the working directory
EXTENSION_DIR=$(dirname "$(realpath "$0")")
cd "$EXTENSION_DIR" || { log_message "Error: Failed to change directory to $EXTENSION_DIR"; exit 1; }

# Create the po directory if it doesn't exist
mkdir -p po

# Extract the package version from metadata.json
if [ ! -f metadata.json ]; then
    log_message "Error: metadata.json not found"
    exit 1
fi

PACKAGE_VERSION=$(jq -r '.version' metadata.json)
PACKAGE_NAME=$(jq -r '.name' metadata.json)

if [ -z "$PACKAGE_VERSION" ]; then
    log_message "Error: Unable to extract package version from metadata.json"
    exit 1
fi

log_message "Package version: $PACKAGE_VERSION"

# Check if tsc is installed
command -v tsc >/dev/null 2>&1 || { log_message "Error: tsc is required but it's not installed. Aborting."; exit 1; }

# Compile TypeScript
log_message "Building typescript files..."
tsc

# Check for errors
if [ $? -ne 0 ]; then
    echo "Failed to compile TypeScript"
    exit 1
fi

# Check if there is a build directory
if [ ! -d build ]; then
    log_message "Error: build directory not found"
    exit 1
fi

# enter build directory
cd build || { log_message "Error: Failed to change directory to build"; exit 1; }

# Generate pot file from .js files, excluding node_modules directory
log_message "Generating POT file..."
JS_FILES=$(find . -name '*.js' -type f)
xgettext --language=JavaScript --from-code=UTF-8 --package-name="$PACKAGE_NAME" --package-version="$PACKAGE_VERSION" --copyright-holder="Lju" --output=../po/monitor@astraext.pot $JS_FILES
if [ $? -ne 0 ]; then
    log_message "Error: Failed to generate POT file"
    exit 1
fi
log_message "POT file generated successfully"

cd - || { log_message "Error: Failed to change directory to $EXTENSION_DIR"; exit 1; }

# Remove duplicate entries from the pot file
msguniq po/monitor@astraext.pot -o po/monitor@astraext.pot

# Replace charset in the pot file
sed -i 's/charset=CHARSET/charset=UTF-8/'

# Replace plural forms in the pot file
sed -i 's/nplurals=INTEGER/nplurals=2/'
sed -i 's/plural=EXPRESSION/plural=(n != 1)/'

# Replace language in the pot file
sed -i 's/Language: /Language: en_US/'

# Update all .po files with the new .pot file
log_message "Updating PO files..."
for po_file in po/*.po; do
    if [ -f "$po_file" ]; then
        msgmerge -U "$po_file" po/monitor@astraext.pot
        if [ $? -eq 0 ]; then
            log_message "Updated $po_file"
        else
            log_message "Error: Failed to update $po_file"
        fi
    else
        log_message "Warning: No PO file found at $po_file"
    fi
done
log_message "PO file updates completed"

log_message "Script completed"

exit 0