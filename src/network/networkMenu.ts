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
    data: any;
    container: St.Button;
    icon: St.Icon;
    label: St.Label;
    label2: St.Label;
    uploadValueLabel: St.Label;
    uploadActivityIcon: St.Icon;
    downloadValueLabel: St.Label;
    downloadActivityIcon: St.Icon;
};

export default class NetworkMenu extends MenuBase {
    /*private networkSectionLabel!: St.Label;*/
    
    private graph!: InstanceType<typeof NetworkGraph>;
    private totalUploadSpeedValueLabel!: St.Label;
    private totalDownloadSpeedValueLabel!: St.Label;
    
    private deviceSection!: InstanceType<typeof Grid>;
    private noDevicesLabel!: St.Label;
    
    private devices!: Map<string, InterfaceDeviceInfo>;
    
    private updateTimer: number = 0;
    
    constructor(sourceActor: St.Widget, arrowAlignment: number, arrowSide: St.Side) {
        super(sourceActor, arrowAlignment, arrowSide);
        
        /*this.networkSectionLabel = */this.addMenuSection(_('Network'));
        this.createActivitySection();
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
            }
        }
        
        // add new devices / update existing devices
        const idList = Array.from(devices.keys());
        
        // TODO: set main interface first
        
        for(const id of idList) {
            const deviceData = devices.get(id);
            
            let device;
            if(!this.devices.has(id)) {
                device = this.createInterfaceDevice();
                this.deviceSection.addToGrid(device.container, 2);
                this.devices.set(id, device);
            }
            else {
                device = this.devices.get(id);
            }
            
            if(!device)
                continue;
            if(!deviceData)
                continue;
            
            //Update device info
            try {
                this.updateInterfaceDevice(device, deviceData);
            }
            catch(e: any) {
                Utils.error(e);
            }
        }
    }
    
    createInterfaceDevice(): InterfaceDeviceInfo {
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
            
        });
        
        container.connect('leave-event', () => {
            container.style = defaultStyle;
            
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
    
    updateInterfaceDevice(device: InterfaceDeviceInfo, deviceData: InterfaceInfo) {
        device.data = deviceData;
        
        const icon = {
            gicon: Utils.getLocalIcon('am-network-symbolic'),
            fallback_icon_name: 'network-wired-symbolic',
        };
        if(deviceData.name.startsWith('wlan') || deviceData.name.startsWith('wl')) {
            icon.gicon = Utils.getLocalIcon('am-wireless-symbolic');
            icon.fallback_icon_name = 'network-wireless-symbolic';
        }
        else if(deviceData.name.startsWith('wwan') || deviceData.name.startsWith('ww'))
            icon.fallback_icon_name = 'network-cellular-symbolic';
        else if(deviceData.name.startsWith('tun') || deviceData.name.startsWith('tap'))
            icon.fallback_icon_name = 'network-vpn-symbolic';
        
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
    
    onOpen() {
        this.clear();
        
        this.update('networkIO');
        Utils.networkMonitor.listen(this, 'networkIO', this.update.bind(this, 'networkIO'));
        
        Utils.networkMonitor.listen(this, 'detailedNetworkIO', this.update.bind(this, 'detailedNetworkIO'));
        Utils.networkMonitor.requestUpdate('detailedNetworkIO');
        
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
    
    onClose() {
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
            }
            else {
                this.totalUploadSpeedValueLabel.text = '-';
                this.totalDownloadSpeedValueLabel.text = '-';
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
                    }
                    else {
                        device.uploadValueLabel.text = '-';
                        device.uploadActivityIcon.style = 'color:rgba(255,255,255,0.5);';
                        device.downloadValueLabel.text = '-';
                        device.downloadActivityIcon.style = 'color:rgba(255,255,255,0.5);';
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
    }
    
    destroy() {
        this.close(true);
        this.removeAll();
        
        super.destroy();
    }
}

