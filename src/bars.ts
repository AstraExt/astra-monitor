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
import St from 'gi://St';
import Clutter from 'gi://Clutter';

import Utils from './utils/utils.js';
import Config from './config.js';

declare const global: any;

export type BarProps = {
    header?: boolean;
    mini?: boolean;
    layout?: 'vertical' | 'horizontal';
    width?: number;
    numBars?: number;
    height?: number;
    layers?: number;
    style?: string;
    x_align?: Clutter.ActorAlign;
    y_align?: Clutter.ActorAlign;
    breakdownConfig?: string;
    hideEmpty?: boolean;
};

export default GObject.registerClass(
    class BarsBase extends St.BoxLayout {
        protected layout: 'horizontal' | 'vertical';
        protected header: boolean;
        protected mini: boolean;
        protected colors!: string[];
        protected breakdownConfig?: string;
        protected scaleFactor: number;
        protected barSize: number;
        protected bars: St.Widget[][];
        protected hideEmpty: boolean;

        constructor(params: BarProps) {
            //default params
            if(params.layout === undefined) params.layout = 'vertical';
            if(params.numBars === undefined) params.numBars = 1;
            if(params.width === undefined) params.width = 0;
            if(params.height === undefined) params.height = 0;
            if(params.layers === undefined) params.layers = 1;
            if(params.header === undefined) params.header = false;
            if(params.mini === undefined) params.mini = false;
            if(params.x_align === undefined) params.x_align = Clutter.ActorAlign.CENTER;
            if(params.y_align === undefined) params.y_align = Clutter.ActorAlign.CENTER;
            if(params.style === undefined) params.style = '';
            if(params.hideEmpty === undefined) params.hideEmpty = false;

            let style = '';
            if(params.height) {
                if(params.layout === 'vertical') style += `height:${params.height}em;`;
            }
            if(params.width) {
                if(params.layout === 'horizontal') style += `width:${params.width}px;`;
            }
            style += params.style;

            if(params.mini) {
                params.y_align = Clutter.ActorAlign.FILL;
            }

            super({
                style: style,
                x_align: params.x_align,
                x_expand: true,
                y_align: params.y_align,
                y_expand: true
            });

            this.layout = params.layout;
            this.header = params.header;
            this.mini = params.mini;
            this.breakdownConfig = params.breakdownConfig;
            this.hideEmpty = params.hideEmpty;
            this.setStyle();

            Config.connect(this, 'changed::theme-style', this.setStyle.bind(this));

            const size = this.layout === 'vertical' ? params.width : params.height;
            this.barSize = this.computeBarSize(params.numBars, size);

            const bars = new Array(params.numBars);
            for(let i = 0; i < params.numBars; i++) {
                bars[i] = [];

                let barConfig;
                if(this.layout === 'vertical') {
                    barConfig = {
                        reactive: false,
                        track_hover: false,
                        can_focus: false,
                        style: `width:${this.barSize}em;`
                    };
                } else {
                    barConfig = {
                        reactive: false,
                        track_hover: false,
                        can_focus: false,
                        style: `height:${this.barSize}em;`
                    };
                }

                const container = new St.Widget(barConfig);

                for(let k = 0; k < params.layers; k++) {
                    let layerConfig;

                    if(this.layout === 'vertical') {
                        layerConfig = {
                            style_class: 'astra-monitor-bars-vertical-bar',
                            x_expand: true
                        };
                    } else {
                        layerConfig = {
                            style_class: 'astra-monitor-bars-horizontal-bar',
                            y_expand: true
                        };
                    }

                    const layer = new St.Widget(layerConfig);
                    if(k > 0) layer.visible = false;

                    bars[i].push(layer);
                    container.add_child(layer);
                }
                this.add_child(container);
            }
            this.bars = bars;

            const themeContext = St.ThemeContext.get_for_stage(global.get_stage());
            if(themeContext.get_scale_factor) {
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
            if(this.layout === 'vertical') {
                styleClass = 'astra-monitor-bars-vertical';
            }
            else {
                styleClass = 'astra-monitor-bars-horizontal';
            }

            if(this.mini) styleClass += '-mini';

            const bgStyle = 'astra-monitor-bg-' + Utils.themeStyle;
            this.style_class = styleClass + ' ' + bgStyle;
        }

        setUsage(_usage: any) {
            Utils.log('setUsage MUST BE OVERWRITTEN');
        }

        updateBars(values: { color: number; value: number }[][]) {
            if(!this.get_stage() || !this.get_parent()) return;

            try {
                // eslint-disable-next-line prefer-const
                let [width, height] = this.get_size();
                width /= this.scaleFactor;
                height /= this.scaleFactor;
                
                let size;
                if(this.layout === 'vertical') {
                    size = height - 4;
                }
                else {
                    size = width - 4;
                }
                
                if(!values || values.length === 0) {
                    for(let i = 0; i < this.bars.length; i++) {
                        const bar = this.bars[i];
                        for(let l = 0; l < bar.length; l++) {
                            bar[l].visible = false;
                        }
                    }
                    return;
                }

                for(let i = 0; i < this.bars.length; i++) {
                    const bar = this.bars[i];
                    if(i >= values.length) {
                        for(let l = 0; l < bar.length; l++) bar[l].visible = false;
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

                        if(this.hideEmpty) {
                            for(let l = 0; l < bar.length; l++)
                                bar[l].visible = l < value.length && value[l].value > 0;
                            if(value[l].value === 0) continue;
                        }

                        const zero = Math.round(value[l].value * 100) < 1 ? 0 : 1;
                        const normalizedValue = value[l].value * size;
                        let fillSize = zero;
                        if(normalizedValue >= 0.5)
                            fillSize = Math.ceil(normalizedValue);
                        if(isNaN(fillSize) || fillSize < zero) fillSize = zero;
                        
                        if(this.layout === 'vertical') {
                            const position = size - start - fillSize;
                            layer.set_position(0, position * this.scaleFactor);
                        }
                        else {
                            const position = start;
                            layer.set_position(position * this.scaleFactor, 0);
                        }

                        const color = fillSize === 0 ? 'transparent' : this.colors[value[l].color];
                        const style =
                            this.computeStyle(start, fillSize, size) + `background-color:${color};`;
                        layer.set_style(style);
                        start += fillSize;

                        if(!layer.visible) layer.visible = true;
                    }
                }
            } catch(e: any) {
                Utils.error(e);
            }
        }

        computeStyle(start: number, size: number, totalSize: number) {
            const border = this.mini ? '0.15em' : '0.2em';
            const bordersHelper = {
                topLeft: '0',
                topRight: '0',
                bottomRight: '0',
                bottomLeft: '0'
            };

            if(start === 0) {
                if(this.layout === 'vertical') {
                    bordersHelper.bottomLeft = border;
                    bordersHelper.bottomRight = border;
                } else {
                    bordersHelper.topLeft = border;
                    bordersHelper.bottomLeft = border;
                }
            }

            const roundedSize = (this.mini ? 3 : 4) * this.scaleFactor;
            if(totalSize - (start + size) <= roundedSize) {
                if(this.layout === 'vertical') {
                    bordersHelper.topLeft = border;
                    bordersHelper.topRight = border;
                } else {
                    bordersHelper.topRight = border;
                    bordersHelper.bottomRight = border;
                }
            }

            size = Math.max(size, 1);
            const style = `border-radius: ${bordersHelper.topLeft} ${bordersHelper.topRight} ${bordersHelper.bottomRight} ${bordersHelper.bottomLeft};`;
            if(this.layout === 'vertical')
                return `${style}height:${size}px;width:${this.barSize}em;`;
            return `${style}height:${this.barSize}em;width:${size}px;`;
        }

        computeBarSize(numBars: number, size: number) {
            if(numBars > 8)
                size *= 0.5; // Reduce bar by half when there are many bars
            else if(numBars > 2) size *= 0.75; // Reduce bar by 3/4 when there are a few bars
            return size;
        }

        destroy() {
            Config.clear(this);
            super.destroy();
        }
    }
);
