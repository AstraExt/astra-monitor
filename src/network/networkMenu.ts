/*!
 * Copyright (C) 2023 Lju
 *
 * This file is part of Astra Monitor extension for GNOME Shell.
 * [https://github.com/AstraExt/astra-monitor]
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 *
 * This program is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See the
 * GNU General Public License for more details.
 *
 * You should have received a copy of the GNU General Public License
 * along with this program. If not, see <https://www.gnu.org/licenses/>.
 */

import GLib from 'gi://GLib';
import St from 'gi://St';
import Clutter from 'gi://Clutter';

import { gettext as _, pgettext } from 'resource:///org/gnome/shell/extensions/extension.js';
import MenuBase from '../menu.js';
import NetworkGraph from './networkGraph.js';
import Grid from '../grid.js';
import Utils, { InterfaceInfo, RouteInfo } from '../utils/utils.js';
import Config from '../config.js';
import { NetworkWirelessInfo } from './networkMonitor.js';

type InterfaceDeviceInfo = {
    data: InterfaceInfo | null;
    container: InstanceType<typeof Grid>;
    icon: St.Icon;
    label: St.Label;
    label2: St.Label;
    uploadValueLabel: St.Label;
    uploadActivityIcon: St.Icon;
    downloadValueLabel: St.Label;
    downloadActivityIcon: St.Icon;
    wirelessButton: St.Button;
    wirelessLabel: St.Label;
};

type NetworkActivityPopup = MenuBase & {
    totalUploadedValueLabel?: St.Label;
    totalDownloadedValueLabel?: St.Label;

    packetsUploadedValueLabel?: St.Label;
    packetsDownloadedValueLabel?: St.Label;

    errorsUploadValueLabel?: St.Label;
    errorsDownloadValueLabel?: St.Label;
};

type RoutesPopup = MenuBase & {
    routes: {
        titleLabel: St.Label;
        metricLabel: St.Label;
        metricValue: St.Label;
        typeLabel: St.Label;
        typeValue: St.Label;
        deviceLabel: St.Label;
        deviceValue: St.Label;
        destinationLabel: St.Label;
        destinationValue: St.Label;
        gatewayLabel: St.Label;
        gatewayValue: St.Label;
        protocolLabel: St.Label;
        protocolValue: St.Label;
        scopeLabel: St.Label;
        scopeValue: St.Label;
        flagsLabel: St.Label;
        flagsValue: St.Label;
    }[];
};

type DeviceInfoPopup = MenuBase & {
    nameValue?: St.Label;
    altNamesLabel?: St.Label;
    altNamesValue?: St.Label;
    ifindexLabel?: St.Label;
    ifindexValue?: St.Label;
    macAddressLabel?: St.Label;
    macAddressValue?: St.Label;
    groupLabel?: St.Label;
    groupValue?: St.Label;
    speedLabel?: St.Label;
    speedValue?: St.Label;
    duplexLabel?: St.Label;
    duplexValue?: St.Label;
    mtuLabel?: St.Label;
    mtuValue?: St.Label;
    txQueueLabel?: St.Label;
    txQueueValue?: St.Label;
    linkTypeLabel?: St.Label;
    linkTypeValue?: St.Label;
    operStateLabel?: St.Label;
    operStateValue?: St.Label;
    qdiscLabel?: St.Label;
    qdiscValue?: St.Label;
    parentLabel?: St.Label;
    parentValue?: St.Label;
};

type DeviceAddressesPopup = MenuBase & {
    addresses: {
        labelValue: St.Label;
        familyLabel: St.Label;
        familyValue: St.Label;
        localLabel: St.Label;
        localValue: St.Label;
        prefixlenLabel: St.Label;
        prefixlenValue: St.Label;
        broadcastLabel: St.Label;
        broadcastValue: St.Label;
        scopeLabel: St.Label;
        scopeValue: St.Label;
    }[];
};

type DeviceTotalsPopup = MenuBase & {
    totalUploadedValueLabel?: St.Label;
    totalDownloadedValueLabel?: St.Label;
    packetsUploadedValueLabel?: St.Label;
    packetsDownloadedValueLabel?: St.Label;
    errorsUploadValueLabel?: St.Label;
    errorsDownloadValueLabel?: St.Label;
};

type DeviceWirelessPopup = MenuBase & {
    IEEELabel?: St.Label;
    IEEEValue?: St.Label;
    SSIDLabel?: St.Label;
    SSIDValue?: St.Label;
    modeLabel?: St.Label;
    modeValue?: St.Label;
    frequencyLabel?: St.Label;
    frequencyValue?: St.Label;
    accessPointLabel?: St.Label;
    accessPointValue?: St.Label;
    bitRateLabel?: St.Label;
    bitRateValue?: St.Label;
    txPowerLabel?: St.Label;
    txPowerValue?: St.Label;
    linkQualityLabel?: St.Label;
    linkQualityValue?: St.Label;
    signalLevelLabel?: St.Label;
    signalLevelValue?: St.Label;
};

enum RefreshStatus {
    IDLE,
    REFRESHING,
    DONE
}

export default class NetworkMenu extends MenuBase {
    /*private networkSectionLabel!: St.Label;*/
    private networkActivityPopup!: NetworkActivityPopup;

    private graph!: InstanceType<typeof NetworkGraph>;
    private totalUploadSpeedValueLabel!: St.Label;
    private totalDownloadSpeedValueLabel!: St.Label;

    private publicIPLabel!: St.Label;
    private publicIPContainer!: St.Button;
    private publicIPv4!: {
        label: St.Label;
        value: St.Label;
    };
    private publicIpv6!: {
        label: St.Label;
        value1: St.Label;
        value2: St.Label;
        footerLabel: St.Label;
        refreshStatus: RefreshStatus;
        refreshTimer?: number;
    };

    private defaultRouteDevice!: St.Label;
    private defaultRouteGateway!: St.Label;
    private routesPopup!: RoutesPopup;

    private deviceSection!: InstanceType<typeof Grid>;
    private noDevicesLabel!: St.Label;

    private devices!: Map<string, InterfaceDeviceInfo>;
    private devicesInfoPopup!: Map<string, DeviceInfoPopup>;
    private devicesAddressesPopup!: Map<string, DeviceAddressesPopup>;
    private devicesTotalsPopup!: Map<string, DeviceTotalsPopup>;
    private devicesWirelessPopup!: Map<string, DeviceWirelessPopup>;

    private updateTimer: number = 0;

    constructor(sourceActor: St.Widget, arrowAlignment: number, arrowSide: St.Side) {
        super(sourceActor, arrowAlignment, { name: 'Network Menu', arrowSide });

        /*this.networkSectionLabel = */ this.addMenuSection(_('Network'));
        this.createActivitySection();
        this.createPublicIps();
        this.createRoutes();
        this.createDeviceList();

        this.addUtilityButtons();

        this.setStyle();
        Config.connect(this, 'changed::theme-style', this.setStyle.bind(this));
    }

    setStyle() {
        const lightTheme = Utils.themeStyle === 'light';

        const styleClass = lightTheme ? 'astra-monitor-menu-key-light' : 'astra-monitor-menu-key';
        this.totalUploadSpeedValueLabel.style_class = styleClass;
        this.totalDownloadSpeedValueLabel.style_class = styleClass;

        this.publicIPv4.value.style_class = styleClass;
        this.publicIpv6.value1.style_class = styleClass;
        this.publicIpv6.value2.style_class = styleClass;

        this.defaultRouteGateway.style_class = styleClass;
    }

    createActivitySection() {
        const defaultStyle = '';

        const hoverButton = new St.Button({
            reactive: true,
            track_hover: true,
            style: defaultStyle
        });

        const grid = new Grid({ styleClass: 'astra-monitor-menu-subgrid' });
        hoverButton.set_child(grid);

        //TODO: make width customizable!?
        this.graph = new NetworkGraph({
            width: 200 - 2 - 15,
            mini: false
        });
        grid.addToGrid(this.graph, 2);

        const totalUploadSpeedLabel = new St.Label({
            text: _('Global Upload:'),
            x_expand: true,
            style_class: 'astra-monitor-menu-label',
            style: 'margin-top:0.25em;'
        });
        grid.addToGrid(totalUploadSpeedLabel);

        this.totalUploadSpeedValueLabel = new St.Label({
            text: '-',
            x_expand: true
        });
        grid.addToGrid(this.totalUploadSpeedValueLabel);

        const totalDownloadSpeedLabel = new St.Label({
            text: _('Global Download:'),
            x_expand: true,
            style_class: 'astra-monitor-menu-label'
        });
        grid.addToGrid(totalDownloadSpeedLabel);

        this.totalDownloadSpeedValueLabel = new St.Label({
            text: '-',
            x_expand: true
        });
        grid.addToGrid(this.totalDownloadSpeedValueLabel);

        this.createActivityPopup(hoverButton);

        hoverButton.connect('enter-event', () => {
            hoverButton.style = defaultStyle + this.selectionStyle;
            if(this.networkActivityPopup) this.networkActivityPopup.open(true);
        });

        hoverButton.connect('leave-event', () => {
            hoverButton.style = defaultStyle;
            if(this.networkActivityPopup) this.networkActivityPopup.close(true);
        });

        this.addToMenu(hoverButton, 2);
    }

