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

import GObject from 'gi://GObject';
import Gio from 'gi://Gio';
import St from 'gi://St';
import Clutter from 'gi://Clutter';

import * as PopupMenu from 'resource:///org/gnome/shell/ui/popupMenu.js';
import * as Main from 'resource:///org/gnome/shell/ui/main.js';

import Header from '../header.js';
import Config from '../config.js';
import Utils from '../utils/utils.js';
import MemoryMenu from './memoryMenu.js';
import MemoryGraph from './memoryGraph.js';
import MemoryBars from './memoryBars.js';

type TooltipMenu = PopupMenu.PopupMenu & {
    actor: St.Widget;
};

type TooltipItem = PopupMenu.PopupMenuItem & {
    label: St.Label;
};

export default GObject.registerClass(
class MemoryHeader extends Header {
    protected icon!: St.Icon;
    protected bars!: InstanceType<typeof MemoryBars>;
    protected graph!: InstanceType<typeof MemoryGraph>;
    protected percentage!: St.Label;
    protected value!: St.Label;
    protected free!: St.Label;
    
    protected tooltipMenu!: TooltipMenu;
    protected tooltipItem!: TooltipItem;
    
    constructor() {
        super('Memory Header');
        
        this.buildIcon();
        this.buildGraph();
        this.buildBars();
        this.buildPercentage();
        this.buildValue();
        this.buildFree();
        
        this.addOrReorderIndicators();
        
        const menu = new MemoryMenu(this, 0.5, St.Side.TOP);
        this.setMenu(menu);
        
        Config.connect(this, 'changed::memory-indicators-order', this.addOrReorderIndicators.bind(this));
        Config.bind('memory-header-show', this, 'visible', Gio.SettingsBindFlags.GET);
    }
    
    addOrReorderIndicators() {
        const indicators = Utils.getIndicatorsOrder('memory');
        
        let position = 0;
        for(const indicator of indicators) {
            let widget;
            switch(indicator) {
                case 'icon':
                    widget = this.icon;
                    break;
                case 'bar':
                    widget = this.bars;
                    break;
                case 'graph':
                    widget = this.graph;
                    break;
                case 'percentage':
                    widget = this.percentage;
                    break;
                case 'value':
                    widget = this.value;
                    break;
                case 'free':
                    widget = this.free;
                    break;
            }
            
            if(widget) {
                if(widget.get_parent())
                    this.remove_child(widget);
                this.insert_child_at_index(widget, position++);
            }
        }
    }
    
    buildIcon() {
        const defaultStyle = 'margin-left:2px;margin-right:4px;';
        let iconSize = Config.get_int('storage-header-icon-size');
        iconSize = Math.max(8, Math.min(30, iconSize));
        this.icon = new St.Icon({
            fallback_gicon: Utils.getLocalIcon('am-memory-symbolic'),
            style: defaultStyle,
            icon_size: iconSize,
            y_expand: false,
            y_align: Clutter.ActorAlign.CENTER,
            x_align: Clutter.ActorAlign.CENTER,
        });
        
        const setIconName = () => {
            const iconCustom = Config.get_string('memory-header-icon-custom');
            if(iconCustom)
                this.icon.icon_name = iconCustom;
            else // @ts-expect-error gicon shouldn't be null, but we do have a fallback icon
                this.icon.gicon = Utils.getLocalIcon('am-memory-symbolic');
        };
        setIconName();
        
        let baseColor = '';
        let alertColor = '';
        const alerts = new Set();
        
        const setIconBaseColor = () => {
            baseColor = Config.get_string('memory-header-icon-color') || '';
            updateIconColor();
        };
        const setIconAlertColor = () => {
            alertColor = Config.get_string('memory-header-icon-alert-color') || '';
            updateIconColor();
        };
        const updateIconColor = () => {
            if(alerts.size > 0)
                this.icon.style = defaultStyle + 'color:' + alertColor + ';';
            else if(baseColor)
                this.icon.style = defaultStyle + 'color:' + baseColor + ';';
            else
                this.icon.style = defaultStyle;
        };
        
        setIconBaseColor();
        setIconAlertColor();
        updateIconColor();
        
        Config.bind('memory-header-icon', this.icon, 'visible', Gio.SettingsBindFlags.GET);
        Config.bind('memory-header-icon-size', this.icon, 'icon_size', Gio.SettingsBindFlags.GET);
        Config.connect(this.icon, 'changed::memory-header-icon-custom', setIconName.bind(this));
        Config.connect(this.icon, 'changed::memory-header-icon-color', setIconBaseColor.bind(this));
        Config.connect(this.icon, 'changed::memory-header-icon-alert-color', setIconAlertColor.bind(this));
        
        Utils.memoryMonitor.listen(this.icon, 'memoryUsage', () => {
            if(!Config.get_boolean('memory-header-icon'))
                return;
            
            const percentageThreshold = Config.get_int('memory-header-percentage-icon-alert-threshold') || 0;
            const freeThreshold = Config.get_int('memory-header-free-icon-alert-threshold') || 0;
            
            if(percentageThreshold === 0 && freeThreshold === 0) {
                if(alerts.size > 0) {
                    alerts.clear();
                    updateIconColor();
                }
                return;
            }
            
            const usage = Utils.memoryMonitor.getCurrentValue('memoryUsage');
            if(!usage || !usage.total || isNaN(usage.total) || !usage.used || isNaN(usage.used))
                return;
            
            if(percentageThreshold > 0) {
                const perc = Math.round(usage.used / usage.total * 100);
                if(perc < percentageThreshold) {
                    if(alerts.has('memoryUsage')) {
                        alerts.delete('memoryUsage');
                        updateIconColor();
                    }
                }
                else {
                    if(!alerts.has('memoryUsage')) {
                        alerts.add('memoryUsage');
                        updateIconColor();
                    }
                }
            }
            
            if(freeThreshold > 0) {
                if(usage.free >= freeThreshold*1000*1000) {
                    if(alerts.has('memoryFree')) {
                        alerts.delete('memoryFree');
                        updateIconColor();
                    }
                }
                else {
                    if(!alerts.has('memoryFree')) {
                        alerts.add('memoryFree');
                        updateIconColor();
                    }
                }
            }
        });
    }
    
    buildBars() {
        if(this.bars) {
            this.remove_child(this.bars);
            Config.clear(this.bars);
            Utils.memoryMonitor.unlisten(this.bars);
            this.bars.destroy();
        }
        
        this.bars = new MemoryBars({
            numBars: 1,
            header: true,
            mini: true,
            width: 0.5,
            breakdownConfig: 'memory-header-bars-breakdown'
        });
        Config.bind('memory-header-bars', this.bars, 'visible', Gio.SettingsBindFlags.GET);
        
        Utils.memoryMonitor.listen(this.bars, 'memoryUsage', () => {
            if(!Config.get_boolean('memory-header-bars'))
                return;
            
            const usage = Utils.memoryMonitor.getCurrentValue('memoryUsage');
            if(!usage || !usage.total || isNaN(usage.total))
                this.bars.setUsage([]);
            else
                this.bars.setUsage([usage]);
        });
    }
    
    buildGraph() {
        if(this.graph) {
            this.remove_child(this.graph);
            Config.clear(this.graph);
            Utils.memoryMonitor.unlisten(this.graph);
            this.graph.destroy();
        }
        
        let graphWidth = Config.get_int('memory-header-graph-width');
        graphWidth = Math.max(10, Math.min(500, graphWidth));
        
        this.graph = new MemoryGraph({ width: graphWidth, mini: true, breakdownConfig: 'memory-header-graph-breakdown' });
        Config.bind('memory-header-graph', this.graph, 'visible', Gio.SettingsBindFlags.GET);
        
        Config.connect(this.graph, 'changed::memory-header-graph-width', () => {
            let graphWidth = Config.get_int('memory-header-graph-width');
            graphWidth = Math.max(10, Math.min(500, graphWidth));
            this.graph.setWidth(graphWidth);
        });
        
        Utils.memoryMonitor.listen(this.graph, 'memoryUsage', () => {
            if(!Config.get_boolean('memory-header-graph'))
                return;
            const usage = Utils.memoryMonitor.getUsageHistory('memoryUsage');
            this.graph.setUsageHistory(usage);
        });
    }
    
    buildPercentage() {
        this.percentage = new St.Label({
            text: '-%',
            style_class: 'astra-monitor-header-percentage3',
            y_align: Clutter.ActorAlign.CENTER,
        });
        Config.bind('memory-header-percentage', this.percentage, 'visible', Gio.SettingsBindFlags.GET);
        
        Utils.memoryMonitor.listen(this.percentage, 'memoryUsage', () => {
            if(!Config.get_boolean('memory-header-percentage'))
                return;
            
            const usage = Utils.memoryMonitor.getCurrentValue('memoryUsage');
            if(!usage || !usage.total || isNaN(usage.total) || !usage.used || isNaN(usage.used))
                this.percentage.text = '';
            else
                this.percentage.text = `${Math.round(usage.used / usage.total * 100)}%`;
        });
    }
    
    buildValue() {
        this.value = new St.Label({
            text: '-',
            style_class: 'astra-monitor-header-value',
            y_align: Clutter.ActorAlign.CENTER,
        });
        Config.bind('memory-header-value', this.value, 'visible', Gio.SettingsBindFlags.GET);
        
        Utils.memoryMonitor.listen(this.value, 'memoryUsage', () => {
            if(!Config.get_boolean('memory-header-value'))
                return;
            
            const figures = Config.get_int('memory-header-value-figures');
            
            const usage = Utils.memoryMonitor.getCurrentValue('memoryUsage');
            if(!usage || !usage.used || isNaN(usage.used))
                this.value.text = '-';
            else
                this.value.text = `${Utils.formatBytes(usage.used, figures)}`;
        });
    }
    
    buildFree() {
        this.free = new St.Label({
            text: '-',
            style_class: 'astra-monitor-header-value',
            y_align: Clutter.ActorAlign.CENTER,
        });
        Config.bind('memory-header-free', this.free, 'visible', Gio.SettingsBindFlags.GET);
        
        Utils.memoryMonitor.listen(this.free, 'memoryUsage', () => {
            if(!Config.get_boolean('memory-header-free'))
                return;
            
            const figures = Config.get_int('memory-header-free-figures');
            
            const usage = Utils.memoryMonitor.getCurrentValue('memoryUsage');
            if(!usage || !usage.used || isNaN(usage.used))
                this.free.text = '-';
            else
                this.free.text = `${Utils.formatBytes(usage.free, figures)}`;
        });
    }
    
    update() {
        
    }
    
    createTooltip() {
        this.tooltipMenu = new PopupMenu.PopupMenu(this, 0.5, St.Side.TOP) as TooltipMenu;
        
        Main.uiGroup.add_child(this.tooltipMenu.actor);
        this.tooltipMenu.actor.add_style_class_name('astra-monitor-tooltip-menu');
        this.tooltipMenu.actor.x_expand = true;
        this.tooltipMenu.actor.hide();
        
        this.tooltipItem = new PopupMenu.PopupMenuItem('', {
            reactive: true,
            style_class: 'astra-monitor-tooltip-item'
        }) as TooltipItem;
        this.tooltipItem.actor.x_expand = true;
        this.tooltipItem.actor.x_align = Clutter.ActorAlign.CENTER;
        this.tooltipItem.sensitive = true;
        this.tooltipMenu.addMenuItem(this.tooltipItem);
        
        Config.connect(this.tooltipMenu, 'changed::memory-header-tooltip', () => {
            if(!Config.get_boolean('memory-header-tooltip'))
                this.tooltipMenu.close(true);
        });
        
        Utils.memoryMonitor.listen(this.tooltipMenu, 'memoryUsage', () => {
            if(!Config.get_boolean('memory-header-tooltip'))
                return;
            
            const usage = Utils.memoryMonitor.getCurrentValue('memoryUsage');
            if(!usage || !usage.total || isNaN(usage.total) || !usage.used || isNaN(usage.used))
                this.tooltipItem.label.text = '';
            else
                this.tooltipItem.label.text = `${Math.round(usage.used / usage.total * 100)}%`;
            
            const width = this.tooltipItem.get_preferred_width(-1)[1] + 30;
            this.tooltipMenu.actor.set_width(width);
        });
    }
    
    showTooltip() {
        if(!this.tooltipMenu)
            return;
        if(!Config.get_boolean('memory-header-tooltip'))
            return;
        
        this.tooltipMenu.open(false);
    }
    
    hideTooltip() {
        if(!this.tooltipMenu)
            return;
        if(!Config.get_boolean('memory-header-tooltip'))
            return;
        this.tooltipMenu.close(false);
    }
    
    destroy() {
        Config.clear(this);
        Utils.memoryMonitor.unlisten(this);
        
        Config.clear(this.icon);
        
        if(this.percentage) {
            Config.clear(this.percentage);
            Utils.memoryMonitor.unlisten(this.percentage);
        }
        if(this.value) {
            Config.clear(this.value);
            Utils.memoryMonitor.unlisten(this.value);
        }
        if(this.free) {
            Config.clear(this.free);
            Utils.memoryMonitor.unlisten(this.free);
        }
        if(this.bars) {
            Config.clear(this.bars);
            Utils.memoryMonitor.unlisten(this.bars);
        }
        if(this.graph) {
            Config.clear(this.graph);
            Utils.memoryMonitor.unlisten(this.graph);
        }
        if(this.tooltipMenu) {
            Config.clear(this.tooltipMenu);
            Utils.memoryMonitor.unlisten(this.tooltipMenu);
            this.tooltipMenu.close(false);
        }

        super.destroy();
    }
});