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
import Clutter from 'gi://Clutter';
import St from 'gi://St';
import Cairo from 'gi://cairo';

import {gettext as _, ngettext} from 'resource:///org/gnome/shell/extensions/extension.js';

import {GraphBase} from '../graph.js';
import Config from '../config.js';
import Utils from '../utils/utils.js';

export const NetworkGraph = GObject.registerClass({
    
}, class NetworkGraphBase extends GraphBase {
    constructor(params) {
        super(params);
    }
    
    setStyle() {
        this.colors = [
            Clutter.Color.from_string('rgb(29,172,214)')[1],
            Clutter.Color.from_string('rgb(214,29,29)')[1]
        ];
        
        let line = 'rgba(255,255,255,0.2)';
        if(Utils.themeStyle() === 'light')
            line = 'rgba(0,0,0,0.8)';
        this.midLineColor = Clutter.Color.from_string(line)[1];
        
        let bg = 'rgba(0,0,0,0.2)';
        if(Utils.themeStyle() === 'light')
            bg = 'rgba(255,255,255,0.2)';
        this.bgColor = Clutter.Color.from_string(bg)[1];
    }
    
    buildHistoryGrid() {
        this.maxUploadSpeedLabel = new St.Label({
            text: '-',
            y_align: Clutter.ActorAlign.START,
            style_class: 'astra-monitor-graph-label'});
        this.historyGrid.attach(this.maxUploadSpeedLabel, 2, 0, 1, 1);
        this.maxDownloadSpeedLabel = new St.Label({
            text: '',
            y_align: Clutter.ActorAlign.CENTER,
            style_class: 'astra-monitor-graph-label',
            style: 'margin-top:10px;'
        });
        this.historyGrid.attach(this.maxDownloadSpeedLabel, 2, 1, 1, 1);
        let label = new St.Label({text: '', y_align: Clutter.ActorAlign.END, style_class: 'astra-monitor-graph-label'});
        this.historyGrid.attach(label, 2, 2, 1, 1);
        
        const seconds = Utils.memoryMonitor.usageHistoryLength * Config.get_double('memory-update');
        const limitInMins = seconds / 60;
        const startLabel = ngettext('%d min ago', '%d mins ago', limitInMins).format(limitInMins);
        label = new St.Label({text: startLabel, style_class: 'astra-monitor-graph-label-then'});
        this.historyGrid.attach(label, 0, 3, 1, 1);
        label = new St.Label({text: _('now'), style_class: 'astra-monitor-graph-label-now'});
        this.historyGrid.attach(label, 1, 3, 1, 1);
        
        Config.connect(this, 'changed::network-io-unit', () => {
            let slicedHistory = this.history.slice(0, this.historyLimit);
            const maxUpload = Math.max(slicedHistory.reduce((max, d) => Math.max(max, d.bytesUploadedPerSec), 0), 56 * 1024);
            const maxDownload = Math.max(slicedHistory.reduce((max, d) => Math.max(max, d.bytesDownloadedPerSec), 0), 256 * 1024);
            this.refreshMaxSpeed(maxUpload, maxDownload);
        });
    }
    
    refreshMaxSpeed(maxUpload, maxDownload) {
        const unit = Config.get_string('network-io-unit');
        
        if(this.maxUploadSpeedLabel)
            this.maxUploadSpeedLabel.text = Utils.formatBytesPerSec(maxUpload, unit, 2);

        if(this.maxDownloadSpeedLabel)
            this.maxDownloadSpeedLabel.text = Utils.formatBytesPerSec(maxDownload, unit, 2);
        
    }
    
    repaint() {
        const [width, height] = this.historyChart.get_surface_size();
        const ctx = this.historyChart.get_context();
            
        this.setupClipping(ctx, width, height, 2);
        
        ctx.setSourceRGBA(this.bgColor.red / 255, this.bgColor.green / 255, this.bgColor.blue / 255, this.bgColor.alpha / 255);
        ctx.rectangle(0, 0, width, height);
        ctx.fill();
        
        if (this.history && this.history.length > 0) {
            const pointSpacing = width / (this.historyLimit - 1);
            
            let slicedHistory = this.history.slice(0, this.historyLimit);
            const baseX = (this.historyLimit - slicedHistory.length) * pointSpacing;
            
            const maxUpload = Math.max(slicedHistory.reduce((max, d) => Math.max(max, d.bytesUploadedPerSec), 0), 56 * 1024);
            const maxDownload = Math.max(slicedHistory.reduce((max, d) => Math.max(max, d.bytesDownloadedPerSec), 0), 256 * 1024);
            
            this.refreshMaxSpeed(maxUpload, maxDownload);
            
            ctx.setSourceRGBA(this.colors[0].red / 255, this.colors[0].green / 255, this.colors[0].blue / 255, this.colors[0].alpha / 255);
            const uploadFunc = (node) => node.bytesUploadedPerSec / maxUpload;
            super.drawGraph(ctx, slicedHistory, uploadFunc, baseX, 0, height/2, pointSpacing);
            
            ctx.setSourceRGBA(this.colors[1].red / 255, this.colors[1].green / 255, this.colors[1].blue / 255, this.colors[1].alpha / 255);
            const downloadFunc = (node) => node.bytesDownloadedPerSec / maxDownload;
            this.drawGraph(ctx, slicedHistory, downloadFunc, baseX, height/2, height/2, pointSpacing);
        }
        
        //draw a line at 50%
        ctx.setSourceRGBA(this.midLineColor.red / 255, this.midLineColor.green / 255, this.midLineColor.blue / 255, this.midLineColor.alpha / 255);
        
        if(this.mini) {
            ctx.moveTo(0, height/2);
            ctx.setLineCap (Cairo.LineCap.ROUND);
            ctx.setLineWidth(0.5);
            ctx.lineTo(width, height/2);
            ctx.stroke();
        }
        else {
            ctx.rectangle(0, height/2, width, 1);
            ctx.fill();
        }
        
        ctx.$dispose();
    }
});