    createActivityPopup(sourceActor: St.Widget) {
        this.networkActivityPopup = new MenuBase(sourceActor, 0.05, { numCols: 2 });
        this.networkActivityPopup.addMenuSection(_('Upload Activity'));

        //Total
        this.networkActivityPopup.addToMenu(
            new St.Label({
                text: _('Total'),
                style_class: 'astra-monitor-menu-sub-key'
            })
        );

        const totalUploadedValueLabel = new St.Label({ text: '', style: 'text-align:left;' });
        this.networkActivityPopup.addToMenu(totalUploadedValueLabel);
        this.networkActivityPopup.totalUploadedValueLabel = totalUploadedValueLabel;

        //Packets
        this.networkActivityPopup.addToMenu(
            new St.Label({
                text: _('Packets'),
                style_class: 'astra-monitor-menu-sub-key'
            })
        );

        const packetsUploadedValueLabel = new St.Label({ text: '', style: 'text-align:left;' });
        this.networkActivityPopup.addToMenu(packetsUploadedValueLabel);
        this.networkActivityPopup.packetsUploadedValueLabel = packetsUploadedValueLabel;

        //Errors
        this.networkActivityPopup.addToMenu(
            new St.Label({
                text: _('Errors/Dropped'),
                style_class: 'astra-monitor-menu-sub-key'
            })
        );

        const errorsUploadValueLabel = new St.Label({ text: '', style: 'text-align:left;' });
        this.networkActivityPopup.addToMenu(errorsUploadValueLabel);
        this.networkActivityPopup.errorsUploadValueLabel = errorsUploadValueLabel;

        this.networkActivityPopup.addMenuSection(_('Download Activity'));

        //Total
        this.networkActivityPopup.addToMenu(
            new St.Label({
                text: _('Total'),
                style_class: 'astra-monitor-menu-sub-key'
            })
        );

        const totalDownloadedValueLabel = new St.Label({ text: '', style: 'text-align:left;' });
        this.networkActivityPopup.addToMenu(totalDownloadedValueLabel);
        this.networkActivityPopup.totalDownloadedValueLabel = totalDownloadedValueLabel;

        //Packets
        this.networkActivityPopup.addToMenu(
            new St.Label({
                text: _('Packets'),
                style_class: 'astra-monitor-menu-sub-key'
            })
        );

        const packetsDownloadedValueLabel = new St.Label({ text: '', style: 'text-align:left;' });
        this.networkActivityPopup.addToMenu(packetsDownloadedValueLabel);
        this.networkActivityPopup.packetsDownloadedValueLabel = packetsDownloadedValueLabel;

        //Errors
        this.networkActivityPopup.addToMenu(
            new St.Label({
                text: _('Errors/Dropped'),
                style_class: 'astra-monitor-menu-sub-key'
            })
        );

        const errorsDownloadValueLabel = new St.Label({ text: '', style: 'text-align:left;' });
        this.networkActivityPopup.addToMenu(errorsDownloadValueLabel);
        this.networkActivityPopup.errorsDownloadValueLabel = errorsDownloadValueLabel;
    }

    createPublicIps() {
        this.publicIPLabel = this.addMenuSection(_('Public IP'));

        const defaultStyle = '';

        this.publicIPContainer = new St.Button({
            reactive: true,
            track_hover: true,
            style: defaultStyle
        });

        const grid = new Grid({ styleClass: 'astra-monitor-menu-subgrid' });
        this.publicIPContainer.set_child(grid);

        const publicIPv4Label = new St.Label({
            text: _('Public IPv4:'),
            x_expand: true,
            style_class: 'astra-monitor-menu-label',
            style: 'margin-top:0.25em;'
        });
        grid.addToGrid(publicIPv4Label);

        const publicIPv4Value = new St.Label({
            text: '-',
            x_expand: true
        });
        grid.addToGrid(publicIPv4Value);

        this.publicIPv4 = {
            label: publicIPv4Label,
            value: publicIPv4Value
        };

        const publicIpv6Grid = new Grid({ styleClass: 'astra-monitor-menu-subgrid', numCols: 2 });

        const publicIpv6Label = new St.Label({
            text: _('Public IPv6:'),
            x_expand: true,
            style_class: 'astra-monitor-menu-label'
        });
        publicIpv6Grid.addGrid(publicIpv6Label, 1, 1, 1, 2);

        const publicIpv6Value1 = new St.Label({
            text: '-',
            x_expand: true,
            style: 'font-size: 1em;'
        });
        publicIpv6Grid.addGrid(publicIpv6Value1, 2, 1, 1, 1);

        const publicIpv6Value2 = new St.Label({
            text: '-',
            x_expand: true,
            style: 'font-size: 1em;'
        });
        publicIpv6Grid.addGrid(publicIpv6Value2, 2, 2, 1, 1);

        grid.addToGrid(publicIpv6Grid, 2);

        const footerLabel = new St.Label({
            text: '',
            style_class: 'astra-monitor-menu-key-mid-center'
        });
        grid.addToGrid(footerLabel, 2);

        this.publicIpv6 = {
            label: publicIpv6Label,
            value1: publicIpv6Value1,
            value2: publicIpv6Value2,
            footerLabel: footerLabel,
            refreshStatus: RefreshStatus.IDLE
        };

        this.publicIPContainer.connect('enter-event', () => {
            this.publicIPContainer.style = defaultStyle + this.selectionStyle;
        });

        this.publicIPContainer.connect('leave-event', () => {
            this.publicIPContainer.style = defaultStyle;
        });

        this.publicIPContainer.connect('clicked', () => {
            if(this.publicIpv6.refreshStatus !== RefreshStatus.IDLE) return;
            this.publicIpv6.refreshStatus = RefreshStatus.REFRESHING;
            this.updateIpsFooterLablel();
            Utils.networkMonitor.updatePublicIps(true);
        });

        this.addToMenu(this.publicIPContainer, 2);
    }

    updateIpsFooterLablel() {
        const seconds = Utils.networkMonitor.secondsSinceLastIpsUpdate;

        let lastUpdate = _('Updated a long time ago');
        if(seconds < 15) lastUpdate = _('Updated a few seconds ago');
        else if(seconds < 45) lastUpdate = _('Updated less than a minute ago');
        else if(seconds < 90) lastUpdate = _('Updated about a minute ago');
        else if(seconds < 150) lastUpdate = _('Updated about 2 minutes ago');
        else if(seconds < 330) lastUpdate = _('Updated about 5 minutes ago');
        else if(seconds < 600) lastUpdate = _('Updated more than 5 minutes ago');

        let refreshStatus = _('Click to refresh');
        if(this.publicIpv6.refreshStatus === RefreshStatus.REFRESHING)
            refreshStatus = _('Refreshing...');
        else if(this.publicIpv6.refreshStatus === RefreshStatus.DONE) refreshStatus = _('Done');

        this.publicIpv6.footerLabel.text = lastUpdate + ' - ' + refreshStatus;
    }

    createRoutes() {
        this.addMenuSection(_('Default Routes'));

        const defaultStyle = '';

        const hoverButton = new St.Button({
            reactive: true,
            track_hover: true,
            style: defaultStyle
        });

        const grid = new Grid({ styleClass: 'astra-monitor-menu-subgrid' });
        hoverButton.set_child(grid);

        this.defaultRouteDevice = new St.Label({
            text: '',
            x_expand: true,
            style_class: 'astra-monitor-menu-label',
            style: 'margin-top:0.25em;'
        });
        grid.addToGrid(this.defaultRouteDevice);

        this.defaultRouteGateway = new St.Label({
            text: '-',
            x_expand: true
        });
        grid.addToGrid(this.defaultRouteGateway);

        this.createRoutesPopup(hoverButton);

        hoverButton.connect('enter-event', () => {
            hoverButton.style = defaultStyle + this.selectionStyle;

            if(this.routesPopup) this.routesPopup.open(true);
        });

        hoverButton.connect('leave-event', () => {
            hoverButton.style = defaultStyle;

            if(this.routesPopup) this.routesPopup.close(true);
        });

        this.addToMenu(hoverButton, 2);
    }

    createRoutesPopup(sourceActor: St.Widget) {
        this.routesPopup = new MenuBase(sourceActor, 0.05, { numCols: 2 }) as RoutesPopup;
        this.routesPopup.routes = [];

        for(let i = 0; i < 5; i++) {
            const titleLabel = new St.Label({
                text: _('Route') + ` ${i}`,
                style_class: 'astra-monitor-menu-header-centered',
                x_expand: true
            });
            this.routesPopup.addToMenu(titleLabel, 2);

            const metricLabel = new St.Label({
                text: _('Metric'),
                style_class: 'astra-monitor-menu-sub-key'
            });
            this.routesPopup.addToMenu(metricLabel);
            const metricValue = new St.Label({ text: '', style: 'text-align:left;' });
            this.routesPopup.addToMenu(metricValue);

            const deviceLabel = new St.Label({
                text: _('Device'),
                style_class: 'astra-monitor-menu-sub-key'
            });
            this.routesPopup.addToMenu(deviceLabel);
            const deviceValue = new St.Label({ text: '', style: 'text-align:left;' });
            this.routesPopup.addToMenu(deviceValue);

            const gatewayLabel = new St.Label({
                text: _('Gateway'),
                style_class: 'astra-monitor-menu-sub-key'
            });
            this.routesPopup.addToMenu(gatewayLabel);
            const gatewayValue = new St.Label({ text: '', style: 'text-align:left;' });
            this.routesPopup.addToMenu(gatewayValue);

            const typeLabel = new St.Label({
                text: _('Type'),
                style_class: 'astra-monitor-menu-sub-key'
            });
            this.routesPopup.addToMenu(typeLabel);
            const typeValue = new St.Label({ text: '', style: 'text-align:left;' });
            this.routesPopup.addToMenu(typeValue);

            const destinationLabel = new St.Label({
                text: _('Destination'),
                style_class: 'astra-monitor-menu-sub-key'
            });
            this.routesPopup.addToMenu(destinationLabel);
            const destinationValue = new St.Label({ text: '', style: 'text-align:left;' });
            this.routesPopup.addToMenu(destinationValue);

            const protocolLabel = new St.Label({
                text: _('Protocol'),
                style_class: 'astra-monitor-menu-sub-key'
            });
            this.routesPopup.addToMenu(protocolLabel);
            const protocolValue = new St.Label({ text: '', style: 'text-align:left;' });
            this.routesPopup.addToMenu(protocolValue);

            const scopeLabel = new St.Label({
                text: _('Scope'),
                style_class: 'astra-monitor-menu-sub-key'
            });
            this.routesPopup.addToMenu(scopeLabel);
            const scopeValue = new St.Label({ text: '', style: 'text-align:left;' });
            this.routesPopup.addToMenu(scopeValue);

            const flagsLabel = new St.Label({
                text: _('Flags'),
                style_class: 'astra-monitor-menu-sub-key'
            });
            this.routesPopup.addToMenu(flagsLabel);
            const flagsValue = new St.Label({ text: '', style: 'text-align:left;' });
            this.routesPopup.addToMenu(flagsValue);

            this.routesPopup.routes.push({
                titleLabel,
                metricLabel,
                metricValue,
                typeLabel,
                typeValue,
                deviceLabel,
                deviceValue,
                destinationLabel,
                destinationValue,
                gatewayLabel,
                gatewayValue,
                protocolLabel,
                protocolValue,
                scopeLabel,
                scopeValue,
                flagsLabel,
                flagsValue
            });
        }
    }

