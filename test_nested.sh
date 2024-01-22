#!/bin/bash
clear

EXTENSION_NAME="monitor@astraext.github.io"
XEPHYR_DISPLAY=":2"
RESOLUTION=1867x1050 # this fits my 4th monitor perfectly, change it to your needs

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
gnome-extensions install --force "./$EXTENSION_NAME.shell-extension.zip"

# Check if Xephyr on display :2 is already running
if ! ps ax | grep -v grep | grep "Xephyr.*$XEPHYR_DISPLAY" > /dev/null; then
    echo "Starting Xephyr on display $XEPHYR_DISPLAY"
    screen -dmS xephyr_session Xephyr -ac -br -noreset -screen $RESOLUTION $XEPHYR_DISPLAY
    sleep 1  # Give Xephyr time to start
else
    echo "Xephyr on display $XEPHYR_DISPLAY is already running"
fi

# Enable the extension
echo "Enabling the extension..."
extension_status=$(gnome-extensions info "$EXTENSION_NAME" | grep -i "state:")
if [[ $extension_status == *"DISABLED"* ]]; then
    gnome-extensions enable "$EXTENSION_NAME"
fi

#export G_MESSAGES_DEBUG=all
export SHELL_DEBUG=all

export MUTTER_DEBUG_DUMMY_MODE_SPECS=$RESOLUTION
export XDG_SESSION_TYPE=wayland
export XDG_CURRENT_DESKTOP=GNOME-Shell
export XDG_SESSION_DESKTOP=GNOME-Shell
export XDG_SESSION_CLASS=user

export DISPLAY=$XEPHYR_DISPLAY
export WAYLAND_DISPLAY=wayland-1

# Start DBus session and capture its PID
export DBUS_SESSION_BUS_ADDRESS=$(dbus-daemon --session --fork --print-address)
export DBUS_SESSION_BUS_PID=$!
export ASTRA_MONITOR_NESTED_SESSION=1

# Check if the system is NixOS
if [ -f /etc/NIXOS ]; then
    echo "This is NixOS"
    
    # NOTE: This is for testing purpose only, on my personal machine
    #       Should be handled properly, but I don't have time for that now
    # Export GI_TYPELIB_PATH
    export GI_TYPELIB_PATH=/nix/store/311jq5bizzzj1yk2k7smb7j6lxc9qbin-libgtop-2.41.1/lib/girepository-1.0
else
    echo "This is not NixOS"
fi

dbus-run-session -- gnome-shell --nested --wayland --mode=minimal &
sleep 1

cleanup() {
    echo "Terminating gnome-shell..."
    pkill -f "gnome-shell --nested --wayland --mode=minimal"
    sleep 0.5
    wait $(pgrep -f "gnome-shell --nested --wayland --mode=minimal")
    sleep 0.5

    # Kill the DBus session
    if [ -n "$DBUS_SESSION_BUS_PID" ]; then
        kill $DBUS_SESSION_BUS_PID
    fi
}

trap cleanup EXIT INT TERM

wait $(pgrep -f "gnome-shell --nested --wayland --mode=minimal")

sleep 0.5
rm "./$EXTENSION_NAME.shell-extension.zip"
sleep 0.5
exit 0
