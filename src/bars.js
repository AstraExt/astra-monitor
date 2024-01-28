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
import St from 'gi://St';
import Clutter from 'gi://Clutter';

import Utils from './utils/utils.js';
import Config from './config.js';

/* global global */

export const BarsBase = GObject.registerClass({
    
}, class BarsBase extends St.BoxLayout {
    constructor(params) {
        //default params
        if(params.layout === undefined)
            params.layout = 'vertical';
        if(params.numBars === undefined)
            params.numBars = 1;
        if(params.width === undefined)
            params.width = 0;
        if(params.height === undefined)
            params.height = 0;
        if(params.layers === undefined)
            params.layers = 1;
        if(params.mini === undefined)
            params.mini = false;
        if(params.colors === undefined)
            params.colors = [];
        if(params.x_align === undefined)
            params.x_align = Clutter.ActorAlign.CENTER;
        if(params.y_align === undefined)
            params.y_align = Clutter.ActorAlign.CENTER;
        if(params.style === undefined)
            params.style = '';
        
        let style = '';
        if(params.height) {
            if(params.layout === 'vertical')
                style += `height:${params.height}em;`;
        }
        if(params.width) {
            if(params.layout === 'horizontal')
                style += `width:${params.width}px;`;
        }
        style += params.style;
        
        if(params.mini)
            params.y_align = Clutter.ActorAlign.FILL;
            
        super({
            style: style,
            x_align: params.x_align,
            x_expand: true,
            y_align: params.y_align,
            y_expand: true
        });
        
        this.layout = params.layout;
        this.mini = params.mini;
        this.colors = params.colors;
        this.breakdownConfig = params.breakdownConfig;
        this.initialWidth = params.width;
        this.setStyle();
        
        Config.connect(this, 'changed::theme-style', this.setStyle.bind(this));
        
        const size = this.layout === 'vertical' ? params.width : params.height;
        this.barSize = this.computeBarSize(params.numBars, size);
        
        let bars = new Array(params.numBars);
        for (let i = 0; i < params.numBars; i++) {
            bars[i] = [];
            
            let barConfig;
            if(this.layout === 'vertical') {
                barConfig = {
                    reactive: false,
                    track_hover: false,
                    can_focus: false,
                    style: `width:${this.barSize}em;`,
                };
            }
            else {
                barConfig = {
                    reactive: false,
                    track_hover: false,
                    can_focus: false,
                    style: `height:${this.barSize}em;`,
                };
            }
            
            let container = new St.Widget(barConfig);
            
            for (let k = 0; k < params.layers; k++) {
                let layerConfig;
                
                if(this.layout === 'vertical') {
                    layerConfig = {
                        style_class: `astra-monitor-bars-vertical-bar`,
                        x_expand: true,
                    };
                }
                else {
                    layerConfig = {
                        style_class: `astra-monitor-bars-horizontal-bar`,
                        y_expand: true,
                    };
                }
                
                let layer = new St.Widget(layerConfig);
                if(k > 0)
                    layer.visible = false;
                
                bars[i].push(layer);
                container.add_child(layer);
            }
            this.add_child(container);
        }
        this.bars = bars;
        
        let themeContext = St.ThemeContext.get_for_stage(global.get_stage());
        if (themeContext.get_scale_factor) {
            this.scaleFactor = themeContext.get_scale_factor();
            themeContext.connect('notify::scale-factor', obj => {
                this.scaleFactor = obj.get_scale_factor();
            });
        } else {
            this.scaleFactor = 1;
        }
    }
    
    setStyle() {
        let styleClass;
        if(this.layout === 'vertical')
            styleClass = 'astra-monitor-bars-vertical'
        else
            styleClass = 'astra-monitor-bars-horizontal';
        
        if(this.mini)
            styleClass += '-mini';
        
        const bgStyle = 'astra-monitor-bg-' + Utils.themeStyle();
        this.style_class = styleClass + ' ' + bgStyle;
    }
    
    setUsage(usage) {
        Utils.log('setUsage MUST BE OVERWRITTEN');
    }
    
    /**
     * @param {{color: number, value: number}[][]} values 
     */
    updateBars(values) {
        if(!this.get_stage())
            return;
        
        let [width, height] = this.get_size();
        if(this.initialWidth && width > this.initialWidth)
            width = this.initialWidth;
        
        let size;
        if(this.layout === 'vertical')
            size = height - 4; // Remove 2px padding and 2px border
        else
            size = width - 4; // Remove 2px padding and 2px border
        
        if(!values || values.length === 0) {
            for (let i = 0; i < this.bars.length; i++) {
                const bar = this.bars[i];
                for(let l = 0; l < bar.length; l++)
                    bar[l].visible = false;
            }
            return;
        }
        
        for (let i = 0; i < this.bars.length; i++) {
            const bar = this.bars[i];
            if(i >= values.length) {
                for(let l = 0; l < bar.length; l++)
                    bar[l].visible = false;
                continue;
            }
            
            const value = values[i];
            
            let start = 0;
            for(let l = 0; l < bar.length; l++) {
                const layer = bar[l];
                if(l >= value.length) {
                    layer.visible = false;
                    continue;
                }
                
                const normalizedValue = value[l].value * size;
                let fillSize = 1
                if(normalizedValue >= 0.5)
                    fillSize = Math.ceil(normalizedValue) / this.scaleFactor;
                if(isNaN(fillSize) || fillSize < 1)
                    fillSize = 1;
                
                if(this.layout === 'vertical')
                    layer.set_position(0, size-start-fillSize);
                else
                    layer.set_position(start, 0);
                
                let style = this.computeStyle(start, fillSize, size) + `background-color:${this.colors[value[l].color]};`;
                layer.set_style(style);
                start += fillSize;
                
                if(!layer.visible)
                    layer.visible = true;
            }
        }
    }
    
    computeStyle(start, size, totalSize) {
        const border = this.mini ? '0.15em' : '0.2em';
        const bordersHelper = {
            topLeft: '0',
            topRight: '0',
            bottomRight: '0',
            bottomLeft: '0',
        };
        
        if(start === 0) {
            if(this.layout === 'vertical') {
                bordersHelper.bottomLeft = border;
                bordersHelper.bottomRight = border;
            }
            else {
                bordersHelper.topLeft = border;
                bordersHelper.bottomLeft = border;
            }
        }
        
        let scaleFactor = St.ThemeContext.get_for_stage(global.stage).scale_factor;
        
        const roundedSize = this.mini ? 3 : 4;
        if(totalSize - (start+size) <= roundedSize*scaleFactor) {
            if(this.layout === 'vertical') {
                bordersHelper.topLeft = border;
                bordersHelper.topRight = border;
            }
            else {
                bordersHelper.topRight = border;
                bordersHelper.bottomRight = border;
            }
        }
        
        const style = `border-radius: ${bordersHelper.topLeft} ${bordersHelper.topRight} ${bordersHelper.bottomRight} ${bordersHelper.bottomLeft};`;
        if(this.layout === 'vertical')
            return `${style}height:${size}px;width:${this.barSize}em;`;
        return `${style}height:${this.barSize}em;width:${size}px;`;
    }
    
    computeBarSize(numBars, size) {
        if(numBars > 8)
            size *= .5; // Reduce bar by half when there are many bars
        else if (numBars > 2)
            size *= .75; // Reduce bar by 3/4 when there are a few bars
        return size;
    }
    
    destroy() {
        Config.clear(this);
        super.destroy();
    }
});