    createDeviceList() {
        if(this.deviceSection === undefined) {
            this.addMenuSection(_('Interfaces'));

            this.deviceSection = new Grid({ styleClass: 'astra-monitor-menu-subgrid' });
            this.noDevicesLabel = new St.Label({
                text: _('No network interface found'),
                style_class: 'astra-monitor-menu-label-warning',
                style: 'font-style:italic;'
            });
            this.deviceSection.addToGrid(this.noDevicesLabel, 2);
            this.devices = new Map();
            this.devicesInfoPopup = new Map();
            this.devicesAddressesPopup = new Map();
            this.devicesTotalsPopup = new Map();
            this.devicesWirelessPopup = new Map();
            this.addToMenu(this.deviceSection, 2);

            Config.connect(this, 'changed::network-ignored', this.updateDeviceList.bind(this));
            Config.connect(
                this,
                'changed::network-ignored-regex',
                this.updateDeviceList.bind(this)
            );
        }
    }

    updateDeviceList() {
        const devices = Utils.getNetworkInterfacesSync();
        if(devices.size > 0) this.noDevicesLabel.hide();
        else this.noDevicesLabel.show();

        //filter ignored devices
        const ignoredDevices = Config.get_json('network-ignored');
        if(ignoredDevices && Array.isArray(ignoredDevices) && ignoredDevices.length > 0) {
            for(const id of ignoredDevices) {
                if(devices.has(id)) devices.delete(id);
            }
        }

        const ignoredRegex = Config.get_string('network-ignored-regex');
        if(ignoredRegex) {
            try {
                const regex = new RegExp(`^${ignoredRegex}$`, 'i');
                for(const [id, device] of devices.entries()) {
                    if(regex.test(device.name)) devices.delete(id);
                }
            } catch(e) {
                //Not a valid regex
            }
        }

        // remove all devices that are not present anymore
        for(const [id, device] of this.devices.entries()) {
            if(!devices.has(id)) {
                this.deviceSection.remove_child(device.container);
                this.devices.delete(id);

                this.devicesInfoPopup.get(id)?.close(true);
                this.devicesInfoPopup.get(id)?.destroy();
                this.devicesInfoPopup.delete(id);

                this.devicesAddressesPopup.get(id)?.close(true);
                this.devicesAddressesPopup.get(id)?.destroy();
                this.devicesAddressesPopup.delete(id);

                this.devicesTotalsPopup.get(id)?.close(true);
                this.devicesTotalsPopup.get(id)?.destroy();
                this.devicesTotalsPopup.delete(id);

                this.devicesWirelessPopup.get(id)?.close(true);
                this.devicesWirelessPopup.get(id)?.destroy();
                this.devicesWirelessPopup.delete(id);
            }
        }

        // add new devices / update existing devices
        const idList = Array.from(devices.keys());

        // TODO: set main interface first

        for(const id of idList) {
            const deviceData = devices.get(id);

            let device;
            let infoPopup;
            let addressesPopup;
            let totalsPopup;
            let wirelessPopup;

            if(!this.devices.has(id)) {
                device = this.createInterfaceDevice(id);
                this.deviceSection.addToGrid(device.container, 2);
                this.devices.set(id, device);
            } else {
                device = this.devices.get(id);
            }

            if(!device) continue;

            //Info Popup
            if(!this.devicesInfoPopup.has(id)) {
                infoPopup = this.createDeviceInfoPopup(device.container);
                this.devicesInfoPopup.set(id, infoPopup);
            } else {
                infoPopup = this.devicesInfoPopup.get(id);
            }
            if(!infoPopup) continue;

            //Addresses Popup
            if(!this.devicesAddressesPopup.has(id)) {
                addressesPopup = this.createDeviceAddressesPopup(device.container);
                this.devicesAddressesPopup.set(id, addressesPopup);
            } else {
                addressesPopup = this.devicesAddressesPopup.get(id);
            }
            if(!addressesPopup) continue;

            //Totals Popup
            if(!this.devicesTotalsPopup.has(id)) {
                totalsPopup = this.createDeviceTotalsPopup(device.container);
                this.devicesTotalsPopup.set(id, totalsPopup);
            } else {
                totalsPopup = this.devicesTotalsPopup.get(id);
            }
            if(!totalsPopup) continue;

            //Wireless Popup
            if(!this.devicesWirelessPopup.has(id)) {
                wirelessPopup = this.createDeviceWirelessPopup(device.container);
                this.devicesWirelessPopup.set(id, wirelessPopup);
            } else {
                wirelessPopup = this.devicesWirelessPopup.get(id);
            }
            if(!wirelessPopup) continue;

            //Update device info
            if(!deviceData) continue;
            try {
                this.updateInterfaceDevice(
                    device,
                    infoPopup,
                    addressesPopup,
                    totalsPopup,
                    wirelessPopup,
                    deviceData
                );
            } catch(e: any) {
                Utils.error(e);
            }
        }
    }

    createInterfaceDevice(id: string): InterfaceDeviceInfo {
        const container = new Grid({
            x_expand: true,
            styleClass: 'astra-monitor-menu-subgrid',
            style: 'padding-top:0.3em;margin-bottom:0.3em;'
        });

        //Header Grid
        //{
        const headerGrid = new Grid({
            numCols: 2,
            styleClass: 'astra-monitor-menu-subgrid'
        });

        const nameGrid = new Grid({
            numCols: 2,
            styleClass: 'astra-monitor-menu-subgrid',
            style: 'backgrund-color:red;'
        });

        const nameButton = new St.Button({
            reactive: true,
            track_hover: true,
            x_expand: true,
            style: ''
        });
        nameButton.set_child(nameGrid);

        nameButton.connect('enter-event', () => {
            nameButton.style = this.selectionStyle;

            const popup = this.devicesInfoPopup.get(id);
            popup?.open(true);
        });

        nameButton.connect('leave-event', () => {
            nameButton.style = '';

            const popup = this.devicesInfoPopup.get(id);
            popup?.close(true);
        });
        headerGrid.addToGrid(nameButton);

        const icon = new St.Icon({
            style_class: 'astra-monitor-menu-icon',
            style: 'padding-left:0.25em;'
        });
        nameGrid.addToGrid(icon);

        const label = new St.Label({
            text: '',
            style_class: 'astra-monitor-menu-label'
        });
        nameGrid.addToGrid(label);

        const ipButton = new St.Button({
            reactive: true,
            track_hover: true,
            x_expand: true,
            style: ''
        });

        const label2 = new St.Label({
            text: '',
            x_expand: true,
            style_class: 'astra-monitor-menu-key-mid'
        });
        ipButton.set_child(label2);

        ipButton.connect('enter-event', () => {
            ipButton.style = this.selectionStyle;

            const popup = this.devicesAddressesPopup.get(id);
            if(popup && popup.addresses.length > 0 && popup.addresses[0].labelValue.visible)
                popup.open(true);
        });

        ipButton.connect('leave-event', () => {
            ipButton.style = '';

            const popup = this.devicesAddressesPopup.get(id);
            popup?.close(true);
        });
        headerGrid.addToGrid(ipButton);

        container.addToGrid(headerGrid, 2);
        //}

        // Upload/Download Speed
        //{
        const rwButton = new St.Button({
            reactive: true,
            track_hover: true,
            x_expand: true,
            style: ''
        });

        const rwContainer = new St.Widget({
            layout_manager: new Clutter.GridLayout({ orientation: Clutter.Orientation.HORIZONTAL }),
            x_expand: true,
            style: 'margin-left:0;margin-right:0;'
        });
        rwButton.set_child(rwContainer);

        const uploadContainer = new St.Widget({
            layout_manager: new Clutter.GridLayout({ orientation: Clutter.Orientation.HORIZONTAL }),
            x_expand: true,
            style: 'margin-left:0;margin-right:0;'
        });

        const uploadLabel = new St.Label({
            text: pgettext('short for upload', 'U'),
            style_class: 'astra-monitor-menu-label',
            style: 'padding-right:0.15em;'
        });
        uploadContainer.add_child(uploadLabel);

        const uploadActivityIcon = new St.Icon({
            gicon: Utils.getLocalIcon('am-up-symbolic'),
            fallback_icon_name: 'network-transmit-symbolic',
            style_class: 'astra-monitor-menu-icon-mini',
            style: 'color:rgba(255,255,255,0.5);'
        });
        uploadContainer.add_child(uploadActivityIcon);

        const uploadValueLabel = new St.Label({
            text: '-',
            x_expand: true,
            style_class: 'astra-monitor-menu-key-mid'
        });
        uploadContainer.add_child(uploadValueLabel);
        uploadContainer.set_width(100);

        rwContainer.add_child(uploadContainer);

        const downloadContainer = new St.Widget({
            layout_manager: new Clutter.GridLayout({ orientation: Clutter.Orientation.HORIZONTAL }),
            x_expand: true,
            style: 'margin-left:0;margin-right:0;'
        });

        const downloadLabel = new St.Label({
            text: pgettext('short for download', 'D'),
            style_class: 'astra-monitor-menu-label',
            style: 'padding-right:0.15em;'
        });
        downloadContainer.add_child(downloadLabel);

        const downloadActivityIcon = new St.Icon({
            gicon: Utils.getLocalIcon('am-down-symbolic'),
            fallback_icon_name: 'network-receive-symbolic',
            style_class: 'astra-monitor-menu-icon-mini',
            style: 'color:rgba(255,255,255,0.5);'
        });
        downloadContainer.add_child(downloadActivityIcon);

        const downloadValueLabel = new St.Label({
            text: '-',
            x_expand: true,
            style_class: 'astra-monitor-menu-key-mid'
        });
        downloadContainer.add_child(downloadValueLabel);
        downloadContainer.set_width(100);

        rwContainer.add_child(downloadContainer);

        rwButton.connect('enter-event', () => {
            rwButton.style = this.selectionStyle;

            const popup = this.devicesTotalsPopup.get(id);
            popup?.open(true);
        });

        rwButton.connect('leave-event', () => {
            rwButton.style = '';

            const popup = this.devicesTotalsPopup.get(id);
            popup?.close(true);
        });

        container.addToGrid(rwButton, 2);
        //}

        const wirelessButtonStyle = 'margin-bottom:0.5em;';
        const wirelessButton = new St.Button({
            reactive: true,
            track_hover: true,
            x_expand: true,
            style: wirelessButtonStyle
        });

        const wirelessLabel = new St.Label({
            text: '',
            x_expand: true,
            style_class: 'astra-monitor-menu-special',
            style: 'padding-right:0.15em;'
        });
        wirelessButton.set_child(wirelessLabel);

        wirelessButton.connect('enter-event', () => {
            wirelessButton.style = wirelessButtonStyle + this.selectionStyle;

            const popup = this.devicesWirelessPopup.get(id);
            popup?.open(true);
        });

        wirelessButton.connect('leave-event', () => {
            wirelessButton.style = wirelessButtonStyle;

            const popup = this.devicesWirelessPopup.get(id);
            popup?.close(true);
        });

        container.addToGrid(wirelessButton, 2);

        return {
            data: null,
            container,
            icon,
            label,
            label2,
            uploadValueLabel,
            uploadActivityIcon,
            downloadValueLabel,
            downloadActivityIcon,
            wirelessButton,
            wirelessLabel
        };
    }

