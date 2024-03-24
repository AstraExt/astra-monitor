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

import {gettext as _, pgettext} from 'resource:///org/gnome/shell/extensions/extension.js';
import MenuBase from '../menu.js';
import NetworkGraph from './networkGraph.js';
import Grid from '../grid.js';
import Utils, { InterfaceInfo } from '../utils/utils.js';
import Config from '../config.js';

type InterfaceDeviceInfo = {
    data: InterfaceInfo | null;
    container: St.Button;
    icon: St.Icon;
    label: St.Label;
    label2: St.Label;
    uploadValueLabel: St.Label;
    uploadActivityIcon: St.Icon;
    downloadValueLabel: St.Label;
    downloadActivityIcon: St.Icon;
};

type NetworkActivityPopup = MenuBase & {
    totalUploadedValueLabel?: St.Label,
    totalDownloadedValueLabel?: St.Label,
    
    packetsUploadedValueLabel?: St.Label,
    packetsDownloadedValueLabel?: St.Label,
    
    errorsUploadValueLabel?: St.Label,
    errorsDownloadValueLabel?: St.Label,
};

type DevicePopup = MenuBase & {
    nameValue?: St.Label,
    altNamesLabel?: St.Label,
    altNamesValue?: St.Label,
    ifindexLabel?: St.Label,
    ifindexValue?: St.Label,
    macAddressLabel?: St.Label,
    macAddressValue?: St.Label,
    groupLabel?: St.Label,
    groupValue?: St.Label,
    speedLabel?: St.Label,
    speedValue?: St.Label,
    duplexLabel?: St.Label,
    duplexValue?: St.Label,
    mtuLabel?: St.Label,
    mtuValue?: St.Label,
    txQueueLabel?: St.Label,
    txQueueValue?: St.Label,
    linkTypeLabel?: St.Label,
    linkTypeValue?: St.Label,
    operStateLabel?: St.Label,
    operStateValue?: St.Label,
    qdiscLabel?: St.Label,
    qdiscValue?: St.Label,
    parentLabel?: St.Label,
    parentValue?: St.Label,
    
    addresses: {
        labelValue: St.Label,
        familyLabel: St.Label,
        familyValue: St.Label,
        localLabel: St.Label,
        localValue: St.Label,
        prefixlenLabel: St.Label,
        prefixlenValue: St.Label,
        broadcastLabel: St.Label,
        broadcastValue: St.Label,
        scopeLabel: St.Label,
        scopeValue: St.Label,
    }[],
    
    totalUploadedValueLabel?: St.Label,
    totalDownloadedValueLabel?: St.Label,
    packetsUploadedValueLabel?: St.Label,
    packetsDownloadedValueLabel?: St.Label,
    errorsUploadValueLabel?: St.Label,
    errorsDownloadValueLabel?: St.Label,
};

export default class NetworkMenu extends MenuBase {
    /*private networkSectionLabel!: St.Label;*/
    private networkActivityPopup!: NetworkActivityPopup;
    
    private graph!: InstanceType<typeof NetworkGraph>;
    private totalUploadSpeedValueLabel!: St.Label;
    private totalDownloadSpeedValueLabel!: St.Label;
    
    private publicIPv4!: {
        label: St.Label;
        value: St.Label;
    };
    private publicIpv6!: {
        label: St.Label;
        value1: St.Label;
        value2: St.Label;
    };
    
    private deviceSection!: InstanceType<typeof Grid>;
    private noDevicesLabel!: St.Label;
    
    private devices!: Map<string, InterfaceDeviceInfo>;
    private devicesPopup!: Map<string, DevicePopup>;
    
    private updateTimer: number = 0;
    
