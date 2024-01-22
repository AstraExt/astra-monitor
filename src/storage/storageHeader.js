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

import GObject from 'gi://GObject';
import Gio from 'gi://Gio';
import St from 'gi://St';
import Clutter from 'gi://Clutter';

import * as PopupMenu from 'resource:///org/gnome/shell/ui/popupMenu.js';
import * as Main from 'resource:///org/gnome/shell/ui/main.js';

import { Header } from '../header.js';
import Config from '../config.js';
import Utils from '../utils/utils.js';
import {StorageMenu} from './storageMenu.js';
import {StorageGraph} from './storageGraph.js';
import {StorageBars} from './storageBars.js';
import { StorageIOBars } from './storageIOBars.js';

export const StorageHeader = GObject.registerClass({
    Properties: {
        
    },
}, class StorageHeaderBase extends Header {
    constructor() {
        super('Storage Header');
        
        this.buildIcon();
        this.buildBars();
        this.buildPercentage();
        this.buildIOBars();
        this.buildGraph();
        this.buildSpeed();
        
        const menu = new StorageMenu(this, 0.5, St.Side.TOP);
        this.setMenu(menu);
        
        this.resetMaxWidths();
        
        Config.bind('storage-header-show', this, 'visible', Gio.SettingsBindFlags.GET);
        
        Config.connect(this, 'changed::visible', this.resetMaxWidths.bind(this));
        Config.connect(this, 'changed::storage-header-io', this.resetMaxWidths.bind(this));
        Config.connect(this, 'changed::headers-font-family', this.resetMaxWidths.bind(this));
        Config.connect(this, 'changed::headers-font-size', this.resetMaxWidths.bind(this));
    }
    
    resetMaxWidths() {
        this.maxWidths = [];
        
        if(!Config.get_boolean('storage-header-io'))
            return;
        
        if(!this.read.get_stage() || !this.write.get_stage())
            return;
        
        const readWidth = this.read.get_preferred_width(-1);
        const writeWidth = this.write.get_preferred_width(-1);
        this.fixSpeedContainerWidth(Math.max(readWidth?readWidth[1]:0, writeWidth?writeWidth[1]:0));
    }
    
    buildIcon() {
        let iconSize = Config.get_int('storage-header-icon-size');
        iconSize = Math.max(8, Math.min(30, iconSize));
        this.icon = new St.Icon({
            gicon: Utils.getLocalIcon('am-harddisk-symbolic'),
            fallback_icon_name: 'drive-harddisk-symbolic',
            style: 'margin-left:2px;margin-right:4px;',
            icon_size: iconSize,
            y_expand: false,
            y_align: Clutter.ActorAlign.CENTER,
            x_align: Clutter.ActorAlign.CENTER,
        });
        this.insert_child_at_index(this.icon, 0);
        Config.bind('storage-header-icon', this.icon, 'visible', Gio.SettingsBindFlags.GET);
        Config.bind('storage-header-icon-size', this.icon, 'icon_size', Gio.SettingsBindFlags.GET);
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
            x_align: Clutter.ActorAlign.CENTER,
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
    
    buildIOBars() {
        if(this.ioBars) {
            this.remove_child(this.ioBars);
            Config.clear(this.ioBars);
            Utils.storageMonitor.unlisten(this.ioBars);
            this.ioBars.destroy();
            this.ioBars = null;
        }
        
        // @ts-ignore
        this.ioBars = new StorageIOBars({ numBars: 2, mini: true, width: 0.5 });
        this.insert_child_at_index(this.ioBars, 3);
        Config.bind('storage-header-io-bars', this.ioBars, 'visible', Gio.SettingsBindFlags.GET);
        
        Utils.storageMonitor.listen(this.ioBars, 'storageIO', () => {
            if(!Config.get_boolean('storage-header-io-bars'))
                return;
            let usage = Utils.storageMonitor.getUsageHistory('storageIO');
            this.ioBars.setUsage(usage);
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
        
        let graphWidth = Config.get_int('storage-header-graph-width');
        graphWidth = Math.max(10, Math.min(500, graphWidth));
        
        this.graph = new StorageGraph({ width: graphWidth, mini: true });
        this.insert_child_at_index(this.graph, 4);
        Config.bind('storage-header-graph', this.graph, 'visible', Gio.SettingsBindFlags.GET);
        
        Config.connect(this.graph, 'changed::storage-header-graph-width', () => {
            let graphWidth = Config.get_int('storage-header-graph-width');
            graphWidth = Math.max(10, Math.min(500, graphWidth));
            this.graph.setWidth(graphWidth);
        });
        
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
            x_align: Clutter.ActorAlign.START,
            y_align: Clutter.ActorAlign.CENTER,
            y_expand: true,
            vertical: true,
            width: 1
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
        
        this.insert_child_at_index(this.speedContainer, 5);
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
                let bytesReadPerSec = usage.bytesReadPerSec;
                let bytesWrittenPerSec = usage.bytesWrittenPerSec;
                
                const threshold = Config.get_int('storage-header-io-threshold');
                
                if(bytesReadPerSec < threshold*1000)
                    bytesReadPerSec = 0;
                
                if(bytesWrittenPerSec < threshold*1000)
                    bytesWrittenPerSec = 0;
                
                const unit = Config.get_string('storage-io-unit');
                let maxFigures = Config.get_int('storage-header-io-figures');
                maxFigures = Math.max(1, Math.min(4, maxFigures));
                this.read.text = Utils.formatBytesPerSec(bytesReadPerSec, unit, maxFigures);
                this.write.text = Utils.formatBytesPerSec(bytesWrittenPerSec, unit, maxFigures);
                
                const readWidth = this.read.get_preferred_width(-1);
                const writeWidth = this.write.get_preferred_width(-1);
                this.fixSpeedContainerWidth(Math.max(readWidth?readWidth[1]:0, writeWidth?writeWidth[1]:0));
            }
        });
    }
    
    fixSpeedContainerWidth(width) {
        this.maxWidths.push(width);
        
        if(this.maxWidths.length > Utils.storageMonitor.updateFrequency * 30)
            this.maxWidths.shift();
        
        let max = Math.max(...this.maxWidths);
        if(max === this.speedContainer.width)
            return;
        if(max <= 0)
            max = 1;
        this.speedContainer.set_width(max);
    }
    
    update() {
        
    }
    
    createTooltip() {
        this.tooltipMenu = new PopupMenu.PopupMenu(this, 0.5, St.Side.TOP);
        
        Main.uiGroup.add_actor(this.tooltipMenu.actor);
        this.tooltipMenu.actor.add_style_class_name('astra-monitor-tooltip-menu');
        this.tooltipMenu.actor.x_expand = true;
        this.tooltipMenu.actor.hide();
        
        this.tooltipItem = new PopupMenu.PopupMenuItem('', {
            reactive: true,
            style_class: 'astra-monitor-tooltip-item'
        });
        this.tooltipItem.actor.x_expand = true;
        this.tooltipItem.actor.x_align = Clutter.ActorAlign.CENTER;
        this.tooltipItem.sensitive = true;
        this.tooltipMenu.addMenuItem(this.tooltipItem);
        
        Config.connect(this.tooltipMenu, 'changed::storage-header-tooltip', () => {
            if(!Config.get_boolean('storage-header-tooltip'))
                this.tooltipMenu.close();
        });
        
        Utils.storageMonitor.listen(this.tooltipMenu, 'storageUsage', () => {
            if(!Config.get_boolean('storage-header-tooltip'))
                return;
            
            const usage = Utils.storageMonitor.getCurrentValue('storageUsage');
            if(!usage || !usage.usePercentage || isNaN(usage.usePercentage))
                this.tooltipItem.label.text = '';
            else
                this.tooltipItem.label.text = `${Math.round(usage.usePercentage)}%`;
            
            const width = this.tooltipItem.get_preferred_width(-1)[1] + 30;
            this.tooltipMenu.actor.set_width(width);
        });
    }
    
    showTooltip() {
        if(!this.tooltipMenu)
            return;
        if(!Config.get_boolean('storage-header-tooltip'))
            return;
        
        this.tooltipMenu.open();
    }
    
    hideTooltip() {
        if(!this.tooltipMenu)
            return;
        if(!Config.get_boolean('storage-header-tooltip'))
            return;
        this.tooltipMenu.close();
    }
    
    destroy() {
        Config.clear(this);
        Utils.storageMonitor.unlisten(this);
        
        Config.clear(this.icon);
        
        if(this.percentage) {
            Config.clear(this.percentage);
            Utils.storageMonitor.unlisten(this.percentage);
        }
        if(this.bars) {
            Config.clear(this.bars);
            Utils.storageMonitor.unlisten(this.bars);
        }
        if(this.ioBars) {
            Config.clear(this.ioBars);
            Utils.storageMonitor.unlisten(this.ioBars);
        }
        if(this.graph) {
            Config.clear(this.graph);
            Utils.storageMonitor.unlisten(this.graph);
        }
        if(this.speedContainer) {
            Config.clear(this.speedContainer);
            Utils.storageMonitor.unlisten(this.speedContainer);
        }
        if(this.tooltipMenu) {
            Config.clear(this.tooltipMenu);
            Utils.storageMonitor.unlisten(this.tooltipMenu);
            this.tooltipMenu.close();
        }

        super.destroy();
    }
});
    