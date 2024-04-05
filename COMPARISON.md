# Project Comparison

## Table of Contents

- [Introduction](#introduction)
- [Performance and Benchmarks](#performance-and-benchmarks)
- [Features](#features)
- [Public Response](#public-response)

## Introduction

This document provides a comparative analysis of Astra Monitor against similar projects within our domain. Our primary aim with this comparison is twofold. Firstly, it serves as a critical tool for our project's ongoing development, helping us identify areas of improvement and opportunity to refine and enhance our offering. Secondly, it acts as a guide for users, offering greater insights and assisting them in making an informed decision when choosing the ideal tool for their needs. By highlighting the unique features, performance benchmarks, and key differences between Astra Monitor and its alternatives, we hope to foster a transparent and informative environment for both our development team and the user community at large.


## Performance and Benchmarks

### Methodology

We have conducted a series of performance tests to compare Astra Monitor with other popular monitoring tools. The tests were conducted with the with the help of a custom script made by us that (available [here](./benchmarks)), in an isolated fresh system with GNOME 45, measure the CPU and memory usage of the extensions for a period of 60 seconds, repeating the test 10 times. Since not all extensions have the same capabilities, we have tested our extension in single head-to-head tests with each of the other extensions, enabling only the features that are present in both extensions, trying to enable as many features as possible.

For cpu performance, we measured a baseline of the CPU usage of the GNOME Shell process with no extensions enabled, and then we measured the CPU usage of the GNOME Shell process with each extension enabled.

For memory performance, we measured the memory usage of the GNOME Shell process with no extensions enabled, and then we measured the memory usage of the GNOME Shell process with each extension enabled for 5 minute and then disabled looping this 3 times.

### Results

The results of the tests are shown in the table below. The values are the average of the 10 tests.

#### Astra Monitor vs [Vitals](https://github.com/corecoding/Vitals/):
<p style="font-size:12px" align="center"><b>Configuration:</b> Both extensions have Cpu perc usage, Memory perc, used value and free, Disk used value and free, Network IO values, Sensor temps values for cpu and gpu. Update frequency is the same on both extensions.</p>
<table align="center">
    <tr>
        <th></th>
        <th colspan="4" style="text-align:center">CPU</th>
        <th style="text-align:center">Memory</th>
    </tr>
    <tr>
        <th>Extension</th>
        <th>Avg</th>
        <th>StdDev</th>
        <th>Min</th>
        <th>Max</th>
        <th>Total</th>
    </tr>
    <tr>
        <td><u>Astra Monitor v15</u> [EGOv24]</td>
        <td>868 🏆</td>
        <td>32.18</td>
        <td>780</td>
        <td>?*</td>
        <td>1696</td>
    </tr>
    <tr>
        <td>Vitals [EGOv66]</td>
        <td>1461</td>
        <td>37.26</td>
        <td>1400</td>
        <td>1550</td>
        <td>2432</td>
    </tr>
</table>
<p style="font-size:12px" align="center"><i>* Value missing; I have already collected this data but I'm currently abroad. Details will be updated upon return.</i><br><i>The lower the values, the better the performance.</i></p>

#### Astra Monitor vs [TopHat](https://github.com/fflewddur/tophat):
<p style="font-size:12px" align="center"><b>Configuration:</b> Both extensions have Cpu perc usage and bar, Memory perc usage and bar, Disk bar and IO values, Network IO values. Update frequency is the same on both extensions.</p>
<table align="center">
    <tr>
        <th></th>
        <th colspan="4" style="text-align:center">CPU</th>
        <th style="text-align:center">Memory</th>
    </tr>
    <tr>
        <th>Extension</th>
        <th>Avg</th>
        <th>StdDev</th>
        <th>Min</th>
        <th>Max</th>
        <th>Total</th>
    </tr>
    <tr>
        <td><u>Astra Monitor v15</u> [EGOv24]</td>
        <td>409 🏆</td>
        <td>13.00</td>
        <td>390</td>
        <td>430</td>
        <td>2720</td>
    </tr>
    <tr>
        <td>TopHat [EGOv13]</td>
        <td>702</td>
        <td>100.97</td>
        <td>640</td>
        <td>1000</td>
        <td>74508</td>
    </tr>
</table>
<p style="font-size:12px" align="center"><i>The lower the values, the better the performance.</i></p>


#### Astra Monitor vs [system-monitor-next](https://github.com/mgalgs/gnome-shell-system-monitor-applet):
<p style="font-size:12px" align="center"><b>Configuration:</b> Both extensions have Cpu perc usage and graph, Memory perc usage and graph, Disk IO values and graph, Network IO values and graph, Sensor temps value for cpu and gpu fan speed value. Update frequency is the same on both extensions.</p>
<table align="center">
    <tr>
        <th></th>
        <th colspan="4" style="text-align:center">CPU</th>
        <th style="text-align:center">Memory</th>
    </tr>
    <tr>
        <th>Extension</th>
        <th>Avg</th>
        <th>StdDev</th>
        <th>Min</th>
        <th>Max</th>
        <th>Total</th>
    </tr>
    <tr>
        <td><u>Astra Monitor v15</u> [EGOv24]</td>
        <td>546 🏆</td>
        <td>35.27</td>
        <td>490</td>
        <td>600</td>
        <td>1336</td>
    </tr>
    <tr>
        <td>system-monitor-next [EGOv65]</td>
        <td>762</td>
        <td>16.00</td>
        <td>730</td>
        <td>790</td>
        <td>1312</td>
    </tr>
</table>
<p style="font-size:12px" align="center"><i>The lower the values, the better the performance.</i></p>

#### Considerations

The aim of these tests is to provide a general idea of the performance of the extensions. The idea came out to compare the performance of Astra Monitor directly with itself during each development iteration to see if the performance was improving or not and that were no regressions. We would like to emphasize that this is not a competition and the intent is not to discredit any other extension. We are aware that the performance of an extension can vary depending on the system and the hardware, and it's not the only factor to consider when choosing an extension. Memory test's main goal is to check if memory grows over time or retain data between enabling and disabling the extension multiple times.

## Features

#### Legend

- ✅: Feature is present
- ⚠️: Feature is partially present
- ❌: Feature is not present
- 🚧: Feature is in development
- ❓: Feature status is unknown

_<u>FEATURE COMPARISON TABLE IS ONLY PARTIALLY COMPLETE.<br>
PLEASE BEAR WITH US AS WE CONTINUE TO UPDATE IT.</u>_

<table style="text-align:center" align="center">
    <tr>
        <th rowspan="12" style="text-align:center;background-color:#888">General</th>
        <th style="text-align:center">Category</th>
        <th style="text-align:center">Feature</th>
        <th style="text-align:center">Astra Monitor v15<br>[EGOv24]</th>
        <th style="text-align:center">Vitals<br>[EGOv66]</th>
        <th style="text-align:center">TopHat<br>[EGOv13]</th>
        <th style="text-align:center">system-monitor-next<br>[EGOv65]</th>
    </tr>
    <tr>
        <td rowspan="2">Generic</td>
        <td>Dependency</td>
        <td>✅<br>No required dependency (GTop suggested)</td>
        <td>⚠️<br>GTop (required)<br>ls_sensors</td>
        <td>⚠️<br>GTop (required)</td>
        <td>⚠️<br>GTop (required)</td>
    </tr>
    <tr>
        <td>Startup Delay</td>
        <td>✅</td>
        <td>❌</td>
        <td>❌</td>
        <td>❌</td>
    </tr>
    <tr>
        <td rowspan="3">Panel Box</td>
        <td>Positioning</td>
        <td>✅</td>
        <td>✅</td>
        <td>✅</td>
        <td>❌</td>
    </tr>
    <tr>
        <td>Ordering</td>
        <td>✅</td>
        <td>❌</td>
        <td>❌</td>
        <td>❌</td>
    </tr>
    <tr>
        <td>Styling</td>
        <td>⚠️<br>Only L&R margins</td>
        <td>❌</td>
        <td>❌</td>
        <td>⚠️<br>Background color</td>
    </tr>
    <tr>
        <td rowspan="3">Monitor<br>Headers</td>
        <td>Ordering</td>
        <td>✅</td>
        <td>⚠️<br>Manually remove/readd all monitors</td>
        <td>❌</td>
        <td>✅</td>
    </tr>
    <tr>
        <td>Styling</td>
        <td>⚠️<br>Only Height and vertical margin</td>
        <td>⚠️<br>Fixed/variable width</td>
        <td>❌</td>
        <td>⚠️<br>Compact display</td>
    </tr>
    <tr>
        <td>Font</td>
        <td>✅<br>Family & size</td>
        <td>❌</td>
        <td>❌</td>
        <td>❌</td>
    </tr>
    <tr>
        <td rowspan="3">Configuration</td>
        <td>Export</td>
        <td>✅</td>
        <td>❌</td>
        <td>❌</td>
        <td>❌</td>
    </tr>
    <tr>
        <td>Import</td>
        <td>✅</td>
        <td>❌</td>
        <td>❌</td>
        <td>❌</td>
    </tr>
    <tr>
        <td>Reset</td>
        <td>✅</td>
        <td>❌</td>
        <td>❌</td>
        <td>❌</td>
    </tr>
    <tr>
        <th rowspan="20" style="text-align:center;background-color:#888">CPU</th>
    </tr>
    <tr>
        <td rowspan="2">Generic</td>
        <td>Update Frequency</td>
        <td>✅</td>
        <td>⚠️<br>Global</td>
        <td>⚠️<br>Only 3 Global options</td>
        <td>✅</td>
    </tr>
    <tr>
        <td>Data Source Selection</td>
        <td>✅</td>
        <td>❌</td>
        <td>❌</td>
        <td>❌</td>
    </tr>
    <tr>
        <td rowspan="1">Indicators</td>
        <td>Order</td>
        <td>✅</td>
        <td>⚠️<br>Manually remove/readd all indicators</td>
        <td>❌</td>
        <td>❌</td>
    </tr>
    <tr>
        <td rowspan="3">Icon</td>
        <td>Custom Icon</td>
        <td>✅</td>
        <td>⚠️<br>Global<br>2 options</td>
        <td>❌</td>
        <td>❌</td>
    </tr>
    <tr>
        <td>Custom Color</td>
        <td>✅</td>
        <td>❌</td>
        <td>❌</td>
        <td>❌</td>
    </tr>
    <tr>
        <td>Color Alert</td>
        <td>✅</td>
        <td>❌</td>
        <td>❌</td>
        <td>❌</td>
    </tr>
    <tr>
        <td rowspan="3">Usage</td>
        <td>Percentage</td>
        <td>✅</td>
        <td>✅</td>
        <td>✅</td>
        <td>✅</td>
    </tr>
    <tr>
        <td>Single Core</td>
        <td>✅</td>
        <td>✅</td>
        <td>✅</td>
        <td>✅</td>
    </tr>
    <tr>
        <td>Alert</td>
        <td>✅</td>
        <td>❌</td>
        <td>❌</td>
        <td>❌</td>
    </tr>
    <tr>
        <td rowspan="4">History Graph</td>
        <td>Header</td>
        <td>✅</td>
        <td>❌</td>
        <td>❌</td>
        <td>✅</td>
    </tr>
    <tr>
        <td>Breakdown</td>
        <td>✅</td>
        <td>❌</td>
        <td>❌</td>
        <td>✅<br></td>
    </tr>
    <tr>
        <td>Color Customizaiton</td>
        <td>✅</td>
        <td>❌</td>
        <td>✅</td>
        <td>✅</td>
    </tr>
    <tr>
        <td>Size Customizaiton</td>
        <td>✅</td>
        <td>❌</td>
        <td>❌</td>
        <td>✅</td>
    </tr>
    <tr>
        <td rowspan="4">Realtime Bar</td>
        <td>Header</td>
        <td>✅</td>
        <td>❌</td>
        <td>✅</td>
        <td>❌</td>
    </tr>
    <tr>
        <td>Single Core</td>
        <td>✅</td>
        <td>❌</td>
        <td>✅</td>
        <td>❌</td>
    </tr>
    <tr>
        <td>Breakdown</td>
        <td>✅</td>
        <td>❌</td>
        <td>❌</td>
        <td>❌</td>
    </tr>
    <tr>
        <td>Color Customizaiton</td>
        <td>✅</td>
        <td>❌</td>
        <td>✅</td>
        <td>❌</td>
    </tr>
    <tr>
        <td rowspan="2">Tooltip</td>
        <td>Percentage</td>
        <td>✅</td>
        <td>❌</td>
        <td>❌</td>
        <td>✅</td>
    </tr>
    <tr>
        <td>Single Core</td>
        <td>✅</td>
        <td>❌</td>
        <td>❌</td>
        <td>❌</td>
    </tr>
    <tr>
        <th rowspan="14" style="text-align:center;background-color:#888">GPU</th>
    </tr>
    <tr>
        <td rowspan="3">Support</td>
        <td>Nvidia</td>
        <td>✅</td>
        <td>✅</td>
        <td>❌</td>
        <td>❓</td>
    </tr>
    <tr>
        <td>AMD</td>
        <td>✅</td>
        <td>❌</td>
        <td>❌</td>
        <td>❌</td>
    </tr>
    <tr>
        <td>Intel</td>
        <td>❌</td>
        <td>❌</td>
        <td>❌</td>
        <td>❌</td>
    </tr>
    <tr>
        <td rowspan="5">Menu</td>
        <td>Usage Percentage</td>
        <td>✅</td>
        <td>✅</td>
        <td>❌</td>
        <td>❓</td>
    </tr>
    <tr>
        <td>Usage Bar</td>
        <td>✅</td>
        <td>❌</td>
        <td>❌</td>
        <td>❓</td>
    </tr>
    <tr>
        <td>History Graph</td>
        <td>❌</td>
        <td>❌</td>
        <td>❌</td>
        <td>❓</td>
    </tr>
    <tr>
        <td>Memory Percentage</td>
        <td>✅</td>
        <td>✅</td>
        <td>❌</td>
        <td>❓</td>
    </tr>
    <tr>
        <td>Memory Bar</td>
        <td>✅</td>
        <td>❌</td>
        <td>❌</td>
        <td>❓</td>
    </tr>
    <tr>
        <td rowspan="5">Header</td>
        <td>Usage Percentage</td>
        <td>❌</td>
        <td>✅</td>
        <td>❌</td>
        <td>❓</td>
    </tr>
    <tr>
        <td>Usage Bar</td>
        <td>❌</td>
        <td>❌</td>
        <td>❌</td>
        <td>❓</td>
    </tr>
    <tr>
        <td>History Graph</td>
        <td>❌</td>
        <td>❌</td>
        <td>❌</td>
        <td>❓</td>
    </tr>
    <tr>
        <td>Memory Percentage</td>
        <td>❌</td>
        <td>✅</td>
        <td>❌</td>
        <td>❓</td>
    </tr>
    <tr>
        <td>Memory Bar</td>
        <td>❌</td>
        <td>❌</td>
        <td>❌</td>
        <td>❓</td>
    </tr>
    <tr>
        <th rowspan="26" style="text-align:center;background-color:#888">Memory</th>
    </tr>
    <tr>
        <td rowspan="4">Generic</td>
        <td>Update Frequency</td>
        <td>✅</td>
        <td>⚠️<br>Global</td>
        <td>⚠️<br>Only 3 Global options</td>
        <td>✅</td>
    </tr>
    <tr>
        <td>Data Unit Customization</td>
        <td>✅<br>7 choices</td>
        <td>❌</td>
        <td>❌</td>
        <td>❌</td>
    </tr>
    <tr>
        <td>Used Formula Customization</td>
        <td>✅</td>
        <td>❌</td>
        <td>❌</td>
        <td>❌</td>
    </tr>
    <tr>
        <td>Data Source Selection</td>
        <td>✅</td>
        <td>❌</td>
        <td>❌</td>
        <td>❌</td>
    </tr>
    <tr>
        <td rowspan="1">Indicators</td>
        <td>Order</td>
        <td>✅</td>
        <td>⚠️<br>Manually remove/readd all indicators</td>
        <td>❌</td>
        <td>❌</td>
    </tr>
    <tr>
        <td rowspan="3">Icon</td>
        <td>Custom Icon</td>
        <td>✅</td>
        <td>⚠️<br>Global<br>2 options</td>
        <td>❌</td>
        <td>❌</td>
    </tr>
    <tr>
        <td>Custom Color</td>
        <td>✅</td>
        <td>❌</td>
        <td>❌</td>
        <td>❌</td>
    </tr>
    <tr>
        <td>Color Alert</td>
        <td>✅</td>
        <td>❌</td>
        <td>❌</td>
        <td>❌</td>
    </tr>
    <tr>
        <td rowspan="5">Usage</td>
        <td>Percentage</td>
        <td>✅</td>
        <td>✅</td>
        <td>✅</td>
        <td>✅</td>
    </tr>
    <tr>
        <td>Percentage Alert</td>
        <td>✅</td>
        <td>❌</td>
        <td>❌</td>
        <td>❌</td>
    </tr>
    <tr>
        <td>Value</td>
        <td>✅</td>
        <td>✅</td>
        <td>❌</td>
        <td>❌</td>
    </tr>
    <tr>
        <td>Free</td>
        <td>✅</td>
        <td>✅</td>
        <td>❌</td>
        <td>❌</td>
    </tr>
    <tr>
        <td>Free Alert</td>
        <td>✅</td>
        <td>❌</td>
        <td>❌</td>
        <td>❌</td>
    </tr>
    <tr>
        <td rowspan="4">History Graph</td>
        <td>Header</td>
        <td>✅</td>
        <td>❌</td>
        <td>❌</td>
        <td>✅</td>
    </tr>
    <tr>
        <td>Breakdown</td>
        <td>✅</td>
        <td>❌</td>
        <td>❌</td>
        <td>✅</td>
    </tr>
    <tr>
        <td>Color Customizaiton</td>
        <td>✅</td>
        <td>❌</td>
        <td>✅</td>
        <td>✅</td>
    </tr>
    <tr>
        <td>Size Customizaiton</td>
        <td>✅</td>
        <td>❌</td>
        <td>❌</td>
        <td>✅</td>
    </tr>
    <tr>
        <td rowspan="3">Realtime Bar</td>
        <td>Header</td>
        <td>✅</td>
        <td>❌</td>
        <td>✅</td>
        <td>❌</td>
    </tr>
    <tr>
        <td>Breakdown</td>
        <td>✅</td>
        <td>❌</td>
        <td>❌</td>
        <td>❌</td>
    </tr>
    <tr>
        <td>Color Customizaiton</td>
        <td>✅</td>
        <td>❌</td>
        <td>✅</td>
        <td>❌</td>
    </tr>
    <tr>
        <td rowspan="3">Tooltip</td>
        <td>Percentage</td>
        <td>✅</td>
        <td>❌</td>
        <td>❌</td>
        <td>✅</td>
    </tr>
    <tr>
        <td>Value</td>
        <td>✅</td>
        <td>❌</td>
        <td>❌</td>
        <td>❌</td>
    </tr>
    <tr>
        <td>Free</td>
        <td>✅</td>
        <td>❌</td>
        <td>❌</td>
        <td>❌</td>
    </tr>
    <tr>
        <td rowspan="2">Swap</td>
        <td>Value</td>
        <td>⚠️ Menu only</td>
        <td>✅</td>
        <td>⚠️ Menu only</td>
        <td>✅</td>
    </tr>
    <tr>
        <td>Bar</td>
        <td>⚠️ Menu only</td>
        <td>❌</td>
        <td>❌</td>
        <td>❌</td>
    </tr>
    <tr>
        <th rowspan="26" style="text-align:center;background-color:#888">Storage</th>
    </tr>
    <tr>
        <td rowspan="5">Generic</td>
        <td>Update Frequency</td>
        <td>✅</td>
        <td>⚠️<br>Global</td>
        <td>⚠️<br>Only 3 Global options</td>
        <td>✅</td>
    </tr>
    <tr>
        <td>Data Unit Customization</td>
        <td>✅<br>11 choices</td>
        <td>❌</td>
        <td>❌</td>
        <td>❌</td>
    </tr>
    <tr>
        <td>Main Disk Selection</td>
        <td>✅</td>
        <td>✅</td>
        <td>⚠️<br>Only 3 fixed choices</td>
        <td>❌</td>
    </tr>
    <tr>
        <td>Ignored disks</td>
        <td>✅<br>Selection & regex</td>
        <td>❌</td>
        <td>❌</td>
        <td>❌</td>
    </tr>
    <tr>
        <td>Data Source Selection</td>
        <td>✅</td>
        <td>❌</td>
        <td>❌</td>
        <td>❌</td>
    </tr>
    <tr>
        <td rowspan="1">Indicators</td>
        <td>Order</td>
        <td>✅</td>
        <td>⚠️<br>Manually remove/readd all indicators</td>
        <td>❌</td>
        <td>❌</td>
    </tr>
    <tr>
        <td rowspan="3">Icon</td>
        <td>Custom Icon</td>
        <td>✅</td>
        <td>⚠️<br>Global<br>2 options</td>
        <td>❌</td>
        <td>❌</td>
    </tr>
    <tr>
        <td>Custom Color</td>
        <td>✅</td>
        <td>❌</td>
        <td>❌</td>
        <td>❌</td>
    </tr>
    <tr>
        <td>Color Alert</td>
        <td>✅</td>
        <td>❌</td>
        <td>❌</td>
        <td>❌</td>
    </tr>
    <tr>
        <td rowspan="6">Usage</td>
        <td>Header Bar</td>
        <td>✅</td>
        <td>❌</td>
        <td>✅</td>
        <td>❌</td>
    <tr>
        <td>Percentage</td>
        <td>✅</td>
        <td>❌</td>
        <td>✅</td>
        <td>❌</td>
    </tr>
    <tr>
        <td>Percentage Alert</td>
        <td>✅</td>
        <td>❌</td>
        <td>❌</td>
        <td>❌</td>
    </tr>
    <tr>
        <td>Value</td>
        <td>✅</td>
        <td>✅</td>
        <td>❌</td>
        <td>❌</td>
    </tr>
    <tr>
        <td>Free</td>
        <td>✅</td>
        <td>✅</td>
        <td>❌</td>
        <td>❌</td>
    </tr>
    <tr>
        <td>Free Alert</td>
        <td>✅</td>
        <td>❌</td>
        <td>❌</td>
        <td>❌</td>
    </tr>
    <tr>
        <td rowspan="6">IO</td>
        <td>Bar</td>
        <td>✅</td>
        <td>❌</td>
        <td>❌</td>
        <td>❌</td>
    </tr>
    <tr>
        <td>Values</td>
        <td>✅</td>
        <td>✅</td>
        <td>✅</td>
        <td>✅</td>
    </tr>
    <tr>
        <td>Threshold</td>
        <td>✅</td>
        <td>❌</td>
        <td>❌</td>
        <td>❌</td>
    </tr>
    <tr>
        <td>History Graph</td>
        <td>✅</td>
        <td>❌</td>
        <td>❌</td>
        <td>✅</td>
    </tr>
    <tr>
        <td>Custom Colors</td>
        <td>✅</td>
        <td>❌</td>
        <td>❌</td>
        <td>✅</td>
    </tr>
    <tr>
        <td>Custom Graph Width</td>
        <td>✅</td>
        <td>❌</td>
        <td>❌</td>
        <td>✅</td>
    </tr>
    <tr>
        <td rowspan="4">Tooltip</td>
        <td>Percentage</td>
        <td>✅</td>
        <td>❌</td>
        <td>❌</td>
        <td>❌</td>
    </tr>
    <tr>
        <td>Value</td>
        <td>✅</td>
        <td>❌</td>
        <td>❌</td>
        <td>❌</td>
    </tr>
    <tr>
        <td>Free</td>
        <td>✅</td>
        <td>❌</td>
        <td>❌</td>
        <td>❌</td>
    </tr>
    <tr>
        <td>IO</td>
        <td>✅</td>
        <td>❌</td>
        <td>❌</td>
        <td>✅</td>
    </tr>
    <tr>
        <th rowspan="18" style="text-align:center;background-color:#888">Network</th>
    </tr>
    <tr>
        <td rowspan="4">Generic</td>
        <td>Update Frequency</td>
        <td>✅</td>
        <td>⚠️<br>Global</td>
        <td>⚠️<br>Only 3 Global options</td>
        <td>✅</td>
    </tr>
    <tr>
        <td>Data Unit Customization</td>
        <td>✅<br>7 choices</td>
        <td>✅<br>2 choices</td>
        <td>✅<br>2 choices</td>
        <td>✅<br>2 choices</td>
    </tr>
    <tr>
        <td>Ignored interfaces</td>
        <td>✅<br>Selection & regex</td>
        <td>❌</td>
        <td>❌</td>
        <td>❌</td>
    </tr>
    <tr>
        <td>Data Source Selection</td>
        <td>✅</td>
        <td>❌</td>
        <td>❌</td>
        <td>❌</td>
    </tr>
    <tr>
        <td rowspan="1">Indicators</td>
        <td>Order</td>
        <td>✅</td>
        <td>⚠️<br>Manually remove/readd all indicators</td>
        <td>❌</td>
        <td>❌</td>
    </tr>
    <tr>
        <td rowspan="3">Icon</td>
        <td>Custom Icon</td>
        <td>✅</td>
        <td>⚠️<br>Global<br>2 options</td>
        <td>❌</td>
        <td>❌</td>
    </tr>
    <tr>
        <td>Custom Color</td>
        <td>✅</td>
        <td>❌</td>
        <td>❌</td>
        <td>❌</td>
    </tr>
    <tr>
        <td>Color Alert</td>
        <td>✅</td>
        <td>❌</td>
        <td>❌</td>
        <td>❌</td>
    </tr>
    <tr>
        <td rowspan="6">IO</td>
        <td>Bar</td>
        <td>✅</td>
        <td>❌</td>
        <td>✅</td>
        <td>❌</td>
    </tr>
    <tr>
        <td>Values</td>
        <td>✅</td>
        <td>✅</td>
        <td>✅</td>
        <td>✅</td>
    </tr>
    <tr>
        <td>Threshold</td>
        <td>✅</td>
        <td>❌</td>
        <td>❌</td>
        <td>❌</td>
    </tr>
    <tr>
        <td>History Graph</td>
        <td>✅</td>
        <td>❌</td>
        <td>❌</td>
        <td>✅</td>
    </tr>
    <tr>
        <td>Custom Colors</td>
        <td>✅</td>
        <td>❌</td>
        <td>❌</td>
        <td>✅</td>
    </tr>
    <tr>
        <td>Custom Graph Width</td>
        <td>✅</td>
        <td>❌</td>
        <td>❌</td>
        <td>✅</td>
    </tr>
    <tr>
        <td rowspan="2">Public IP</td>
        <td>IPv4</td>
        <td>✅</td>
        <td>✅</td>
        <td>❌</td>
        <td>❌</td>
    </tr>
    <tr>
        <td>IPv6</td>
        <td>✅</td>
        <td>❌</td>
        <td>❌</td>
        <td>❌</td>
    </tr>
    <tr>
        <td rowspan="1">Tooltip</td>
        <td>IO</td>
        <td>✅</td>
        <td>❌</td>
        <td>❌</td>
        <td>✅</td>
    </tr>
    <tr>
        <th rowspan="9" style="text-align:center;background-color:#888">Sensors</th>
    </tr>
    <tr>
        <td rowspan="3">Generic</td>
        <td>Update Frequency</td>
        <td>✅</td>
        <td>⚠️<br>Global</td>
        <td>❌</td>
        <td>✅</td>
    </tr>
    <tr>
        <td>Temperature Unit Customization</td>
        <td>✅</td>
        <td>✅</td>
        <td>❌</td>
        <td>✅</td>
    </tr>
    <tr>
        <td>Data Source Selection</td>
        <td>✅</td>
        <td>❌</td>
        <td>❌</td>
        <td>❌</td>
    </tr>
    <tr>
        <td rowspan="1">Indicators</td>
        <td>Order</td>
        <td>✅</td>
        <td>⚠️<br>Manually remove/readd all indicators</td>
        <td>❌</td>
        <td>⚠️<br>Swap temp with fan</td>
    </tr>
    <tr>
        <td rowspan="3">Icon</td>
        <td>Custom Icon</td>
        <td>✅</td>
        <td>⚠️<br>Global<br>2 options</td>
        <td>❌</td>
        <td>❌</td>
    </tr>
    <tr>
        <td>Custom Color</td>
        <td>✅</td>
        <td>❌</td>
        <td>❌</td>
        <td>❌</td>
    </tr>
    <tr>
        <td>Color Alert</td>
        <td>✅</td>
        <td>❌</td>
        <td>❌</td>
        <td>❌</td>
    </tr>
    <tr>
        <td rowspan="1">Tooltip</td>
        <td>Customization</td>
        <td>✅</td>
        <td>❌</td>
        <td>❌</td>
        <td>❌</td>
    </tr>
    <tr>
        <th rowspan="25" style="text-align:center;background-color:#888">Battery</th>
    </tr>
    <tr>
        <td rowspan="1">Generic</td>
        <td>Update Frequency</td>
        <td>❌</td>
        <td>⚠️<br>Global</td>
        <td>❌</td>
        <td>✅</td>
    </tr>
    <tr>
        <td rowspan="1">Indicators</td>
        <td>Order</td>
        <td>❌</td>
        <td>⚠️<br>Manually remove/readd all indicators</td>
        <td>❌</td>
        <td>❌</td>
    </tr>
    <tr>
        <td rowspan="3">Icon</td>
        <td>Custom Icon</td>
        <td>❌</td>
        <td>⚠️<br>Global<br>2 options</td>
        <td>❌</td>
        <td>❌</td>
    </tr>
    <tr>
        <td>Custom Color</td>
        <td>❌</td>
        <td>❌</td>
        <td>❌</td>
        <td>❌</td>
    </tr>
    <tr>
        <td>Color Alert</td>
        <td>❌</td>
        <td>❌</td>
        <td>❌</td>
        <td>❌</td>
    </tr>
    <tr>
        <td rowspan="6">Header</td>
        <td>Bar</td>
        <td>❌</td>
        <td>❌</td>
        <td>❌</td>
        <td>❌</td>
    </tr>
    <tr>
        <td>Percentage</td>
        <td>❌</td>
        <td>✅</td>
        <td>❌</td>
        <td>✅</td>
    </tr>
    <tr>
        <td>History Graph</td>
        <td>❌</td>
        <td>❌</td>
        <td>❌</td>
        <td>✅</td>
    </tr>
    <tr>
        <td>Custom Colors</td>
        <td>❌</td>
        <td>❌</td>
        <td>❌</td>
        <td>✅</td>
    </tr>
    <tr>
        <td>Custom Graph Width</td>
        <td>❌</td>
        <td>❌</td>
        <td>❌</td>
        <td>✅</td>
    </tr>
</table>
<p align="center" style="font-size:14px">Note: The tables above might not be up to date or accurate. For the most accurate and up-to-date information, please refer to the respective extension's documentation. If you find any inaccuracies, please let us know.</p>

# Public Response

Thank you all for the amazing support and feedback. We have been the most downloaded extensions on the GNOME Shell Extensions website among the extensions released in the last year, and we are very grateful for that (_as of March 2024_). We also received a lot of stars on GitHub compared to similar projects, and we are very happy to see that our work is being appreciated. We hope to continue to improve and provide a better experience for all of you.

## Star History

<a href="https://star-history.com/#AstraExt/astra-monitor&corecoding/Vitals&fflewddur/tophat&paradoxxxzero/gnome-shell-system-monitor-applet&0ry0n/Resource_Monitor&Timeline">
  <picture>
    <source media="(prefers-color-scheme: dark)" srcset="https://rb.gy/wrs915" />
    <source media="(prefers-color-scheme: light)" srcset="https://rb.gy/91wxok" />
    <img alt="Star History Chart" src="https://rb.gy/91wxok" />
  </picture>
</a>
