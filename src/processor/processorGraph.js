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
import Clutter from 'gi://Clutter';
import St from 'gi://St';

import {gettext as _, ngettext} from 'resource:///org/gnome/shell/extensions/extension.js';

import {GraphBase} from '../graph.js';
import Config from '../config.js';
import Utils from '../utils/utils.js';

export const ProcessorGraph = GObject.registerClass({
    
}, class ProcessorGraphBase extends GraphBase {
    constructor(params) {
        super(params);
        
        //TODO: make them customizable
        this.breakdownConfig = params.breakdownConfig;
    }
    
    setStyle() {
        this.colors = [
            Clutter.Color.from_string('rgb(29,172,214)'),
            Clutter.Color.from_string('rgb(214,29,29)')
        ];
        
        let bg = 'rgba(0,0,0,0.2)';
        if(Utils.themeStyle() === 'light')
            bg = 'rgba(255,255,255,0.2)';
        this.bgColor = Clutter.Color.from_string(bg);
    }
    
    buildHistoryGrid() {
        let label = new St.Label({text: '100%', y_align: Clutter.ActorAlign.START, style_class: 'astra-monitor-graph-label'});
        this.historyGrid.attach(label, 2, 0, 1, 1);
        label = new St.Label({text: '50%', y_align: Clutter.ActorAlign.CENTER, style_class: 'astra-monitor-graph-label'});
        this.historyGrid.attach(label, 2, 1, 1, 1);
        label = new St.Label({text: '0%', y_align: Clutter.ActorAlign.END, style_class: 'astra-monitor-graph-label'});
        this.historyGrid.attach(label, 2, 2, 1, 1);
        
        const seconds = Utils.processorMonitor.usageHistoryLength * Config.get_double('processor-update');
        const limitInMins = seconds / 60;
        const startLabel = ngettext('%d min ago', '%d mins ago', limitInMins).format(limitInMins);
        label = new St.Label({text: startLabel, style_class: 'astra-monitor-graph-label-then'});
        this.historyGrid.attach(label, 0, 3, 1, 1);
        label = new St.Label({text: _('now'), style_class: 'astra-monitor-graph-label-now'});
        this.historyGrid.attach(label, 1, 3, 1, 1);
    }
    
    repaint() {
        const historyLength = this.history ? this.history.length : 0;
    
        const [width, height] = this.historyChart.get_surface_size();
        const ctx = this.historyChart.get_context();
            
        this.setupClipping(ctx, width, height, 2);
        
        Clutter.cairo_set_source_color(ctx, this.bgColor[1]);
        ctx.rectangle(0, 0, width, height);
        ctx.fill();
        
        if (this.history && this.history.length > 0) {
            const pointSpacing = width / (this.historyLimit - 1);
            const baseX = (this.historyLimit - historyLength) * pointSpacing;
            
            if(!this.breakdownConfig || Config.get_boolean(this.breakdownConfig)) {
                // Draw system usage graph
                Clutter.cairo_set_source_color(ctx, this.colors[1][1]);
                const systemFunc = (node) => node.total / 100.0;
                super.drawGraph(ctx, this.history, systemFunc, baseX, 0, height, pointSpacing);
                
                // Draw user usage graph on top
                Clutter.cairo_set_source_color(ctx, this.colors[0][1]);
                const userFunc = (node) => node.user / 100.0;
                super.drawGraph(ctx, this.history, userFunc, baseX, 0, height, pointSpacing);
            } else {
                // Draw single graph for total usage
                Clutter.cairo_set_source_color(ctx, this.colors[0][1]);
                const totalFunc = (node) => node.total / 100.0;
                this.drawGraph(ctx, this.history, totalFunc, baseX, 0, height, pointSpacing);
            }
        }
        
        ctx.$dispose();
    }
});