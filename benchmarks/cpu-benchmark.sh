#!/bin/bash

# Configuration variables
DELAY=5
MEASUREMENTS=10
TIME=60

# Function to log messages
log_message() {
    echo "[`date +"%Y-%m-%d %H:%M:%S"`] $1" >&2
}

# Required packages
required_packages=("bc" "grep" "awk")

# Check if all required packages are installed
for pkg in "${required_packages[@]}"; do
    if ! command -v $pkg &> /dev/null; then
        log_message "Error: Required package '$pkg' is not installed. Please install it to continue."
        exit 1
    fi
done

# Extensions to test
#"monitor@astraext.github.io" "Vitals@CoreCoding.com" "tophat@fflewddur.github.io" "system-monitor-next@paradoxxx.zero.gmail.com" "System_Monitor@bghome.gmail.com" "Resource_Monitor@Ory0n"
extensions=("monitor@astraext.github.io")

# Store versions for each extension
declare -A extension_versions

# Store CPU times for each extension
declare -A extension_cpu_times

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

get_cpu_time() {
    local pid=$1
    local hz=$(getconf CLK_TCK) # System clock ticks per second
    local cpu_time_jiffies=$(awk '{print ($14 + $15)}' /proc/$pid/stat)
    echo $((cpu_time_jiffies * 1000 / hz)) # Convert jiffies to milliseconds
}

# Measure baseline CPU time with no extensions enabled
measure_baseline() {
    log_message "Measuring baseline CPU time..."
    local pid=$1
    local result_var=$2
    local min_cpu_time=999999999 # Initialize with a high value

    for (( i=1; i<=3; i++ )); do
        sleep $DELAY
        log_message "Starting round $i"
        local cpu_time_start=$(get_cpu_time $pid)
        sleep $TIME
        local cpu_time_end=$(get_cpu_time $pid)
        local cpu_time_used=$((cpu_time_end - cpu_time_start))

        if [[ $cpu_time_used -lt $min_cpu_time ]]; then
            min_cpu_time=$cpu_time_used
        fi
    done

    eval $result_var="'$min_cpu_time'"
}

# Function to measure and calculate stats for CPU time used by GNOME Shell
measure_stats() {
    local pid=$1
    local ext=$2
    local round=$3
    local baseline=$4
    local -n cpu_time_used_ref=$5
    
    local cpu_time_start=$(get_cpu_time "$pid")
    sleep "$TIME"
    local cpu_time_end=$(get_cpu_time "$pid")
    cpu_time_used_ref=$((cpu_time_end - cpu_time_start - baseline))
    log_message "$ext, Round $round, CPU time used: ${cpu_time_used_ref} ms"
}

# Function to calculate statistics
calculate_stats() {
    local -a times=("${@:1:$#-4}")
    local -n mean_ref="${@: -4:1}"
    local -n stddev_ref="${@: -3:1}"
    local -n min_ref="${@: -2:1}"
    local -n max_ref="${@: -1:1}"
    
    local sum=0
    local sq_sum=0
    local mean_l=0
    local stddev_l=0
    local min_l=999999999
    local max_l=0
    
    # Ensure times array elements are numeric for bc calculations
    for time in "${times[@]}"; do
        if ! [[ "$time" =~ ^[0-9]+(\.[0-9]+)?$ ]]; then
            log_message "Non-numeric value encountered: $time"
            continue
        fi
        sum=$(echo "$sum + $time" | bc)
        (( $(echo "$time < $min_l" | bc) )) && min_l=$time
        (( $(echo "$time > $max_l" | bc) )) && max_l=$time
    done
    
    local count=${#times[@]}
    if (( count > 0 )); then
        mean_l=$(echo "scale=2; $sum / $count" | bc)
        for time in "${times[@]}"; do
            sq_sum=$(echo "$sq_sum + ($time - $mean_l)^2" | bc)
        done
        stddev_l=$(echo "scale=2; sqrt($sq_sum / $count)" | bc)
    fi
    
    mean_ref=$mean_l
    stddev_ref=$stddev_l
    min_ref=$min_l
    max_ref=$max_l
}

trap cleanup INT ERR

# Disable all extensions and backup their states
disable_all_extensions

# Main GNOME Shell PID
gnome_shell_pid=$(pgrep -f '/bin/gnome-shell$' | head -n 1)
log_message "Main GNOME Shell PID: $gnome_shell_pid"

# Measure baseline CPU time
baseline_cpu_time=0
measure_baseline $gnome_shell_pid baseline_cpu_time
log_message "Baseline CPU Time: $baseline_cpu_time ms"

# Initialize extension_cpu_times array
for ext in "${extensions[@]}"; do
    extension_cpu_times[$ext]=""
done

# Test each extension in rounds
for (( round=1; round<=MEASUREMENTS; round++ )); do
    for ext in "${extensions[@]}"; do
        if [[ -z "${extension_versions[$ext]}" ]]; then
            continue # Skip if version is not set (extension not installed)
        fi
        sleep $DELAY
        
        log_message "Testing $ext in round $round"
        # Enable extension
        gnome-extensions enable "$ext"
        # Measure CPU time
        cpu_time_used=0
        measure_stats "$gnome_shell_pid" "$ext" "$round" "$baseline_cpu_time" "cpu_time_used"
        
        # Append the CPU time to the extension's list
        extension_cpu_times[$ext]+="$cpu_time_used "
        # Disable extension
        gnome-extensions disable "$ext"
    done
done

# After testing, re-enable the originally enabled extensions
reenable_original_extensions

# Calculate and print stats for all extensions
for ext in "${!extension_cpu_times[@]}"; do
    cpu_times=${extension_cpu_times[$ext]}
    # Convert string to array
    read -ra cpu_times_array <<< "$cpu_times"
    
    # Calculate mean, stddev, min, max using cpu_times_array
    mean=0; stddev=0; min=0; max=0
    calculate_stats "${cpu_times_array[@]}" "mean" "stddev" "min" "max"
    
    log_message "Stats for $ext (Version ${extension_versions[$ext]}): Mean=$mean, StdDev=$stddev, Min=$min, Max=$max"
done

exit 0