    constructor(sourceActor: St.Widget, arrowAlignment: number, arrowSide: St.Side) {
        super(sourceActor, arrowAlignment, arrowSide);
        
        /*this.networkSectionLabel = */this.addMenuSection(_('Network'));
        this.createActivitySection();
        this.createPublicIps();
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
            width: 200-2-15,
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
            if(this.networkActivityPopup)
                this.networkActivityPopup.open(true);
        });
        
        hoverButton.connect('leave-event', () => {
            hoverButton.style = defaultStyle;
            if(this.networkActivityPopup)
                this.networkActivityPopup.close(true);
        });
        
        this.addToMenu(hoverButton, 2);
    }
    
    createActivityPopup(sourceActor: St.Widget) {
        this.networkActivityPopup = new MenuBase(sourceActor, 0.05, St.Side.RIGHT, { numCols: 2});
        this.networkActivityPopup.addMenuSection(_('Upload Activity'));
        
        //Total
        this.networkActivityPopup.addToMenu(new St.Label({
            text: _('Total'),
            style_class: 'astra-monitor-menu-sub-key'
        }));
        
        const totalUploadedValueLabel = new St.Label({text: '', style: 'text-align:left;'});
        this.networkActivityPopup.addToMenu(totalUploadedValueLabel);
        this.networkActivityPopup.totalUploadedValueLabel = totalUploadedValueLabel;
        
        //Packets
        this.networkActivityPopup.addToMenu(new St.Label({
            text: _('Packets'),
            style_class: 'astra-monitor-menu-sub-key'
        }));
        
        const packetsUploadedValueLabel = new St.Label({text: '', style: 'text-align:left;'});
        this.networkActivityPopup.addToMenu(packetsUploadedValueLabel);
        this.networkActivityPopup.packetsUploadedValueLabel = packetsUploadedValueLabel;
        
        //Errors
        this.networkActivityPopup.addToMenu(new St.Label({
            text: _('Errors/Dropped'),
            style_class: 'astra-monitor-menu-sub-key'
        }));
        
        const errorsUploadValueLabel = new St.Label({text: '', style: 'text-align:left;'});
        this.networkActivityPopup.addToMenu(errorsUploadValueLabel);
        this.networkActivityPopup.errorsUploadValueLabel = errorsUploadValueLabel;
        
        this.networkActivityPopup.addMenuSection(_('Download Activity'));
        
        //Total
        this.networkActivityPopup.addToMenu(new St.Label({
            text: _('Total'),
            style_class: 'astra-monitor-menu-sub-key'
        }));
        
        const totalDownloadedValueLabel = new St.Label({text: '', style: 'text-align:left;'});
        this.networkActivityPopup.addToMenu(totalDownloadedValueLabel);
        this.networkActivityPopup.totalDownloadedValueLabel = totalDownloadedValueLabel;
        
        //Packets
        this.networkActivityPopup.addToMenu(new St.Label({
            text: _('Packets'),
            style_class: 'astra-monitor-menu-sub-key'
        }));
        
        const packetsDownloadedValueLabel = new St.Label({text: '', style: 'text-align:left;'});
        this.networkActivityPopup.addToMenu(packetsDownloadedValueLabel);
        this.networkActivityPopup.packetsDownloadedValueLabel = packetsDownloadedValueLabel;
        
        //Errors
        this.networkActivityPopup.addToMenu(new St.Label({
            text: _('Errors/Dropped'),
            style_class: 'astra-monitor-menu-sub-key'
        }));
        
        const errorsDownloadValueLabel = new St.Label({text: '', style: 'text-align:left;'});
        this.networkActivityPopup.addToMenu(errorsDownloadValueLabel);
        this.networkActivityPopup.errorsDownloadValueLabel = errorsDownloadValueLabel;
    }
    
    createPublicIps() {
        this.addMenuSection(_('Public IP'));
        
        const defaultStyle = '';
        
        const hoverButton = new St.Button({
            reactive: true,
            track_hover: true,
            style: defaultStyle
        });
        
        const grid = new Grid({ styleClass: 'astra-monitor-menu-subgrid' });
        hoverButton.set_child(grid);
        
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
        
        const publicIpv6Grid = new Grid({ styleClass: 'astra-monitor-menu-subgrid', numCols: 2});
        
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
        
        this.publicIpv6 = {
            label: publicIpv6Label,
            value1: publicIpv6Value1,
            value2: publicIpv6Value2
        };
        
        hoverButton.connect('enter-event', () => {
            hoverButton.style = defaultStyle + this.selectionStyle;
            
        });
        
        hoverButton.connect('leave-event', () => {
            hoverButton.style = defaultStyle;
            
        });
        
        this.addToMenu(hoverButton, 2);
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
            this.devicesPopup = new Map();
            this.addToMenu(this.deviceSection, 2);
            
            Config.connect(this, 'changed::network-ignored', this.updateDeviceList.bind(this));
            Config.connect(this, 'changed::network-ignored-regex', this.updateDeviceList.bind(this));
        }
    }
    
    updateDeviceList() {
        const devices = Utils.getNetworkInterfacesSync();
        if(devices.size > 0)
            this.noDevicesLabel.hide();
        else
            this.noDevicesLabel.show();
        
        //filter ignored devices
        const ignoredDevices = Config.get_json('network-ignored');
        if(ignoredDevices && Array.isArray(ignoredDevices) && ignoredDevices.length > 0) {
            for(const id of ignoredDevices) {
                if(devices.has(id))
                    devices.delete(id);
            }
        }
        
        const ignoredRegex = Config.get_string('network-ignored-regex');
        if(ignoredRegex) {
            try {
                const regex = new RegExp(`^${ignoredRegex}$`, 'i');
                for(const [id, device] of devices.entries()) {
                    if(regex.test(device.name))
                        devices.delete(id);
                }
            }
            catch(e) {
                //Not a valid regex
            }
        }
        
        // remove all devices that are not present anymore
        for(const [id, device] of this.devices.entries()) {
            if(!devices.has(id)) {
                this.deviceSection.remove_child(device.container);
                this.devices.delete(id);
                
                this.devicesPopup.get(id)?.close(true);
                this.devicesPopup.get(id)?.destroy();
                this.devicesPopup.delete(id);
            }
        }
        
        // add new devices / update existing devices
        const idList = Array.from(devices.keys());
        
        // TODO: set main interface first
        
        for(const id of idList) {
            const deviceData = devices.get(id);
            
            let device;
            let popup;
            if(!this.devices.has(id)) {
                device = this.createInterfaceDevice(id);
                this.deviceSection.addToGrid(device.container, 2);
                this.devices.set(id, device);
            }
            else {
                device = this.devices.get(id);
            }
            
            if(!device)
                continue;
            
            if(!this.devicesPopup.has(id)) {
                popup = this.createDevicePopup(device.container);
                this.devicesPopup.set(id, popup);
            }
            else {
                popup = this.devicesPopup.get(id);
            }
            
            if(!popup)
                continue;
            
            if(!deviceData)
                continue;
            
            //Update device info
            try {
                this.updateInterfaceDevice(device, popup, deviceData);
            }
            catch(e: any) {
                Utils.error(e);
            }
        }
    }
    
    createInterfaceDevice(id: string): InterfaceDeviceInfo {
        const defaultStyle = 'padding-top:0.25em;margin-bottom:0.25em;';
        const container = new St.Button({
            reactive: true,
            track_hover: true,
            x_expand: true,
            style: defaultStyle
        });
        
        const grid = new Grid({
            x_expand: true,
            styleClass: 'astra-monitor-menu-subgrid'
        });
        container.set_child(grid);
        
        //Header Grid
        //{
            const headerGrid = new Grid({
                numCols: 3,
                styleClass: 'astra-monitor-menu-subgrid'
            });
            
            const icon = new St.Icon({
                style_class: 'astra-monitor-menu-icon',
                style: 'padding-left:0.25em;'
            });
            headerGrid.addToGrid(icon);
            
            const label = new St.Label({
                text: '',
                style_class: 'astra-monitor-menu-label'
            });
            headerGrid.addToGrid(label);
            
            const label2 = new St.Label({
                text: '',
                x_expand: true,
                style_class: 'astra-monitor-menu-key-mid'
            });
            headerGrid.addToGrid(label2);
            
            grid.addToGrid(headerGrid, 2);
        //}
        
        // Upload/Download Speed
        //{
            const rwContainer = new St.Widget({
                layout_manager: new Clutter.GridLayout({orientation: Clutter.Orientation.HORIZONTAL}),
                x_expand: true,
                style: 'margin-left:0;margin-right:0;'
            });
            
            const uploadContainer = new St.Widget({
                layout_manager: new Clutter.GridLayout({orientation: Clutter.Orientation.HORIZONTAL}),
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
                layout_manager: new Clutter.GridLayout({orientation: Clutter.Orientation.HORIZONTAL}),
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
            
            grid.addToGrid(rwContainer, 2);
        //}
        
        container.connect('enter-event', () => {
            container.style = defaultStyle + this.selectionStyle;
            
            const popup = this.devicesPopup.get(id);
            popup?.open(true);
        });
        
        container.connect('leave-event', () => {
            container.style = defaultStyle;
            
            const popup = this.devicesPopup.get(id);
            popup?.close(true);
        });
        
        return {
            data: null,
            container,
            icon,
            label,
            label2,
            uploadValueLabel,
            uploadActivityIcon,
            downloadValueLabel,
            downloadActivityIcon
        };
    }
    
    createDevicePopup(sourceActor: St.Widget): DevicePopup {
        const popup:DevicePopup = new MenuBase(sourceActor, 0.05, St.Side.RIGHT, { numCols: 2}) as DevicePopup;
        
        //Info
        popup.addMenuSection(_('Info'));
        {
            //Name
            popup.addToMenu(new St.Label({
                text: _('Name'),
                style_class: 'astra-monitor-menu-sub-key'
            }));
            
            const nameLabel = new St.Label({text: '', style: 'text-align:left;'});
            popup.addToMenu(nameLabel);
            popup.nameValue = nameLabel;
            
            // Alt Names
            const altNamesLabel = new St.Label({
                text: _('Alt Names'),
                style_class: 'astra-monitor-menu-sub-key'
            });
            popup.addToMenu(altNamesLabel);
            popup.altNamesLabel = altNamesLabel;
            
            const altNamesValue = new St.Label({text: '', style: 'text-align:left;'});
            popup.addToMenu(altNamesValue);
            popup.altNamesValue = altNamesValue;
            
            // Ifindex
            const ifindexLabel = new St.Label({
                text: _('Interface Index'),
                style_class: 'astra-monitor-menu-sub-key'
            });
            popup.addToMenu(ifindexLabel);
            popup.ifindexLabel = ifindexLabel;
            
            const ifindexValue = new St.Label({text: '', style: 'text-align:left;'});
            popup.addToMenu(ifindexValue);
            popup.ifindexValue = ifindexValue;
            
            // Mac Address
            const macAddressLabel = new St.Label({
                text: _('MAC Address'),
                style_class: 'astra-monitor-menu-sub-key'
            });
            popup.addToMenu(macAddressLabel);
            popup.macAddressLabel = macAddressLabel;
            
            const macAddressValue = new St.Label({text: '', style: 'text-align:left;'});
            popup.addToMenu(macAddressValue);
            popup.macAddressValue = macAddressValue;
            
            // Group
            const groupLabel = new St.Label({
                text: _('Group'),
                style_class: 'astra-monitor-menu-sub-key'
            });
            popup.addToMenu(groupLabel);
            popup.groupLabel = groupLabel;
            
            const groupValue = new St.Label({text: '', style: 'text-align:left;'});
            popup.addToMenu(groupValue);
            popup.groupValue = groupValue;
            
            // Speed
            const speedLabel = new St.Label({
                text: _('Speed'),
                style_class: 'astra-monitor-menu-sub-key'
            });
            popup.addToMenu(speedLabel);
            popup.speedLabel = speedLabel;
            
            const speedValue = new St.Label({text: '', style: 'text-align:left;'});
            popup.addToMenu(speedValue);
            popup.speedValue = speedValue;
            
            // Duplex
            const duplexLabel = new St.Label({
                text: _('Duplex'),
                style_class: 'astra-monitor-menu-sub-key'
            });
            popup.addToMenu(duplexLabel);
            popup.duplexLabel = duplexLabel;
            
            const duplexValue = new St.Label({text: '', style: 'text-align:left;'});
            popup.addToMenu(duplexValue);
            popup.duplexValue = duplexValue;
            
            // MTU
            const mtuLabel = new St.Label({
                text: _('MTU'),
                style_class: 'astra-monitor-menu-sub-key'
            });
            popup.addToMenu(mtuLabel);
            popup.mtuLabel = mtuLabel;
            
            const mtuValue = new St.Label({text: '', style: 'text-align:left;'});
            popup.addToMenu(mtuValue);
            popup.mtuValue = mtuValue;
            
            // Tx Queue Length
            const txQueueLabel = new St.Label({
                text: _('Tx Queue Length'),
                style_class: 'astra-monitor-menu-sub-key'
            });
            popup.addToMenu(txQueueLabel);
            popup.txQueueLabel = txQueueLabel;
            
            const txQueueValue = new St.Label({text: '', style: 'text-align:left;'});
            popup.addToMenu(txQueueValue);
            popup.txQueueValue = txQueueValue;
            
            // Link Type
            const linkTypeLabel = new St.Label({
                text: _('Link Type'),
                style_class: 'astra-monitor-menu-sub-key'
            });
            popup.addToMenu(linkTypeLabel);
            popup.linkTypeLabel = linkTypeLabel;
            
            const linkTypeValue = new St.Label({text: '', style: 'text-align:left;'});
            popup.addToMenu(linkTypeValue);
            popup.linkTypeValue = linkTypeValue;
            
            // Operative State
            const operativeStateLabel = new St.Label({
                text: _('Operative State'),
                style_class: 'astra-monitor-menu-sub-key'
            });
            popup.addToMenu(operativeStateLabel);
            popup.operStateLabel = operativeStateLabel;
            
            const operativeStateValue = new St.Label({text: '', style: 'text-align:left;'});
            popup.addToMenu(operativeStateValue);
            popup.operStateValue = operativeStateValue;
            
            // Qdisc
            const qdiscLabel = new St.Label({
                text: _('Qdisc'),
                style_class: 'astra-monitor-menu-sub-key'
            });
            popup.addToMenu(qdiscLabel);
            popup.qdiscLabel = qdiscLabel;
            
            const qdiscValue = new St.Label({text: '', style: 'text-align:left;'});
            popup.addToMenu(qdiscValue);
            popup.qdiscValue = qdiscValue;
            
            // Parent
            const parentLabel = new St.Label({text:'', style_class: 'astra-monitor-menu-sub-key'});
            popup.addToMenu(parentLabel);
            popup.parentLabel = parentLabel;
            
            const parentValue = new St.Label({text: '', style: 'text-align:left;'});
            popup.addToMenu(parentValue);
            popup.parentValue = parentValue;
        }
        
        //Addresses
        popup.addresses = [];
        
        for(let i = 0; i < 5; i++) {
            const labelValue = new St.Label({text: '', style_class: 'astra-monitor-menu-header-centered', x_expand: true});
            popup.addToMenu(labelValue, 2);
            
            const familyLabel = new St.Label({text: _('Family'), style_class: 'astra-monitor-menu-sub-key'});
            popup.addToMenu(familyLabel);
            const familyValue = new St.Label({text: '', style: 'text-align:left;'});
            popup.addToMenu(familyValue);
            
            const localLabel = new St.Label({text: _('Local'), style_class: 'astra-monitor-menu-sub-key'});
            popup.addToMenu(localLabel);
            const localValue = new St.Label({text: '', style: 'text-align:left;'});
            popup.addToMenu(localValue);
            
            const prefixlenLabel = new St.Label({text: _('Prefix Length'), style_class: 'astra-monitor-menu-sub-key'});
            popup.addToMenu(prefixlenLabel);
            const prefixlenValue = new St.Label({text: '', style: 'text-align:left;'});
            popup.addToMenu(prefixlenValue);
            
            const broadcastLabel = new St.Label({text: _('Broadcast'), style_class: 'astra-monitor-menu-sub-key'});
            popup.addToMenu(broadcastLabel);
            const broadcastValue = new St.Label({text: '', style: 'text-align:left;'});
            popup.addToMenu(broadcastValue);
            
            const scopeLabel = new St.Label({text: _('Scope'), style_class: 'astra-monitor-menu-sub-key'});
            popup.addToMenu(scopeLabel);
            const scopeValue = new St.Label({text: '', style: 'text-align:left;'});
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
        
        //Upload
        popup.addMenuSection(_('Upload'));
        {
            //Total
            popup.addToMenu(new St.Label({
                text: _('Total'),
                style_class: 'astra-monitor-menu-sub-key'
            }));
            
            const totalUploadedValueLabel = new St.Label({text: '', style: 'text-align:left;'});
            popup.addToMenu(totalUploadedValueLabel);
            popup.totalUploadedValueLabel = totalUploadedValueLabel;
            
            //Packets
            popup.addToMenu(new St.Label({
                text: _('Packets'),
                style_class: 'astra-monitor-menu-sub-key'
            }));
            
            const packetsUploadedValueLabel = new St.Label({text: '', style: 'text-align:left;'});
            popup.addToMenu(packetsUploadedValueLabel);
            popup.packetsUploadedValueLabel = packetsUploadedValueLabel;
            
            //Errors
            popup.addToMenu(new St.Label({
                text: _('Errors/Dropped'),
                style_class: 'astra-monitor-menu-sub-key'
            }));
            
            const errorsUploadValueLabel = new St.Label({text: '', style: 'text-align:left;'});
            popup.addToMenu(errorsUploadValueLabel);
            popup.errorsUploadValueLabel = errorsUploadValueLabel;
        }
        
        //Download
        popup.addMenuSection(_('Download'));
        {
            //Total
            popup.addToMenu(new St.Label({
                text: _('Total'),
                style_class: 'astra-monitor-menu-sub-key'
            }));
            
            const totalDownloadedValueLabel = new St.Label({text: '', style: 'text-align:left;'});
            popup.addToMenu(totalDownloadedValueLabel);
            popup.totalDownloadedValueLabel = totalDownloadedValueLabel;
            
            //Packets
            popup.addToMenu(new St.Label({
                text: _('Packets'),
                style_class: 'astra-monitor-menu-sub-key'
            }));
            
            const packetsDownloadedValueLabel = new St.Label({text: '', style: 'text-align:left;'});
            popup.addToMenu(packetsDownloadedValueLabel);
            popup.packetsDownloadedValueLabel = packetsDownloadedValueLabel;
            
            //Errors
            popup.addToMenu(new St.Label({
                text: _('Errors/Dropped'),
                style_class: 'astra-monitor-menu-sub-key'
            }));
            
            const errorsDownloadValueLabel = new St.Label({text: '', style: 'text-align:left;'});
            popup.addToMenu(errorsDownloadValueLabel);
            popup.errorsDownloadValueLabel = errorsDownloadValueLabel;
        }
        
        return popup;
    }
    
    updateInterfaceDevice(device: InterfaceDeviceInfo, popup:DevicePopup, deviceData: InterfaceInfo) {
        device.data = deviceData;
        
        const icon = {
            gicon: Utils.getLocalIcon('am-network-symbolic'),
            fallback_icon_name: 'network-wired-symbolic',
        };
        if(deviceData.name.startsWith('wlan') || deviceData.name.startsWith('wl')) {
            icon.gicon = Utils.getLocalIcon('am-wireless-symbolic');
            icon.fallback_icon_name = 'network-wireless-symbolic';
        }
        else if(deviceData.name.startsWith('wwan') || deviceData.name.startsWith('ww')) {
            icon.fallback_icon_name = 'network-cellular-symbolic';
        }
        else if(deviceData.name.startsWith('tun') || deviceData.name.startsWith('tap')) {
            icon.fallback_icon_name = 'network-vpn-symbolic';
        }
        else if(deviceData.name.includes('br')) {
            icon.gicon = Utils.getLocalIcon('am-bridge-symbolic');
            icon.fallback_icon_name = 'network-wired-symbolic';
        }
        
        if(icon.gicon)
            device.icon.gicon = icon.gicon;
        device.icon.fallback_icon_name = icon.fallback_icon_name;
        
        device.label.text = deviceData.name;
        
        let label2 = '';
        
        if(deviceData.addr_info && deviceData.addr_info.length > 0) {
            const addr = deviceData.addr_info[0];
            if(addr.local)
                label2 = addr.local;
        }
        else if(deviceData.altnames && deviceData.altnames.length > 0) {
            label2 = deviceData.altnames[0];
        }
        
        device.label2.text = label2;
        
        if(popup) {
            if(deviceData.name && popup.nameValue)
                popup.nameValue.text = deviceData.name;
            
            if(deviceData.altnames && deviceData.altnames.length > 0 && popup.altNamesValue) {
                popup.altNamesLabel?.show();
                popup.altNamesValue?.show();
                popup.altNamesValue.text = deviceData.altnames.join(', ');
            }
            else {
                popup.altNamesLabel?.hide();
                popup.altNamesValue?.hide();
            }
            
            if(deviceData.ifindex && popup.ifindexValue) {
                popup.ifindexLabel?.show();
                popup.ifindexValue?.show();
                popup.ifindexValue.text = deviceData.ifindex.toString();
            }
            else {
                popup.ifindexLabel?.hide();
                popup.ifindexValue?.hide();
            }
            
            if(deviceData.address && popup.macAddressValue) {
                popup.macAddressLabel?.show();
                popup.macAddressValue?.show();
                popup.macAddressValue.text = deviceData.address;
            }
            else {
                popup.macAddressLabel?.hide();
                popup.macAddressValue?.hide();
            }
            
            if(deviceData.group && popup.groupValue) {
                popup.groupLabel?.show();
                popup.groupValue?.show();
                popup.groupValue.text = deviceData.group;
            }
            else {
                popup.groupLabel?.hide();
                popup.groupValue?.hide();
            }
            
            if(deviceData.speed && popup.speedValue) {
                popup.speedLabel?.show();
                popup.speedValue?.show();
                popup.speedValue.text = `${deviceData.speed} Mb/s`;
            }
            else {
                popup.speedLabel?.hide();
                popup.speedValue?.hide();
            }
            
            if(deviceData.duplex && popup.duplexValue) {
                popup.duplexLabel?.show();
                popup.duplexValue?.show();
                popup.duplexValue.text = deviceData.duplex;
            }
            else {
                popup.duplexLabel?.hide();
                popup.duplexValue?.hide();
            }
            
            if(deviceData.mtu && popup.mtuValue) {
                popup.mtuLabel?.show();
                popup.mtuValue?.show();
                popup.mtuValue.text = deviceData.mtu.toString();
            }
            else {
                popup.mtuLabel?.hide();
                popup.mtuValue?.hide();
            }
            
            if(deviceData.txqlen && popup.txQueueValue) {
                popup.txQueueLabel?.show();
                popup.txQueueValue?.show();
                popup.txQueueValue.text = deviceData.txqlen.toString();
            }
            else {
                popup.txQueueLabel?.hide();
                popup.txQueueValue?.hide();
            }
            
            if(deviceData.link_type && popup.linkTypeValue) {
                popup.linkTypeLabel?.show();
                popup.linkTypeValue?.show();
                popup.linkTypeValue.text = deviceData.link_type;
            }
            else {
                popup.linkTypeLabel?.hide();
                popup.linkTypeValue?.hide();
            }
            
            if(deviceData.operstate && popup.operStateValue) {
                popup.operStateLabel?.show();
                popup.operStateValue?.show();
                popup.operStateValue.text = deviceData.operstate;
            }
            else {
                popup.operStateLabel?.hide();
                popup.operStateValue?.hide();
            }
            
            if(deviceData.qdisc && popup.qdiscValue) {
                popup.qdiscLabel?.show();
                popup.qdiscValue?.show();
                popup.qdiscValue.text = deviceData.qdisc;
            }
            else {
                popup.qdiscLabel?.hide();
                popup.qdiscValue?.hide();
            }
            
            if(deviceData.parentbus && deviceData.parentdev && popup.parentLabel && popup.parentValue) {
                popup.parentLabel?.show();
                popup.parentValue?.show();
                popup.parentLabel.text = deviceData.parentbus;
                popup.parentValue.text = deviceData.parentdev;
            }
            else {
                popup.parentLabel?.hide();
                popup.parentValue?.hide();
            }
            
            //Addresses
            for(let i = 0; i < 5; i++) {
                const address = popup.addresses[i];
                
                if(address && deviceData.addr_info && deviceData.addr_info[i]) {
                    const addrInfo = deviceData.addr_info[i];
                    
                    let label = 'Address ' + (i+1);
                    if(addrInfo.label)
                        label += ` [${addrInfo.label}]`;
                    address.labelValue.text = label;
                    
                    if(addrInfo.family) {
                        address.familyLabel.show();
                        address.familyValue.show();
                        address.familyValue.text = addrInfo.family;
                    }
                    else {
                        address.familyLabel.hide();
                        address.familyValue.hide();
                    }
                    
                    if(addrInfo.local) {
                        address.localLabel.show();
                        address.localValue.show();
                        address.localValue.text = addrInfo.local;
                    }
                    else {
                        address.localLabel.hide();
                        address.localValue.hide();
                    }
                    
                    if(addrInfo.prefixlen) {
                        address.prefixlenLabel.show();
                        address.prefixlenValue.show();
                        address.prefixlenValue.text = addrInfo.prefixlen.toString();
                    }
                    else {
                        address.prefixlenLabel.hide();
                        address.prefixlenValue.hide();
                    }
                    
                    if(addrInfo.broadcast) {
                        address.broadcastLabel.show();
                        address.broadcastValue.show();
                        address.broadcastValue.text = addrInfo.broadcast;
                    }
                    else {
                        address.broadcastLabel.hide();
                        address.broadcastValue.hide();
                    }
                    
                    if(addrInfo.scope) {
                        address.scopeLabel.show();
                        address.scopeValue.show();
                        address.scopeValue.text = addrInfo.scope;
                    }
                    else {
                        address.scopeLabel.hide();
                        address.scopeValue.hide();
                    }
                }
                else {
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
        super.addUtilityButtons('network', (box) => {
            const button = new St.Button({style_class: 'button'});
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
        
        Utils.networkMonitor.listen(this, 'detailedNetworkIO', this.update.bind(this, 'detailedNetworkIO'));
        Utils.networkMonitor.requestUpdate('detailedNetworkIO');
        
        this.update('publicIps');
        Utils.networkMonitor.listen(this, 'publicIps', this.update.bind(this, 'publicIps'));
        
        this.update('deviceList');
        if(!this.updateTimer) {
            this.updateTimer = GLib.timeout_add(GLib.PRIORITY_DEFAULT,
                Utils.networkMonitor.updateFrequency * 1000 * 2, // Halves the update frequency
                () => {
                    this.update('deviceList');
                    return true;
                });
        }
    }
    
    async onClose() {
        Utils.networkMonitor.unlisten(this, 'networkIO');
        Utils.networkMonitor.unlisten(this, 'detailedNetworkIO');
        
        if(this.updateTimer) {
            GLib.source_remove(this.updateTimer);
            this.updateTimer = 0;
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
                    this.totalUploadSpeedValueLabel.text = Utils.formatBytesPerSec(current.bytesUploadedPerSec, unit as any, 3);
                else
                    this.totalUploadSpeedValueLabel.text = '-';
                
                if(current.bytesDownloadedPerSec)
                    this.totalDownloadSpeedValueLabel.text = Utils.formatBytesPerSec(current.bytesDownloadedPerSec, unit as any, 3);
                else
                    this.totalDownloadSpeedValueLabel.text = '-';
                
                if(this.networkActivityPopup) {
                    if(this.networkActivityPopup.totalUploadedValueLabel) {
                        if(current.totalBytesUploaded)
                            this.networkActivityPopup.totalUploadedValueLabel.text = Utils.formatBytes(current.totalBytesUploaded, 'kB-KB', 3);
                        else
                            this.networkActivityPopup.totalUploadedValueLabel.text = '-';
                    }
                    if(this.networkActivityPopup.totalDownloadedValueLabel) {
                        if(current.totalBytesDownloaded)
                            this.networkActivityPopup.totalDownloadedValueLabel.text = Utils.formatBytes(current.totalBytesDownloaded, 'kB-KB', 3);
                        else
                            this.networkActivityPopup.totalDownloadedValueLabel.text = '-';
                    }
                    if(this.networkActivityPopup.packetsUploadedValueLabel) {
                        if(current.packetsUploaded)
                            this.networkActivityPopup.packetsUploadedValueLabel.text = Utils.formatHugeNumber(current.packetsUploaded);
                        else
                            this.networkActivityPopup.packetsUploadedValueLabel.text = '-';
                    }
                    if(this.networkActivityPopup.packetsDownloadedValueLabel) {
                        if(current.packetsDownloaded)
                            this.networkActivityPopup.packetsDownloadedValueLabel.text = Utils.formatHugeNumber(current.packetsDownloaded);
                        else
                            this.networkActivityPopup.packetsDownloadedValueLabel.text = '-';
                    }
                    if(this.networkActivityPopup.errorsUploadValueLabel) {
                        if(current.errorsUpload)
                            this.networkActivityPopup.errorsUploadValueLabel.text = Utils.formatHugeNumber(current.errorsUpload);
                        else
                            this.networkActivityPopup.errorsUploadValueLabel.text = '-';
                    }
                    if(this.networkActivityPopup.errorsDownloadValueLabel) {
                        if(current.errorsDownload)
                            this.networkActivityPopup.errorsDownloadValueLabel.text = Utils.formatHugeNumber(current.errorsDownload);
                        else
                            this.networkActivityPopup.errorsDownloadValueLabel.text = '-';
                    }
                }
            }
            else {
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
                            device.uploadValueLabel.text = Utils.formatBytesPerSec(data.bytesUploadedPerSec, unit as any, 3);
                            const uploadColor = Config.get_string('network-menu-arrow-color1') ?? 'rgba(29,172,214,1.0)';
                            device.uploadActivityIcon.style = `color:${uploadColor};`;
                        }
                        else {
                            device.uploadValueLabel.text = '-';
                            device.uploadActivityIcon.style = 'color:rgba(255,255,255,0.5);';
                        }
                        
                        if(data.bytesDownloadedPerSec) {
                            device.downloadValueLabel.text = Utils.formatBytesPerSec(data.bytesDownloadedPerSec, unit as any, 3);
                            const downloadColor = Config.get_string('network-menu-arrow-color2') ?? 'rgba(214,29,29,1.0)';
                            device.downloadActivityIcon.style = `color:${downloadColor};`;
                        }
                        else {
                            device.downloadValueLabel.text = '-';
                            device.downloadActivityIcon.style = 'color:rgba(255,255,255,0.5);';
                        }
                        
                        const popup = this.devicesPopup.get(id);
                        if(popup) {
                            if(popup.totalUploadedValueLabel) {
                                if(data.totalBytesUploaded)
                                    popup.totalUploadedValueLabel.text = Utils.formatBytes(data.totalBytesUploaded, 'kB-KB', 3);
                                else
                                    popup.totalUploadedValueLabel.text = '-';
                            }
                            if(popup.totalDownloadedValueLabel) {
                                if(data.totalBytesDownloaded)
                                    popup.totalDownloadedValueLabel.text = Utils.formatBytes(data.totalBytesDownloaded, 'kB-KB', 3);
                                else
                                    popup.totalDownloadedValueLabel.text = '-';
                            }
                            if(popup.packetsUploadedValueLabel) {
                                if(data.packetsUploaded)
                                    popup.packetsUploadedValueLabel.text = Utils.formatHugeNumber(data.packetsUploaded);
                                else
                                    popup.packetsUploadedValueLabel.text = '-';
                            }
                            if(popup.packetsDownloadedValueLabel) {
                                if(data.packetsDownloaded)
                                    popup.packetsDownloadedValueLabel.text = Utils.formatHugeNumber(data.packetsDownloaded);
                                else
                                    popup.packetsDownloadedValueLabel.text = '-';
                            }
                            if(popup.errorsUploadValueLabel) {
                                if(data.errorsUpload)
                                    popup.errorsUploadValueLabel.text = Utils.formatHugeNumber(data.errorsUpload);
                                else
                                    popup.errorsUploadValueLabel.text = '-';
                            }
                            if(popup.errorsDownloadValueLabel) {
                                if(data.errorsDownload)
                                    popup.errorsDownloadValueLabel.text = Utils.formatHugeNumber(data.errorsDownload);
                                else
                                    popup.errorsDownloadValueLabel.text = '-';
                            }
                        }
                    }
                    else {
                        device.uploadValueLabel.text = '-';
                        device.uploadActivityIcon.style = 'color:rgba(255,255,255,0.5);';
                        device.downloadValueLabel.text = '-';
                        device.downloadActivityIcon.style = 'color:rgba(255,255,255,0.5);';
                        
                        const popup = this.devicesPopup.get(id);
                        if(popup) {
                            if(popup.totalUploadedValueLabel)
                                popup.totalUploadedValueLabel.text = '-';
                            if(popup.totalDownloadedValueLabel)
                                popup.totalDownloadedValueLabel.text = '-';
                            if(popup.packetsUploadedValueLabel)
                                popup.packetsUploadedValueLabel.text = '-';
                            if(popup.packetsDownloadedValueLabel)
                                popup.packetsDownloadedValueLabel.text = '-';
                            if(popup.errorsUploadValueLabel)
                                popup.errorsUploadValueLabel.text = '-';
                            if(popup.errorsDownloadValueLabel)
                                popup.errorsDownloadValueLabel.text = '-';
                        }
                    }
                }
            }
            return;
        }
        if(code === 'publicIps') {
            const publicIPv4 = Utils.networkMonitor.getCurrentValue('publicIpv4Address');
            if(publicIPv4) {
                this.publicIPv4.label.show();
                this.publicIPv4.value.show();
                this.publicIPv4.value.text = publicIPv4;
            }
            else {
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
                }
                else {
                    this.publicIpv6.value1.show();
                    this.publicIpv6.value2.hide();
                    this.publicIpv6.value1.text = publicIpv6;
                }
            }
            else {
                this.publicIpv6.label.hide();
                this.publicIpv6.value1.hide();
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
        for(const [_id, popup] of this.devicesPopup.entries()) {
            if(popup.totalUploadedValueLabel)
                popup.totalUploadedValueLabel.text = '-';
            if(popup.totalDownloadedValueLabel)
                popup.totalDownloadedValueLabel.text = '-';
            if(popup.packetsUploadedValueLabel)
                popup.packetsUploadedValueLabel.text = '-';
            if(popup.packetsDownloadedValueLabel)
                popup.packetsDownloadedValueLabel.text = '-';
            if(popup.errorsUploadValueLabel)
                popup.errorsUploadValueLabel.text = '-';
            if(popup.errorsDownloadValueLabel)
                popup.errorsDownloadValueLabel.text = '-';
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
    }
    
    destroy() {
        this.close(true);
        this.removeAll();
        
        super.destroy();
    }
}

