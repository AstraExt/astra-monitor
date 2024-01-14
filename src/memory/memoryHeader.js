import GObject from 'gi://GObject';
import Gio from 'gi://Gio';
import St from 'gi://St';
import Clutter from 'gi://Clutter';

import { Header } from '../header.js';
import Config from '../config.js';
import Utils from '../utils/utils.js';
import {MemoryMenu} from './memoryMenu.js';
import {MemoryGraph} from './memoryGraph.js';
import {MemoryBars} from './memoryBars.js';

export const MemoryHeader = GObject.registerClass({
    Properties: {
        
    },
}, class MemoryHeaderBase extends Header {
    constructor() {
        super('Memory Header');
        
        this.buildIcon();
        this.buildGraph();
        this.buildBars();
        this.buildPercentage();
        
        const menu = new MemoryMenu(this, 0.5, St.Side.TOP);
        this.setMenu(menu);
        
        Config.bind('memory-header-show', this, 'visible', Gio.SettingsBindFlags.GET);
    }
    
    buildIcon() {
        let iconSize = Config.get_int('storage-header-icon-size');
        iconSize = Math.max(8, Math.min(30, iconSize));
        this.icon = new St.Icon({
            gicon: Utils.getLocalIcon('am-memory-symbolic'),
            fallback_icon_name: 'memory-symbolic',
            style: 'margin-left:2px;margin-right:4px;',
            icon_size: iconSize,
            y_expand: false,
            y_align: Clutter.ActorAlign.CENTER,
        });
        this.insert_child_at_index(this.icon, 0);
        Config.bind('memory-header-icon', this.icon, 'visible', Gio.SettingsBindFlags.GET);
        Config.bind('memory-header-icon-size', this.icon, 'icon_size', Gio.SettingsBindFlags.GET);
    }
    
    buildBars() {
        if(this.bars) {
            this.remove_child(this.bars);
            Config.clear(this.bars);
            Utils.memoryMonitor.unlisten(this.bars);
            this.bars.destroy();
            this.bars = null;
        }
        
        // @ts-ignore
        this.bars = new MemoryBars({
            numBars: 1,
            mini: true,
            width: 0.5,
            breakdownConfig: 'memory-header-bars-breakdown'
        });
        this.insert_child_at_index(this.bars, 1);
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
            this.graph = null;
        }
        
        let graphWidth = Config.get_int('memory-header-graph-width');
        graphWidth = Math.max(10, Math.min(500, graphWidth));
        
        this.graph = new MemoryGraph({ width: graphWidth, mini: true, breakdownConfig: 'memory-menu-graph-breakdown' });
        this.insert_child_at_index(this.graph, 2);
        Config.bind('memory-header-graph', this.graph, 'visible', Gio.SettingsBindFlags.GET);
        
        Config.connect(this.graph, 'changed::memory-header-graph-width', () => {
            let graphWidth = Config.get_int('memory-header-graph-width');
            graphWidth = Math.max(10, Math.min(500, graphWidth));
            this.graph.setWidth(graphWidth);
        });
        
        Utils.memoryMonitor.listen(this.graph, 'memoryUsage', () => {
            if(!Config.get_boolean('memory-header-graph'))
                return;
            let usage = Utils.memoryMonitor.getUsageHistory('memoryUsage');
            this.graph.setUsageHistory(usage);
        });
    }
    
    buildPercentage() {
        this.percentage = new St.Label({
            text: '-%',
            style_class: 'astra-monitor-header-percentage3',
            y_align: Clutter.ActorAlign.CENTER,
        });
        this.insert_child_at_index(this.percentage, 3);
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
    
    update() {
        
    }
    
    destroy() {
        Config.clear(this);
        Config.clear(this.icon);
        Config.clear(this.bars);
        Config.clear(this.graph);
        Config.clear(this.percentage);
        
        Utils.networkMonitor.unlisten(this);
        
        if(this.bars)
            Utils.networkMonitor.unlisten(this.bars);
        if(this.graph)
            Utils.networkMonitor.unlisten(this.graph);
        if(this.percentage)
            Utils.networkMonitor.unlisten(this.percentage);

        super.destroy();
    }
    
});