    createDeviceInfoPopup(sourceActor: St.Widget): DeviceInfoPopup {
        const popup: DeviceInfoPopup = new MenuBase(sourceActor, 0.05, {
            numCols: 2
        }) as DeviceInfoPopup;

        //Info
        popup.addMenuSection(_('Info'));
        {
            //Name
            popup.addToMenu(
                new St.Label({
                    text: _('Name'),
                    style_class: 'astra-monitor-menu-sub-key'
                })
            );

            const nameLabel = new St.Label({ text: '', style: 'text-align:left;' });
            popup.addToMenu(nameLabel);
            popup.nameValue = nameLabel;

            // Alt Names
            const altNamesLabel = new St.Label({
                text: _('Alt Names'),
                style_class: 'astra-monitor-menu-sub-key'
            });
            popup.addToMenu(altNamesLabel);
            popup.altNamesLabel = altNamesLabel;

            const altNamesValue = new St.Label({ text: '', style: 'text-align:left;' });
            popup.addToMenu(altNamesValue);
            popup.altNamesValue = altNamesValue;

            // Ifindex
            const ifindexLabel = new St.Label({
                text: _('Interface Index'),
                style_class: 'astra-monitor-menu-sub-key'
            });
            popup.addToMenu(ifindexLabel);
            popup.ifindexLabel = ifindexLabel;

            const ifindexValue = new St.Label({ text: '', style: 'text-align:left;' });
            popup.addToMenu(ifindexValue);
            popup.ifindexValue = ifindexValue;

            // Mac Address
            const macAddressLabel = new St.Label({
                text: _('MAC Address'),
                style_class: 'astra-monitor-menu-sub-key'
            });
            popup.addToMenu(macAddressLabel);
            popup.macAddressLabel = macAddressLabel;

            const macAddressValue = new St.Label({ text: '', style: 'text-align:left;' });
            popup.addToMenu(macAddressValue);
            popup.macAddressValue = macAddressValue;

            // Group
            const groupLabel = new St.Label({
                text: _('Group'),
                style_class: 'astra-monitor-menu-sub-key'
            });
            popup.addToMenu(groupLabel);
            popup.groupLabel = groupLabel;

            const groupValue = new St.Label({ text: '', style: 'text-align:left;' });
            popup.addToMenu(groupValue);
            popup.groupValue = groupValue;

            // Speed
            const speedLabel = new St.Label({
                text: _('Speed'),
                style_class: 'astra-monitor-menu-sub-key'
            });
            popup.addToMenu(speedLabel);
            popup.speedLabel = speedLabel;

            const speedValue = new St.Label({ text: '', style: 'text-align:left;' });
            popup.addToMenu(speedValue);
            popup.speedValue = speedValue;

            // Duplex
            const duplexLabel = new St.Label({
                text: _('Duplex'),
                style_class: 'astra-monitor-menu-sub-key'
            });
            popup.addToMenu(duplexLabel);
            popup.duplexLabel = duplexLabel;

            const duplexValue = new St.Label({ text: '', style: 'text-align:left;' });
            popup.addToMenu(duplexValue);
            popup.duplexValue = duplexValue;

            // MTU
            const mtuLabel = new St.Label({
                text: _('MTU'),
                style_class: 'astra-monitor-menu-sub-key'
            });
            popup.addToMenu(mtuLabel);
            popup.mtuLabel = mtuLabel;

            const mtuValue = new St.Label({ text: '', style: 'text-align:left;' });
            popup.addToMenu(mtuValue);
            popup.mtuValue = mtuValue;

            // Tx Queue Length
            const txQueueLabel = new St.Label({
                text: _('Tx Queue Length'),
                style_class: 'astra-monitor-menu-sub-key'
            });
            popup.addToMenu(txQueueLabel);
            popup.txQueueLabel = txQueueLabel;

            const txQueueValue = new St.Label({ text: '', style: 'text-align:left;' });
            popup.addToMenu(txQueueValue);
            popup.txQueueValue = txQueueValue;

            // Link Type
            const linkTypeLabel = new St.Label({
                text: _('Link Type'),
                style_class: 'astra-monitor-menu-sub-key'
            });
            popup.addToMenu(linkTypeLabel);
            popup.linkTypeLabel = linkTypeLabel;

            const linkTypeValue = new St.Label({ text: '', style: 'text-align:left;' });
            popup.addToMenu(linkTypeValue);
            popup.linkTypeValue = linkTypeValue;

            // Operative State
            const operativeStateLabel = new St.Label({
                text: _('Operative State'),
                style_class: 'astra-monitor-menu-sub-key'
            });
            popup.addToMenu(operativeStateLabel);
            popup.operStateLabel = operativeStateLabel;

            const operativeStateValue = new St.Label({ text: '', style: 'text-align:left;' });
            popup.addToMenu(operativeStateValue);
            popup.operStateValue = operativeStateValue;

            // Qdisc
            const qdiscLabel = new St.Label({
                text: _('Qdisc'),
                style_class: 'astra-monitor-menu-sub-key'
            });
            popup.addToMenu(qdiscLabel);
            popup.qdiscLabel = qdiscLabel;

            const qdiscValue = new St.Label({ text: '', style: 'text-align:left;' });
            popup.addToMenu(qdiscValue);
            popup.qdiscValue = qdiscValue;

            // Parent
            const parentLabel = new St.Label({
                text: '',
                style_class: 'astra-monitor-menu-sub-key'
            });
            popup.addToMenu(parentLabel);
            popup.parentLabel = parentLabel;

            const parentValue = new St.Label({ text: '', style: 'text-align:left;' });
            popup.addToMenu(parentValue);
            popup.parentValue = parentValue;
        }

        return popup;
    }

    createDeviceAddressesPopup(sourceActor: St.Widget): DeviceAddressesPopup {
        const popup: DeviceAddressesPopup = new MenuBase(sourceActor, 0.05, {
            numCols: 2
        }) as DeviceAddressesPopup;

        //Addresses
        popup.addresses = [];

        for(let i = 0; i < 10; i++) {
            const labelValue = new St.Label({
                text: '',
                style_class: 'astra-monitor-menu-header-centered',
                x_expand: true
            });
            popup.addToMenu(labelValue, 2);

            const familyLabel = new St.Label({
                text: _('Family'),
                style_class: 'astra-monitor-menu-sub-key'
            });
            popup.addToMenu(familyLabel);
            const familyValue = new St.Label({ text: '', style: 'text-align:left;' });
            popup.addToMenu(familyValue);

            const localLabel = new St.Label({
                text: _('Local'),
                style_class: 'astra-monitor-menu-sub-key'
            });
            popup.addToMenu(localLabel);
            const localValue = new St.Label({ text: '', style: 'text-align:left;' });
            popup.addToMenu(localValue);

            const prefixlenLabel = new St.Label({
                text: _('Prefix Length'),
                style_class: 'astra-monitor-menu-sub-key'
            });
            popup.addToMenu(prefixlenLabel);
            const prefixlenValue = new St.Label({ text: '', style: 'text-align:left;' });
            popup.addToMenu(prefixlenValue);

            const broadcastLabel = new St.Label({
                text: _('Broadcast'),
                style_class: 'astra-monitor-menu-sub-key'
            });
            popup.addToMenu(broadcastLabel);
            const broadcastValue = new St.Label({ text: '', style: 'text-align:left;' });
            popup.addToMenu(broadcastValue);

            const scopeLabel = new St.Label({
                text: _('Scope'),
                style_class: 'astra-monitor-menu-sub-key'
            });
            popup.addToMenu(scopeLabel);
            const scopeValue = new St.Label({ text: '', style: 'text-align:left;' });
            popup.addToMenu(scopeValue);

            popup.addresses.push({
                labelValue,
                familyLabel,
                familyValue,
                localLabel,
                localValue,
                prefixlenLabel,
                prefixlenValue,
                broadcastLabel,
                broadcastValue,
                scopeLabel,
                scopeValue
            });
        }

        return popup;
    }

