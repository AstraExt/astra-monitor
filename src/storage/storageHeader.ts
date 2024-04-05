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
import StorageMenu from './storageMenu.js';
import StorageGraph from './storageGraph.js';
import StorageBars from './storageBars.js';
import StorageIOBars from './storageIOBars.js';
import { StorageIO } from './storageMonitor.js';
import MenuBase from '../menu.js';

type TooltipMenu = PopupMenu.PopupMenu & {
    actor: St.Widget;
};

type TooltipItem = PopupMenu.PopupMenuItem & {
    label: St.Label;
};

export default GObject.registerClass(
class StorageHeader extends Header {
    protected icon!: St.Icon;
    protected bars!: InstanceType<typeof StorageBars>;
    protected percentage!: St.Label;
    protected value!: St.Label;
    protected free!: St.Label;
    protected ioBars!: InstanceType<typeof StorageIOBars>;
    protected graph!: InstanceType<typeof StorageGraph>;
    protected speedContainer!: St.BoxLayout;
    protected speed!: St.Label;
    protected ioLayout!: string;
    
    protected tooltipMenu!: TooltipMenu;
    protected tooltipItem!: TooltipItem;
    
    protected maxWidths!: number[];
    
    constructor() {
        super('Storage Header');
        
        this.buildIcon();
        this.buildBars();
        this.buildPercentage();
        this.buildValue();
        this.buildFree();
        this.buildIOBars();
        this.buildGraph();
        this.buildSpeed();
        
        this.addOrReorderIndicators();
        
        const menu = new StorageMenu(this, 0.5, MenuBase.arrowAlignement);
        this.setMenu(menu);
        
        this.resetMaxWidths();
        
        Config.connect(this, 'changed::storage-indicators-order', this.addOrReorderIndicators.bind(this));
        Config.bind('storage-header-show', this, 'visible', Gio.SettingsBindFlags.GET);        
        
        Config.connect(this, 'changed::visible', this.resetMaxWidths.bind(this));
        Config.connect(this, 'changed::storage-header-io', this.resetMaxWidths.bind(this));
        Config.connect(this, 'changed::headers-font-family', this.resetMaxWidths.bind(this));
        Config.connect(this, 'changed::headers-font-size', this.resetMaxWidths.bind(this));
        
        const updateIOLayout = () => {
            this.ioLayout = Config.get_string('storage-header-io-layout') || 'vertical';
            this.speed.text = '';
            this.resetMaxWidths();
        };
        Config.connect(this, 'changed::storage-header-io-layout', updateIOLayout.bind(this));
        updateIOLayout();
    }
    
    addOrReorderIndicators() {
        const indicators = Utils.getIndicatorsOrder('storage');
        
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
                case 'percentage':
                    widget = this.percentage;
                    break;
                case 'value':
                    widget = this.value;
                    break;
                case 'free':
                    widget = this.free;
                    break;
                case 'IO bar':
                    widget = this.ioBars;
                    break;
                case 'IO graph':
                    widget = this.graph;
                    break;
                case 'IO speed':
                    widget = this.speedContainer;
                    break;
            }

            if(widget) {
                if(widget.get_parent())
                    this.remove_child(widget);
                this.insert_child_at_index(widget, position++);
            }
        }
    }
    
    resetMaxWidths() {
        this.maxWidths = [];
        
        if(!Config.get_boolean('storage-header-io'))
            return;
        
        if(!this.speed.get_stage())
            return;
        
        this.fixSpeedContainerStyle();
    }
    
    buildIcon() {
        const defaultStyle = 'margin-left:2px;margin-right:4px;';
        let iconSize = Config.get_int('storage-header-icon-size');
        iconSize = Math.max(8, Math.min(30, iconSize));
        this.icon = new St.Icon({
            fallback_gicon: Utils.getLocalIcon('am-harddisk-symbolic'),
            style: defaultStyle,
            icon_size: iconSize,
            y_expand: false,
            y_align: Clutter.ActorAlign.CENTER,
            x_align: Clutter.ActorAlign.CENTER,
        });
        
        const setIconName = () => {
            const iconCustom = Config.get_string('storage-header-icon-custom');
            if(iconCustom)
                this.icon.icon_name = iconCustom;
            else // @ts-expect-error gicon shouldn't be null, but we do have a fallback icon
                this.icon.gicon = Utils.getLocalIcon('am-harddisk-symbolic');
        };
        setIconName();
        
        let baseColor = '';
        let alertColor = '';
        const alerts = new Set();
        
        const setIconBaseColor = () => {
            baseColor = Config.get_string('storage-header-icon-color') || '';
            updateIconColor();
        };
        const setIconAlertColor = () => {
            alertColor = Config.get_string('storage-header-icon-alert-color') || '';
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
        
        Config.bind('storage-header-icon', this.icon, 'visible', Gio.SettingsBindFlags.GET);
        Config.bind('storage-header-icon-size', this.icon, 'icon_size', Gio.SettingsBindFlags.GET);
        Config.connect(this.icon, 'changed::storage-header-icon-custom', setIconName.bind(this));
        Config.connect(this.icon, 'changed::storage-header-icon-color', setIconBaseColor.bind(this));
        Config.connect(this.icon, 'changed::storage-header-icon-alert-color', setIconAlertColor.bind(this));
        
        Utils.storageMonitor.listen(this.icon, 'storageUsage', () => {
            if(!Config.get_boolean('storage-header-icon'))
                return;
            
            const percentageThreshold = Config.get_int('storage-header-percentage-icon-alert-threshold') || 0;
            const freeThreshold = Config.get_int('storage-header-free-icon-alert-threshold') || 0;
            
            if(percentageThreshold === 0 && freeThreshold === 0) {
                if(alerts.size > 0) {
                    alerts.clear();
                    updateIconColor();
                }
                return;
            }
            
            const usage = Utils.storageMonitor.getCurrentValue('storageUsage');
            if(!usage || !usage.usePercentage || isNaN(usage.usePercentage))
                return;
            
            if(percentageThreshold > 0) {
                if(usage.usePercentage < percentageThreshold) {
                    if(alerts.has('storageUsage')) {
                        alerts.delete('storageUsage');
                        updateIconColor();
                    }
                }
                else {
                    if(!alerts.has('storageUsage')) {
                        alerts.add('storageUsage');
                        updateIconColor();
                    }
                }
            }
            
            if(freeThreshold > 0) {
                if(usage.free >= freeThreshold*1000*1000) {
                    if(alerts.has('storageFree')) {
                        alerts.delete('storageFree');
                        updateIconColor();
                    }
                }
                else {
                    if(!alerts.has('storageFree')) {
                        alerts.add('storageFree');
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
            Utils.storageMonitor.unlisten(this.bars);
            this.bars.destroy();
        }
        
        this.bars = new StorageBars({ numBars: 1, header: true, mini: true, width: 0.5 });
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
    
    buildValue() {
        this.value = new St.Label({
            text: '-',
            style_class: 'astra-monitor-header-value',
            y_align: Clutter.ActorAlign.CENTER,
        });
        Config.bind('storage-header-value', this.value, 'visible', Gio.SettingsBindFlags.GET);
        
        Utils.storageMonitor.listen(this.value, 'storageUsage', () => {
            if(!Config.get_boolean('storage-header-value'))
                return;
            
            const figures = Config.get_int('storage-header-value-figures');
            
            const usage = Utils.storageMonitor.getCurrentValue('storageUsage');
            if(!usage || !usage.used || isNaN(usage.used))
                this.value.text = '-';
            else
                this.value.text = `${Utils.formatBytes(usage.used, 'kB-KB', figures)}`;
        });
    }
    
    buildFree() {
        this.free = new St.Label({
            text: '-',
            style_class: 'astra-monitor-header-value',
            y_align: Clutter.ActorAlign.CENTER,
        });
        Config.bind('storage-header-free', this.free, 'visible', Gio.SettingsBindFlags.GET);
        
        Utils.storageMonitor.listen(this.free, 'storageUsage', () => {
            if(!Config.get_boolean('storage-header-free'))
                return;
            
            const figures = Config.get_int('storage-header-free-figures');
            
            const usage = Utils.storageMonitor.getCurrentValue('storageUsage');
            if(!usage || !usage.free || isNaN(usage.free))
                this.free.text = '-';
            else
                this.free.text = `${Utils.formatBytes(usage.free, 'kB-KB', figures)}`;
        });
    }
    
    buildIOBars() {
        if(this.ioBars) {
            this.remove_child(this.ioBars);
            Config.clear(this.ioBars);
            Utils.storageMonitor.unlisten(this.ioBars);
            this.ioBars.destroy();
        }
        
        this.ioBars = new StorageIOBars({ numBars: 2, header: true, mini: true, width: 0.5 });
        Config.bind('storage-header-io-bars', this.ioBars, 'visible', Gio.SettingsBindFlags.GET);
        
        Utils.storageMonitor.listen(this.ioBars, 'storageIO', () => {
            if(!Config.get_boolean('storage-header-io-bars'))
                return;
            const usage = Utils.storageMonitor.getUsageHistory('storageIO') as StorageIO[];
            this.ioBars.setUsage(usage);
        });
    }
    
    buildGraph() {
        if(this.graph) {
            this.remove_child(this.graph);
            Config.clear(this.graph);
            Utils.storageMonitor.unlisten(this.graph);
            this.graph.destroy();
        }
        
        let graphWidth = Config.get_int('storage-header-graph-width');
        graphWidth = Math.max(10, Math.min(500, graphWidth));
        
        this.graph = new StorageGraph({ width: graphWidth, mini: true });
        Config.bind('storage-header-graph', this.graph, 'visible', Gio.SettingsBindFlags.GET);
        
        Config.connect(this.graph, 'changed::storage-header-graph-width', () => {
            let graphWidth = Config.get_int('storage-header-graph-width');
            graphWidth = Math.max(10, Math.min(500, graphWidth));
            this.graph.setWidth(graphWidth);
        });
        
        Utils.storageMonitor.listen(this.graph, 'storageIO', () => {
            if(!Config.get_boolean('storage-header-graph'))
                return;
            
            const usage = Utils.storageMonitor.getUsageHistory('storageIO');
            this.graph.setUsageHistory(usage);
        });
    }
    
    buildSpeed() {
        this.speedContainer = new St.BoxLayout({
            x_align: Clutter.ActorAlign.START,
            y_align: Clutter.ActorAlign.FILL,
            y_expand: true,
            vertical: true,
            width: 1
        });
        
        this.speed = new St.Label({
            text: '',
            style_class: 'astra-monitor-header-speed-label',
            style: 'font-size: 0.65em;',
            y_align: Clutter.ActorAlign.CENTER,
            x_align: Clutter.ActorAlign.END,
            x_expand: true,
            y_expand: true
        });
        this.speedContainer.add_child(this.speed);
        
        Config.bind('storage-header-io', this.speedContainer, 'visible', Gio.SettingsBindFlags.GET);
        
        Utils.storageMonitor.listen(this.speedContainer, 'storageIO', () => {
            if(!Config.get_boolean('storage-header-io'))
                return;
            
            let read = '- B/s';
            let write = '- B/s';
            
            const usage = Utils.storageMonitor.getCurrentValue('storageIO');
            if(usage) {
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
                
                read = Utils.formatBytesPerSec(bytesReadPerSec, unit as any, maxFigures);
                write = Utils.formatBytesPerSec(bytesWrittenPerSec, unit as any, maxFigures);
            }
            
            if(this.ioLayout === 'horizontal')
                this.speed.text = `${read} | ${write}`;
            else
                this.speed.text = `${read}\n${write}`;
            this.fixSpeedContainerStyle();
        });
    }
    
    fixSpeedContainerStyle() {
        if(!this.speedContainer.get_parent())
            return;
        if(!this.speed.get_parent())
            return;
        
        const calculateStyle = () => {
            if(this.ioLayout === 'horizontal')
                return 'font-size:1em;';
            const containerHeight = this.speedContainer.height;
            return `font-size:${Math.round(containerHeight/3)}px;`;
        };
        const style = calculateStyle();
        
        if(this.speed.style !== style) {
            this.speed.style = style;
            this.speed.queue_relayout();
            this.speedContainer.queue_relayout();
        }
        
        const speedWidth = this.speed.get_preferred_width(-1);
        const width = speedWidth ? speedWidth[1] : 0;
        
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
        
        Config.connect(this.tooltipMenu, 'changed::storage-header-tooltip', () => {
            if(!Config.get_boolean('storage-header-tooltip'))
                this.tooltipMenu.close(true);
        });
        
        const updateTooltip = () => {
            if(!Config.get_boolean('storage-header-tooltip'))
                return;
            
            const values: string[] = [];
            
            const usage = Utils.storageMonitor.getCurrentValue('storageUsage');
            
            if(Config.get_boolean('storage-header-tooltip-percentage')) {
                if(!usage || !usage.usePercentage || isNaN(usage.usePercentage))
                    values.push('-');
                else
                    values.push(`${Math.round(usage.usePercentage)}%`);
            }
            
            if(Config.get_boolean('storage-header-tooltip-value')) {
                const figures = Config.get_int('storage-header-value-figures');
                
                const usage = Utils.storageMonitor.getCurrentValue('storageUsage');
                if(!usage || !usage.used || isNaN(usage.used))
                    values.push('-');
                else
                    values.push(`${Utils.formatBytes(usage.used, 'kB-KB', figures)}`);
            }
            
            if(Config.get_boolean('storage-header-tooltip-free')) {
                const figures = Config.get_int('storage-header-free-figures');
                
                const usage = Utils.storageMonitor.getCurrentValue('storageUsage');
                if(!usage || !usage.free || isNaN(usage.free))
                    values.push('-');
                else
                    values.push(`${Utils.formatBytes(usage.free, 'kB-KB', figures)}`);
            }
            
            if(Config.get_boolean('storage-header-tooltip-io')) {
                const usage = Utils.storageMonitor.getCurrentValue('storageIO');
                
                if(usage) {
                    const unit = Config.get_string('storage-io-unit');
                    let maxFigures = Config.get_int('storage-header-io-figures');
                    maxFigures = Math.max(1, Math.min(4, maxFigures));
                    
                    values.push('↑' + Utils.formatBytesPerSec(usage.bytesReadPerSec, unit as any, maxFigures));
                    values.push('↓' + Utils.formatBytesPerSec(usage.bytesWrittenPerSec, unit as any, maxFigures));
                }
            }
            
            if(values.length === 0)
                values.push('-');
            
            this.tooltipItem.label.text = values.join(' | ');
            const width = this.tooltipItem.get_preferred_width(-1)[1] + 30;
            this.tooltipMenu.actor.set_width(width);
        };
        
        Utils.storageMonitor.listen(this.tooltipMenu, 'storageUsage', updateTooltip);
        Utils.storageMonitor.listen(this.tooltipMenu, 'storageIO', updateTooltip);
    }
    
    showTooltip() {
        if(!this.tooltipMenu)
            return;
        if(!Config.get_boolean('storage-header-tooltip'))
            return;
        
        this.tooltipMenu.open(false);
    }
    
    hideTooltip() {
        if(!this.tooltipMenu)
            return;
        if(!Config.get_boolean('storage-header-tooltip'))
            return;
        this.tooltipMenu.close(false);
    }
    
    destroy() {
        Config.clear(this);
        Utils.storageMonitor.unlisten(this);
        
        Config.clear(this.icon);
        
        if(this.percentage) {
            Config.clear(this.percentage);
            Utils.storageMonitor.unlisten(this.percentage);
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
            this.tooltipMenu.close(false);
        }

        super.destroy();
    }
});