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
import Shell from 'gi://Shell';

import {gettext as _, pgettext} from 'resource:///org/gnome/shell/extensions/extension.js';

import Grid from '../grid.js';
import Utils from '../utils/utils.js';
import Config from '../config.js';
import MenuBase from '../menu.js';
import StorageBars from './storageBars.js';
import StorageGraph from './storageGraph.js';
import StorageMonitor, { BlockDevice, BlockDeviceData } from './storageMonitor.js';

type BlockDeviceInfo = {
    data: BlockDevice|null,
    container: InstanceType<typeof Grid>,
    icon: St.Icon,
    label: St.Label,
    name: St.Label,
    barGrid: St.Widget,
    bar: InstanceType<typeof StorageBars>,
    barLabel: St.Label,
    sizeLabel: St.Label,
    readValueLabel: St.Label,
    readActivityIcon: St.Icon,
    writeValueLabel: St.Label,
    writeActivityIcon: St.Icon
}

type StorageActivityPopup = MenuBase & {
    totalReadValueLabel?: St.Label,
    totalWriteValueLabel?: St.Label
}

type DeviceInfoPopup = MenuBase & {
    empty: boolean,
    
    section1: St.Label;
    labelsS1: St.Label[],
    valuesS1: St.Label[],
    
    section2: St.Label;
    labelsS2: St.Label[],
    valuesS2: St.Label[],
    
    section3: St.Label;
    labelsS3: St.Label[],
    valuesS3: St.Label[],
    
    section4: St.Label;
    labelsS4: St.Label[],
    valuesS4: St.Label[],
    
    section5: St.Label;
    labelsS5: St.Label[],
    valuesS5: St.Label[],
    
    section6: St.Label;
    labelsS6: St.Label[],
    valuesS6: St.Label[],
};

type DeviceTotalsPopup = MenuBase & {
    totalReadValueLabel?: St.Label,
    totalWriteValueLabel?: St.Label
}

type DeviceInfoPopupConfiguration = {
    title: string,
    sectionNr: 'section1' | 'section2' | 'section3' | 'section4' | 'section5' | 'section6',
    labels: 'labelsS1' | 'labelsS2' | 'labelsS3' | 'labelsS4' | 'labelsS5' | 'labelsS6',
    values: 'valuesS1' | 'valuesS2' | 'valuesS3' | 'valuesS4' | 'valuesS5' | 'valuesS6',
    fields: {
        key: keyof BlockDeviceData,
        label: string,
        parent?: boolean,
        checkNull?: boolean,
        formatAsBytes?: boolean
    }[],
}[];

type TopProcess = {
    label: St.Label,
    description?: St.Label,
    read: {
        container: St.Widget,
        value: St.Label,
        icon: St.Icon
    },
    write: {
        container: St.Widget,
        value: St.Label,
        icon: St.Icon
    }
};

type TopProcesses = {
    separator: St.Label,
    labels: TopProcess[],
    hoverButton: St.Button
};

type TopProcessesPopup = MenuBase & {
    processes?: Map<number, TopProcess>
};

export default class StorageMenu extends MenuBase {
    /*private storageSectionLabel!: St.Label;*/
    private storageActivityPopup!: StorageActivityPopup;
    
    private graph!: InstanceType<typeof StorageGraph>;
    private totalReadSpeedValueLabel!: St.Label;
    private totalWriteSpeedValueLabel!: St.Label;
    
    private topProcesses!: TopProcesses;
    private topProcessesPopup!: TopProcessesPopup;
    
    private deviceSection!: InstanceType<typeof Grid>;
    private noDevicesLabel!: St.Label;
    
    private devices!: Map<string, BlockDeviceInfo>;
    private devicesInfoPopup!: Map<string, DeviceInfoPopup>;
    private devicesTotalsPopup!: Map<string, DeviceTotalsPopup>;
    private updateTimer: number = 0;
    
    constructor(sourceActor: St.Widget, arrowAlignment: number, arrowSide: St.Side) {
        super(sourceActor, arrowAlignment, { name: 'Storage Menu', arrowSide });
        
        Utils.verbose('Initializing storage menu');
        
        /*this.storageSectionLabel = */this.addMenuSection(_('Storage'));
        this.createActivitySection();
        this.addTopProcesses();
        this.createDeviceList();
        
        this.addUtilityButtons();
        
        this.setStyle();
        Config.connect(this, 'changed::theme-style', this.setStyle.bind(this));
    }
    
