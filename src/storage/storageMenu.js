/*
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
import Shell from 'gi://Shell';

import {gettext as _, pgettext} from 'resource:///org/gnome/shell/extensions/extension.js';

import {MenuBase} from '../menu.js';
import {Grid} from '../grid.js';
import Utils from '../utils/utils.js';
import { StorageBars } from './storageBars.js';
import Config from '../config.js';
import { StorageGraph } from './storageGraph.js';
import { StorageMonitor } from './storageMonitor.js';

export class StorageMenu extends MenuBase {
    constructor(sourceActor, arrowAlignment, arrowSide) {
        super(sourceActor, arrowAlignment, arrowSide);
        
        this.storageSectionLabel = this.addMenuSection(_('Storage'), 'centered');
        this.createActivitySection();
        this.addTopProcesses();
        this.createDeviceList();
        
        this.addUtilityButtons();
    }
    
    createActivitySection() {
        const defaultStyle = '';
        
        let hoverButton = new St.Button({
            reactive: true,
            track_hover: true,
            style: defaultStyle
        });
        
        const grid = new Grid({ styleClass: 'astra-monitor-menu-subgrid' });
        hoverButton.set_child(grid);
        
        //TODO: make width customizable!?
        this.graph = new StorageGraph({
            width: 200-2-15,
            mini: false
        });
        grid.addToGrid(this.graph, 2);
        
        const totalReadSpeedLabel = new St.Label({
            text: _('Global Read:'),
            x_expand: true,
            style_class: 'astra-monitor-menu-label',
            style: 'margin-top:0.25em;'
        });
        grid.addToGrid(totalReadSpeedLabel);
        
        this.totalReadSpeedValueLabel = new St.Label({
            text: '-',
            x_expand: true,
            style_class: 'astra-monitor-menu-key'
        });
        grid.addToGrid(this.totalReadSpeedValueLabel);
        
        const totalWriteSpeedLabel = new St.Label({
            text: _('Global Write:'),
            x_expand: true,
            style_class: 'astra-monitor-menu-label'
        });
        grid.addToGrid(totalWriteSpeedLabel);
        
        this.totalWriteSpeedValueLabel = new St.Label({
            text: '-',
            x_expand: true,
            style_class: 'astra-monitor-menu-key'
        });
        grid.addToGrid(this.totalWriteSpeedValueLabel);
        
        hoverButton.connect('enter-event', () => {
            hoverButton.style = defaultStyle + this.selectionStyle;
            
        });
        
        hoverButton.connect('leave-event', () => {
            hoverButton.style = defaultStyle;
            
        });
        
        this.addToMenu(hoverButton, 2);
    }
    
    addTopProcesses() {
        const separator = this.addMenuSection(_('Top processes'), 'centered');
        separator.hide();
        
        const defaultStyle = '';
        
        let hoverButton = new St.Button({
            reactive: true,
            track_hover: true,
            style: defaultStyle
        });
        hoverButton.hide();
        
        const grid = new Grid({ numCols: 3, styleClass: 'astra-monitor-menu-subgrid' });
        
        const labels = [];
        
        //TODO: allow to customize number of processes to show in the menu
        const numProcesses = 5;
        for(let i = 0; i < numProcesses; i++) {
            let label = new St.Label({
                text: '',
                style_class: 'astra-monitor-menu-cmd-name',
                x_expand: true
            });
            grid.addToGrid(label);
            
            // READ
            const readContainer = new St.Widget({
                layout_manager: new Clutter.GridLayout({orientation: Clutter.Orientation.HORIZONTAL}),
                style: 'margin-left:0;margin-right:0;width:5em;'
            });
            
            const readActivityIcon = new St.Icon({
                gicon: Utils.getLocalIcon('am-up-symbolic'),
                fallback_icon_name: 'go-up-symbolic',
                style_class: 'astra-monitor-menu-icon-mini',
                style: 'color:rgba(255,255,255,0.5);'
            });
            readContainer.add_child(readActivityIcon);
            
            const readValue = new St.Label({
                text: '',
                style_class: 'astra-monitor-menu-cmd-usage',
                x_expand: true
            });
            readContainer.add_child(readValue);
            
            grid.addToGrid(readContainer);
            
            // WRITE
            const writeContainer = new St.Widget({
                layout_manager: new Clutter.GridLayout({orientation: Clutter.Orientation.HORIZONTAL}),
                style: 'margin-left:0;margin-right:0;width:5em;'
            });
            
            const writeActivityIcon = new St.Icon({
                gicon: Utils.getLocalIcon('am-down-symbolic'),
                fallback_icon_name: 'go-down-symbolic',
                style_class: 'astra-monitor-menu-icon-mini',
                style: 'color:rgba(255,255,255,0.5);'
            });
            writeContainer.add_child(writeActivityIcon);
            
            const writeValue = new St.Label({
                text: '',
                style_class: 'astra-monitor-menu-cmd-usage',
                x_expand: true
            });
            writeContainer.add_child(writeValue);
            
            grid.addToGrid(writeContainer);
            
            labels.push({
                label,
                read: {
                    container: readContainer,
                    value: readValue,
                    icon: readActivityIcon
                },
                write: {
                    container: writeContainer,
                    value: writeValue,
                    icon: writeActivityIcon
                },
                
            });
        }
        
        hoverButton.set_child(grid);
        
        //this.createTopProcessesPopup(hoverButton);
        
        hoverButton.connect('enter-event', () => {
            hoverButton.style = defaultStyle + this.selectionStyle;
            //if(this.topProcessesPopup)
            //    this.topProcessesPopup.open(true);
        });
        
        hoverButton.connect('leave-event', () => {
            hoverButton.style = defaultStyle;
            //if(this.topProcessesPopup)
            //    this.topProcessesPopup.close(true);
        });
        this.addToMenu(hoverButton, 2);
        
        this.topProcesses = {
            separator,
            labels,
            hoverButton
        };
    }
    
    createTopProcessesPopup(sourceActor) {
        this.topProcessesPopup = new MenuBase(sourceActor, 0.05, St.Side.RIGHT);
        this.topProcessesPopup.addMenuSection(_('Top processes'), 'centered');
        
        const grid = new Grid({ numCols: 2, styleClass: 'astra-monitor-menu-subgrid' });
        
        for(let i = 0; i < StorageMonitor.TOP_PROCESSES_LIMIT; i++) {
            // READ
            const readContainer = new St.Widget({
                layout_manager: new Clutter.GridLayout({orientation: Clutter.Orientation.HORIZONTAL}),
                style: 'margin-left:0;margin-right:0;width:5em;'
            });
            
            const readActivityIcon = new St.Icon({
                gicon: Utils.getLocalIcon('am-up-symbolic'),
                fallback_icon_name: 'go-up-symbolic',
                style_class: 'astra-monitor-menu-icon-mini',
                style: 'color:rgba(255,255,255,0.5);'
            });
            readContainer.add_child(readActivityIcon);
            
            const readValue = new St.Label({
                text: '-',
                style_class: 'astra-monitor-menu-cmd-usage',
                x_expand: true
            });
            readContainer.add_child(readValue);
            
            grid.addGrid(readContainer, 0, i*2, 1, 1);
            
            // WRITE
            const writeContainer = new St.Widget({
                layout_manager: new Clutter.GridLayout({orientation: Clutter.Orientation.HORIZONTAL}),
                style: 'margin-left:0;margin-right:0;width:5em;'
            });
            
            const writeActivityIcon = new St.Icon({
                gicon: Utils.getLocalIcon('am-down-symbolic'),
                fallback_icon_name: 'go-down-symbolic',
                style_class: 'astra-monitor-menu-icon-mini',
                style: 'color:rgba(255,255,255,0.5);'
            });
            writeContainer.add_child(writeActivityIcon);
            
            const writeValue = new St.Label({
                text: '-',
                style_class: 'astra-monitor-menu-cmd-usage',
                x_expand: true
            });
            writeContainer.add_child(writeValue);
            
            grid.addGrid(writeContainer, 0, i*2+1, 1, 1);
            
            const label = new St.Label({
                text: '-',
                style_class: 'astra-monitor-menu-cmd-name-full'
            });
            grid.addGrid(label, 1, i*2, 1, 1);
            
            const description = new St.Label({
                text: '-',
                style_class: 'astra-monitor-menu-cmd-description'
            });
            grid.addGrid(description, 1, i*2+1, 1, 1);
            
            this.topProcessesPopup['process' + i] = {
                label,
                description,
                read: {
                    container: readContainer,
                    value: readValue,
                    icon: readActivityIcon
                },
                write: {
                    container: writeContainer,
                    value: writeValue,
                    icon: writeActivityIcon
                }
            };
        }
        
        this.topProcessesPopup.addToMenu(grid, 2);
    }
    
    createDeviceList() {
        if(this.deviceSection === undefined) {
            this.deviceSectionLabel = this.addMenuSection(_('Devices'), 'centered');
            
            this.deviceSection = new Grid({ styleClass: 'astra-monitor-menu-subgrid' });
            this.noDevicesLabel = new St.Label({
                text: _('No storage device found'),
                style_class: 'astra-monitor-menu-label-warning',
                style: 'font-style:italic;'
            });
            this.deviceSection.addToGrid(this.noDevicesLabel, 2);
            this.devices = new Map();
            this.addToMenu(this.deviceSection, 2);
        }
    }
    
    updateDeviceList() {
        const devices = Utils.storageMonitor.getBlockDevicesSync();
        if(devices.size > 0)
            this.noDevicesLabel.hide();
        else
            this.noDevicesLabel.show();
        
        // remove all devices that are not present anymore
        for(const [id, device] of this.devices.entries()) {
            if(!devices.has(id)) {
                this.deviceSection.remove_child(device.container);
                this.devices.delete(id);
            }
        }
        
        // add new devices / update existing devices
        const idList = Array.from(devices.keys());
        // set main storage device first
        const mainDisk = Config.get_string('storage-main');
        const mainDiskIndex = idList.indexOf(mainDisk);
        if(mainDiskIndex > 0) {
            idList.splice(mainDiskIndex, 1);
            idList.unshift(mainDisk);
        }
        
        for(const id of idList) {
            const deviceData = devices.get(id);
            
            let device;
            if(!this.devices.has(id)) {
                device = this.createBlockDevice();
                this.deviceSection.addToGrid(device.container, 2);
                this.devices.set(id, device);
            }
            else {
                device = this.devices.get(id);
            }
            
            //Update device info
            try {
                this.updateBlockDevice(device, deviceData);
            }
            catch(e) {
                Utils.error(e);
            }
        }
    }
    
    createBlockDevice() {
        const defaultStyle = 'padding-top:0.25em;margin-bottom:0.25em;';
        const container = new St.Button({
            reactive: true,
            track_hover: true,
            style: defaultStyle
        });
        
        const grid = new Grid({
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
            
            const name = new St.Label({
                text: '',
                x_expand: true,
                style_class: 'astra-monitor-menu-key'
            });
            headerGrid.addToGrid(name);
            
            grid.addToGrid(headerGrid, 2);
        //}
        
        //Bar
        //{
            const barGrid = new St.Widget({
                layout_manager: new Clutter.GridLayout({orientation: Clutter.Orientation.VERTICAL}),
                style: 'margin-left:0;'
            });
            
            const sizeLabel = new St.Label({
                text: '',
                y_align: Clutter.ActorAlign.CENTER,
                style_class: 'astra-monitor-menu-key'
            });
            barGrid.layout_manager.attach(sizeLabel, 0, 0, 1, 1);
            
            const bar = new StorageBars({
                numBars: 1,
                width: 160-2-4,
                height: 0.5,
                mini:false,
                layout: 'horizontal',
                x_align: Clutter.ActorAlign.START,
                style: 'margin-left:0;margin-bottom:0;margin-right:0;border:solid 1px #555;'
            });
            barGrid.layout_manager.attach(bar, 1, 0, 1, 1);
            
            const barLabel = new St.Label({
                text: '0%',
                y_align: Clutter.ActorAlign.CENTER,
                style: 'width:2.7em;font-size:0.8em;text-align:right;margin-right:0.25em;margin-top:0.2em;'
            });
            barGrid.layout_manager.attach(barLabel, 2, 0, 1, 1);
            
            grid.addToGrid(barGrid, 2);
        //}
        
        // Read/Write Speed
        //{
            const rwContainer = new St.Widget({
                layout_manager: new Clutter.GridLayout({orientation: Clutter.Orientation.HORIZONTAL}),
                x_expand: true,
                style: 'margin-left:0;margin-right:0;'
            });
            
            const readContainer = new St.Widget({
                layout_manager: new Clutter.GridLayout({orientation: Clutter.Orientation.HORIZONTAL}),
                x_expand: true,
                style: 'margin-left:0;margin-right:0;'
            });
            
            const readLabel = new St.Label({
                text: pgettext('short for read', 'R'),
                style_class: 'astra-monitor-menu-label',
                style: 'padding-right:0.15em;'
            });
            readContainer.add_child(readLabel);
            
            const readActivityIcon = new St.Icon({
                gicon: Utils.getLocalIcon('am-up-symbolic'),
                fallback_icon_name: 'go-up-symbolic',
                style_class: 'astra-monitor-menu-icon-mini',
                style: 'color:rgba(255,255,255,0.5);'
            });
            readContainer.add_child(readActivityIcon);
            
            const readValueLabel = new St.Label({
                text: '-',
                x_expand: true,
                style_class: 'astra-monitor-menu-key'
            });
            readContainer.add_child(readValueLabel);
            readContainer.set_width(100);
            
            rwContainer.add_child(readContainer);
            
            const writeContainer = new St.Widget({
                layout_manager: new Clutter.GridLayout({orientation: Clutter.Orientation.HORIZONTAL}),
                x_expand: true,
                style: 'margin-left:0;margin-right:0;'
            });
            
            const writeLabel = new St.Label({
                text: pgettext('short for write', 'W'),
                style_class: 'astra-monitor-menu-label',
                style: 'padding-right:0.15em;'
            });
            writeContainer.add_child(writeLabel);
            
            const writeActivityIcon = new St.Icon({
                gicon: Utils.getLocalIcon('am-down-symbolic'),
                fallback_icon_name: 'go-down-symbolic',
                style_class: 'astra-monitor-menu-icon-mini',
                style: 'color:rgba(255,255,255,0.5);'
            });
            writeContainer.add_child(writeActivityIcon);
            
            const writeValueLabel = new St.Label({
                text: '-',
                x_expand: true,
                style_class: 'astra-monitor-menu-key'
            });
            writeContainer.add_child(writeValueLabel);
            writeContainer.set_width(100);
            
            rwContainer.add_child(writeContainer);
            
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
            name,
            barGrid,
            bar,
            barLabel,
            sizeLabel,
            readValueLabel,
            readActivityIcon,
            writeValueLabel,
            writeActivityIcon
        };
    }
    
    updateBlockDevice(device, deviceData) {
        device.data = deviceData;
        
        const icon = {
            gicon: Utils.getLocalIcon('am-harddisk-symbolic'),
            fallback_icon_name: 'drive-harddisk-symbolic'
        };
        
        if(deviceData.removable) {
            icon.gicon = Utils.getLocalIcon('am-media-removable-symbolic');
            icon.fallback_icon_name = 'media-removable-symbolic';
        }
        else if((deviceData.fstype && deviceData.fstype.startsWith('swap')) ||
                deviceData.mountpoints.includes('/boot') ||
                deviceData.mountpoints.includes('[SWAP]')) {
            icon.gicon = Utils.getLocalIcon('am-linux-symbolic');
            icon.fallback_icon_name = 'drive-harddisk-system-symbolic';
        }
        else if(deviceData.type.startsWith('raid') ||
                deviceData.type.startsWith('lvm') ||
                deviceData.type.startsWith('md')) {
            icon.gicon = Utils.getLocalIcon('am-raid-symbolic');
            icon.fallback_icon_name = 'drive-harddisk-raid-symbolic';
        }
        else if(deviceData.type.startsWith('cdrom') || deviceData.type.startsWith('rom') || deviceData.type.endsWith('rom')) {
            icon.fallback_icon_name = 'drive-optical-symbolic';
        }
        else if(deviceData.type.startsWith('floppy')) {
            icon.fallback_icon_name = 'media-floppy-symbolic';
        }
        
        if(icon.gicon)
            device.icon.gicon = icon.gicon;
        device.icon.fallback_icon_name = icon.fallback_icon_name;
        
        let label = deviceData.label || '';
        if(!label) {
            if(deviceData.model)
                label = deviceData.model;
            else if(deviceData.vendor)
                label = deviceData.vendor;
            else
                label = _('Disk');
        }
        device.label.text = label;
        device.name.text = deviceData.name ? `[${deviceData.name}]` : '';
        
        if(!Number.isNaN(deviceData.usage) && deviceData.usage !== undefined) {
            device.barGrid.visible = true;
            device.barLabel.text = `${deviceData.usage}%`;
            device.bar.setUsage({usePercentage: deviceData.usage});
        }
        else {
            device.barGrid.visible = false;
        }
        
        let size = deviceData.size;
        if(size)
            device.sizeLabel.text = Utils.formatBytes(size, 3);
        else
            device.sizeLabel.text = '-';
    }
    
    addUtilityButtons() {
        super.addUtilityButtons('storage', (box) => {
            const appSys = Shell.AppSystem.get_default();
            
            //TODO: add enable/disable these buttons on the preferences menu!?
            
            // Disk Usage Analyzer
            const baobabApp = appSys.lookup_app('org.gnome.baobab.desktop');
            if(baobabApp) {
                let button = new St.Button({style_class: 'button'});
                button.child = new St.Icon({
                    gicon: Utils.getLocalIcon('am-pie-symbolic'),
                    fallback_icon_name: 'baobab-symbolic',
                });
                
                button.connect('clicked', () => {
                    this.close(true);
                    baobabApp.activate();
                });
                box.add_child(button);
            }
            
            // Disk Utility
            const diskApp = appSys.lookup_app('org.gnome.DiskUtility.desktop');
            if(diskApp) {
                let button = new St.Button({style_class: 'button'});
                button.child = new St.Icon({
                    gicon: Utils.getLocalIcon('am-disk-utility-symbolic'),
                    fallback_icon_name: 'utilities-disk-utility-symbolic',
                });

                button.connect('clicked', () => {
                    this.close(true);
                    diskApp.activate();
                });
                box.add_child(button);
            }
        });
    }
    
    onOpen() {
        this.clear();
        
        Utils.storageMonitor.listen(this, 'storageIO', this.update.bind(this, 'storageIO'));
        this.update('storageIO');
        
        Utils.storageMonitor.listen(this, 'detailedStorageIO', this.update.bind(this, 'detailedStorageIO'));
        Utils.storageMonitor.requestUpdate('detailedStorageIO');
        
        if(Utils.GTop) {
            this.topProcesses.separator.show();
            this.topProcesses.hoverButton.show();
            
            Utils.storageMonitor.listen(this, 'topProcesses', this.update.bind(this, 'topProcesses'));
            Utils.storageMonitor.requestUpdate('topProcesses');
        }
        
        this.update('deviceList');
        if(!this.updateTimer) {
            this.updateTimer = GLib.timeout_add(GLib.PRIORITY_DEFAULT,
                Utils.storageMonitor.updateFrequency * 1000 * 2, // Halves the update frequency
                () => {
                    this.update('deviceList');
                    return true;
                });
        }
    }
    
    onClose() {
        Utils.storageMonitor.unlisten(this, 'storageIO');
        Utils.storageMonitor.unlisten(this, 'detailedStorageIO');
        Utils.processorMonitor.unlisten(this, 'topProcesses');
        
        if(this.updateTimer) {
            GLib.source_remove(this.updateTimer);
            this.updateTimer = null;
        }
    }
    
    update(code) {
        if(code === 'deviceList') {
            this.updateDeviceList();
            return;
        }
        if(code === 'storageIO') {
            let usage = Utils.storageMonitor.getUsageHistory('storageIO');
            this.graph.setUsageHistory(usage);
            
            let current = Utils.storageMonitor.getCurrentValue('storageIO');
            if(current) {
                const unit = Config.get_string('storage-io-unit');
                
                if(current.bytesReadPerSec)
                    this.totalReadSpeedValueLabel.text = Utils.formatBytesPerSec(current.bytesReadPerSec, unit, 3);
                else
                    this.totalReadSpeedValueLabel.text = '-';
                
                if(current.bytesWrittenPerSec)
                    this.totalWriteSpeedValueLabel.text = Utils.formatBytesPerSec(current.bytesWrittenPerSec, unit, 3);
                else
                    this.totalWriteSpeedValueLabel.text = '-';
            }
            else {
                this.totalReadSpeedValueLabel.text = '-';
                this.totalWriteSpeedValueLabel.text = '-';
            }
            return;
        }
        if(code === 'detailedStorageIO') {
            let current = Utils.storageMonitor.getCurrentValue('detailedStorageIO');
            
            if(current) {
                for(const [id, device] of this.devices.entries()) {
                    if(device.data === null)
                        continue;
                    const kname = device.data.kname;
                    if(kname) {
                        const data = current.get(kname);
                        
                        if(data) {
                            const unit = Config.get_string('storage-io-unit');
                            
                            if(data.bytesReadPerSec) {
                                device.readValueLabel.text = Utils.formatBytesPerSec(data.bytesReadPerSec, unit, 3);
                                // TODO: make this color customizable!?
                                device.readActivityIcon.style = 'color:rgb(29,172,214);';
                            }
                            else {
                                device.readValueLabel.text = '-';
                                device.readActivityIcon.style = 'color:rgba(255,255,255,0.5);';
                            }
                            
                            if(data.bytesWrittenPerSec) {
                                device.writeValueLabel.text = Utils.formatBytesPerSec(data.bytesWrittenPerSec, unit, 3);
                                // TODO: make this color customizable!?
                                device.writeActivityIcon.style = 'color:rgb(214,29,29);';
                            }
                            else {
                                device.writeValueLabel.text = '-';
                                device.writeActivityIcon.style = 'color:rgba(255,255,255,0.5);';
                            }
                        }
                    }
                    else {
                        device.readValueLabel.text = '-';
                        device.readActivityIcon.style = 'color:rgba(255,255,255,0.5);';
                        device.writeValueLabel.text = '-';
                        device.writeActivityIcon.style = 'color:rgba(255,255,255,0.5);';
                    }
                }
            }
            return;
        }
        if(code === 'topProcesses') {
            const topProcesses = Utils.storageMonitor.getCurrentValue('topProcesses');
            
            for(let i = 0; i < StorageMonitor.TOP_PROCESSES_LIMIT; i++) {
                if(!topProcesses || !Array.isArray(topProcesses) || !topProcesses[i] || !topProcesses[i].process) {
                    if(i < 5) {
                        this.topProcesses.labels[i].label.text = '-';
                        this.topProcesses.labels[i].read.value.text = '-';
                        this.topProcesses.labels[i].read.icon.style = 'color:rgba(255,255,255,0.5);';
                        this.topProcesses.labels[i].write.value.text = '-';
                        this.topProcesses.labels[i].write.icon.style = 'color:rgba(255,255,255,0.5);';
                    }
                    
                    /*if(this.topProcessesPopup && this.topProcessesPopup['process' + i]) {
                        const popupElement = this.topProcessesPopup['process' + i];
                        popupElement.label.hide();
                        popupElement.description.hide();
                        popupElement.read.container.hide();
                        popupElement.write.container.hide();
                    }*/
                }
                else {
                    const topProcess = topProcesses[i];
                    const process = topProcess.process;
                    const read = topProcess.read;
                    const write = topProcess.write;
                    
                    if(i < 5) {
                        this.topProcesses.labels[i].label.text = process.exec;
                        
                        if(read > 0) {
                            // TODO: make this color customizable!?
                            this.topProcesses.labels[i].read.icon.style = 'color:rgb(29,172,214);';
                            this.topProcesses.labels[i].read.value.text = Utils.formatBytesPerSec(read, 3);
                        }
                        else {
                            this.topProcesses.labels[i].read.icon.style = 'color:rgba(255,255,255,0.5);';
                            this.topProcesses.labels[i].read.value.text = '-';
                        }
                        
                        if(write > 0) {
                            // TODO: make this color customizable!?
                            this.topProcesses.labels[i].write.icon.style = 'color:rgb(214,29,29);';
                            this.topProcesses.labels[i].write.value.text = Utils.formatBytesPerSec(write, 3);
                        }
                        else {
                            this.topProcesses.labels[i].write.icon.style = 'color:rgba(255,255,255,0.5);';
                            this.topProcesses.labels[i].write.value.text = '-';
                        }
                    }
                    
                    /*if(this.topProcessesPopup && this.topProcessesPopup['process' + i]) {
                        const popupElement = this.topProcessesPopup['process' + i];
                        
                        popupElement.label.show();
                        popupElement.label.text = process.exec;
                        
                        popupElement.description.show();
                        popupElement.description.text = process.cmd;
                        
                        popupElement.read.container.show();
                        if(read > 0) {
                            popupElement.read.icon.style = 'color:rgb(29,172,214);';
                            popupElement.read.value.text = Utils.formatBytesPerSec(read, 3);
                        }
                        else {
                            popupElement.read.icon.style = 'color:rgba(255,255,255,0.5);';
                            popupElement.read.value.text = '-';
                        }
                        
                        popupElement.write.container.show();
                        if(write > 0) {
                            popupElement.write.icon.style = 'color:rgb(214,29,29);';
                            popupElement.write.value.text = Utils.formatBytesPerSec(write, 3);
                        }
                        else {
                            popupElement.write.icon.style = 'color:rgba(255,255,255,0.5);';
                            popupElement.write.value.text = '-';
                        }
                    }*/
                }   
            }
            return;
        }
    }
    
    clear() {
        this.totalReadSpeedValueLabel.text = '-';
        this.totalWriteSpeedValueLabel.text = '-';
        
        for(const [id, device] of this.devices.entries()) {
            device.readValueLabel.text = '-';
            device.readActivityIcon.style = 'color:rgba(255,255,255,0.5);';
            device.writeValueLabel.text = '-';
            device.writeActivityIcon.style = 'color:rgba(255,255,255,0.5);';
        }
    }
    
    destroy() {
        this.close(true);
        this.removeAll();
        
        super.destroy();
    }
};
