# Astra Monitor 5 - January 16 2024

### New features
- New threshold option for Network and Storage IO Speed: now you can choose a threshold to avoid showing the IO Speed when it's under a certain value [[#19](https://github.com/AstraExt/astra-monitor/issues/19)]
- New option to ignore network interfaces: now you can choose to selectively ignore specific network interfaces to avoid showing them in the Network Menu and to exclude them from IO Speed calculation [[#20](https://github.com/AstraExt/astra-monitor/issues/20)]
- Now Clicking on the Extension Settings in a specific menu will open the Preferences window with the corresponding tab selected [[#12](https://github.com/AstraExt/astra-monitor/issues/12)]
- Debug Mode: now you can enable debug mode to see more logs in the console (for future debugging features)
- Now you can override Header's Font Family and Font Size to suit your personal preferences [[#3](https://github.com/AstraExt/astra-monitor/issues/3)]

### Bug fixes
- Fixed a bug where the icon and the unit was missing in energy sensor value [[#17](https://github.com/AstraExt/astra-monitor/issues/17)]
- Top Processes list in Processors Menu is now more responsive and should be filled faster
- Cpu Info popup now squeeze to fit shorter screens [[#18](https://github.com/AstraExt/astra-monitor/issues/18)]
- Set a minimum size for the Preferences window to avoid UI elements to be cut off [[#21](https://github.com/AstraExt/astra-monitor/issues/21)]

# Astra Monitor 4 - January 15 2024

### New features
- New option for Storage Header: an indicator that shows the global read and write speed through a pair of bars [[#14](https://github.com/AstraExt/astra-monitor/issues/14)]
- Graph Width customization: now you can choose the width of the header graphs individually
- Storage and Network Header IO Speed Number Max Figures: now you can choose the maximum number of figures to show in the IO Speed number
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
