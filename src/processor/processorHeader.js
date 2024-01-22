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
import {ProcessorMenu} from './processorMenu.js';
import {ProcessorGraph} from './processorGraph.js';
import {ProcessorBars} from './processorBars.js';

export const ProcessorHeader = GObject.registerClass({
    Properties: {
        
    },
}, class ProcessorHeaderBase extends Header {
    constructor() {
        super('Processor Header');
        
        this.buildIcon();
        this.buildGraph();
        this.buildBars();
        this.buildPercentage();
        
        Config.connect(this, 'changed::processor-header-bars-core', () => {
            this.buildBars();
        });
        
        const menu = new ProcessorMenu(this, 0.5, St.Side.TOP);
        this.setMenu(menu);
        
        Config.bind('processor-header-show', this, 'visible', Gio.SettingsBindFlags.GET);
    }
    
    buildIcon() {
        let iconSize = Config.get_int('storage-header-icon-size');
        iconSize = Math.max(8, Math.min(30, iconSize));
        this.icon = new St.Icon({
            gicon: Utils.getLocalIcon('am-cpu-symbolic'),
            fallback_icon_name: 'cpu-symbolic',
            style: 'margin-left:2px;margin-right:4px;',
            icon_size: iconSize,
            y_expand: false,
            y_align: Clutter.ActorAlign.CENTER,
            x_align: Clutter.ActorAlign.CENTER,
        });
        this.insert_child_at_index(this.icon, 0);
        Config.bind('processor-header-icon', this.icon, 'visible', Gio.SettingsBindFlags.GET);
        Config.bind('processor-header-icon-size', this.icon, 'icon_size', Gio.SettingsBindFlags.GET);
    }
    
    buildBars() {
        if(this.bars) {
            this.remove_child(this.bars);
            Config.clear(this.bars);
            Utils.processorMonitor.unlisten(this.bars);
            this.bars.destroy();
            this.bars = null;
        }
        
        let numBars = 1;
        const perCoreBars = Config.get_boolean('processor-header-bars-core');
        if(perCoreBars)
            numBars = Utils.processorMonitor.getNumberOfCores();
        
        this.bars = new ProcessorBars({
            numBars: numBars,
            mini: true,
            width: 0.5,
            breakdownConfig: 'processor-header-bars-breakdown'
        });
        this.insert_child_at_index(this.bars, 1);
        Config.bind('processor-header-bars', this.bars, 'visible', Gio.SettingsBindFlags.GET);
        
        if(perCoreBars) {
            Utils.processorMonitor.listen(this.bars, 'cpuCoresUsage', () => {
                if(!Config.get_boolean('processor-header-bars'))
                    return;
                
                const usage = Utils.processorMonitor.getCurrentValue('cpuCoresUsage');
                const cores = Utils.processorMonitor.getNumberOfCores();
                if(!usage || !Array.isArray(usage) || usage.length < cores)
                    this.bars.setUsage([]);
                else
                    this.bars.setUsage(usage);
            });
        }
        else {
            Utils.processorMonitor.listen(this.bars, 'cpuUsage', () => {
                if(!Config.get_boolean('processor-header-bars'))
                    return;
                
                const usage = Utils.processorMonitor.getCurrentValue('cpuUsage');
                if(!usage || !usage.total || isNaN(usage.total))
                    this.bars.setUsage([]);
                else
                    this.bars.setUsage([usage]);
            });
        }
    }
    
    buildGraph() {
        if(this.graph) {
            this.remove_child(this.graph);
            Config.clear(this.graph);
            Utils.processorMonitor.unlisten(this.graph);
            this.graph.destroy();
            this.graph = null;
        }
        
        let graphWidth = Config.get_int('processor-header-graph-width');
        graphWidth = Math.max(10, Math.min(500, graphWidth));
        
        this.graph = new ProcessorGraph({ width: graphWidth, mini: true, breakdownConfig: 'processor-header-graph-breakdown'});
        this.insert_child_at_index(this.graph, 2);
        Config.bind('processor-header-graph', this.graph, 'visible', Gio.SettingsBindFlags.GET);
        
        Config.connect(this.graph, 'changed::processor-header-graph-width', () => {
            let graphWidth = Config.get_int('processor-header-graph-width');
            graphWidth = Math.max(10, Math.min(500, graphWidth));
            this.graph.setWidth(graphWidth);
        });
        
        Utils.processorMonitor.listen(this.graph, 'cpuUsage', () => {
            if(!Config.get_boolean('processor-header-graph'))
                return;
            let usage = Utils.processorMonitor.getUsageHistory('cpuUsage');
            this.graph.setUsageHistory(usage);
        });
    }
    
    buildPercentage() {
        const useFourDigitStyle = Config.get_boolean('processor-header-percentage-core');
        this.percentage = new St.Label({
            text: '-%',
            style_class: useFourDigitStyle ? 'astra-monitor-header-percentage4' : 'astra-monitor-header-percentage3',
            y_align: Clutter.ActorAlign.CENTER,
        });
        this.insert_child_at_index(this.percentage, 3);
        Config.bind('processor-header-percentage', this.percentage, 'visible', Gio.SettingsBindFlags.GET);

        Config.connect(this.percentage, 'changed::processor-header-percentage-core', () => {
            const useFourDigitStyle = Config.get_boolean('processor-header-percentage-core');
            this.percentage.style_class = useFourDigitStyle ? 'astra-monitor-header-percentage4' : 'astra-monitor-header-percentage3';
        });
        
        Utils.processorMonitor.listen(this.percentage, 'cpuUsage', () => {
            if(!Config.get_boolean('processor-header-percentage'))
                return;
            
            const cpuUsage = Utils.processorMonitor.getCurrentValue('cpuUsage');
            
            if(!cpuUsage || !cpuUsage.total || isNaN(cpuUsage.total)) {
                this.percentage.text = '0%';
                return;
            }
            
            if(Config.get_boolean('processor-header-percentage-core')) {
                const numberOfCores = Utils.processorMonitor.getNumberOfCores();
                this.percentage.text = (cpuUsage.total * numberOfCores).toFixed(0) + '%';
            }
            else {
                this.percentage.text = cpuUsage.total.toFixed(0) + '%';
            }
        });
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
        
        Config.connect(this.tooltipMenu, 'changed::processor-header-tooltip', () => {
            if(!Config.get_boolean('processor-header-tooltip'))
                this.tooltipMenu.close();
        });
        
        Utils.processorMonitor.listen(this.tooltipMenu, 'cpuUsage', () => {
            if(!Config.get_boolean('processor-header-tooltip'))
                return;
            
            const cpuUsage = Utils.processorMonitor.getCurrentValue('cpuUsage');
            
            if(!cpuUsage || !cpuUsage.total || isNaN(cpuUsage.total)) {
                this.tooltipItem.label.text = '0%';
                return;
            }
            
            if(Config.get_boolean('processor-header-percentage-core')) {
                const numberOfCores = Utils.processorMonitor.getNumberOfCores();
                this.tooltipItem.label.text = (cpuUsage.total * numberOfCores).toFixed(0) + '%';
            }
            else {
                this.tooltipItem.label.text = cpuUsage.total.toFixed(0) + '%';
            }
            
            const width = this.tooltipItem.get_preferred_width(-1)[1] + 30;
            this.tooltipMenu.actor.set_width(width);
        });
    }
    
    showTooltip() {
        if(!this.tooltipMenu)
            return;
        if(!Config.get_boolean('processor-header-tooltip'))
            return;
        
        this.tooltipMenu.open();
    }
    
    hideTooltip() {
        if(!this.tooltipMenu)
            return;
        if(!Config.get_boolean('processor-header-tooltip'))
            return;
        this.tooltipMenu.close();
    }
    
    destroy() {
        Config.clear(this);
        Utils.processorMonitor.unlisten(this);
        
        Config.clear(this.icon);
        
        if(this.percentage) {
            Config.clear(this.percentage);
            Utils.processorMonitor.unlisten(this.percentage);
        }
        if(this.bars) {
            Config.clear(this.bars);
            Utils.processorMonitor.unlisten(this.bars);
        }
        if(this.graph) {
            Config.clear(this.graph);
            Utils.processorMonitor.unlisten(this.graph);
        }
        if(this.tooltipMenu) {
            Config.clear(this.tooltipMenu);
            Utils.processorMonitor.unlisten(this.tooltipMenu);
            this.tooltipMenu.close();
        }
        
        super.destroy();
    }
});