    createDeviceTotalsPopup(sourceActor: St.Widget): DeviceTotalsPopup {
        const popup: DeviceTotalsPopup = new MenuBase(sourceActor, 0.05, {
            numCols: 2
        }) as DeviceTotalsPopup;

        //Upload
        popup.addMenuSection(_('Upload'));
        {
            //Total
            popup.addToMenu(
                new St.Label({
                    text: _('Total'),
                    style_class: 'astra-monitor-menu-sub-key'
                })
            );

            const totalUploadedValueLabel = new St.Label({ text: '', style: 'text-align:left;' });
            popup.addToMenu(totalUploadedValueLabel);
            popup.totalUploadedValueLabel = totalUploadedValueLabel;

            //Packets
            popup.addToMenu(
                new St.Label({
                    text: _('Packets'),
                    style_class: 'astra-monitor-menu-sub-key'
                })
            );

            const packetsUploadedValueLabel = new St.Label({ text: '', style: 'text-align:left;' });
            popup.addToMenu(packetsUploadedValueLabel);
            popup.packetsUploadedValueLabel = packetsUploadedValueLabel;

            //Errors
            popup.addToMenu(
                new St.Label({
                    text: _('Errors/Dropped'),
                    style_class: 'astra-monitor-menu-sub-key'
                })
            );

            const errorsUploadValueLabel = new St.Label({ text: '', style: 'text-align:left;' });
            popup.addToMenu(errorsUploadValueLabel);
            popup.errorsUploadValueLabel = errorsUploadValueLabel;
        }

        //Download
        popup.addMenuSection(_('Download'));
        {
            //Total
            popup.addToMenu(
                new St.Label({
                    text: _('Total'),
                    style_class: 'astra-monitor-menu-sub-key'
                })
            );

            const totalDownloadedValueLabel = new St.Label({ text: '', style: 'text-align:left;' });
            popup.addToMenu(totalDownloadedValueLabel);
            popup.totalDownloadedValueLabel = totalDownloadedValueLabel;

            //Packets
            popup.addToMenu(
                new St.Label({
                    text: _('Packets'),
                    style_class: 'astra-monitor-menu-sub-key'
                })
            );

            const packetsDownloadedValueLabel = new St.Label({
                text: '',
                style: 'text-align:left;'
            });
            popup.addToMenu(packetsDownloadedValueLabel);
            popup.packetsDownloadedValueLabel = packetsDownloadedValueLabel;

            //Errors
            popup.addToMenu(
                new St.Label({
                    text: _('Errors/Dropped'),
                    style_class: 'astra-monitor-menu-sub-key'
                })
            );

            const errorsDownloadValueLabel = new St.Label({ text: '', style: 'text-align:left;' });
            popup.addToMenu(errorsDownloadValueLabel);
            popup.errorsDownloadValueLabel = errorsDownloadValueLabel;
        }

        return popup;
    }

    createDeviceWirelessPopup(sourceActor: St.Widget): DeviceWirelessPopup {
        const popup: DeviceWirelessPopup = new MenuBase(sourceActor, 0.05, {
            numCols: 2
        }) as DeviceWirelessPopup;

        const IEEELabel = new St.Label({
            text: _('IEEE'),
            style_class: 'astra-monitor-menu-sub-key'
        });
        popup.addToMenu(IEEELabel);
        popup.IEEELabel = IEEELabel;

        const IEEEValue = new St.Label({
            text: '',
            style: 'text-align:left;'
        });
        popup.addToMenu(IEEEValue);
        popup.IEEEValue = IEEEValue;

        const SSIDLabel = new St.Label({
            text: _('SSID'),
            style_class: 'astra-monitor-menu-sub-key'
        });
        popup.addToMenu(SSIDLabel);
        popup.SSIDLabel = SSIDLabel;

        const SSIDValue = new St.Label({
            text: '',
            style: 'text-align:left;'
        });
        popup.addToMenu(SSIDValue);
        popup.SSIDValue = SSIDValue;

        const modeLabel = new St.Label({
            text: _('Mode'),
            style_class: 'astra-monitor-menu-sub-key'
        });
        popup.addToMenu(modeLabel);
        popup.modeLabel = modeLabel;

        const modeValue = new St.Label({
            text: '',
            style: 'text-align:left;'
        });
        popup.addToMenu(modeValue);
        popup.modeValue = modeValue;

        const frequencyLabel = new St.Label({
            text: _('Frequency'),
            style_class: 'astra-monitor-menu-sub-key'
        });
        popup.addToMenu(frequencyLabel);
        popup.frequencyLabel = frequencyLabel;

        const frequencyValue = new St.Label({
            text: '',
            style: 'text-align:left;'
        });
        popup.addToMenu(frequencyValue);
        popup.frequencyValue = frequencyValue;

        const accessPointLabel = new St.Label({
            text: _('Access Point'),
            style_class: 'astra-monitor-menu-sub-key'
        });
        popup.addToMenu(accessPointLabel);
        popup.accessPointLabel = accessPointLabel;

        const accessPointValue = new St.Label({
            text: '',
            style: 'text-align:left;'
        });
        popup.addToMenu(accessPointValue);
        popup.accessPointValue = accessPointValue;

        const bitRateLabel = new St.Label({
            text: _('Bit Rate'),
            style_class: 'astra-monitor-menu-sub-key'
        });
        popup.addToMenu(bitRateLabel);
        popup.bitRateLabel = bitRateLabel;

        const bitRateValue = new St.Label({
            text: '',
            style: 'text-align:left;'
        });
        popup.addToMenu(bitRateValue);
        popup.bitRateValue = bitRateValue;

        const txPowerLabel = new St.Label({
            text: _('TX Power'),
            style_class: 'astra-monitor-menu-sub-key'
        });
        popup.addToMenu(txPowerLabel);
        popup.txPowerLabel = txPowerLabel;

        const txPowerValue = new St.Label({
            text: '',
            style: 'text-align:left;'
        });
        popup.addToMenu(txPowerValue);
        popup.txPowerValue = txPowerValue;

        const linkQualityLabel = new St.Label({
            text: _('Link Quality'),
            style_class: 'astra-monitor-menu-sub-key'
        });
        popup.addToMenu(linkQualityLabel);
        popup.linkQualityLabel = linkQualityLabel;

        const linkQualityValue = new St.Label({
            text: '',
            style: 'text-align:left;'
        });
        popup.addToMenu(linkQualityValue);
        popup.linkQualityValue = linkQualityValue;

        const signalLevelLabel = new St.Label({
            text: _('Signal Level'),
            style_class: 'astra-monitor-menu-sub-key'
        });
        popup.addToMenu(signalLevelLabel);
        popup.signalLevelLabel = signalLevelLabel;

        const signalLevelValue = new St.Label({
            text: '',
            style: 'text-align:left;'
        });
        popup.addToMenu(signalLevelValue);
        popup.signalLevelValue = signalLevelValue;

        return popup;
    }

