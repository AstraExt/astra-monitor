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
import {NetworkMenu} from './networkMenu.js';
import {NetworkGraph} from './networkGraph.js';
import {NetworkBars} from './networkBars.js';

export const NetworkHeader = GObject.registerClass({
    Properties: {
        
    },
}, class NetworkHeaderBase extends Header {
    constructor() {
        super('Network Header');
        
        this.buildIcon();
        this.buildGraph();
        this.buildSpeed();
        this.buildBars();
        
        this.addOrReorderIndicators();
        
        const menu = new NetworkMenu(this, 0.5, St.Side.TOP);
        this.setMenu(menu);
        
        this.resetMaxWidths();
        
        Config.connect(this, 'changed::network-indicators-order', this.addOrReorderIndicators.bind(this));
        Config.bind('network-header-show', this, 'visible', Gio.SettingsBindFlags.GET);
        
        Config.connect(this, 'changed::visible', this.resetMaxWidths.bind(this));
        Config.connect(this, 'changed::network-header-io', this.resetMaxWidths.bind(this));
        Config.connect(this, 'changed::headers-font-family', this.resetMaxWidths.bind(this));
        Config.connect(this, 'changed::headers-font-size', this.resetMaxWidths.bind(this));
    }
    
    addOrReorderIndicators() {
        const indicators = Utils.getIndicatorsOrder('network');
        
        let position = 0;
        for(const indicator of indicators) {
            let widget;
            switch(indicator) {
                case 'icon':
                    widget = this.icon;
                    break;
                case 'IO bar':
                    widget = this.bars;
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
        
        if(!Config.get_boolean('network-header-io'))
            return;
        
        if(!this.upload.get_stage() || !this.download.get_stage())
            return;
        
        const uploadWidth = this.upload.get_preferred_width(-1);
        const downloadWidth = this.download.get_preferred_width(-1);
        this.fixSpeedContainerWidth(Math.max(uploadWidth?uploadWidth[1]:0, downloadWidth?downloadWidth[1]:0));
    }
    
    buildIcon() {
        const defaultStyle = 'margin-left:2px;margin-right:4px;';
        let iconSize = Config.get_int('storage-header-icon-size');
        iconSize = Math.max(8, Math.min(30, iconSize));
        this.icon = new St.Icon({
            fallback_gicon: Utils.getLocalIcon('am-network-symbolic'),
            style: defaultStyle,
            icon_size: iconSize,
            y_expand: false,
            y_align: Clutter.ActorAlign.CENTER,
            x_align: Clutter.ActorAlign.CENTER,
        });
        
        const setIconName = () => {
            const iconCustom = Config.get_string('network-header-icon-custom');
            if(iconCustom)
                this.icon.icon_name = iconCustom;
            else
                this.icon.gicon = Utils.getLocalIcon('am-network-symbolic');
        };
        setIconName();
        
        const setIconColor = () => {
            const iconColor = Config.get_string('network-header-icon-color');
            if(iconColor)
                this.icon.style = defaultStyle + 'color:' + iconColor + ';';
            else
                this.icon.style = defaultStyle;
        };
        setIconColor();
        
        Config.bind('network-header-icon', this.icon, 'visible', Gio.SettingsBindFlags.GET);
        Config.bind('network-header-icon-size', this.icon, 'icon_size', Gio.SettingsBindFlags.GET);
        Config.connect(this.icon, 'changed::network-header-icon-custom', setIconName.bind(this));
        Config.connect(this.icon, 'changed::network-header-icon-color', setIconColor.bind(this));
    }
    
    buildBars() {
        if(this.bars) {
            this.remove_child(this.bars);
            Config.clear(this.bars);
            Utils.networkMonitor.unlisten(this.bars);
            this.bars.destroy();
            this.bars = null;
        }
        
        // @ts-ignore
        this.bars = new NetworkBars({ numBars: 2, mini: true, width: 0.5 });
        Config.bind('network-header-bars', this.bars, 'visible', Gio.SettingsBindFlags.GET);
        
        Utils.networkMonitor.listen(this.bars, 'networkIO', () => {
            if(!Config.get_boolean('network-header-bars'))
                return;
            
            let usage = Utils.networkMonitor.getCurrentValue('networkIO');
            let maxSpeeds = Utils.networkMonitor.detectedMaxSpeeds;
            this.bars.setUsage(usage, maxSpeeds);
        });
    }
    
    buildGraph() {
        if(this.graph) {
            this.remove_child(this.graph);
            Config.clear(this.graph);
            Utils.networkMonitor.unlisten(this.graph);
            this.graph.destroy();
            this.graph = null;
        }
        
        let graphWidth = Config.get_int('network-header-graph-width');
        graphWidth = Math.max(10, Math.min(500, graphWidth));
        
        this.graph = new NetworkGraph({ width: graphWidth, mini: true });
        Config.bind('network-header-graph', this.graph, 'visible', Gio.SettingsBindFlags.GET);
        
        Config.connect(this.graph, 'changed::network-header-graph-width', () => {
            let graphWidth = Config.get_int('network-header-graph-width');
            graphWidth = Math.max(10, Math.min(500, graphWidth));
            this.graph.setWidth(graphWidth);
        });
        
        Utils.networkMonitor.listen(this.graph, 'networkIO', () => {
            if(!Config.get_boolean('network-header-graph'))
                return;
            
            let usage = Utils.networkMonitor.getUsageHistory('networkIO');
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
        
        this.upload = new St.Label({
            text: '- B/s',
            style_class: 'astra-monitor-header-speed-label',
            y_align: Clutter.ActorAlign.START,
            x_align: Clutter.ActorAlign.END,
            x_expand: true,
        });
        
        this.download = new St.Label({
            text: '- B/s',
            style_class: 'astra-monitor-header-speed-label',
            y_align: Clutter.ActorAlign.END,
            x_align: Clutter.ActorAlign.END,
            x_expand: true,
        });
        
        this.speedContainer.add_child(this.upload);
        this.speedContainer.add_child(this.download);
        
        Config.bind('network-header-io', this.speedContainer, 'visible', Gio.SettingsBindFlags.GET);
        
        Utils.networkMonitor.listen(this.speedContainer, 'networkIO', () => {
            if(!Config.get_boolean('network-header-io'))
                return;
            
            const usage = Utils.networkMonitor.getCurrentValue('networkIO');
            if(!usage) {
                this.upload.text = '- B/s';
                this.download.text = '- B/s';
            }
            else {
                let bytesUploadedPerSec = usage.bytesUploadedPerSec;
                let bytesDownloadedPerSec = usage.bytesDownloadedPerSec;
                
                const threshold = Config.get_int('network-header-io-threshold');
                
                if(bytesUploadedPerSec < threshold*1000)
                    bytesUploadedPerSec = 0;
                
                if(bytesDownloadedPerSec < threshold*100)
                    bytesDownloadedPerSec = 0;
                
                const unit = Config.get_string('network-io-unit');
                let maxFigures = Config.get_int('network-header-io-figures');
                maxFigures = Math.max(1, Math.min(4, maxFigures));
                this.upload.text = Utils.formatBytesPerSec(bytesUploadedPerSec, unit, maxFigures, true);
                this.download.text = Utils.formatBytesPerSec(bytesDownloadedPerSec, unit, maxFigures, true);
                
                const uploadWidth = this.upload.get_preferred_width(-1);
                const downloadWidth = this.download.get_preferred_width(-1);
                this.fixSpeedContainerWidth(Math.max(uploadWidth?uploadWidth[1]:0, downloadWidth?downloadWidth[1]:0));
            }
        });
    }
    
    fixSpeedContainerWidth(width) {
        this.maxWidths.push(width);
        
        if(this.maxWidths.length > Utils.networkMonitor.updateFrequency * 30)
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
        
        Main.uiGroup.add_child(this.tooltipMenu.actor);
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
        
        Config.connect(this.tooltipMenu, 'changed::network-header-tooltip', () => {
            if(!Config.get_boolean('network-header-tooltip'))
                this.tooltipMenu.close();
        });
        
        Utils.networkMonitor.listen(this.tooltipMenu, 'networkIO', () => {
            if(!Config.get_boolean('network-header-tooltip'))
                return;
            
            const usage = Utils.networkMonitor.getCurrentValue('networkIO');
            if(!usage) {
                this.tooltipItem.label.text = '- B/s | - B/s';
            }
            else {
                let bytesUploadedPerSec = usage.bytesUploadedPerSec;
                let bytesDownloadedPerSec = usage.bytesDownloadedPerSec;
                
                const unit = Config.get_string('network-io-unit');
                let maxFigures = Config.get_int('network-header-io-figures');
                maxFigures = Math.max(1, Math.min(4, maxFigures));
                const upload = Utils.formatBytesPerSec(bytesUploadedPerSec, unit, maxFigures, true);
                const download = Utils.formatBytesPerSec(bytesDownloadedPerSec, unit, maxFigures, true);
                
                this.tooltipItem.label.text = `${upload} | ${download}`;
            }
            
            const width = this.tooltipItem.get_preferred_width(-1)[1] + 30;
            this.tooltipMenu.actor.set_width(width);
        });
    }
    
    showTooltip() {
        if(!this.tooltipMenu)
            return;
        if(!Config.get_boolean('network-header-tooltip'))
            return;
        
        this.tooltipMenu.open();
    }
    
    hideTooltip() {
        if(!this.tooltipMenu)
            return;
        if(!Config.get_boolean('network-header-tooltip'))
            return;
        this.tooltipMenu.close();
    }
    
    destroy() {
        Config.clear(this);
        Utils.networkMonitor.unlisten(this);
        
        Config.clear(this.icon);
        
        if(this.bars) {
            Config.clear(this.bars);
            Utils.networkMonitor.unlisten(this.bars);
        }
        if(this.graph) {
            Config.clear(this.graph);
            Utils.networkMonitor.unlisten(this.graph);
        }
        if(this.speedContainer) {
            Config.clear(this.speedContainer);
            Utils.networkMonitor.unlisten(this.speedContainer);
        }
        if(this.tooltipMenu) {
            Config.clear(this.tooltipMenu);
            Utils.networkMonitor.unlisten(this.tooltipMenu);
            this.tooltipMenu.close();
        }
        
        super.destroy();
    }
});
    