# Astra Monitor 13 - February 28 2024

### New features
- Add memory data unit customization (default is kB as kibibyte as standard) [[#67](https://github.com/AstraExt/astra-monitor/issues/67)]
- All colors for bars, graphs and other elements are now fully customizable [[#58](https://github.com/AstraExt/astra-monitor/issues/58)]
- Tooltip Customization: now you can choose what to show in the tooltip for each header [[#60](https://github.com/AstraExt/astra-monitor/issues/60)]
- Sensors Tooltip: now you can choose up to 5 sensors to show in the sensor tooltip with an optional custom name each

### Bug fixes
- Fixed bytes being incorrectly calculated in some cases
- Fixed prefs indentation and alignment [[#68](https://github.com/AstraExt/astra-monitor/issues/68)]

# Astra Monitor 12 - February 18 2024

### New features
- 'Default' option for _data source_ removal: now all _data sources_ are set at 'Auto' by default. We reccomend to leave them at 'Auto' unless you have a specific need: the best source will automatically be chosen based on the availability of dependencies, performance and reliability
- In source selection now you better understand what /proc source is used: ie. `/proc/stat` instead of just `/proc`
- GTop source has been added to the list of sources for Memory Usage, Storage Usage and Network IO (GTop is the default option for all of them if available)
- New indicator for Memory Header: Free Value in Bytes + Icon Alert [[#61](https://github.com/AstraExt/astra-monitor/issues/61)]
- New indicator for Storage Header: Main Disk Usage and Free Value in Bytes + Icon Alert [[#61](https://github.com/AstraExt/astra-monitor/issues/61)]
- Add setting to adjust the startup delay in case of formatting glitches at boot [[#30](https://github.com/AstraExt/astra-monitor/issues/30)]

### Bug fixes
- Light Theme readability improvements [[#53](https://github.com/AstraExt/astra-monitor/issues/53)]
- Fixed GTop detection label not updating in extension settings
- Preference panel proper indentation and alignment and '⁝' removal [[#56](https://github.com/AstraExt/astra-monitor/issues/56)]
- Graph rendering has been improved fixing a potential misaligned baseline

# Astra Monitor 11 - February 12 2024

### Bug fixes
- Fixed Graphs not updating [[#54](https://github.com/AstraExt/astra-monitor/issues/54)]

# Astra Monitor 10 - February 9 2024

### TYPESCRIPT
- The extension has been ported to Typescript. This transition enables the writing of better code and fosters a more stable codebase. It also lowers the barrier for new contributors to join the project. This is a major change, so, although thorough testing has been conducted, there are likely still some bugs to address. This significant update marks a milestone, and the assistance in identifying any bugs is greatly appreciated. Reporting discovered issues will be invaluable in enhancing the project. Thank you in advance for your valuable contributions and support.

### New features
- Initial AMD GPU monitoring support through `amdgpu_top`
- Initial NVIDIA GPU monitoring support through `nvidia-smi`
- Storage Devices can be ignored selectively or with a regex (just like Network Interfaces) [[#45](https://github.com/AstraExt/astra-monitor/issues/45)]
- New experimental feature to add a left/right margin to the headers panel [[#49](https://github.com/AstraExt/astra-monitor/issues/49)]
- New source selection for Cpu Usage and Cores Usage: now you can choose between GTop and /proc (GTop is the default if available)

### Bug fixes
- Fixed a bug where an header bar could be rendered heigher than expected when a fullscreen app is opened [[#50](https://github.com/AstraExt/astra-monitor/issues/50)]

# Astra Monitor 9 - January 28 2024

### New features
- Optionally choose the number of digits for sensors header values [[#41](https://github.com/AstraExt/astra-monitor/issues/41)]

### Bug fixes
- Fixed graph and layout rendering in Gnome 46 alpha [[#40](https://github.com/AstraExt/astra-monitor/issues/40)]
- Fixed labels rendering for Dash To Panel and narrow panels [[#30](https://github.com/AstraExt/astra-monitor/issues/30)] [[#42](https://github.com/AstraExt/astra-monitor/issues/42)]
- Fixed sensors list column split when the list is too long [[#43](https://github.com/AstraExt/astra-monitor/issues/43)]

# Astra Monitor 8 - January 25 2024

### New features
- Top Processes for Storage Menu is now available (only for GTop data source)
- GTop support as _data source_ for Top Processes is now available in Memory Menu
- Indicators ordering on the header is now customizable [[#37](https://github.com/AstraExt/astra-monitor/issues/37)]
- Support for custom icon Name and Color for each header
- Support for Icon Alerts: choose what Color the icon should be when an alert is triggered
- Initial alert support for CPU, Memory and Storage on usage percentage [[#34](https://github.com/AstraExt/astra-monitor/issues/34)]
- New Indicator for Memory Header: Usage Value in Bytes [[#16](https://github.com/AstraExt/astra-monitor/issues/16)] [[#34](https://github.com/AstraExt/astra-monitor/issues/34)]
- Initial Gnome 46 support [[#38](https://github.com/AstraExt/astra-monitor/issues/38)]

# Astra Monitor 7 - January 23 2024

### New features
- GTop support as _data source_ for Top Processes is now available in CPU Menu [[#33](https://github.com/AstraExt/astra-monitor/issues/33)]
- Auto option for _data source_ (enabled by default) will automatically choose the best source based on the availability of dependencies
- New option to show cpu percentage on Top Processes list as per-core value [[#33](https://github.com/AstraExt/astra-monitor/issues/33)]
- Regex Ignore Network Interfaces: now, in addition to manual selection, you can use regex to ignore network interfaces [[#29](https://github.com/AstraExt/astra-monitor/issues/29)]
- New languages: German and Russian [[#26](https://github.com/AstraExt/astra-monitor/issues/26)] [[#27](https://github.com/AstraExt/astra-monitor/issues/27)]

### Bug fixes
- Top Processes list in Processors Menu is now even more responsive and should be filled faster for both '_GTop_' and '_/proc_' based sources
- Fixed Memory Header History Graph breakdown [[#32](https://github.com/AstraExt/astra-monitor/issues/32)]

# Astra Monitor 6 - January 19 2024

### New features
- ___Initial___ implementation of Tooltips for Header's buttons [[#25](https://github.com/AstraExt/astra-monitor/issues/23)]

### Bug fixes
- Fixed processor settings menu button going to general settings instead of processor settings [[#23](https://github.com/AstraExt/astra-monitor/issues/23)]
- Improved GPU detection [[#24](https://github.com/AstraExt/astra-monitor/issues/24)]
- Menu Realtime Bars Breakdown setting now works as intended
- Introduced a new setting to set Realtime Core Bars Breakdown
- Vertical Topbar (ie: Dash to Panel) UI improvements but still experimental (no graph/bars support)
- Fixed regression for Storage Usage bar in the header

# Astra Monitor 5 - January 16 2024

### New features
- New threshold option for Network and Storage IO Speed: now you can choose a threshold to avoid showing the IO Speed when it's under a certain value [[#19](https://github.com/AstraExt/astra-monitor/issues/19)]
- New option to ignore network interfaces: now you can choose to selectively ignore specific network interfaces to avoid showing them in the Network Menu and to exclude them from IO Speed calculation [[#20](https://github.com/AstraExt/astra-monitor/issues/20)]
- Now clicking on the Extension Settings in a specific menu will open the Preferences window with the corresponding tab selected [[#12](https://github.com/AstraExt/astra-monitor/issues/12)]
- Debug Mode: now you can enable debug mode to see more logs in the console (for future debugging features)
- Now you can override Header's Font Family and Font Size to suit your personal preferences [[#3](https://github.com/AstraExt/astra-monitor/issues/3)]

### Bug fixes
- Fixed a bug where the icon and the unit were missing in energy sensor value [[#17](https://github.com/AstraExt/astra-monitor/issues/17)]
- Top Processes list in Processors Menu is now more responsive and should be filled faster
- Cpu Info popup now squeeze to fit shorter screens [[#18](https://github.com/AstraExt/astra-monitor/issues/18)]
- Set a minimum size for the Preferences window to avoid UI elements to be cut off [[#21](https://github.com/AstraExt/astra-monitor/issues/21)]

# Astra Monitor 4 - January 15 2024

### New features
- New option for Storage Header: an indicator that shows the global read and write speed through a pair of bars [[#14](https://github.com/AstraExt/astra-monitor/issues/14)]
- Graph Width customization: now you can choose the width of the header graphs individually
- Storage and Network Header IO Speed Max Number of Figures: now you can choose the maximum number of figures to show in the IO Speed number
- Header Height and Margis customization: as experimental feature, you can now change the height of the header's button and its margins to better fit your desktop environment's theme [[#7](https://github.com/AstraExt/astra-monitor/issues/7)]
- Icon size customization: as experimental feature, now you can choose the size of the icons in the header
- Preference panel reorganized to better fit more options and to organize them in a more logical way

### Bug fixes
- Fixed a bug where the icon and the unit was missing in current sensor value [[#16](https://github.com/AstraExt/astra-monitor/issues/16)]
- Fixed a sizing bug when headers have a label that changes often

# Astra Monitor 3 - January 14 2024

### New features
- Used Memory customization: now you can choose the formula to calculate used memory
- Swap Memory info expanded with a popup menu to show more details, including swap devices and usage per device
- Added About page in the Preferences window with version number and useful links [[#8](https://github.com/AstraExt/astra-monitor/issues/8)]
- Added Data Unit customization for network and storage [[#13](https://github.com/AstraExt/astra-monitor/issues/13)]

### Bug fixes
- Fixed a bug where the used memory was not being calculated correctly [[#9](https://github.com/AstraExt/astra-monitor/issues/9)] [[#10](https://github.com/AstraExt/astra-monitor/issues/10)]
- __Swap__-ped from '*free*' to '*/proc/meminfo*' to get swap info. [[#6](https://github.com/AstraExt/astra-monitor/issues/6)]
- Fixed a bug where the processor name was not being displayed correctly [[#5](https://github.com/AstraExt/astra-monitor/issues/5)]
- Sensor header should now be more coherent with the rest on the style and width [[#11](https://github.com/AstraExt/astra-monitor/issues/11)]
- Fixed a graphical bug where the sensor header was not being displayed correctly [[#15](https://github.com/AstraExt/astra-monitor/issues/15)]

# Astra Monitor 2 - January 12 2024

### New features
- Added an option to change Theme Style (Light/Dark) to better fit your desktop environment's theme

### Bug fixes
- Sensor header width not consistant [[#1](https://github.com/AstraExt/astra-monitor/issues/1)]
- Sensor menu not centered
- Sensor menu missing footer utility buttons [[#4](https://github.com/AstraExt/astra-monitor/issues/4)]
- Icon madness fixed. Now icons are more unified and support light and dark themes
- Icons missing on the preferences window [[#2](https://github.com/AstraExt/astra-monitor/issues/2)]

# Astra Monitor 1 - January 10 2024

Public release.