    updateInterfaceDevice(
        device: InterfaceDeviceInfo,
        infoPopup: DeviceInfoPopup,
        addressesPopup: DeviceAddressesPopup,
        _totalsPopup: DeviceTotalsPopup,
        _wirelessPopup: DeviceWirelessPopup,
        deviceData: InterfaceInfo
    ) {
        device.data = deviceData;

        const icon = {
            gicon: Utils.getLocalIcon('am-network-symbolic'),
            fallback_icon_name: 'network-wired-symbolic'
        };
        if(deviceData.name.startsWith('wlan') || deviceData.name.startsWith('wl')) {
            icon.gicon = Utils.getLocalIcon('am-wireless-symbolic');
            icon.fallback_icon_name = 'network-wireless-symbolic';
        } else if(deviceData.name.startsWith('wwan') || deviceData.name.startsWith('ww')) {
            icon.fallback_icon_name = 'network-cellular-symbolic';
        } else if(deviceData.name.startsWith('tun') || deviceData.name.startsWith('tap')) {
            icon.gicon = Utils.getLocalIcon('am-vpn-symbolic');
            icon.fallback_icon_name = 'network-vpn-symbolic';
        } else if(deviceData.name.includes('br')) {
            icon.gicon = Utils.getLocalIcon('am-bridge-symbolic');
            icon.fallback_icon_name = 'network-wired-symbolic';
        }

        if(icon.gicon) device.icon.gicon = icon.gicon;
        device.icon.fallback_icon_name = icon.fallback_icon_name;

        device.label.text = deviceData.name;

        let label2 = '';

        if(deviceData.addr_info && deviceData.addr_info.length > 0) {
            const addr = deviceData.addr_info[0];
            if(addr.local) label2 = addr.local;
        } else if(deviceData.altnames && deviceData.altnames.length > 0) {
            label2 = deviceData.altnames[0];
        }

        device.label2.text = label2;

        if(infoPopup) {
            if(deviceData.name && infoPopup.nameValue) infoPopup.nameValue.text = deviceData.name;

            if(deviceData.altnames && deviceData.altnames.length > 0 && infoPopup.altNamesValue) {
                infoPopup.altNamesLabel?.show();
                infoPopup.altNamesValue?.show();
                infoPopup.altNamesValue.text = deviceData.altnames.join(', ');
            } else {
                infoPopup.altNamesLabel?.hide();
                infoPopup.altNamesValue?.hide();
            }

            if(deviceData.ifindex && infoPopup.ifindexValue) {
                infoPopup.ifindexLabel?.show();
                infoPopup.ifindexValue?.show();
                infoPopup.ifindexValue.text = deviceData.ifindex.toString();
            } else {
                infoPopup.ifindexLabel?.hide();
                infoPopup.ifindexValue?.hide();
            }

            if(deviceData.address && infoPopup.macAddressValue) {
                infoPopup.macAddressLabel?.show();
                infoPopup.macAddressValue?.show();
                infoPopup.macAddressValue.text = deviceData.address;
            } else {
                infoPopup.macAddressLabel?.hide();
                infoPopup.macAddressValue?.hide();
            }

            if(deviceData.group && infoPopup.groupValue) {
                infoPopup.groupLabel?.show();
                infoPopup.groupValue?.show();
                infoPopup.groupValue.text = deviceData.group;
            } else {
                infoPopup.groupLabel?.hide();
                infoPopup.groupValue?.hide();
            }

            if(deviceData.speed && infoPopup.speedValue) {
                infoPopup.speedLabel?.show();
                infoPopup.speedValue?.show();
                infoPopup.speedValue.text = `${deviceData.speed} Mb/s`;
            } else {
                infoPopup.speedLabel?.hide();
                infoPopup.speedValue?.hide();
            }

            if(deviceData.duplex && infoPopup.duplexValue) {
                infoPopup.duplexLabel?.show();
                infoPopup.duplexValue?.show();
                infoPopup.duplexValue.text = deviceData.duplex;
            } else {
                infoPopup.duplexLabel?.hide();
                infoPopup.duplexValue?.hide();
            }

            if(deviceData.mtu && infoPopup.mtuValue) {
                infoPopup.mtuLabel?.show();
                infoPopup.mtuValue?.show();
                infoPopup.mtuValue.text = deviceData.mtu.toString();
            } else {
                infoPopup.mtuLabel?.hide();
                infoPopup.mtuValue?.hide();
            }

            if(deviceData.txqlen && infoPopup.txQueueValue) {
                infoPopup.txQueueLabel?.show();
                infoPopup.txQueueValue?.show();
                infoPopup.txQueueValue.text = deviceData.txqlen.toString();
            } else {
                infoPopup.txQueueLabel?.hide();
                infoPopup.txQueueValue?.hide();
            }

            if(deviceData.link_type && infoPopup.linkTypeValue) {
                infoPopup.linkTypeLabel?.show();
                infoPopup.linkTypeValue?.show();
                infoPopup.linkTypeValue.text = deviceData.link_type;
            } else {
                infoPopup.linkTypeLabel?.hide();
                infoPopup.linkTypeValue?.hide();
            }

            if(deviceData.operstate && infoPopup.operStateValue) {
                infoPopup.operStateLabel?.show();
                infoPopup.operStateValue?.show();
                infoPopup.operStateValue.text = deviceData.operstate;
            } else {
                infoPopup.operStateLabel?.hide();
                infoPopup.operStateValue?.hide();
            }

            if(deviceData.qdisc && infoPopup.qdiscValue) {
                infoPopup.qdiscLabel?.show();
                infoPopup.qdiscValue?.show();
                infoPopup.qdiscValue.text = deviceData.qdisc;
            } else {
                infoPopup.qdiscLabel?.hide();
                infoPopup.qdiscValue?.hide();
            }

            if(
                deviceData.parentbus &&
                deviceData.parentdev &&
                infoPopup.parentLabel &&
                infoPopup.parentValue
            ) {
                infoPopup.parentLabel?.show();
                infoPopup.parentValue?.show();
                infoPopup.parentLabel.text = deviceData.parentbus;
                infoPopup.parentValue.text = deviceData.parentdev;
            } else {
                infoPopup.parentLabel?.hide();
                infoPopup.parentValue?.hide();
            }
        }

        if(addressesPopup) {
            //Addresses
            for(let i = 0; i < 10; i++) {
                const address = addressesPopup.addresses[i];

                if(address && deviceData.addr_info && deviceData.addr_info[i]) {
                    const addrInfo = deviceData.addr_info[i];

                    let label = 'Address ' + (i + 1);
                    if(addrInfo.label) label += ` [${addrInfo.label}]`;
                    address.labelValue.text = label;

                    if(addrInfo.family) {
                        address.familyLabel.show();
                        address.familyValue.show();
                        address.familyValue.text = addrInfo.family;
                    } else {
                        address.familyLabel.hide();
                        address.familyValue.hide();
                    }

                    if(addrInfo.local) {
                        address.localLabel.show();
                        address.localValue.show();
                        address.localValue.text = addrInfo.local;
                    } else {
                        address.localLabel.hide();
                        address.localValue.hide();
                    }

                    if(addrInfo.prefixlen) {
                        address.prefixlenLabel.show();
                        address.prefixlenValue.show();
                        address.prefixlenValue.text = addrInfo.prefixlen.toString();
                    } else {
                        address.prefixlenLabel.hide();
                        address.prefixlenValue.hide();
                    }

                    if(addrInfo.broadcast) {
                        address.broadcastLabel.show();
                        address.broadcastValue.show();
                        address.broadcastValue.text = addrInfo.broadcast;
                    } else {
                        address.broadcastLabel.hide();
                        address.broadcastValue.hide();
                    }

                    if(addrInfo.scope) {
                        address.scopeLabel.show();
                        address.scopeValue.show();
                        address.scopeValue.text = addrInfo.scope;
                    } else {
                        address.scopeLabel.hide();
                        address.scopeValue.hide();
                    }
                } else {
                    address.labelValue.hide();
                    address.familyLabel.hide();
                    address.familyValue.hide();
                    address.localLabel.hide();
                    address.localValue.hide();
                    address.prefixlenLabel.hide();
                    address.prefixlenValue.hide();
                    address.broadcastLabel.hide();
                    address.broadcastValue.hide();
                    address.scopeLabel.hide();
                    address.scopeValue.hide();
                }
            }
        }
    }

    addUtilityButtons() {
        super.addUtilityButtons('network', box => {
            const button = new St.Button({ style_class: 'button' });
            button.child = new St.Icon({
                gicon: Utils.getLocalIcon('am-network-symbolic'),
                fallback_icon_name: 'network-wired-symbolic'
            });

            button.connect('clicked', () => {
                this.close(true);
                GLib.spawn_command_line_async('gnome-control-center network');
            });
            box.add_child(button);
        });
    }

    async onOpen() {
        this.clear();

        this.update('networkIO');
        Utils.networkMonitor.listen(this, 'networkIO', this.update.bind(this, 'networkIO'));

        Utils.networkMonitor.listen(
            this,
            'detailedNetworkIO',
            this.update.bind(this, 'detailedNetworkIO')
        );
        Utils.networkMonitor.requestUpdate('detailedNetworkIO');

        this.update('publicIps');
        Utils.networkMonitor.listen(this, 'publicIps', this.update.bind(this, 'publicIps'));

        if(this.publicIpv6.refreshStatus === RefreshStatus.IDLE) {
            const updateSeconds = Utils.networkMonitor.secondsSinceLastIpsUpdate;
            if(updateSeconds > 60 && updateSeconds < 60 * 5 - 30) {
                this.publicIpv6.refreshStatus = RefreshStatus.REFRESHING;
                this.updateIpsFooterLablel();
                Utils.networkMonitor.updatePublicIps(true);
            }
        }

        this.update('routes');
        Utils.networkMonitor.listen(this, 'routes', this.update.bind(this, 'routes'));
        Utils.networkMonitor.requestUpdate('routes');

        this.update('wireless');
        Utils.networkMonitor.listen(this, 'wireless', this.update.bind(this, 'wireless'));
        Utils.networkMonitor.requestUpdate('wireless');

        this.update('deviceList');
        if(!this.updateTimer) {
            this.updateTimer = GLib.timeout_add(
                GLib.PRIORITY_DEFAULT,
                Utils.networkMonitor.updateFrequency * 1000 * 2, // Halves the update frequency
                () => {
                    this.update('deviceList');
                    return true;
                }
            );
        }
    }

    async onClose() {
        Utils.networkMonitor.unlisten(this, 'networkIO');
        Utils.networkMonitor.unlisten(this, 'detailedNetworkIO');
        Utils.networkMonitor.unlisten(this, 'publicIps');
        Utils.networkMonitor.unlisten(this, 'routes');
        Utils.networkMonitor.unlisten(this, 'wireless');

        if(this.updateTimer) {
            GLib.source_remove(this.updateTimer);
            this.updateTimer = 0;
        }
        if(this.publicIpv6.refreshTimer) {
            GLib.source_remove(this.publicIpv6.refreshTimer);
            this.publicIpv6.refreshTimer = 0;
        }
    }

