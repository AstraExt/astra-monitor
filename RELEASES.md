# Astra Monitor 34 - April 1 2025

### New features

-   **Time Traveling**: Introduced revolutionary time manipulation capabilities allowing users to monitor system performance in the past, present, and future simultaneously. Access metrics from yesterday's gaming session or tomorrow's compile job with our quantum-entangled monitoring algorithm. (April Fools!)

### Bug fixes

-   Fixed a memory leak while disabling and re-enabling the extension [[#181](https://github.com/AstraExt/astra-monitor/issues/181)]
-   Implemented significant memory usage optimizations and enhanced resource cleanup when the extension is disabled.

# Astra Monitor 33 - February 22 2025

### Bug fixes

-   Fixed a memory leak on running async commands [[#179](https://github.com/AstraExt/astra-monitor/issues/179)]

# Astra Monitor 32 - February 21 2025

### Experimental Features

-   **New Feature Introduction Process**: From now on, substantial changes will be introduced as experimental features that need to be manually activated. This approach ensures that these new features are not immediately available to everyone, helping to avoid regressions or bugs in environments where stability is crucial.
-   **POSIX Subprocess**: Introduced experimental support for posix_spawn() subprocess management to enhance command execution efficiency and flexibility. This new feature is disabled by default.
-   **Enable via Preferences**: To activate posix_spawn Subprocess functionality, please navigate to the **Preferences > Utility** page and enable it.
-   **Community Testing & Feedback**: We invite the community to help test this experimental feature in the current release and in future updates. Please report any bugs, regressions, or share your suggestions and feedback to help improve the feature.

# Astra Monitor 31 - February 17 2025

### Bug fixes

-   Reverted command spawner due to its potential to cause crashes; this change reintroduces lag in the menus because of a [GLib limitation](https://gitlab.gnome.org/GNOME/glib/-/issues/3229). A new solution is being explored, as preventing crashes remains the top priority.
-   Fixed display counter: now excluding writeback connectors.

# Astra Monitor 30 - February 13 2025

### New features

-   **_Preliminary Multi-GPU Monitoring Support_**: Introduced initial support for monitoring multiple GPUs simultaneously. This feature allows viewing and managing the performance metrics of multiple GPUs within the Astra Monitor interface. While still in its early stages, this functionality aims to provide comprehensive insights into multi-GPU setups, enhancing the monitoring capabilities for those with complex hardware configurations. Feedback is welcome to help refine and improve this feature.

    _Note: This development paves the way for integrated GPU support and will eventually allow the system to automatically check and select the active GPU. Currently, it is necessary to manually set the main GPU, but this process will possibly be automated in future updates._

-   **_Display Output and Display Info_**: Added support for display output and detailed display information. This enhancement allows detailed display parameters to be viewed directly from the Astra Monitor interface, streamlining the management and troubleshooting of connected monitors. While only a subset of the parsed EDID data is utilized at present, this lays the groundwork for incorporating even more in-depth display information in future updates. Your feedback is welcome as we continue to refine this functionality.

![screenshot](https://github.com/user-attachments/assets/fbf2da8e-b967-401a-8c3c-d09e95031806)

### Bug fixes

-   Fixed lag issue while navigating through the menu [[#138](https://github.com/AstraExt/astra-monitor/issues/138)] (related to [GNOME GLib issue #3229](https://gitlab.gnome.org/GNOME/glib/-/issues/3229))
-   `nvidia-smi` parsing performance improved by ~40%
-   Fixed CPU frequency not being correctly displayed [[#155](https://github.com/AstraExt/astra-monitor/issues/155)] [[#168](https://github.com/AstraExt/astra-monitor/issues/168)]
-   Fixed GPU detection on some GPUs [[#162](https://github.com/AstraExt/astra-monitor/issues/162)]
-   Fixed GPU model name not being correctly displayed [[#152](https://github.com/AstraExt/astra-monitor/issues/152)]
-   Improved NVIDIA `nvidia-smi` parsing for better sensors monitoring

# Astra Monitor 29 - October 2 2024

### New features

-   **_Processor Header Frequency_**: Added the ability to display the CPU frequency in the top bar. You can choose to show either the average or the maximum frequency of your CPU cores. [[#122](https://github.com/AstraExt/astra-monitor/issues/122)]

### Bug fixes

-   Significantly improved menu opening times through a complex performance overhaul. This enhancement may lead to potential regressions in some features, so please report any bugs you encounter. [[#138](https://github.com/AstraExt/astra-monitor/issues/138)]
-   Fixed NVIDIA GPU monitoring to support scenarios with a single top process in the list [[#150](https://github.com/AstraExt/astra-monitor/issues/150)]
-   Temporary, but effective, fix for the bars overflowing from their container when there's a fullscreen window [[#127](https://github.com/AstraExt/astra-monitor/issues/127)]
-   Addressed a layout issue in horizontal sensors header where sudden changes in one of the sensors values length could disrupt the overall arrangement [[#111](https://github.com/AstraExt/astra-monitor/issues/111)]
-   Resolved an issue where `iotop` was not accurately identifying process names when both SWAPIN and IO% information were present
-   Improved CPU info popup layout for smaller screens and fixed an issue where some lines were skipped on larger screens [[#121](https://github.com/AstraExt/astra-monitor/issues/121)]
-   Fixed layout issues in the main disk preference when disks had long names [[#126](https://github.com/AstraExt/astra-monitor/issues/126)]

# Astra Monitor 28 - September 27 2024

### Bug fixes

-   Resolved an issue with NVIDIA GPU monitoring where PCI matching failed due to case sensitivity [[#149](https://github.com/AstraExt/astra-monitor/issues/149)]

### Development and Maintenance

-   Enhanced debugging capabilities for improved error identification and issue resolution
-   Updated TypeScript dependencies to the latest GIR versions

# Astra Monitor 27 - September 25 2024

### New features

-   **_I/O Monitoring for Root Processes_**: A new feature has been added to monitor disk I/O activity of root processes. You can now click on the storage top processes header to view root processes with the highest I/O activity for a 60-second window. This feature addresses the security limitations in Linux that restrict access to precise I/O data for root processes. To use this functionality, user permission is required to access the privileged `iotop` utility, which is now a new _(optional)_ dependency for the extension.

![gif](https://github.com/user-attachments/assets/46e7be77-23af-498f-9f30-d9e0eb5c73c0)

-   **_Network Top Processes_**: Introduced the ability to monitor network I/O activity of individual processes. This feature relies on `nethogs`, a new optional dependency for the extension. Due to `nethogs` requiring root access, it can be utilized in two ways:

    1. On-demand: Click the network top processes header to grant permission and start `nethogs` with elevated privileges for about 60 seconds.
    2. Always-on: Grant `nethogs` the necessary capabilities (`cap_net_admin` and `cap_net_raw=ep`) to run as a privileged service. The extension will automatically detect and use it in this configuration.

    _Check the [documentation](https://github.com/AstraExt/astra-monitor/blob/main/README.md#nethogs) for more details._

![nethogs](https://github.com/user-attachments/assets/388dc409-c60d-4b92-9b0e-6a112c9d13d0)

-   **_Sensors Ignore Regex_**: Now you can use regular expressions to ignore specific sensors based on their name, category, or attribute. This feature allows for more granular control over which sensor data is displayed:

    -   Sensor Name: Exclude an entire sensor (the one you see in the sensors menu).
    -   Category: Exclude entire groups of sensors (e.g., "Package", "Core", "Edge").
    -   Attribute: Exclude specific attributes (e.g., Min, Max, Crit, Alarm).

    This powerful filtering mechanism enables users to customize their sensor display, focusing on the most relevant information while reducing clutter from unwanted sensor data.

![sensors ignore](https://github.com/user-attachments/assets/330e7cef-ef5f-4c25-b04a-b064c69195ad)

### Bug fixes

-   Resolved an issue where `nvidia-smi` was causing an exception, preventing the UI from updating correctly [[#131](https://github.com/AstraExt/astra-monitor/issues/131)]
-   Addressed `amdgpu_top` v0.8.5 data structure change, now top processes are correctly displayed
-   Fixed a bug that prevented Storage Devices from being un-ignored

# Astra Monitor 26 - September 16 2024

### New features

-   GNOME 47 support [[#143](https://github.com/AstraExt/astra-monitor/issues/143)]

### Bug fixes

-   Fix GNOME System Monitor icon missing for GNOME 46 and later [[#128](https://github.com/AstraExt/astra-monitor/issues/128)]
-   Fix lm-sensors output bug (trailing commas) [[#133](https://github.com/AstraExt/astra-monitor/issues/133)]
-   Overall Performance improvements
-   Enable 3rd column in sensors list and fix a graphical bug
-   Improved CPU & GPU model name shortening [[#140](https://github.com/AstraExt/astra-monitor/issues/140)]

# Astra Monitor 25 - May 8 2024

### New features

![Profiles](https://github.com/AstraExt/astra-monitor/assets/11982322/68d40115-2a4d-4331-9296-c55b9cc5edf8)

-   **_Profiles_**: Astra Monitor now gains a **Profiles** feature. This new feature is designed to allow you to save and load different configurations of the extension. You can create as many profiles as you want and switch between them very easily. Right-clicking on an header, including the compact mode arrow, you can open the profiles menu and switch to another profile. You can also click on `Profiles` in the context menu to open the Profiles Settings page to create a new profile, clone the current one, rename it or delete it. We hope you enjoy this new feature and we are looking forward to your feedback.
    \
    ⚠️ **WARNING** ⚠️ **_`Profiles` is a very experimental feature and it may have some bugs or break your configuration. Please export all your settings before experimenting with it._**
    You will always be able to recover your full settings if you exported them before starting to experment with Profiles.

### Bug fixes

-   Fix edge case of multiline font size calculation for headers on HIDPI displays [[#109](https://github.com/AstraExt/astra-monitor/issues/109)][[#112](https://github.com/AstraExt/astra-monitor/issues/112)][[#114](https://github.com/AstraExt/astra-monitor/issues/114)]
-   Icon was missing for sensors header in the default settings
-   Missing file in hwmon monitoring could result in sensor listing returning an empty list.
-   Fixed an exception where no network interface is available

# Astra Monitor 24 - April 25 2024

### New features

-   **_Compact Mode_**: Astra Monitor now gains a **Compact Mode**. This new mode is designed to have a minimalistic footprint on your GNOME panel, until you decide to interact with it. If enabled you will see only an arrow icon on the panel. Hovering over it will reveal the full array of monitors you setup up. They will disappear when you move your mouse away. You can toggle to _"permanently"_ show the monitors by clicking on the arrow. Once you are done, you can click on the arrow again to hide them. Like the other features this is very customizable and you can choose a full array of options to make it fit your needs.
    \
    \
    You may find the new **Compact Mode** in the **Visualization** section of the **Preferences** panel. We hope you enjoy this new feature and we are looking forward to your feedback.

# Astra Monitor 23 - April 24 2024

### New features

-   **_New Preferences Panel_**: In response to the need for more space to accommodate additional sections in our preferences panel, and the burgeoning size of the prefs.js file, which had grown to over 3,500 lines, we have taken the opportunity to reorganize both the code and the user interface of our settings. The new preferences panel now mirrors the layout of the system settings panel, enhancing usability and scalability. It is designed to easily integrate numerous additional sections, paving the way for the swift incorporation of future features
    \
    \
    This is an ongoing process and the panel is not yet in its final form; it may undergo significant changes in the upcoming updates. We highly welcome and value your feedback.

# Astra Monitor 22 - April 23 2024

### Breaking changes

-   <ins>**Headers Height** functionality has been changed</ins>. Prior to this release, the default height was 28px and you could change it to fit your needs. Now it will defaults to disabled and the extension will try to accomodate the height of the panel. You still can override the value to be whatever you want in the settings. Upon update we automatically move your previous value to the new setting and disable it if it was set to 28px. **<ins>We still suggest you to check the value and eventually reset it to 0 it's not already</ins>, to check if the new behavior fits your needs**. [[#114](https://github.com/AstraExt/astra-monitor/issues/114)]

### Bug fixes

-   Fixed gpu monitoring not working on some AMD gpus [[#116](https://github.com/AstraExt/astra-monitor/issues/116)]
-   Arrow colors in Storage Top Processes popup wasn't following menu's color settings [[#115](https://github.com/AstraExt/astra-monitor/issues/115)]
-   Now Headers Font Size override apply to multiple lines values too

# Astra Monitor 21 - April 19 2024

### Bug fixes

-   Fixed visual bug for system with `scale-monitor-framebuffer` feature disabled [[#110](https://github.com/AstraExt/astra-monitor/issues/110)]

-   Fixed GPU monitoring starting even when the GPU menu is disabled

# Astra Monitor 20 - April 17 2024

### Advanced GPU Monitoring

As per our [Roadmap](https://github.com/AstraExt/astra-monitor/blob/main/ROADMAP.md), in this release we are focusing on improving the GPU monitoring capabilities of Astra Monitor.

The new GPU monitoring is experimental right now and may cause some issues. You can disable it setting the **Main GPU** to `None` in the Preferences window.

Both AMD and NVIDIA GPUs are supported, but AMD support might be more accurate and complete because it's been tested more extensively. Intel GPUs are not supported yet for a lack of hardware to test on, but they will be in the future.

Here's a list of the new features and improvements:

-   **GPU Headers**: also GPUs can now have their dedicated headers and be visible in the top bar with a lot options to customize them. By default this is disabled and you can see the GPU info in the CPU Menu. However, you can enable it from the Preferences window. Beware that enabling this feature can lead to a slight increase of CPU usage because GPU data will be queried continuously.

-   **GPU Info**: hovering a the GPU name in the menu will show more info about it.

-   **GPU Activities**: when you pass your mouse over the GPU bar in the menu you are able to monitor a lot of GPU usage details.

-   **GPU VRAM**: also VRAM usage have its dedicated popup menu with a in-depth view of the VRAM usage.

-   **GPU Top Processes**: there is a list of the top processes using the GPU in the GPU Section (3 elements in the CPU menu, 5 in the GPU menu). As before, the popup menu will show more details about the processes.

-   **GPU Sensors**: a dedicated sensor section is available in the GPU section (1 element in the CPU menu, 3 in the GPU menu). To see all the sensors you can open the popup menu. Soon these sensors will be available in the sensors menu too.

-   **Tooltips**: like the other monitors, you can customize the tooltip for the GPU headers.

_Since this is a major change, we recommend you to test and report any issues you may encounter._

### New features

-   Improved UI performance at the expense of data responsiveness: you might see outdated or empty data for a few milliseconds when opening menus. Soon this will become a choice in preferences. [[#102](https://github.com/AstraExt/astra-monitor/issues/102)]

### Bug fixes

-   Improved IPs refreshing in Network Menu: now it refreshes on menu open if it's not been queried recently and you can trigger a refresh by clicking on it [[#108](https://github.com/AstraExt/astra-monitor/issues/108)]
-   Fixed title label not being centered in storage info popup [[#107](https://github.com/AstraExt/astra-monitor/issues/107)]
-   Allow bars to be empty when the value is zero
-   Fixed graph clipping not properly clipping rounded corners
-   Fixed Cpu Cores Bars occasionally exceeding borders on popup open
-   Importing settings saved from a future version to a past version caused the settings to be just reset, now all settings are properly imported from V20 onwards

# Astra Monitor 19 - April 8 2024

### Bug fixes

-   Fixed a graphical bug with multiline font size calculation [[#97](https://github.com/AstraExt/astra-monitor/issues/97)]

# Astra Monitor 18 - April 6 2024

### Advanced Storage Monitoring

As per our [Roadmap](https://github.com/AstraExt/astra-monitor?tab=readme-ov-file#roadmap), in this release we are focusing on improving the Storage monitoring capabilities of Astra Monitor. Here's a list of the new features and improvements:

-   **Storage Devices Info**: now you can see a lot more information about your storage devices in the Storage Menu.

-   **Cumulative Read/Write Bytes**: now you can see the total read/write bytes since the last boot in the Storage Menu for each storage device and globally.

-   **Top Processes Details**: now you can see more details about the top processes in the Storage Menu.

### New features

-   Added layout settings for all multiline headers like Storage IO Speed, Network IO Speed and Sensors: now you can choose either to show them in a single line or in multiple lines [[#82](https://github.com/AstraExt/astra-monitor/issues/82)]
-   Added a setting to hint **Astra Monitor** on the position of the topbar/dash/panel to improve menu anchor points [[#96](https://github.com/AstraExt/astra-monitor/issues/96)]
-   Added an option to replace '-' with 0 [[#85](https://github.com/AstraExt/astra-monitor/issues/85)]

### Bug fixes

-   Greatly improved multiline text rendering in the Top Bar Headers [[#30](https://github.com/AstraExt/astra-monitor/issues/30)] [[#93](https://github.com/AstraExt/astra-monitor/issues/93)]
-   Improved topbar header rendering: as a result of that _Header Margin_ is now deprecated and not needed anymore, the header should always be perfectly aligned with the topbar
-   Fixed long device name in the Storage Menu leading to a misalignment of other elements
-   Reset button in dropdown menus of settings was reloading last saved value, now works as intended resetting to default value

# Astra Monitor 17 - March 27 2024

### Bug fixes

-   Fixed an important bug that prevented the extension to start with a GPU selected before v10 [[#94](https://github.com/AstraExt/astra-monitor/issues/94)]
-   Improved Popup Menu opening side: now they should always properly open on the right side when the extension is on the left side of the top bar _(Requires the extension to be restarted if the panel box position has been changed in the current sesssion)_ [[#92](https://github.com/AstraExt/astra-monitor/issues/92)]

# Astra Monitor 16 - March 26 2024

### Advanced Network Monitoring

As per our [Roadmap](https://github.com/AstraExt/astra-monitor?tab=readme-ov-file#roadmap), in this release we are focusing on improving the Network monitoring capabilities of Astra Monitor. Here's a list of the new features and improvements:

-   **Public IP Address**: now you can see your public IPv4/IPv6 address in the Network Menu. This feature requires a remote API call to get the public IP address. We are using [ipify](https://www.ipify.org/) as the default provider, which is a free and open source service. You can choose a different provider from the settings panel or disable this feature if you don't want to use it. We support every possible provider, included API created by yourself: the ip address will be matched with a regex to extract it from the response.

-   **Default Routes**: you can see default routing informations in the Network Menu.

-   **Device Info**: hovering a network interface will show you a lot more information about it.

-   **Wireless Networks**: the SSID of the connected wireless network is now visible in the Network Menu along with other useful information.

-   **Cumulative Upload/Download Bytes**: now you can see the total upload/download bytes since the last boot in the Network Menu for each network interface and globally.

-   **Packet Upload/Download**: now you can see the total packets uploaded/downloaded since the last boot in the Network Menu for each network interface and globally.

-   **Errors/Dropped Packets**: now you can see the total error/dropped packets since the last boot in the Network Menu for each network interface and globally.

-   **Bridged Network Interfaces**: bridged network interfaces are now visible in the Network Menu.

-   **VPN Network Interfaces**: VPN network interfaces are now marked with a specific icon in the Network Menu.

### Bug fixes

-   Overall performance improvements: Astra Monitor is now faster and more efficient than all system monitor extension I could test it against.<br>_(benchmarks and comparative tests with other popular monitoring extensions can be found [here](https://github.com/AstraExt/astra-monitor/blob/main/COMPARISON.md)!)_
-   Fixed CPU Cores Usage Info user bar invisible when Cores Bar Breakdown is enabled [[#86](https://github.com/AstraExt/astra-monitor/issues/86)]
-   Improved Memory Secondary Color for better readability and value understanding

# Astra Monitor 15 - March 14 2024

### First Beta Release

This marks the first beta release of Astra Monitor. After extensive testing, the extension is nearing stability, but we are open to feedback from the community to address any unresolved issues. Explore our [Roadmap](https://github.com/AstraExt/astra-monitor?tab=readme-ov-file#roadmap) to see what's coming next.

### Bug fixes

-   Overall performance improvements<br>_(benchmarks and comparative tests with other popular monitoring extensions can be found [here](https://github.com/AstraExt/astra-monitor/blob/main/COMPARISON.md)!)_
-   Resolved an issue where updates to hwmon incorrectly triggered lm-sensors queries
-   Addressed a bug causing sensor updates to fail intermittently when lm-sensors was not installed [[#81](https://github.com/AstraExt/astra-monitor/issues/81)]
-   Adjusted the width of the Select Box in Preferences for improved usability [[#80](https://github.com/AstraExt/astra-monitor/issues/80)]
-   Fixed CPU Cores Usage Info not being updated when Cores Bar Breakdown is disabled [[#83](https://github.com/AstraExt/astra-monitor/issues/83)]
-   Improved sensors list with more info and better layout [[#84](https://github.com/AstraExt/astra-monitor/issues/84)]
-   Refined the Export/Import settings feature with a default name, file extension filter and alphabetically ordered exported keys [[#79](https://github.com/AstraExt/astra-monitor/issues/79)]

# Astra Monitor 14 - March 11 2024

### Hwmon

**Hwmon** is a kernel-based subsystem that provides an interface to monitor various hardware sensors and it's the new default source for sensors. This will benefit the extension on many levels: performance, efficiency, reliability, and compatibility.
**lm-sensors** is not a required dependency anymore, but it will remain as an option if you have it installed, even though it's not recommended.

<u>We strongly encourage you to <span>manually move all your sensors to **Hwmon**</span> from the Astra Monitor Settings panel</u>. The sensors list in the menu is already on Hwmon by default, but you can still switch to **lm-sensors** if you want to from the settings panel.

_Since this is a major change, we recommend you to test all your sensors and report any issues you may encounter._

### New features

-   Added a shortcut to set all main and secondary colors all at once [[#74](https://github.com/AstraExt/astra-monitor/issues/74)]
-   You can now export, import and reset settings [[#71](https://github.com/AstraExt/astra-monitor/issues/71)]
-   Added load average to the CPU menu [[#73](https://github.com/AstraExt/astra-monitor/issues/73)]
-   Improved UI performance and some async/await calls to increase parallelization of some tasks
-   New icon for frequency sensor

### Bug fixes

-   Fixed a bug where a task could stop updating when a cancel was requested
-   Fixed discrete GPU used as display controller with an iGFX not being detected [[#76](https://github.com/AstraExt/astra-monitor/issues/76)]

# Astra Monitor 13 - February 28 2024

### New features

-   Add memory data unit customization (default is kB as kibibyte as standard) [[#67](https://github.com/AstraExt/astra-monitor/issues/67)]
-   All colors for bars, graphs and other elements are now fully customizable [[#58](https://github.com/AstraExt/astra-monitor/issues/58)]
-   Tooltip Customization: now you can choose what to show in the tooltip for each header [[#60](https://github.com/AstraExt/astra-monitor/issues/60)]
-   Sensors Tooltip: now you can choose up to 5 sensors to show in the sensor tooltip with an optional custom name each

### Bug fixes

-   Fixed bytes being incorrectly calculated in some cases
-   Fixed prefs indentation and alignment [[#68](https://github.com/AstraExt/astra-monitor/issues/68)]

# Astra Monitor 12 - February 18 2024

### New features

-   'Default' option for _data source_ removal: now all _data sources_ are set at 'Auto' by default. We reccomend to leave them at 'Auto' unless you have a specific need: the best source will automatically be chosen based on the availability of dependencies, performance and reliability
-   In source selection now you better understand what /proc source is used: ie. `/proc/stat` instead of just `/proc`
-   GTop source has been added to the list of sources for Memory Usage, Storage Usage and Network IO (GTop is the default option for all of them if available)
-   New indicator for Memory Header: Free Value in Bytes + Icon Alert [[#61](https://github.com/AstraExt/astra-monitor/issues/61)]
-   New indicator for Storage Header: Main Disk Usage and Free Value in Bytes + Icon Alert [[#61](https://github.com/AstraExt/astra-monitor/issues/61)]
-   Add setting to adjust the startup delay in case of formatting glitches at boot [[#30](https://github.com/AstraExt/astra-monitor/issues/30)]

### Bug fixes

-   Light Theme readability improvements [[#53](https://github.com/AstraExt/astra-monitor/issues/53)]
-   Fixed GTop detection label not updating in extension settings
-   Preference panel proper indentation and alignment and '⁝' removal [[#56](https://github.com/AstraExt/astra-monitor/issues/56)]
-   Graph rendering has been improved fixing a potential misaligned baseline

# Astra Monitor 11 - February 12 2024

### Bug fixes

-   Fixed Graphs not updating [[#54](https://github.com/AstraExt/astra-monitor/issues/54)]

# Astra Monitor 10 - February 9 2024

### TYPESCRIPT

-   The extension has been ported to Typescript. This transition enables the writing of better code and fosters a more stable codebase. It also lowers the barrier for new contributors to join the project. This is a major change, so, although thorough testing has been conducted, there are likely still some bugs to address. This significant update marks a milestone, and the assistance in identifying any bugs is greatly appreciated. Reporting discovered issues will be invaluable in enhancing the project. Thank you in advance for your valuable contributions and support.

### New features

-   Initial AMD GPU monitoring support through `amdgpu_top`
-   Initial NVIDIA GPU monitoring support through `nvidia-smi`
-   Storage Devices can be ignored selectively or with a regex (just like Network Interfaces) [[#45](https://github.com/AstraExt/astra-monitor/issues/45)]
-   New experimental feature to add a left/right margin to the headers panel [[#49](https://github.com/AstraExt/astra-monitor/issues/49)]
-   New source selection for Cpu Usage and Cores Usage: now you can choose between GTop and /proc (GTop is the default if available)

### Bug fixes

-   Fixed a bug where an header bar could be rendered heigher than expected when a fullscreen app is opened [[#50](https://github.com/AstraExt/astra-monitor/issues/50)]

# Astra Monitor 9 - January 28 2024

### New features

-   Optionally choose the number of digits for sensors header values [[#41](https://github.com/AstraExt/astra-monitor/issues/41)]

### Bug fixes

-   Fixed graph and layout rendering in Gnome 46 alpha [[#40](https://github.com/AstraExt/astra-monitor/issues/40)]
-   Fixed labels rendering for Dash To Panel and narrow panels [[#30](https://github.com/AstraExt/astra-monitor/issues/30)] [[#42](https://github.com/AstraExt/astra-monitor/issues/42)]
-   Fixed sensors list column split when the list is too long [[#43](https://github.com/AstraExt/astra-monitor/issues/43)]

# Astra Monitor 8 - January 25 2024

### New features

-   Top Processes for Storage Menu is now available (only for GTop data source)
-   GTop support as _data source_ for Top Processes is now available in Memory Menu
-   Indicators ordering on the header is now customizable [[#37](https://github.com/AstraExt/astra-monitor/issues/37)]
-   Support for custom icon Name and Color for each header
-   Support for Icon Alerts: choose what Color the icon should be when an alert is triggered
-   Initial alert support for CPU, Memory and Storage on usage percentage [[#34](https://github.com/AstraExt/astra-monitor/issues/34)]
-   New Indicator for Memory Header: Usage Value in Bytes [[#16](https://github.com/AstraExt/astra-monitor/issues/16)] [[#34](https://github.com/AstraExt/astra-monitor/issues/34)]
-   Initial Gnome 46 support [[#38](https://github.com/AstraExt/astra-monitor/issues/38)]

# Astra Monitor 7 - January 23 2024

### New features

-   GTop support as _data source_ for Top Processes is now available in CPU Menu [[#33](https://github.com/AstraExt/astra-monitor/issues/33)]
-   Auto option for _data source_ (enabled by default) will automatically choose the best source based on the availability of dependencies
-   New option to show cpu percentage on Top Processes list as per-core value [[#33](https://github.com/AstraExt/astra-monitor/issues/33)]
-   Regex Ignore Network Interfaces: now, in addition to manual selection, you can use regex to ignore network interfaces [[#29](https://github.com/AstraExt/astra-monitor/issues/29)]
-   New languages: German and Russian [[#26](https://github.com/AstraExt/astra-monitor/issues/26)] [[#27](https://github.com/AstraExt/astra-monitor/issues/27)]

### Bug fixes

-   Top Processes list in Processors Menu is now even more responsive and should be filled faster for both '_GTop_' and '_/proc_' based sources
-   Fixed Memory Header History Graph breakdown [[#32](https://github.com/AstraExt/astra-monitor/issues/32)]

# Astra Monitor 6 - January 19 2024

### New features

-   **_Initial_** implementation of Tooltips for Header's buttons [[#25](https://github.com/AstraExt/astra-monitor/issues/23)]

### Bug fixes

-   Fixed processor settings menu button going to general settings instead of processor settings [[#23](https://github.com/AstraExt/astra-monitor/issues/23)]
-   Improved GPU detection [[#24](https://github.com/AstraExt/astra-monitor/issues/24)]
-   Menu Realtime Bars Breakdown setting now works as intended
-   Introduced a new setting to set Realtime Core Bars Breakdown
-   Vertical Topbar (ie: Dash to Panel) UI improvements but still experimental (no graph/bars support)
-   Fixed regression for Storage Usage bar in the header

# Astra Monitor 5 - January 16 2024

### New features

-   New threshold option for Network and Storage IO Speed: now you can choose a threshold to avoid showing the IO Speed when it's under a certain value [[#19](https://github.com/AstraExt/astra-monitor/issues/19)]
-   New option to ignore network interfaces: now you can choose to selectively ignore specific network interfaces to avoid showing them in the Network Menu and to exclude them from IO Speed calculation [[#20](https://github.com/AstraExt/astra-monitor/issues/20)]
-   Now clicking on the Extension Settings in a specific menu will open the Preferences window with the corresponding tab selected [[#12](https://github.com/AstraExt/astra-monitor/issues/12)]
-   Debug Mode: now you can enable debug mode to see more logs in the console (for future debugging features)
-   Now you can override Header's Font Family and Font Size to suit your personal preferences [[#3](https://github.com/AstraExt/astra-monitor/issues/3)]

### Bug fixes

-   Fixed a bug where the icon and the unit were missing in energy sensor value [[#17](https://github.com/AstraExt/astra-monitor/issues/17)]
-   Top Processes list in Processors Menu is now more responsive and should be filled faster
-   Cpu Info popup now squeeze to fit shorter screens [[#18](https://github.com/AstraExt/astra-monitor/issues/18)]
-   Set a minimum size for the Preferences window to avoid UI elements to be cut off [[#21](https://github.com/AstraExt/astra-monitor/issues/21)]

# Astra Monitor 4 - January 15 2024

### New features

-   New option for Storage Header: an indicator that shows the global read and write speed through a pair of bars [[#14](https://github.com/AstraExt/astra-monitor/issues/14)]
-   Graph Width customization: now you can choose the width of the header graphs individually
-   Storage and Network Header IO Speed Max Number of Figures: now you can choose the maximum number of figures to show in the IO Speed number
-   Header Height and Margis customization: as experimental feature, you can now change the height of the header's button and its margins to better fit your desktop environment's theme [[#7](https://github.com/AstraExt/astra-monitor/issues/7)]
-   Icon size customization: as experimental feature, now you can choose the size of the icons in the header
-   Preference panel reorganized to better fit more options and to organize them in a more logical way

### Bug fixes

-   Fixed a bug where the icon and the unit was missing in current sensor value [[#16](https://github.com/AstraExt/astra-monitor/issues/16)]
-   Fixed a sizing bug when headers have a label that changes often

# Astra Monitor 3 - January 14 2024

### New features

-   Used Memory customization: now you can choose the formula to calculate used memory
-   Swap Memory info expanded with a popup menu to show more details, including swap devices and usage per device
-   Added About page in the Preferences window with version number and useful links [[#8](https://github.com/AstraExt/astra-monitor/issues/8)]
-   Added Data Unit customization for network and storage [[#13](https://github.com/AstraExt/astra-monitor/issues/13)]

### Bug fixes

-   Fixed a bug where the used memory was not being calculated correctly [[#9](https://github.com/AstraExt/astra-monitor/issues/9)] [[#10](https://github.com/AstraExt/astra-monitor/issues/10)]
-   **Swap**-ped from '_free_' to '_/proc/meminfo_' to get swap info. [[#6](https://github.com/AstraExt/astra-monitor/issues/6)]
-   Fixed a bug where the processor name was not being displayed correctly [[#5](https://github.com/AstraExt/astra-monitor/issues/5)]
-   Sensor header should now be more coherent with the rest on the style and width [[#11](https://github.com/AstraExt/astra-monitor/issues/11)]
-   Fixed a graphical bug where the sensor header was not being displayed correctly [[#15](https://github.com/AstraExt/astra-monitor/issues/15)]

# Astra Monitor 2 - January 12 2024

### New features

-   Added an option to change Theme Style (Light/Dark) to better fit your desktop environment's theme

### Bug fixes

-   Sensor header width not consistant [[#1](https://github.com/AstraExt/astra-monitor/issues/1)]
-   Sensor menu not centered
-   Sensor menu missing footer utility buttons [[#4](https://github.com/AstraExt/astra-monitor/issues/4)]
-   Icon madness fixed. Now icons are more unified and support light and dark themes
-   Icons missing on the preferences window [[#2](https://github.com/AstraExt/astra-monitor/issues/2)]

# Astra Monitor 1 - January 10 2024

Public release.