    setStyle() {
        const lightTheme = Utils.themeStyle === 'light';
        
        const styleClass = lightTheme ? 'astra-monitor-menu-key-light' : 'astra-monitor-menu-key';
        this.totalReadSpeedValueLabel.style_class = styleClass;
        this.totalWriteSpeedValueLabel.style_class = styleClass;
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
            x_expand: true
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
            x_expand: true
        });
        grid.addToGrid(this.totalWriteSpeedValueLabel);
        
        this.createActivityPopup(hoverButton);
        
        hoverButton.connect('enter-event', () => {
            hoverButton.style = defaultStyle + this.selectionStyle;
            if(this.storageActivityPopup)
                this.storageActivityPopup.open(true);
        });
        
        hoverButton.connect('leave-event', () => {
            hoverButton.style = defaultStyle;
            if(this.storageActivityPopup)
                this.storageActivityPopup.close(true);
        });
        
        this.addToMenu(hoverButton, 2);
    }
    
    createActivityPopup(sourceActor: St.Widget) {
        this.storageActivityPopup = new MenuBase(sourceActor, 0.05, { numCols: 2});
        this.storageActivityPopup.addMenuSection(_('Total Activity'));
        
        //Read
        this.storageActivityPopup.addToMenu(new St.Label({
            text: _('Read'),
            style_class: 'astra-monitor-menu-sub-key'
        }));
        
        const totalReadValueLabel = new St.Label({text: '', style: 'text-align:left;'});
        this.storageActivityPopup.addToMenu(totalReadValueLabel);
        this.storageActivityPopup.totalReadValueLabel = totalReadValueLabel;
        
        //Write
        this.storageActivityPopup.addToMenu(new St.Label({
            text: _('Write'),
            style_class: 'astra-monitor-menu-sub-key'
        }));
        
        const totalWriteValueLabel = new St.Label({text: '', style: 'text-align:left;'});
        this.storageActivityPopup.addToMenu(totalWriteValueLabel);
        this.storageActivityPopup.totalWriteValueLabel = totalWriteValueLabel;
    }
    
    addTopProcesses() {
        const separator = this.addMenuSection(_('Top processes'));
        separator.hide();
        
        const defaultStyle = '';
        
        const hoverButton = new St.Button({
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
            const label = new St.Label({
                text: '',
                style_class: 'astra-monitor-menu-cmd-name',
                style: 'max-width:85px;',
                x_expand: true
            });
            grid.addToGrid(label);
            
            // READ
            const readContainer = new St.Widget({
                layout_manager: new Clutter.GridLayout({orientation: Clutter.Orientation.HORIZONTAL}),
                style: 'margin-left:0;margin-right:0;width:5.5em;'
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
                style: 'margin-left:0;margin-right:0;width:5.5em;'
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
        
        this.createTopProcessesPopup(hoverButton);
        
        hoverButton.connect('enter-event', () => {
            hoverButton.style = defaultStyle + this.selectionStyle;
            if(this.topProcessesPopup)
                this.topProcessesPopup.open(true);
        });
        
        hoverButton.connect('leave-event', () => {
            hoverButton.style = defaultStyle;
            if(this.topProcessesPopup)
                this.topProcessesPopup.close(true);
        });
        this.addToMenu(hoverButton, 2);
        
        this.topProcesses = {
            separator,
            labels,
            hoverButton
        };
    }
    
    createTopProcessesPopup(sourceActor: St.Widget) {
        this.topProcessesPopup = new MenuBase(sourceActor, 0.05);
        const section = this.topProcessesPopup.addMenuSection(_('Top processes'));
        section.style = 'min-width:500px;';
        this.topProcessesPopup.processes = new Map();
        
        const grid = new Grid({
            x_expand: true,
            x_align: Clutter.ActorAlign.START,
            numCols: 2,
            styleClass: 'astra-monitor-menu-subgrid'
        });
        
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
            
            this.topProcessesPopup.processes.set(i, {
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
            });
        }
        
        this.topProcessesPopup.addToMenu(grid, 2);
    }
    
    createDeviceList() {
        if(this.deviceSection === undefined) {
            this.addMenuSection(_('Devices'));
            
            this.deviceSection = new Grid({ styleClass: 'astra-monitor-menu-subgrid' });
            this.noDevicesLabel = new St.Label({
                text: _('No storage device found'),
                style_class: 'astra-monitor-menu-label-warning',
                style: 'font-style:italic;'
            });
            this.deviceSection.addToGrid(this.noDevicesLabel, 2);
            this.devices = new Map();
            this.devicesInfoPopup = new Map();
            this.devicesTotalsPopup = new Map();
            this.addToMenu(this.deviceSection, 2);
            
            Config.connect(this, 'changed::storage-ignored', this.updateDeviceList.bind(this));
            Config.connect(this, 'changed::storage-ignored-regex', this.updateDeviceList.bind(this));
        }
    }
    
    updateDeviceList() {
        const devices = Utils.getBlockDevicesSync();
        if(devices.size > 0)
            this.noDevicesLabel.hide();
        else
            this.noDevicesLabel.show();
        
        //filter ignored devices
        const ignoredDevices = Config.get_json('storage-ignored');
        if(ignoredDevices && Array.isArray(ignoredDevices) && ignoredDevices.length > 0) {
            for(const kname of ignoredDevices) {
                for(const [id, device] of devices.entries()) {
                    if(device.kname === kname) {
                        devices.delete(id);
                        break;
                    }
                }
            }
        }
        
        const ignoredRegex = Config.get_string('storage-ignored-regex');
        if(ignoredRegex) {
            try {
                const regex = new RegExp(`^${ignoredRegex}$`, 'i');
                for(const [id, device] of devices.entries()) {
                    if(regex.test(device.kname))
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
                
                this.devicesInfoPopup.get(id)?.close(true);
                this.devicesInfoPopup.get(id)?.destroy();
                this.devicesInfoPopup.delete(id);
                
                this.devicesTotalsPopup.get(id)?.close(true);
                this.devicesTotalsPopup.get(id)?.destroy();
                this.devicesTotalsPopup.delete(id);
            }
        }
        
        // add new devices / update existing devices
        const idList = Array.from(devices.keys());
        // set main storage device first
        const mainDisk = Config.get_string('storage-main');
        if(mainDisk) {
            const mainDiskIndex = idList.indexOf(mainDisk);
            if(mainDiskIndex > 0) {
                idList.splice(mainDiskIndex, 1);
                idList.unshift(mainDisk);
            }
        }
        
        for(const id of idList) {
            const deviceData = devices.get(id);
            
            let device;
            let infoPopup;
            let totalsPopup;
            
            if(!this.devices.has(id)) {
                device = this.createBlockDevice(id);
                this.deviceSection.addToGrid(device.container, 2);
                this.devices.set(id, device);
            }
            else {
                device = this.devices.get(id);
            }
            
            if(!device)
                continue;
            
            //Info Popup
            if(!this.devicesInfoPopup.has(id)) {
                infoPopup = this.createDeviceInfoPopup(device.container);
                this.devicesInfoPopup.set(id, infoPopup);
            }
            else {
                infoPopup = this.devicesInfoPopup.get(id);
            }
            if(!infoPopup)
                continue;
            
            //Totals Popup
            if(!this.devicesTotalsPopup.has(id)) {
                totalsPopup = this.createDeviceTotalsPopup(device.container);
                this.devicesTotalsPopup.set(id, totalsPopup);
            }
            else {
                totalsPopup = this.devicesTotalsPopup.get(id);
            }
            if(!totalsPopup)
                continue;
            
            //Update device info
            if(!deviceData)
                continue;
            try {
                this.updateBlockDevice(device, deviceData);
            }
            catch(e: any) {
                Utils.error(e);
            }
        }
    }
    
    createBlockDevice(id: string): BlockDeviceInfo {
        const container = new Grid({
            x_expand: true,
            styleClass: 'astra-monitor-menu-subgrid',
            style: 'padding-top:0.3em;margin-bottom:0.3em;'
        });
        
        const topInfoGrid = new Grid({styleClass: 'astra-monitor-menu-subgrid'});
        
        const topInfoButton = new St.Button({
            reactive: true,
            track_hover: true,
            style: ''
        });
        topInfoButton.set_child(topInfoGrid);
        
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
                style_class: 'astra-monitor-menu-key-mid'
            });
            headerGrid.addToGrid(name);
            
            topInfoGrid.addToGrid(headerGrid, 2);
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
                style_class: 'astra-monitor-menu-key-mid'
            });
            (barGrid.layout_manager as any).attach(sizeLabel, 0, 0, 1, 1);
            
            const bar = new StorageBars({
                numBars: 1,
                width: 160-2-4,
                height: 0.5,
                mini:false,
                layout: 'horizontal',
                x_align: Clutter.ActorAlign.START,
                style: 'margin-left:0;margin-bottom:0;margin-right:0;border:solid 1px #555;'
            });
            (barGrid.layout_manager as any).attach(bar, 1, 0, 1, 1);
            
            const barLabel = new St.Label({
                text: '0%',
                y_align: Clutter.ActorAlign.CENTER,
                style: 'width:2.7em;font-size:0.8em;text-align:right;margin-right:0.25em;margin-top:0.2em;'
            });
            (barGrid.layout_manager as any).attach(barLabel, 2, 0, 1, 1);
            
            topInfoGrid.addToGrid(barGrid, 2);
        //}
        
        container.addToGrid(topInfoButton, 2);
        
        topInfoButton.connect('enter-event', () => {
            topInfoButton.style = this.selectionStyle;
            
            const popup = this.devicesInfoPopup.get(id);
            if(popup?.empty === false)
                popup?.open(true);
        });
        
        topInfoButton.connect('leave-event', () => {
            topInfoButton.style = '';
            
            const popup = this.devicesInfoPopup.get(id);
            popup?.close(true);
        });
        
        // Read/Write Speed
        //{
            const rwButton = new St.Button({
                reactive: true,
                track_hover: true,
                x_expand: true,
                style: ''
            });
            
            const rwContainer = new St.Widget({
                layout_manager: new Clutter.GridLayout({orientation: Clutter.Orientation.HORIZONTAL}),
                x_expand: true,
                style: 'margin-left:0;margin-right:0;'
            });
            rwButton.set_child(rwContainer);
            
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
                style_class: 'astra-monitor-menu-key-mid'
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
                style_class: 'astra-monitor-menu-key-mid'
            });
            writeContainer.add_child(writeValueLabel);
            writeContainer.set_width(100);
            
            rwContainer.add_child(writeContainer);
            
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
    
    static get deviceInfoPopupConfiguration(): DeviceInfoPopupConfiguration {
        return [
            {
                title: _('Basic Info'),
                labels: 'labelsS1',
                values: 'valuesS1',
                sectionNr: 'section1',
                fields: [
                    { key: 'name', label: _('Name') },
                    { key: 'type', label: _('Type') },
                    { key: 'model', label: _('Model'), parent: true },
                    { key: 'vendor', label: _('Vendor'), parent: true },
                    { key: 'serial', label: _('Serial'), parent: true },
                    { key: 'size', label: _('Size'), formatAsBytes: true },
                    { key: 'state', label: _('State'), parent: true },
                    { key: 'subsystems', label: _('Subsystems') },
                ]
            },
            {
                title: _('File System and Mounting Info'),
                labels: 'labelsS2',
                values: 'valuesS2',
                sectionNr: 'section2',
                fields: [
                    { key: 'fstype', label: _('File System Type') },
                    { key: 'label', label: _('Label') },
                    { key: 'uuid', label: _('UUID') },
                    { key: 'mountpoints', label: _('Mount Points') },
                    { key: 'fsavail', label: _('Available Space'), formatAsBytes: true },
                    { key: 'fssize', label: _('File System Size'), formatAsBytes: true },
                    { key: 'fsused', label: _('Used Space'), formatAsBytes: true },
                    { key: 'fsuse%', label: _('Used Space (%)') },
                    { key: 'fsver', label: _('File System Version') },
                    { key: 'fsroots', label: _('File System Roots') },
                ]
            },
            {
                title: _('Physical and Disk Details'),
                labels: 'labelsS3',
                values: 'valuesS3',
                sectionNr: 'section3',
                fields: [
                    { key: 'phy-sec', label: _('Physical Sector Size'), formatAsBytes: true},
                    { key: 'log-sec', label: _('Logical Sector Size'), formatAsBytes: true},
                    { key: 'min-io', label: _('Minimum IO Size'), formatAsBytes: true},
                    { key: 'opt-io', label: _('Optimal IO Size'), formatAsBytes: true},
                    { key: 'rota', label: _('Rotational'), checkNull: true },
                    { key: 'rq-size', label: _('Request Size'), formatAsBytes: true},
                    { key: 'alignment', label: _('Alignment Offset'), formatAsBytes: true},
                    { key: 'disc-aln', label: _('Discard Alignment'), formatAsBytes: true},
                    { key: 'disc-gran', label: _('Discard Granularity'), formatAsBytes: true},
                    { key: 'disc-max', label: _('Discard Max Size'), formatAsBytes: true},
                    { key: 'disc-zero', label: _('Discard Zeroes Data'), checkNull: true },
                ]
            },
            {
                title: _('Partition Info'),
                labels: 'labelsS4',
                values: 'valuesS4',
                sectionNr: 'section4',
                fields: [
                    { key: 'parttype', label: _('Partition Type') },
                    { key: 'partlabel', label: _('Partition Label') },
                    { key: 'partuuid', label: _('Partition UUID') },
                    { key: 'partn', label: _('Partition Number') },
                    { key: 'pttype', label: _('Partition Table Type') },
                    { key: 'ptuuid', label: _('Partition Table UUID') },
                ]
            },
            {
                title: _('Performance and Settings'),
                labels: 'labelsS5',
                values: 'valuesS5',
                sectionNr: 'section5',
                fields: [
                    { key: 'ra', label: _('Read Ahead'), formatAsBytes: true },
                    { key: 'sched', label: _('Scheduler') },
                    { key: 'dax', label: _('Direct Access'), checkNull: true },
                    { key: 'mq', label: _('Multiqueue'), checkNull: true },
                ]
            },
            {
                title: _('Advanced Identifiers and States'),
                labels: 'labelsS6',
                values: 'valuesS6',
                sectionNr: 'section6',
                fields: [
                    { key: 'id-link', label: _('ID Link') },
                    { key: 'id', label: _('ID') },
                    { key: 'maj:min', label: _('Major:Minor') },
                    { key: 'hctl', label: _('HCTL') },
                    { key: 'kname', label: _('Kernel Name') },
                    { key: 'path', label: _('Path') },
                    { key: 'rev', label: _('Revision') },
                    { key: 'wwn', label: _('World Wide Name') },
                    { key: 'tran', label: _('Transport') },
                    { key: 'hotplug', label: _('Hotplug'), checkNull: true },
                    { key: 'rand', label: _('Random'), checkNull: true },
                    { key: 'group', label: _('Group') },
                    { key: 'owner', label: _('Owner') },
                    { key: 'mode', label: _('Mode') },
                    { key: 'ro', label: _('Read Only'), checkNull: true },
                    { key: 'rm', label: _('Removable'), checkNull: true },
                    { key: 'wsame', label: _('Write Same'), checkNull: true },
                    { key: 'zoned', label: _('Zoned'), checkNull: true },
                    { key: 'zone-sz', label: _('Zone Size'), formatAsBytes: true },
                    { key: 'zone-wgran', label: _('Zone Write Granularity'), formatAsBytes: true },
                    { key: 'zone-app', label: _('Zone Append'), checkNull: true },
                    { key: 'zone-nr', label: _('Zone Number') },
                    { key: 'zone-omax', label: _('Zone Open Max') },
                    { key: 'zone-amax', label: _('Zone Active Max') },
                ]
            }
        ];
    }
    
    createDeviceInfoPopup(sourceActor: St.Widget): DeviceInfoPopup {
        const popup:DeviceInfoPopup = new MenuBase(sourceActor, 0.05, { numCols: 4 }) as DeviceInfoPopup;
        popup.empty = true;
        
        const configuration = StorageMenu.deviceInfoPopupConfiguration;
        
        for(const section of configuration) {
            popup[section.sectionNr] = popup.addMenuSection(section.title);
            popup[section.labels] = [];
            popup[section.values] = [];
            
            for(let i = 0; i < section.fields.length; i++) {
                const label = new St.Label({text: '', style_class: 'astra-monitor-menu-sub-key'});
                popup.addToMenu(label);
                popup[section.labels].push(label);
                
                const value = new St.Label({text: '', style_class: 'astra-monitor-menu-sub-value'});
                popup.addToMenu(value);
                popup[section.values].push(value);
            }
        }
        return popup;
    }
    
    createDeviceTotalsPopup(sourceActor: St.Widget): DeviceTotalsPopup {
        const popup:DeviceTotalsPopup = new MenuBase(sourceActor, 0.05, { numCols: 2}) as DeviceTotalsPopup;
        
        //Totals
        popup.addMenuSection(_('Total Device Activity'));
        
        //Read
        popup.addToMenu(new St.Label({
            text: _('Read'),
            style_class: 'astra-monitor-menu-sub-key'
        }));
        
        const totalReadValueLabel = new St.Label({text: '', style: 'text-align:left;'});
        popup.addToMenu(totalReadValueLabel);
        popup.totalReadValueLabel = totalReadValueLabel;
        
        //Write
        popup.addToMenu(new St.Label({
            text: _('Write'),
            style_class: 'astra-monitor-menu-sub-key'
        }));
        
        const totalWriteValueLabel = new St.Label({text: '', style: 'text-align:left;'});
        popup.addToMenu(totalWriteValueLabel);
        popup.totalWriteValueLabel = totalWriteValueLabel;
        
        return popup;
    }
    
    updateBlockDevice(device: BlockDeviceInfo, deviceData: BlockDevice) {
        device.data = deviceData;
        
        const icon = {
            gicon: Utils.getLocalIcon('am-harddisk-symbolic'),
            fallback_icon_name: 'drive-harddisk-symbolic'
        };
        
        if(deviceData.removable) {
            icon.gicon = Utils.getLocalIcon('am-media-removable-symbolic');
            icon.fallback_icon_name = 'media-removable-symbolic';
        }
        else if((deviceData.filesystem && deviceData.filesystem.startsWith('swap')) ||
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
        
        let name = deviceData.name;
        if(name && name.length > 17)
            name = name.substring(0, 15) + '…';
        device.name.text = name ? `[${name}]` : '';
        
        if(!Number.isNaN(deviceData.usage) && deviceData.usage !== undefined) {
            device.barGrid.visible = true;
            device.barLabel.text = `${deviceData.usage}%`;
            device.bar.setUsage({size: deviceData.size, usePercentage: deviceData.usage});
        }
        else {
            device.barGrid.visible = false;
        }
        
        const size = deviceData.size;
        if(size)
            device.sizeLabel.text = Utils.formatBytes(size, 'kB-KB', 3);
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
                const button = new St.Button({style_class: 'button'});
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
                const button = new St.Button({style_class: 'button'});
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
    
    async onOpen() {
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
                    Utils.storageMonitor.requestUpdate('storageInfo');
                    return true;
                });
        }
        
        Utils.storageMonitor.listen(this, 'storageInfo', this.update.bind(this, 'storageInfo'));
        Utils.storageMonitor.requestUpdate('storageInfo');
    }
    
    async onClose() {
        Utils.storageMonitor.unlisten(this, 'storageIO');
        Utils.storageMonitor.unlisten(this, 'detailedStorageIO');
        Utils.storageMonitor.unlisten(this, 'topProcesses');
        Utils.storageMonitor.unlisten(this, 'storageInfo');
        
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
        if(code === 'storageIO') {
            const usage = Utils.storageMonitor.getUsageHistory('storageIO');
            this.graph.setUsageHistory(usage);
            
            const current = Utils.storageMonitor.getCurrentValue('storageIO');
            if(current) {
                const unit = Config.get_string('storage-io-unit');
                
                if(current.bytesReadPerSec)
                    this.totalReadSpeedValueLabel.text = Utils.formatBytesPerSec(current.bytesReadPerSec, unit as any, 3);
                else
                    this.totalReadSpeedValueLabel.text = '-';
                
                if(current.bytesWrittenPerSec)
                    this.totalWriteSpeedValueLabel.text = Utils.formatBytesPerSec(current.bytesWrittenPerSec, unit as any, 3);
                else
                    this.totalWriteSpeedValueLabel.text = '-';
                
                if(this.storageActivityPopup) {
                    if(this.storageActivityPopup.totalReadValueLabel) {
                        if(current.totalBytesRead)
                            this.storageActivityPopup.totalReadValueLabel.text = Utils.formatBytes(current.totalBytesRead, 'kB-KB', 3);
                        else
                            this.storageActivityPopup.totalReadValueLabel.text = '-';
                    }
                    if(this.storageActivityPopup.totalWriteValueLabel) {
                        if(current.totalBytesWritten)
                            this.storageActivityPopup.totalWriteValueLabel.text = Utils.formatBytes(current.totalBytesWritten, 'kB-KB', 3);
                        else
                            this.storageActivityPopup.totalWriteValueLabel.text = '-';
                    }
                }
            }
            else {
                this.totalReadSpeedValueLabel.text = '-';
                this.totalWriteSpeedValueLabel.text = '-';
                
                if(this.storageActivityPopup) {
                    if(this.storageActivityPopup.totalReadValueLabel)
                        this.storageActivityPopup.totalReadValueLabel.text = '-';
                    if(this.storageActivityPopup.totalWriteValueLabel)
                        this.storageActivityPopup.totalWriteValueLabel.text = '-';
                }
            }
            return;
        }
        if(code === 'detailedStorageIO') {
            const current = Utils.storageMonitor.getCurrentValue('detailedStorageIO');
            
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
                                device.readValueLabel.text = Utils.formatBytesPerSec(data.bytesReadPerSec, unit as any, 3);
                                const readColor = Config.get_string('storage-menu-arrow-color1') ?? 'rgba(29,172,214,1.0)';
                                device.readActivityIcon.style = `color:${readColor};`;
                            }
                            else {
                                device.readValueLabel.text = '-';
                                device.readActivityIcon.style = 'color:rgba(255,255,255,0.5);';
                            }
                            
                            if(data.bytesWrittenPerSec) {
                                device.writeValueLabel.text = Utils.formatBytesPerSec(data.bytesWrittenPerSec, unit as any, 3);
                                const writeColor = Config.get_string('storage-menu-arrow-color2') ?? 'rgba(214,29,29,1.0)';
                                device.writeActivityIcon.style = `color:${writeColor};`;
                            }
                            else {
                                device.writeValueLabel.text = '-';
                                device.writeActivityIcon.style = 'color:rgba(255,255,255,0.5);';
                            }
                            
                            const totalsPopup = this.devicesTotalsPopup.get(id);
                            if(totalsPopup) {
                                if(totalsPopup.totalReadValueLabel) {
                                    if(data.totalBytesRead)
                                        totalsPopup.totalReadValueLabel.text = Utils.formatBytes(data.totalBytesRead, 'kB-KB', 3);
                                    else
                                        totalsPopup.totalReadValueLabel.text = '-';
                                }
                                if(totalsPopup.totalWriteValueLabel) {
                                    if(data.totalBytesWritten)
                                        totalsPopup.totalWriteValueLabel.text = Utils.formatBytes(data.totalBytesWritten, 'kB-KB', 3);
                                    else
                                        totalsPopup.totalWriteValueLabel.text = '-';
                                }
                            }
                        }
                    }
                    else {
                        device.readValueLabel.text = '-';
                        device.readActivityIcon.style = 'color:rgba(255,255,255,0.5);';
                        device.writeValueLabel.text = '-';
                        device.writeActivityIcon.style = 'color:rgba(255,255,255,0.5);';
                        
                        const totalsPopup = this.devicesTotalsPopup.get(id);
                        if(totalsPopup) {
                            if(totalsPopup.totalReadValueLabel)
                                totalsPopup.totalReadValueLabel.text = '-';
                            if(totalsPopup.totalWriteValueLabel)
                                totalsPopup.totalWriteValueLabel.text = '-';
                        }
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
                    
                    if(this.topProcessesPopup && this.topProcessesPopup.processes) {
                        const popupElement = this.topProcessesPopup.processes.get(i);
                        if(popupElement) {
                            popupElement.label.hide();
                            popupElement.description?.hide();
                            popupElement.read.container.hide();
                            popupElement.write.container.hide();
                        }
                    }
                }
                else {
                    const unit = Config.get_string('storage-io-unit');
                    
                    const topProcess = topProcesses[i];
                    const process = topProcess.process;
                    const read = topProcess.read;
                    const write = topProcess.write;
                    
                    if(i < 5) {
                        this.topProcesses.labels[i].label.text = process.exec;
                        
                        if(read > 0) {
                            const readColor = Config.get_string('storage-menu-arrow-color1') ?? 'rgba(29,172,214,1.0)';
                            this.topProcesses.labels[i].read.icon.style = `color:${readColor};`;
                            this.topProcesses.labels[i].read.value.text = Utils.formatBytesPerSec(read, unit as any, 3);
                        }
                        else {
                            this.topProcesses.labels[i].read.icon.style = 'color:rgba(255,255,255,0.5);';
                            this.topProcesses.labels[i].read.value.text = '-';
                        }
                        
                        if(write > 0) {
                            const writeColor = Config.get_string('storage-menu-arrow-color2') ?? 'rgba(214,29,29,1.0)';
                            this.topProcesses.labels[i].write.icon.style = `color:${writeColor};`;
                            this.topProcesses.labels[i].write.value.text = Utils.formatBytesPerSec(write, unit as any, 3);
                        }
                        else {
                            this.topProcesses.labels[i].write.icon.style = 'color:rgba(255,255,255,0.5);';
                            this.topProcesses.labels[i].write.value.text = '-';
                        }
                    }
                    
                    if(this.topProcessesPopup && this.topProcessesPopup.processes) {
                        const popupElement = this.topProcessesPopup.processes.get(i);
                        if(popupElement) {
                            popupElement.label.show();
                            popupElement.label.text = process.exec;
                            
                            if(popupElement.description) {
                                popupElement.description.show();
                                popupElement.description.text = process.cmd;
                            }
                            
                            popupElement.read.container.show();
                            if(read > 0) {
                                popupElement.read.icon.style = 'color:rgb(29,172,214);';
                                popupElement.read.value.text = Utils.formatBytesPerSec(read, unit as any, 3);
                            }
                            else {
                                popupElement.read.icon.style = 'color:rgba(255,255,255,0.5);';
                                popupElement.read.value.text = '-';
                            }
                            
                            popupElement.write.container.show();
                            if(write > 0) {
                                popupElement.write.icon.style = 'color:rgb(214,29,29);';
                                popupElement.write.value.text = Utils.formatBytesPerSec(write, unit as any, 3);
                            }
                            else {
                                popupElement.write.icon.style = 'color:rgba(255,255,255,0.5);';
                                popupElement.write.value.text = '-';
                            }
                        }
                    }
                }   
            }
            return;
        }
        if(code === 'storageInfo') {
            const storageInfo:Map<string, BlockDeviceData> = Utils.storageMonitor.getCurrentValue('storageInfo');
            
            const formatValue = (value: any, isBytes: boolean = false) => {
                if(Array.isArray(value))
                    return value.join('\n');
                if(isBytes && typeof value === 'number')
                    return Utils.formatBytes(value, 'kB-KB', 4);
                if(typeof value === 'boolean')
                    return value ? _('Yes') : _('No');
                let str = value?.toString().trim() ?? '';
                if(str.length > 100)
                    str = str.substring(0, 97) + '…';
                if(str.length > 50)
                    str = str.substring(0, str.length/2) + ' ⏎\n' + str.substring(str.length/2);
                return str;
            };
            
            const configuration = StorageMenu.deviceInfoPopupConfiguration;
            
            for(const [id, popup] of this.devicesInfoPopup.entries()) {
                const info = storageInfo.get(id);
                
                if(!info) {
                    popup.empty = true;
                    popup.close(true);
                    continue;
                }
                popup.empty = false;
                
                for(const section of configuration) {
                    let i = 0;
                    const labels = popup[section.labels];
                    const values = popup[section.values];
                    
                    for(const field of section.fields) {
                        let value;
                        if(info[field.key])
                            value = info[field.key];
                        else if(field.parent && info.parent && info.parent[field.key])
                            value = info.parent[field.key];
                        
                        if(field.checkNull ? value !== undefined && value !== null : value) {
                            const formattedValue = formatValue(value, field.formatAsBytes);
                            labels[i].text = field.label;
                            labels[i].show();
                            values[i].text = formattedValue;
                            values[i].show();
                            i++;
                        }
                    }
                    
                    if(i === 0)
                        popup[section.sectionNr].hide();
                    else
                        popup[section.sectionNr].show();
                    
                    for(; i < labels.length; i++) {
                        labels[i].hide();
                        values[i].hide();
                    }
                }
            }
            return;
        }
    }
    
    clear() {
        this.totalReadSpeedValueLabel.text = '-';
        this.totalWriteSpeedValueLabel.text = '-';
        
        for(const [_id, device] of this.devices.entries()) {
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
}
