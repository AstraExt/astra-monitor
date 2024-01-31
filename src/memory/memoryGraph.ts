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
import Clutter from 'gi://Clutter';
import St from 'gi://St';

import {gettext as _, ngettext} from 'resource:///org/gnome/shell/extensions/extension.js';

import GraphBase, { CairoContext, GraphProps } from '../graph.js';
import Config from '../config.js';
import Utils, { Color } from '../utils/utils.js';
import { MemoryUsage } from './memoryMonitor.js';

type MemoryGraphProps = GraphProps & {
    breakdownConfig?: string;
};

export default GObject.registerClass(
class MemoryGraph extends GraphBase<MemoryUsage> {
    private breakdownConfig?: string;
    private colors!: Color[];
    private bgColor!: Color;
    
    constructor(params: MemoryGraphProps) {
        super(params);
        
        //TODO: make them customizable
        this.breakdownConfig = params.breakdownConfig;
    }
    
    setStyle() {
        this.colors = [
            Utils.parseRGBA('rgb(29,172,214)'), // blue
            Utils.parseRGBA('rgb(214,29,29)'), // red
        ];
        
        let bg = 'rgba(0,0,0,0.2)';
        if(Utils.themeStyle === 'light')
            bg = 'rgba(255,255,255,0.2)';
        
        this.bgColor = Utils.parseRGBA(bg);
    }
    
    buildHistoryGrid() {
        if(!this.historyGrid)
            return;
        
        let label = new St.Label({text: '100%', y_align: Clutter.ActorAlign.START, style_class: 'astra-monitor-graph-label'});
        this.historyGrid.attach(label, 2, 0, 1, 1);
        label = new St.Label({text: '50%', y_align: Clutter.ActorAlign.CENTER, style_class: 'astra-monitor-graph-label'});
        this.historyGrid.attach(label, 2, 1, 1, 1);
        label = new St.Label({text: '0%', y_align: Clutter.ActorAlign.END, style_class: 'astra-monitor-graph-label'});
        this.historyGrid.attach(label, 2, 2, 1, 1);
        
        const seconds = Utils.memoryMonitor.historyLength * Config.get_double('memory-update');
        const limitInMins = seconds / 60;
        const startLabel = (ngettext('%d min ago', '%d mins ago', limitInMins) as any).format(limitInMins);
        label = new St.Label({text: startLabel, style_class: 'astra-monitor-graph-label-then'});
        this.historyGrid.attach(label, 0, 3, 1, 1);
        label = new St.Label({text: _('now'), style_class: 'astra-monitor-graph-label-now'});
        this.historyGrid.attach(label, 1, 3, 1, 1);
    }
    
    repaint() {
        const historyLength = this.history ? this.history.length : 0;
        
        const [width, height] = this.historyChart.get_surface_size();
        const ctx: CairoContext = this.historyChart.get_context();
            
        this.setupClipping(ctx, width, height, 2);
        
        ctx.setSourceRGBA(this.bgColor.red, this.bgColor.green, this.bgColor.blue, this.bgColor.alpha);
        ctx.rectangle(0, 0, width, height);
        ctx.fill();
        
        if(this.history && this.history.length > 0) {
            const pointSpacing = width / (this.historyLimit - 1);
            const baseX = (this.historyLimit - historyLength) * pointSpacing;
            
            if(!this.breakdownConfig || Config.get_boolean(this.breakdownConfig)) {
                // Draw allocated graph on top
                ctx.setSourceRGBA(this.colors[1].red, this.colors[1].green, this.colors[1].blue, this.colors[1].alpha);
                const activeFunc = (node: MemoryUsage) => node.allocated / node.total;
                super.drawGraph(ctx, this.history, activeFunc, baseX, 0, height, pointSpacing);
                
                // Draw used graph on bottom
                ctx.setSourceRGBA(this.colors[0].red, this.colors[0].green, this.colors[0].blue, this.colors[0].alpha);
                const inactiveFunc = (node: MemoryUsage) => node.used / node.total;
                super.drawGraph(ctx, this.history, inactiveFunc, baseX, 0, height, pointSpacing);
            }
            else {
                // Draw single graph for total usage
                ctx.setSourceRGBA(this.colors[0].red, this.colors[0].green, this.colors[0].blue, this.colors[0].alpha);
                const usedFunc = (node: MemoryUsage) => node.used / node.total;
                super.drawGraph(ctx, this.history, usedFunc, baseX, 0, height, pointSpacing);
            }
        }
        ctx.$dispose();
    }
});