# Astra Monitor

## Table of Contents
- [Overview](#overview)
- [Roadmap](#roadmap)
- [Installation](#installation)
- [Requirements](#requirements)
- [Usage](#usage)
- [Licensing](#licensing)
- [Translations](#translations)
- [Building and Testing](#building-and-testing)
- [Contributing](#contributing)
- [Donations](#donations)
- [Acknowledgments](#acknowledgments)

# Overview

Astra Monitor is a cutting-edge, fully customizable, and performance-focused monitoring extension for GNOME's top bar. It's an all-in-one solution for those seeking to keep a close eye on their system's performance metrics like CPU, GPU, RAM, disk usage, network statistics, and sensor readings. Currently in its early stages of development, Astra Monitor is constantly evolving with an eye towards future enhancements and additional features.

### Key Features:
- **Comprehensive Monitoring:** Track a wide array of system resources. Apart from the wide variety of resources to monitor in the top header bar, inside the menus you can find even more detailed information just hovering over the resource you want to know more about.
- **Customizable Interface:** Tailor the monitoring experience to suit your preferences. Choose what resources to monitor and how to display them. A lot of customization options are available.
- **Optimized Performance:** Designed to be lightweight and efficient. Resources are only queried when needed. No polling. No wasted resources. Hidden components are not queried nor rendered.
- **Effortless Real-Time Updates:** Changes made in the preferences panel are applied instantly, with no need to restart the extension or GNOME Shell. This feature ensures a seamless and interruption-free user experience, allowing for on-the-fly customization and monitoring adjustments.

### Screenshots:

#### High Customization Level
<p align="center">
    Example 1:<br>
    <img src="./screenshots/screenshot1.jpg" width="869px" alt="Screenshot1" /><br>
    Example 2:<br>
    <img src="./screenshots/screenshot2.jpg" width="897px" alt="Screenshot2" /><br>
    Example 3:<br>
    <img src="./screenshots/screenshot3.jpg" width="296px" alt="Screenshot3" />
</p>

#### Rich Menu Information
<p align="center">
    <img src="./screenshots/screenshot9.jpg" height="360px" alt="Screenshot9" />
    <img src="./screenshots/screenshot10.jpg" height="360px" alt="Screenshot10" />
</p>

#### Detailed Resource Information
<p align="center">
    <img src="./screenshots/screenshot4.jpg" height="250px" alt="Screenshot4">
    <img src="./screenshots/screenshot5.jpg" height="250px" alt="Screenshot5">
    <img src="./screenshots/screenshot7.jpg" height="250px" alt="Screenshot7">
</p>
<p align="center">
    <img src="./screenshots/screenshot6.jpg" height="250px" alt="Screenshot6">
    <img src="./screenshots/screenshot8.jpg" height="250px" alt="Screenshot8">
</p>

# Roadmap

As Astra Monitor is in the early stages of development, we have an ambitious roadmap planned:

- **Data Source:** Currently Astra Monitor avoids using GTop, the standard library for system monitoring in GNOME, using a custom implementation through resources close to kernel level such as /proc. We are planning to add support for GTop as a data source, allowing the user to choose between the two.
- **Icons:** Customization of the icons in the preferences panel.
- **Colors:** Customization of the colors in the preferences panel.
- **Ordering:** Ability to rearrange the order of the displayed resources.
- **Sensors:** Support for more sensors sources and better sensor selection UI. (e.g. IPMI, sensor source plugins!?)
- **History:** Settings for the time range and size of history graphs.
- **GPU:** Improvement of GPU monitoring.
- **Network:** Improvement of network monitoring. (e.g. selection of network interface, manual vs automatic max speed detection, VPNs)
- **Disk:** Improvement of disk monitoring. (e.g. ~~selection of main disk~~, disk health)
- **CPU:** Dual socket CPU support.
- **Debugging:** Better resources for the final user to debug errors/problems within the preferences panel (e.g. logs, error messages, etc.)

Your feedback is invaluable in shaping Astra Monitor's development journey. Do you have any new features to suggest? We are very happy to receive suggestions. The best way to see new features become reality as quickly as possible is through direct contributions or donations. Donations will result in more development time dedicated to the project. If you would like to contribute, please refer to the contribution guidelines.

# Installation

Astra Monitor can be installed on any Linux distribution supporting GNOME version 45.0 or higher. Follow these simple steps:

1. Visit the [GNOME Shell Extensions page](https://extensions.gnome.org/).
2. Search for "Astra Monitor".
3. Click on the extension and follow the on-screen instructions to install.

# Requirements

Astra Monitor works out of the box with no additional dependencies. However, some optional dependencies can enhance the data displayed by the extension. These tools and the impact of their absence are clearly listed in the preferences panel of the extension.

<p align="center">
    <img src="./screenshots/screenshot13.jpg" width="600px" alt="Screenshot13" />
</p>

# Usage

Once installed, Astra Monitor can be accessed and configured directly from the GNOME extensions tool. You can customize what system resources to monitor and how the information is displayed, tailoring the experience to your need.

# Licensing

Astra Monitor is licensed under the GNU General Public License v3.0 (GPL-3.0), a widely used free software license that guarantees end users the freedom to run, study, share, and modify the software.

# Translations

Astra Monitor is currently available in English and Italian. If you would like to contribute with a translation, please refer to these guidelines:

1. **Fork the repository:** Fork the repository and clone it to your local machine.
2. **Create/Update the translation file:** Create or update the translation file for your language. Translation files are located in po folder. The file name is the language code (e.g. it.po for Italian). You can use Poedit to edit the translation files.
3. **Compile the translation file:** Compile the translation file using the ```./i18n.sh``` script.
4. **Test the translation:** Test the translation by running the extension with the ```./test.sh``` script or by packing it with the ```./pack.sh``` script and installing it.
5. **Submit a pull request:** Submit a pull request with your changes.

# Building and Testing

Astra Monitor is written in JavaScript and uses the [GNOME Shell Extension API](https://gjs-docs.gnome.org/gnome-shell-extension/stable/).

tsconfig.json is used to configure TypeScript with the only purpose of enabling type suggestion and auto-completion in VSCode. You may run ```npm install``` to install all TypeScript dependencies. However, the extension is written in plain JavaScript and does not require typescript compilation.

Various scrips are provided to facilitate the packing and testing of the extension. These scripts are located in the root directory of the project and can be run from there and are used solely with the scope of facilitating my own development process. Feel free to use or modify them to suit your needs.

### Scripts
**test.sh:** This script runs the extension in a Xephyr session with a gnome xwayland session, allowing for quick and easy testing without restarting your own gnome shell session. It can be run with the following command:
```bash ./test.sh```

**schemas.sh:** This script compiles the schemas for the extension. It can be run with the following command:
```bash ./schemas.sh```

**i18n.sh:** This script create the translations files for the extension. It can be run with the following command:
```bash ./i18n.sh```

**pack.sh:** This script packs the extension into a zip file ready for distribution or use. It automatically check dependencies and compiles schemas. It can be run with the following command:
```bash ./pack.sh```


# Contributing

Contributions to Astra Monitor are highly encouraged and appreciated. We welcome all forms of contributions, from bug reporting to feature suggestions, and direct code contributions. To contribute:

1. **Report Bugs/Request Features:** Use the GitHub issues page to report bugs or suggest new features.
2. **Code Contributions:** Feel free to make changes and submit a pull request.
3. **Feedback:** Share your experience and suggestions to help improve Astra Monitor.

Please refer to our contribution guidelines for more detailed instructions.

# Donations

Astra Monitor is a free and open-source project: we rely on the support of our community. Donations are a vital part of sustaining our project's growth and success. Your contributions enable us to dedicate more time to development and bring the community's most requested features to life.

### How Your Donations Help
- **More Development Time**: Donations allow our team to spend more time directly on project development, leading to quicker releases and updates.
- **Community-Driven Features**: With additional resources, we can focus on implementing features most requested by our community.
- **Enhanced Project Sustainability**: Your support helps us maintain the project in the long run, ensuring its continual improvement and relevance.

### How to Donate
You can donate through your preferred platform, any amount is greatly appreciated and makes a significant impact.

**Buy us [a coffee](https://www.buymeacoffee.com/astra.ext), and help us keep Astra Monitor alive and thriving!**

**Become a [Patron](https://www.patreon.com/AstraExt) to support our project and more!**

**Donate through [Ko-Fi](https://ko-fi.com/astraext), and help our community grow!**

## Acknowledgments

Astra Monitor is a project inspired by the concepts from [iStat Menus](https://bjango.com/mac/istatmenus/) and [TopHat](https://github.com/fflewddur/tophat) by [Todd Kulesza](https://github.com/fflewddur), adapted and evolved for the GNOME environment. This extension is a tribute to the innovation in system monitoring tools and is driven by the passion and contributions of the open-source community.
