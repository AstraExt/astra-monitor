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
import GLib from 'gi://GLib';

import {gettext as _, ngettext} from 'resource:///org/gnome/shell/extensions/extension.js';

import {GraphBase} from '../graph.js';
import Config from '../config.js';
import Utils from '../utils/utils.js';

export const StorageGraph = GObject.registerClass({
    
}, class StorageGraphBase extends GraphBase {
    constructor(params) {
        super(params);
        
        //TODO: make them customizable
        this.historyLimit = params.width;
        this.colors = [
            Clutter.Color.from_string('rgb(29,172,214)'),
            Clutter.Color.from_string('rgb(214,29,29)')
        ];
        this.bgColor = Clutter.Color.from_string('rgba(0,0,0,0.2)');
        this.midLineColor = Clutter.Color.from_string('rgba(255,255,255,0.2)');
    }
    
    buildHistoryGrid() {
        this.maxReadSpeedLabel = new St.Label({
            text: '-',
            y_align: Clutter.ActorAlign.START,
            style_class: 'astra-monitor-graph-label'});
        this.historyGrid.attach(this.maxReadSpeedLabel, 2, 0, 1, 1);
        this.maxWriteSpeedLabel = new St.Label({
            text: '',
            y_align: Clutter.ActorAlign.CENTER,
            style_class: 'astra-monitor-graph-label',
            style: 'margin-top:10px;'
        });
        this.historyGrid.attach(this.maxWriteSpeedLabel, 2, 1, 1, 1);
        let label = new St.Label({text: '', y_align: Clutter.ActorAlign.END, style_class: 'astra-monitor-graph-label'});
        this.historyGrid.attach(label, 2, 2, 1, 1);
        
        const seconds = Utils.memoryMonitor.usageHistoryLength * Config.get_double('memory-update');
        const limitInMins = seconds / 60;
        const startLabel = ngettext('%d min ago', '%d mins ago', limitInMins).format(limitInMins);
        label = new St.Label({text: startLabel, style_class: 'astra-monitor-graph-label-then'});
        this.historyGrid.attach(label, 0, 3, 1, 1);
        label = new St.Label({text: _('now'), style_class: 'astra-monitor-graph-label-now'});
        this.historyGrid.attach(label, 1, 3, 1, 1);
    }
    
    repaint() {
        const [width, height] = this.historyChart.get_surface_size();
        const ctx = this.historyChart.get_context();
        
        const bgColor = this.bgColor[1];
        Clutter.cairo_set_source_color(ctx, bgColor);
        ctx.rectangle(0, 0, width, height);
        ctx.fill();
        
        if (this.history && this.history.length > 0) {
            const pointSpacing = width / (this.historyLimit - 1);
            
            let slicedHistory = this.history.slice(0, this.historyLimit);
            const baseX = (this.historyLimit - slicedHistory.length) * pointSpacing;
            
            this.setupClipping(ctx, width, height, 2);
            
            const maxRead = Math.max(slicedHistory.reduce((max, d) => Math.max(max, d.bytesReadPerSec), 0), 1024 * 1024);
            if(this.maxReadSpeedLabel)
                this.maxReadSpeedLabel.text = Utils.formatBytesPerSec(maxRead, 2);

            const maxWrite = Math.max(slicedHistory.reduce((max, d) => Math.max(max, d.bytesWrittenPerSec), 0), 1024 * 1024);
            if(this.maxWriteSpeedLabel)
                this.maxWriteSpeedLabel.text = Utils.formatBytesPerSec(maxWrite, 2);
            
            Clutter.cairo_set_source_color(ctx, this.colors[0][1]);
            const readFunc = (node) => node.bytesReadPerSec / maxRead;
            this.drawGraph(ctx, slicedHistory, readFunc, baseX, 0, height/2, pointSpacing);
            
            Clutter.cairo_set_source_color(ctx, this.colors[1][1]);
            const writeFunc = (node) => node.bytesWrittenPerSec / maxWrite;
            this.drawGraph(ctx, slicedHistory, writeFunc, baseX, height/2, height/2, pointSpacing);
        }
        
        //draw a line at 50%
        const color = this.midLineColor[1];
        Clutter.cairo_set_source_color(ctx, color);
        ctx.moveTo(0, height/2);
        ctx.lineTo(width, height/2);
        ctx.stroke();
        
        ctx.$dispose();
    }
    
    
});