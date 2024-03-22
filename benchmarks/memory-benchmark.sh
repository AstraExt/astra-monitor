#!/bin/bash

# Configuration variables
DELAY=5
MEASUREMENTS=3
TIME=300

# Function to log messages
log_message() {
    echo "[`date +"%Y-%m-%d %H:%M:%S"`] $1" >&2
}

# Required packages
required_packages=("grep" "awk")

# Check if all required packages are installed
for pkg in "${required_packages[@]}"; do
    if ! command -v $pkg &> /dev/null; then
        log_message "Error: Required package '$pkg' is not installed. Please install it to continue."
        exit 1
    fi
done

# Extensions to test
#"monitor@astraext.github.io" "Vitals@CoreCoding.com" "tophat@fflewddur.github.io" "System_Monitor@bghome.gmail.com" "system-monitor-next@paradoxxx.zero.gmail.com" "Resource_Monitor@Ory0n"
extensions=("monitor@astraext.github.io")

# Store versions for each extension
declare -A extension_versions

# Fetch and store the version for each extension
for ext in "${extensions[@]}"; do
    if gnome-extensions info "$ext" &> /dev/null; then
        extension_versions[$ext]=$(gnome-extensions info "$ext" | grep 'Version' | awk '{print $2}')
    else
        log_message "Warning: Extension $ext is not installed. Skipping..."
        continue
    fi
done

# Backup currently enabled extensions into a variable
enabled_extensions_backup=$(gnome-extensions list --enabled)

# Function to disable all currently enabled extensions
disable_all_extensions() {
    log_message "Disabling all currently enabled extensions..."
    
    for ext in $enabled_extensions_backup; do
        gnome-extensions disable "$ext"
    done
}

# Cleanup function to re-enable original extensions
cleanup() {
    echo "Cleaning up..."
    for ext in "${extensions[@]}"; do
        gnome-extensions disable "$ext"
    done
    reenable_original_extensions
    echo "Original extensions re-enabled."
    exit 1
}

# Re-enable extensions that were originally enabled
reenable_original_extensions() {
    for ext in $enabled_extensions_backup; do
        gnome-extensions enable "$ext"
    done
}

get_memory_usage() {
    local pid=$1
    local mem_usage=$(ps -p $pid -o rss | tail -n 1)
    echo $mem_usage
}

measure_baseline() {
    log_message "Measuring baseline memory usage..."
    local pid=$1
    local result_var=$2
    
    local baseline_mem_usage=$(get_memory_usage $pid)
    eval $result_var="'$baseline_mem_usage'"
}

measure_stats() {
    local pid=$1
    local ext=$2
    local round=$3
    local baseline=$4
    local -n mem_usage_ref=$5
    
    sleep "$TIME"
    
    local mem=$(get_memory_usage "$pid")
    mem_usage_ref=$((mem - baseline))
    log_message "$ext, Round $round, mem usage: ${mem_usage_ref}"
}

trap cleanup INT ERR

# Disable all extensions and backup their states
disable_all_extensions

# Main GNOME Shell PID
gnome_shell_pid=$(pgrep -f '/bin/gnome-shell$' | head -n 1)
log_message "Main GNOME Shell PID: $gnome_shell_pid"

for ext in "${extensions[@]}"; do
    if [[ -z "${extension_versions[$ext]}" ]]; then
        continue # Skip if version is not set (extension not installed)
    fi
    
    # Give some time to garbage collect and free up
    log_message "Waiting for GNOME Shell to free up memory..."
    sleep 60

    # Measure baseline
    baseline_memory_usage=0
    measure_baseline $gnome_shell_pid baseline_memory_usage
    log_message "Baseline Memory Usage: $baseline_memory_usage"

    mem_usage=0
    
    for (( round=1; round<=MEASUREMENTS; round++ )); do
        sleep $DELAY
        
        log_message "Testing $ext in round $round"
        # Enable extension
        gnome-extensions enable "$ext"
        # Measure Memory usage
        measure_stats "$gnome_shell_pid" "$ext" "$round" "$baseline_memory_usage" "mem_usage"
        
        # Disable extension
        gnome-extensions disable "$ext"
    done
    
    log_message "Stats for $ext (Version ${extension_versions[$ext]}): Mem Usage=$mem_usage"
done

exit 0