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
        
        const menu = new NetworkMenu(this, 0.5, St.Side.TOP);
        this.setMenu(menu);
        
        Config.bind('network-header-show', this, 'visible', Gio.SettingsBindFlags.GET);
    }
    
    buildIcon() {
        //TODO: icon should be a setting
        this.icon = new St.Icon({
            gicon: Utils.getLocalIcon('am-network-symbolic'),
            fallback_icon_name: 'network-wired-symbolic',
            style: 'margin-right: 4px;',
            icon_size: 18,
            y_expand: false,
            y_align: Clutter.ActorAlign.CENTER,
        });
        this.insert_child_at_index(this.icon, 0);
        Config.bind('network-header-icon', this.icon, 'visible', Gio.SettingsBindFlags.GET);
        Config.bind('network-header-icon-size', this.icon, 'icon_size', Gio.SettingsBindFlags.GET);
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
        this.insert_child_at_index(this.bars, 1);
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
        this.insert_child_at_index(this.graph, 3);
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
            x_align: Clutter.ActorAlign.CENTER,
            x_expand: true,
            y_align: Clutter.ActorAlign.CENTER,
            y_expand: true,
            vertical: true,
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
        
        this.insert_child_at_index(this.speedContainer, 4);
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
                const unit = Config.get_string('network-io-unit');
                this.upload.text = Utils.formatBytesPerSec(usage.bytesUploadedPerSec, unit, 2, true);
                this.download.text = Utils.formatBytesPerSec(usage.bytesDownloadedPerSec, unit, 2, true);
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
        
        Utils.networkMonitor.unlisten(this);
        
        if(this.bars)
            Utils.networkMonitor.unlisten(this.bars);
        if(this.graph)
            Utils.networkMonitor.unlisten(this.graph);
        if(this.speedContainer)
            Utils.networkMonitor.unlisten(this.speedContainer);
        
        super.destroy();
    }
});
    