    update(code: string) {
        if(code === 'deviceList') {
            this.updateDeviceList();
            return;
        }
        if(code === 'networkIO') {
            const usage = Utils.networkMonitor.getUsageHistory('networkIO');
            this.graph.setUsageHistory(usage);

            const current = Utils.networkMonitor.getCurrentValue('networkIO');
            if(current) {
                const unit = Config.get_string('network-io-unit');

                if(current.bytesUploadedPerSec)
                    this.totalUploadSpeedValueLabel.text = Utils.formatBytesPerSec(
                        current.bytesUploadedPerSec,
                        unit as any,
                        3
                    );
                else this.totalUploadSpeedValueLabel.text = '-';

                if(current.bytesDownloadedPerSec)
                    this.totalDownloadSpeedValueLabel.text = Utils.formatBytesPerSec(
                        current.bytesDownloadedPerSec,
                        unit as any,
                        3
                    );
                else this.totalDownloadSpeedValueLabel.text = '-';

                if(this.networkActivityPopup) {
                    if(this.networkActivityPopup.totalUploadedValueLabel) {
                        if(current.totalBytesUploaded)
                            this.networkActivityPopup.totalUploadedValueLabel.text =
                                Utils.formatBytes(current.totalBytesUploaded, 'kB-KB', 3);
                        else this.networkActivityPopup.totalUploadedValueLabel.text = '-';
                    }
                    if(this.networkActivityPopup.totalDownloadedValueLabel) {
                        if(current.totalBytesDownloaded)
                            this.networkActivityPopup.totalDownloadedValueLabel.text =
                                Utils.formatBytes(current.totalBytesDownloaded, 'kB-KB', 3);
                        else this.networkActivityPopup.totalDownloadedValueLabel.text = '-';
                    }
                    if(this.networkActivityPopup.packetsUploadedValueLabel) {
                        if(current.packetsUploaded)
                            this.networkActivityPopup.packetsUploadedValueLabel.text =
                                Utils.formatHugeNumber(current.packetsUploaded);
                        else this.networkActivityPopup.packetsUploadedValueLabel.text = '-';
                    }
                    if(this.networkActivityPopup.packetsDownloadedValueLabel) {
                        if(current.packetsDownloaded)
                            this.networkActivityPopup.packetsDownloadedValueLabel.text =
                                Utils.formatHugeNumber(current.packetsDownloaded);
                        else this.networkActivityPopup.packetsDownloadedValueLabel.text = '-';
                    }
                    if(this.networkActivityPopup.errorsUploadValueLabel) {
                        if(current.errorsUpload)
                            this.networkActivityPopup.errorsUploadValueLabel.text =
                                Utils.formatHugeNumber(current.errorsUpload);
                        else this.networkActivityPopup.errorsUploadValueLabel.text = '-';
                    }
                    if(this.networkActivityPopup.errorsDownloadValueLabel) {
                        if(current.errorsDownload)
                            this.networkActivityPopup.errorsDownloadValueLabel.text =
                                Utils.formatHugeNumber(current.errorsDownload);
                        else this.networkActivityPopup.errorsDownloadValueLabel.text = '-';
                    }
                }
            } else {
                this.totalUploadSpeedValueLabel.text = '-';
                this.totalDownloadSpeedValueLabel.text = '-';

                if(this.networkActivityPopup) {
                    if(this.networkActivityPopup.totalUploadedValueLabel)
                        this.networkActivityPopup.totalUploadedValueLabel.text = '-';
                    if(this.networkActivityPopup.totalDownloadedValueLabel)
                        this.networkActivityPopup.totalDownloadedValueLabel.text = '-';
                    if(this.networkActivityPopup.packetsUploadedValueLabel)
                        this.networkActivityPopup.packetsUploadedValueLabel.text = '-';
                    if(this.networkActivityPopup.packetsDownloadedValueLabel)
                        this.networkActivityPopup.packetsDownloadedValueLabel.text = '-';
                    if(this.networkActivityPopup.errorsUploadValueLabel)
                        this.networkActivityPopup.errorsUploadValueLabel.text = '-';
                    if(this.networkActivityPopup.errorsDownloadValueLabel)
                        this.networkActivityPopup.errorsDownloadValueLabel.text = '-';
                }
            }
            return;
        }
        if(code === 'detailedNetworkIO') {
            const current = Utils.networkMonitor.getCurrentValue('detailedNetworkIO');

            if(current) {
                for(const [id, device] of this.devices.entries()) {
                    const data = current.get(id);

                    if(data) {
                        const unit = Config.get_string('network-io-unit');

                        if(data.bytesUploadedPerSec) {
                            device.uploadValueLabel.text = Utils.formatBytesPerSec(
                                data.bytesUploadedPerSec,
                                unit as any,
                                3
                            );
                            const uploadColor =
                                Config.get_string('network-menu-arrow-color1') ??
                                'rgba(29,172,214,1.0)';
                            device.uploadActivityIcon.style = `color:${uploadColor};`;
                        } else {
                            device.uploadValueLabel.text = '-';
                            device.uploadActivityIcon.style = 'color:rgba(255,255,255,0.5);';
                        }

                        if(data.bytesDownloadedPerSec) {
                            device.downloadValueLabel.text = Utils.formatBytesPerSec(
                                data.bytesDownloadedPerSec,
                                unit as any,
                                3
                            );
                            const downloadColor =
                                Config.get_string('network-menu-arrow-color2') ??
                                'rgba(214,29,29,1.0)';
                            device.downloadActivityIcon.style = `color:${downloadColor};`;
                        } else {
                            device.downloadValueLabel.text = '-';
                            device.downloadActivityIcon.style = 'color:rgba(255,255,255,0.5);';
                        }

                        const totalsPopup = this.devicesTotalsPopup.get(id);
                        if(totalsPopup) {
                            if(totalsPopup.totalUploadedValueLabel) {
                                if(data.totalBytesUploaded)
                                    totalsPopup.totalUploadedValueLabel.text = Utils.formatBytes(
                                        data.totalBytesUploaded,
                                        'kB-KB',
                                        3
                                    );
                                else totalsPopup.totalUploadedValueLabel.text = '-';
                            }
                            if(totalsPopup.totalDownloadedValueLabel) {
                                if(data.totalBytesDownloaded)
                                    totalsPopup.totalDownloadedValueLabel.text = Utils.formatBytes(
                                        data.totalBytesDownloaded,
                                        'kB-KB',
                                        3
                                    );
                                else totalsPopup.totalDownloadedValueLabel.text = '-';
                            }
                            if(totalsPopup.packetsUploadedValueLabel) {
                                if(data.packetsUploaded)
                                    totalsPopup.packetsUploadedValueLabel.text =
                                        Utils.formatHugeNumber(data.packetsUploaded);
                                else totalsPopup.packetsUploadedValueLabel.text = '-';
                            }
                            if(totalsPopup.packetsDownloadedValueLabel) {
                                if(data.packetsDownloaded)
                                    totalsPopup.packetsDownloadedValueLabel.text =
                                        Utils.formatHugeNumber(data.packetsDownloaded);
                                else totalsPopup.packetsDownloadedValueLabel.text = '-';
                            }
                            if(totalsPopup.errorsUploadValueLabel) {
                                if(data.errorsUpload)
                                    totalsPopup.errorsUploadValueLabel.text =
                                        Utils.formatHugeNumber(data.errorsUpload);
                                else totalsPopup.errorsUploadValueLabel.text = '-';
                            }
                            if(totalsPopup.errorsDownloadValueLabel) {
                                if(data.errorsDownload)
                                    totalsPopup.errorsDownloadValueLabel.text =
                                        Utils.formatHugeNumber(data.errorsDownload);
                                else totalsPopup.errorsDownloadValueLabel.text = '-';
                            }
                        }
                    } else {
                        device.uploadValueLabel.text = '-';
                        device.uploadActivityIcon.style = 'color:rgba(255,255,255,0.5);';
                        device.downloadValueLabel.text = '-';
                        device.downloadActivityIcon.style = 'color:rgba(255,255,255,0.5);';

                        const totalsPopup = this.devicesTotalsPopup.get(id);
                        if(totalsPopup) {
                            if(totalsPopup.totalUploadedValueLabel)
                                totalsPopup.totalUploadedValueLabel.text = '-';
                            if(totalsPopup.totalDownloadedValueLabel)
                                totalsPopup.totalDownloadedValueLabel.text = '-';
                            if(totalsPopup.packetsUploadedValueLabel)
                                totalsPopup.packetsUploadedValueLabel.text = '-';
                            if(totalsPopup.packetsDownloadedValueLabel)
                                totalsPopup.packetsDownloadedValueLabel.text = '-';
                            if(totalsPopup.errorsUploadValueLabel)
                                totalsPopup.errorsUploadValueLabel.text = '-';
                            if(totalsPopup.errorsDownloadValueLabel)
                                totalsPopup.errorsDownloadValueLabel.text = '-';
                        }
                    }
                }
            }
            return;
        }
        if(code === 'publicIps') {
            if(this.publicIpv6.refreshStatus === RefreshStatus.REFRESHING) {
                this.publicIpv6.refreshStatus = RefreshStatus.DONE;
                this.updateIpsFooterLablel();

                this.publicIpv6.refreshTimer = GLib.timeout_add_seconds(
                    GLib.PRIORITY_DEFAULT,
                    2,
                    () => {
                        this.publicIpv6.refreshStatus = RefreshStatus.IDLE;
                        this.updateIpsFooterLablel();
                        return GLib.SOURCE_REMOVE;
                    }
                );
            } else {
                this.updateIpsFooterLablel();
            }

            const publicIPv4 = Utils.networkMonitor.getCurrentValue('publicIpv4Address');
            if(publicIPv4) {
                this.publicIPv4.label.show();
                this.publicIPv4.value.show();
                this.publicIPv4.value.text = publicIPv4;
            } else {
                this.publicIPv4.label.hide();
                this.publicIPv4.value.hide();
            }

            const publicIpv6 = Utils.networkMonitor.getCurrentValue('publicIpv6Address');
            if(publicIpv6) {
                this.publicIpv6.label.show();

                if(publicIpv6.length >= 20) {
                    this.publicIpv6.value1.show();
                    this.publicIpv6.value2.show();

                    const parts = publicIpv6.split(':');
                    const mid = Math.floor(parts.length / 2);
                    const part1 = parts.slice(0, mid).join(':') + ':';
                    const part2 = parts.slice(mid).join(':');

                    this.publicIpv6.value1.text = part1;
                    this.publicIpv6.value2.text = part2;
                } else {
                    this.publicIpv6.value1.show();
                    this.publicIpv6.value2.hide();
                    this.publicIpv6.value1.text = publicIpv6;
                }
            } else {
                this.publicIpv6.label.hide();
                this.publicIpv6.value1.hide();
            }

            if(!publicIPv4 && !publicIpv6) {
                this.publicIPLabel.hide();
                this.publicIPContainer.hide();
            } else {
                this.publicIPLabel.show();
                this.publicIPContainer.show();
            }
            return;
        }
        if(code == 'routes') {
            const routes: RouteInfo[] = Utils.networkMonitor.getCurrentValue('routes');
            if(routes && routes.length > 0) {
                for(let i = 0; i < 5; i++) {
                    const route = routes[i];

                    if(i === 0) {
                        this.defaultRouteDevice.text = route.device;
                        this.defaultRouteGateway.text = route.gateway;
                    }

                    const popupRoute = this.routesPopup.routes[i];
                    if(!popupRoute) break;

                    if(!route) {
                        popupRoute.titleLabel.hide();
                        popupRoute.metricLabel.hide();
                        popupRoute.metricValue.hide();
                        popupRoute.typeLabel.hide();
                        popupRoute.typeValue.hide();
                        popupRoute.deviceLabel.hide();
                        popupRoute.deviceValue.hide();
                        popupRoute.destinationLabel.hide();
                        popupRoute.destinationValue.hide();
                        popupRoute.gatewayLabel.hide();
                        popupRoute.gatewayValue.hide();
                        popupRoute.protocolLabel.hide();
                        popupRoute.protocolValue.hide();
                        popupRoute.scopeLabel.hide();
                        popupRoute.scopeValue.hide();
                        popupRoute.flagsLabel.hide();
                        popupRoute.flagsValue.hide();
                        continue;
                    }

                    popupRoute.titleLabel.show();

                    popupRoute.metricLabel.show();
                    popupRoute.metricValue.text = route.metric?.toString() ?? '0';
                    popupRoute.metricValue.show();

                    popupRoute.typeLabel.show();
                    popupRoute.typeValue.text = route.type ?? '-';
                    popupRoute.typeValue.show();

                    popupRoute.deviceLabel.show();
                    popupRoute.deviceValue.text = route.device;
                    popupRoute.deviceValue.show();

                    popupRoute.destinationLabel.show();
                    popupRoute.destinationValue.text = route.destination ?? '-';
                    popupRoute.destinationValue.show();

                    popupRoute.gatewayLabel.show();
                    popupRoute.gatewayValue.text = route.gateway ?? '-';
                    popupRoute.gatewayValue.show();

                    popupRoute.protocolLabel.show();
                    popupRoute.protocolValue.text = route.protocol ?? '-';
                    popupRoute.protocolValue.show();

                    popupRoute.scopeLabel.show();
                    popupRoute.scopeValue.text = route.scope ?? '-';
                    popupRoute.scopeValue.show();

                    if(route.flags && route.flags.length > 0) {
                        popupRoute.flagsLabel.show();
                        popupRoute.flagsValue.text = route.flags.join(', ');
                        popupRoute.flagsValue.show();
                    } else {
                        popupRoute.flagsLabel.hide();
                        popupRoute.flagsValue.hide();
                    }
                }
            } else {
                this.defaultRouteDevice.text = '-';
                this.defaultRouteGateway.text = '-';

                for(const popupRoute of this.routesPopup.routes) {
                    popupRoute.titleLabel.hide();
                    popupRoute.metricLabel.hide();
                    popupRoute.metricValue.hide();
                    popupRoute.typeLabel.hide();
                    popupRoute.typeValue.hide();
                    popupRoute.deviceLabel.hide();
                    popupRoute.deviceValue.hide();
                    popupRoute.destinationLabel.hide();
                    popupRoute.destinationValue.hide();
                    popupRoute.gatewayLabel.hide();
                    popupRoute.gatewayValue.hide();
                    popupRoute.protocolLabel.hide();
                    popupRoute.protocolValue.hide();
                    popupRoute.scopeLabel.hide();
                    popupRoute.scopeValue.hide();
                    popupRoute.flagsLabel.hide();
                    popupRoute.flagsValue.hide();
                }
            }
            return;
        }
        if(code === 'wireless') {
            const wirelessDevices: Map<string, NetworkWirelessInfo> =
                Utils.networkMonitor.getCurrentValue('wireless');
            if(!wirelessDevices) {
                for(const info of this.devices.values()) info.wirelessButton.hide();
            } else {
                for(const [id, info] of this.devices.entries()) {
                    const popup = this.devicesWirelessPopup.get(id) as DeviceWirelessPopup;
                    if(!popup) {
                        info.wirelessButton.hide();
                    } else {
                        const wirelessInfo = wirelessDevices.get(id);

                        if(!wirelessInfo || !wirelessInfo.EESSID) {
                            info.wirelessButton.hide();
                        } else {
                            info.wirelessLabel.text = wirelessInfo.EESSID;
                            info.wirelessButton.show();

                            if(wirelessInfo.IEEE && popup.IEEEValue) {
                                popup.IEEELabel?.show();
                                popup.IEEEValue.show();
                                popup.IEEEValue.text = wirelessInfo.IEEE;
                            } else {
                                popup.IEEELabel?.hide();
                                popup.IEEEValue?.hide();
                            }

                            if(wirelessInfo.EESSID && popup.SSIDValue) {
                                popup.SSIDLabel?.show();
                                popup.SSIDValue.show();
                                popup.SSIDValue.text = wirelessInfo.EESSID;
                            } else {
                                popup.SSIDLabel?.hide();
                                popup.SSIDValue?.hide();
                            }

                            if(wirelessInfo.mode && popup.modeValue) {
                                popup.modeLabel?.show();
                                popup.modeValue.show();
                                popup.modeValue.text = wirelessInfo.mode;
                            } else {
                                popup.modeLabel?.hide();
                                popup.modeValue?.hide();
                            }

                            if(wirelessInfo.frequency && popup.frequencyValue) {
                                popup.frequencyLabel?.show();
                                popup.frequencyValue.show();
                                popup.frequencyValue.text = wirelessInfo.frequency;
                            } else {
                                popup.frequencyLabel?.hide();
                                popup.frequencyValue?.hide();
                            }

                            if(wirelessInfo.accessPoint && popup.accessPointValue) {
                                popup.accessPointLabel?.show();
                                popup.accessPointValue.show();
                                popup.accessPointValue.text = wirelessInfo.accessPoint;
                            } else {
                                popup.accessPointLabel?.hide();
                                popup.accessPointValue?.hide();
                            }

                            if(wirelessInfo.bitRate && popup.bitRateValue) {
                                popup.bitRateLabel?.show();
                                popup.bitRateValue.show();
                                popup.bitRateValue.text = wirelessInfo.bitRate;
                            } else {
                                popup.bitRateLabel?.hide();
                                popup.bitRateValue?.hide();
                            }

                            if(wirelessInfo.txPower && popup.txPowerValue) {
                                popup.txPowerLabel?.show();
                                popup.txPowerValue.show();
                                popup.txPowerValue.text = wirelessInfo.txPower;
                            } else {
                                popup.txPowerLabel?.hide();
                                popup.txPowerValue?.hide();
                            }

                            if(wirelessInfo.linkQuality && popup.linkQualityValue) {
                                popup.linkQualityLabel?.show();
                                popup.linkQualityValue.show();
                                popup.linkQualityValue.text = wirelessInfo.linkQuality;
                            } else {
                                popup.linkQualityLabel?.hide();
                                popup.linkQualityValue?.hide();
                            }

                            if(wirelessInfo.signalLevel && popup.signalLevelValue) {
                                popup.signalLevelLabel?.show();
                                popup.signalLevelValue.show();
                                popup.signalLevelValue.text = wirelessInfo.signalLevel;
                            } else {
                                popup.signalLevelLabel?.hide();
                                popup.signalLevelValue?.hide();
                            }
                        }
                    }
                }
            }
            return;
        }
    }

