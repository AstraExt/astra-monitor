/*
 * Copyright (C) 2023 Lju
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

import GObject from 'gi://GObject';
import Gio from 'gi://Gio';
import St from 'gi://St';
import Clutter from 'gi://Clutter';

import { Header } from '../header.js';
import Config from '../config.js';
import Utils from '../utils/utils.js';
import {StorageMenu} from './storageMenu.js';
import {StorageGraph} from './storageGraph.js';
import {StorageBars} from './storageBars.js';

export const StorageHeader = GObject.registerClass({
    Properties: {
        
    },
}, class StorageHeaderBase extends Header {
    constructor() {
        super('Storage Header');
        
        this.buildIcon();
        this.buildGraph();
        this.buildSpeed();
        this.buildBars();
        this.buildPercentage();
        
        const menu = new StorageMenu(this, 0.5, St.Side.TOP);
        this.setMenu(menu);
        
        Config.bind('storage-header-show', this, 'visible', Gio.SettingsBindFlags.GET);
    }
    
    buildIcon() {
        //TODO: icon should be a setting
        this.icon = new St.Icon({
            gicon: Utils.getLocalIcon('harddisk-symbolic'),
            fallback_icon_name: 'drive-harddisk-symbolic',
            style_class: 'system-status-icon astra-monitor-header-icon',
        });
        this.insert_child_at_index(this.icon, 0);
        Config.bind('storage-header-icon', this.icon, 'visible', Gio.SettingsBindFlags.GET);
    }
    
    buildBars() {
        if(this.bars) {
            this.remove_child(this.bars);
            Config.clear(this.bars);
            Utils.storageMonitor.unlisten(this.bars);
            this.bars.destroy();
            this.bars = null;
        }
        
        // @ts-ignore
        this.bars = new StorageBars({ numBars: 1, mini: true, width: 0.5 });
        this.insert_child_at_index(this.bars, 1);
        Config.bind('storage-header-bars', this.bars, 'visible', Gio.SettingsBindFlags.GET);
        
        Utils.storageMonitor.listen(this.bars, 'storageUsage', () => {
            if(!Config.get_boolean('storage-header-bars'))
                return;
            
            const usage = Utils.storageMonitor.getCurrentValue('storageUsage');
            this.bars.setUsage(usage);
        });
    }
    
    buildPercentage() {
        this.percentage = new St.Label({
            text: '-%',
            style_class: 'astra-monitor-header-percentage3',
            y_align: Clutter.ActorAlign.CENTER,
        });
        this.insert_child_at_index(this.percentage, 2);
        Config.bind('storage-header-percentage', this.percentage, 'visible', Gio.SettingsBindFlags.GET);
        
        Utils.storageMonitor.listen(this.percentage, 'storageUsage', () => {
            if(!Config.get_boolean('storage-header-percentage'))
                return;
            
            const usage = Utils.storageMonitor.getCurrentValue('storageUsage');
            if(!usage || !usage.usePercentage || isNaN(usage.usePercentage))
                this.percentage.text = '';
            else
                this.percentage.text = `${Math.round(usage.usePercentage)}%`;
        });
    }
    
    buildGraph() {
        if(this.graph) {
            this.remove_child(this.graph);
            Config.clear(this.graph);
            Utils.storageMonitor.unlisten(this.graph);
            this.graph.destroy();
            this.graph = null;
        }
        
        // @ts-ignore
        this.graph = new StorageGraph({ width: 30, mini: true });
        this.insert_child_at_index(this.graph, 3);
        Config.bind('storage-header-graph', this.graph, 'visible', Gio.SettingsBindFlags.GET);
        
        Utils.storageMonitor.listen(this.graph, 'storageIO', () => {
            if(!Config.get_boolean('storage-header-graph'))
                return;
            
            let usage = Utils.storageMonitor.getUsageHistory('storageIO');
            this.graph.setUsageHistory(usage);
        });
    }
    
    buildSpeed() {
        this.speedContainer = new St.BoxLayout({
            style_class: 'astra-monitor-header-speed-container',
            x_align: Clutter.ActorAlign.CENTER,
            x_expand: true,
            y_align: Clutter.ActorAlign.CENTER,
            y_expand: true,
            vertical: true,
        });
        
        this.read = new St.Label({
            text: '- B/s',
            style_class: 'astra-monitor-header-speed-label',
            y_align: Clutter.ActorAlign.START,
            x_align: Clutter.ActorAlign.END,
            x_expand: true,
        });
        
        this.write = new St.Label({
            text: '- B/s',
            style_class: 'astra-monitor-header-speed-label',
            y_align: Clutter.ActorAlign.END,
            x_align: Clutter.ActorAlign.END,
            x_expand: true,
        });
        
        this.speedContainer.add_child(this.read);
        this.speedContainer.add_child(this.write);
        
        this.insert_child_at_index(this.speedContainer, 4);
        Config.bind('storage-header-io', this.speedContainer, 'visible', Gio.SettingsBindFlags.GET);
        
        Utils.storageMonitor.listen(this.speedContainer, 'storageIO', () => {
            if(!Config.get_boolean('storage-header-io'))
                return;
            
            const usage = Utils.storageMonitor.getCurrentValue('storageIO');
            if(!usage) {
                this.read.text = '- B/s';
                this.write.text = '- B/s';
            }
            else {
                this.read.text = Utils.formatBytesPerSec(usage.bytesReadPerSec);
                this.write.text = Utils.formatBytesPerSec(usage.bytesWrittenPerSec);
            }
        });
    }
    
    update() {
        
    }
    
    destroy() {
        Config.clear(this);
        Config.clear(this.icon);
        Config.clear(this.bars);
        Config.clear(this.graph);
        Config.clear(this.speedContainer);
        Config.clear(this.percentage);
        
        Utils.processorMonitor.unlisten(this);
        
        if(this.bars)
            Utils.processorMonitor.unlisten(this.bars);
        if(this.graph)
            Utils.processorMonitor.unlisten(this.graph);
        if(this.percentage)
            Utils.processorMonitor.unlisten(this.percentage);
        if(this.speedContainer)
            Utils.processorMonitor.unlisten(this.speedContainer);

        super.destroy();
    }
});
    