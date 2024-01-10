#!/bin/bash
clear

# Check if schemas are compiled
if [ ! -f ./schemas/gschemas.compiled ]; then
    command -v glib-compile-schemas >/dev/null 2>&1 || { echo >&2 "glib-compile-schemas is required but it's not installed. Aborting."; exit 1; }
    
    echo "Compiling schemas..."
    glib-compile-schemas ./schemas
fi

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
    exit 1
fi

# Install the extension
gnome-extensions install --force ./monitor@astraext.github.io.shell-extension.zip

# Check for errors
if [ $? -ne 0 ]; then
    echo "Failed to install the extension"
    exit 1
fi

# Check if Xephyr on display :2 is already running
if ! ps ax | grep -v grep | grep "Xephyr.*:2" > /dev/null; then
    echo "Starting Xephyr on display :2"
    screen -dmS xephyr_session Xephyr -ac -br -noreset -screen 1280x1024 :2
    sleep 2  # Give Xephyr time to start
else
    echo "Xephyr on display :2 is already running"
fi

# Function to kill the process when exiting
cleanup() {
    echo "Terminating gnome-shell..."
    kill -SIGTERM $GNOME_SHELL_PID
    wait $GNOME_SHELL_PID 2>/dev/null
}

# Start gnome-shell and get its PID
export GI_TYPELIB_PATH=/nix/store/311jq5bizzzj1yk2k7smb7j6lxc9qbin-libgtop-2.41.1/lib/girepository-1.0
DISPLAY=:2 gnome-shell --replace --x11 --mode=minimal 2>&1 &
GNOME_SHELL_PID=$!
echo "Started gnome-shell with PID $GNOME_SHELL_PID"

# Trap bash script exits, and call cleanup function
trap cleanup EXIT INT

# Wait for gnome-shell process to end
wait $GNOME_SHELL_PID