    clear() {
        this.totalUploadSpeedValueLabel.text = '-';
        this.totalDownloadSpeedValueLabel.text = '-';

        for(const [_id, device] of this.devices.entries()) {
            device.uploadValueLabel.text = '-';
            device.uploadActivityIcon.style = 'color:rgba(255,255,255,0.5);';
            device.downloadValueLabel.text = '-';
            device.downloadActivityIcon.style = 'color:rgba(255,255,255,0.5);';
        }
        for(const [_id, totalsPopup] of this.devicesTotalsPopup.entries()) {
            if(totalsPopup.totalUploadedValueLabel) totalsPopup.totalUploadedValueLabel.text = '-';
            if(totalsPopup.totalDownloadedValueLabel)
                totalsPopup.totalDownloadedValueLabel.text = '-';
            if(totalsPopup.packetsUploadedValueLabel)
                totalsPopup.packetsUploadedValueLabel.text = '-';
            if(totalsPopup.packetsDownloadedValueLabel)
                totalsPopup.packetsDownloadedValueLabel.text = '-';
            if(totalsPopup.errorsUploadValueLabel) totalsPopup.errorsUploadValueLabel.text = '-';
            if(totalsPopup.errorsDownloadValueLabel)
                totalsPopup.errorsDownloadValueLabel.text = '-';
        }

        if(this.networkActivityPopup) {
            if(this.networkActivityPopup.totalUploadedValueLabel)
                this.networkActivityPopup.totalUploadedValueLabel.text = '-';
            if(this.networkActivityPopup.totalDownloadedValueLabel)
                this.networkActivityPopup.totalDownloadedValueLabel.text = '-';
            if(this.networkActivityPopup.packetsUploadedValueLabel)
                this.networkActivityPopup.packetsUploadedValueLabel.text = '-';
            if(this.networkActivityPopup.packetsDownloadedValueLabel)
                this.networkActivityPopup.packetsDownloadedValueLabel.text = '-';
            if(this.networkActivityPopup.errorsUploadValueLabel)
                this.networkActivityPopup.errorsUploadValueLabel.text = '-';
            if(this.networkActivityPopup.errorsDownloadValueLabel)
                this.networkActivityPopup.errorsDownloadValueLabel.text = '-';
        }

        this.publicIPv4.value.text = '-';
        this.publicIpv6.value1.text = '-';
        this.publicIpv6.value2.hide();
        this.publicIpv6.refreshStatus = RefreshStatus.IDLE;
        this.updateIpsFooterLablel();
    }

    destroy() {
        this.close(true);
        this.removeAll();

        if(this.publicIpv6.refreshTimer) {
            GLib.source_remove(this.publicIpv6.refreshTimer);
            this.publicIpv6.refreshTimer = 0;
        }

        super.destroy();
    }
}
