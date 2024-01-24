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
import Pango from 'gi://Pango';
import Clutter from 'gi://Clutter';

import * as PopupMenu from 'resource:///org/gnome/shell/ui/popupMenu.js';
import * as Main from 'resource:///org/gnome/shell/ui/main.js';

import { Header } from '../header.js';
import Config from '../config.js';
import Utils from '../utils/utils.js';
import {SensorsMenu} from './sensorsMenu.js';

export const SensorsHeader = GObject.registerClass({
    Properties: {
        
    },
}, class SensorsHeaderBase extends Header {
    constructor() {
        super('Sensors Header');
        
        this.buildIcon();
        this.buildValues();
        this.addOrReorderIndicators();
        
        const menu = new SensorsMenu(this, 0.5, St.Side.TOP);
        this.setMenu(menu);
        
        this.resetMaxWidths();
        
        Config.connect(this, 'changed::sensors-indicators-order', this.addOrReorderIndicators.bind(this));
        Config.bind('sensors-header-show', this, 'visible', Gio.SettingsBindFlags.GET);
        
        Config.connect(this, 'changed::visible', this.resetMaxWidths.bind(this));
        Config.connect(this, 'changed::sensors-header-sensor1-show', this.resetMaxWidths.bind(this));
        Config.connect(this, 'changed::sensors-header-sensor2-show', this.resetMaxWidths.bind(this));
        Config.connect(this, 'changed::headers-font-family', this.resetMaxWidths.bind(this));
        Config.connect(this, 'changed::headers-font-size', this.resetMaxWidths.bind(this));
    }
    
    addOrReorderIndicators() {
        const indicators = Utils.getIndicatorsOrder('sensors');
        
        let position = 0;
        for(const indicator of indicators) {
            let widget;
            switch(indicator) {
                case 'icon':
                    widget = this.icon;
                    break;
                case 'value':
                    widget = this.valuesContainer;
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
        
        if(!this.sensor1.get_stage())
            return;
        
        const sensor1w = this.sensor1.get_preferred_width(-1);
        let sensor2w = null;
        if(Config.get_boolean('sensors-header-sensor2-show'))
            this.sensor2.get_preferred_width(-1);
        this.fixContainerWidth(Math.max(sensor1w?sensor1w[1]:0, sensor2w?sensor2w[1]:0));
    }
    
    buildIcon() {
        const defaultStyle = 'margin-left:2px;margin-right:4px;';
        let iconSize = Config.get_int('sensors-header-icon-size');
        iconSize = Math.max(8, Math.min(30, iconSize));
        this.icon = new St.Icon({
            fallback_gicon: Utils.getLocalIcon('am-temperature-symbolic'),
            style: defaultStyle,
            icon_size: iconSize,
            y_expand: false,
            y_align: Clutter.ActorAlign.CENTER,
            x_align: Clutter.ActorAlign.CENTER,
        });
        
        const setIconName = () => {
            const iconCustom = Config.get_string('sensors-header-icon-custom');
            if(iconCustom)
                this.icon.icon_name = iconCustom;
            else
                this.icon.gicon = Utils.getLocalIcon('am-temperature-symbolic');
        };
        setIconName();
        
        const setIconColor = () => {
            const iconColor = Config.get_string('sensors-header-icon-color');
            if(iconColor)
                this.icon.style = defaultStyle + 'color:' + iconColor + ';';
            else
                this.icon.style = defaultStyle;
        };
        setIconColor();
        
        Config.bind('sensors-header-icon', this.icon, 'visible', Gio.SettingsBindFlags.GET);
        Config.bind('sensors-header-icon-size', this.icon, 'icon_size', Gio.SettingsBindFlags.GET);
        Config.connect(this.icon, 'changed::sensors-header-icon-custom', setIconName.bind(this));
        Config.connect(this.icon, 'changed::sensors-header-icon-color', setIconColor.bind(this));
    }
    
    buildValues() {
        this.valuesContainer = new St.BoxLayout({
            style_class: 'astra-monitor-header-sensors-values-container',
            x_align: Clutter.ActorAlign.CENTER,
            y_align: Clutter.ActorAlign.CENTER,
            x_expand: true,
            y_expand: true,
            vertical: true
        });
        
        this.sensor1 = new St.Label({
            text: '-',
            x_expand: true
        });
        this.sensor1.clutter_text.ellipsize = Pango.EllipsizeMode.NONE;
        this.sensor1.clutter_text.line_wrap = false;
        
        this.sensor2 = new St.Label({
            text: '-',
            style_class: 'astra-monitor-header-sensors-values-label',
            x_expand: true,
            y_align: Clutter.ActorAlign.END,
        });
        this.sensor2.clutter_text.ellipsize = Pango.EllipsizeMode.NONE;
        this.sensor2.clutter_text.line_wrap = false;
        
        const rebuild = () => {
            this.valuesContainer.remove_all_children();
            if(!Config.get_boolean('sensors-header-sensor1-show')) {
                this.valuesContainer.visible = false;
                return;
            }
            
            this.valuesContainer.visible = true;
            this.valuesContainer.add_child(this.sensor1);
            
            if(!Config.get_boolean('sensors-header-sensor2-show')) {
                this.sensor1.set_style_class_name('astra-monitor-header-sensors-value-label');
                this.sensor1.y_align = Clutter.ActorAlign.CENTER;
                return;
            }
                
            this.sensor1.set_style_class_name('astra-monitor-header-sensors-values-label');
            this.sensor1.y_align = Clutter.ActorAlign.START;
            this.valuesContainer.add_child(this.sensor2);
        };
        
        Config.connect(this.valuesContainer, 'changed::sensors-header-sensor1-show', rebuild);
        Config.connect(this.valuesContainer, 'changed::sensors-header-sensor2-show', rebuild);
        rebuild();
        
        Utils.sensorsMonitor.listen(this.valuesContainer, 'sensorsData', () => {
            if(!Config.get_boolean('sensors-header-sensor1-show') && !Config.get_boolean('sensors-header-sensor2-show'))
                return;
            
            const sensorsData = Utils.sensorsMonitor.getCurrentValue('sensorsData');
            if(!sensorsData) {
                this.sensor1.text = '-';
                this.sensor2.text = '-';
                return;
            }
            
            const sensor1Source = Config.get_json('sensors-header-sensor1');
            this.sensor1.text = this.applySource(sensorsData, sensor1Source);
            const sensor1w = this.sensor1.get_preferred_width(-1);
            
            if(Config.get_boolean('sensors-header-sensor2-show')) {
                const sensor2Source = Config.get_json('sensors-header-sensor2');
                this.sensor2.text = this.applySource(sensorsData, sensor2Source);
                const sensor2w = this.sensor2.get_preferred_width(-1);
                this.fixContainerWidth(Math.max(sensor1w?sensor1w[1]:0, sensor2w?sensor2w[1]:0));
            }
            else {
                this.fixContainerWidth(sensor1w?sensor1w[1]:0);
            }
        });
    }
    
    applySource(sensorsData, sensorSource) {
        if(!sensorSource || !sensorSource.service || !sensorsData[sensorSource.service])
            return '-';
        
        let data = sensorsData[sensorSource.service];
        let step;
        for(step of sensorSource.path) {
            if(!data[step])
                return '-';
            data = data[step];
        }
        
        let value;
        let unit;
        
        if(data.value && data.unit) {
            value = data.value;
            unit = data.unit;
        }
        else {
            value = data;
            unit = Utils.inferMeasurementUnit(step);
        }
        
        if(unit) {
            if(unit === '°C' && Config.get_string('sensors-temperature-unit') === 'fahrenheit') {
                value = Utils.celsiusToFahrenheit(value)
                unit = '°F';
            }
            if(!Utils.isIntOrIntString(value) && Utils.isNumeric(value))
                value = value.toFixed(1);
            return value + ' ' + unit;
        }
        if(!Utils.isIntOrIntString(value) && Utils.isNumeric(value))
            value = value.toFixed(1);
        return value;
    }
    
    fixContainerWidth(width) {
        if(!this.valuesContainer.get_stage())
            return;
        this.maxWidths.push(width);
        
        if(this.maxWidths.length > Utils.sensorsMonitor.updateFrequency * 10)
            this.maxWidths.shift();
        
        const max = Math.max(...this.maxWidths);
        
        if(max === this.valuesContainer.width)
            return;
        this.valuesContainer.set_width(max);
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
        
        Config.connect(this.tooltipMenu, 'changed::sensors-header-tooltip', () => {
            if(!Config.get_boolean('sensors-header-tooltip'))
                this.tooltipMenu.close();
        });
        
        Utils.sensorsMonitor.listen(this.tooltipMenu, 'sensorsData', () => {
            if(!Config.get_boolean('sensors-header-tooltip'))
                return;
            
            const sensorsData = Utils.sensorsMonitor.getCurrentValue('sensorsData');
            if(!sensorsData) {
                this.tooltipItem.label.text = '- | -';
                return;
            }
            
            const sensor1Source = Config.get_json('sensors-header-sensor1');
            const sensor1 = this.applySource(sensorsData, sensor1Source);
            
            if(Config.get_boolean('sensors-header-sensor2-show')) {
                const sensor2Source = Config.get_json('sensors-header-sensor2');
                const sensor2 = this.applySource(sensorsData, sensor2Source);
                this.tooltipItem.label.text = `${sensor1} | ${sensor2}`;
            }
            else {
                this.tooltipItem.label.text = sensor1;
            }
            
            const width = this.tooltipItem.get_preferred_width(-1)[1] + 30;
            this.tooltipMenu.actor.set_width(width);
        });
    }
    
    showTooltip() {
        if(!this.tooltipMenu)
            return;
        if(!Config.get_boolean('sensors-header-tooltip'))
            return;
        
        this.tooltipMenu.open();
    }
    
    hideTooltip() {
        if(!this.tooltipMenu)
            return;
        if(!Config.get_boolean('sensors-header-tooltip'))
            return;
        this.tooltipMenu.close();
    }
    
    destroy() {
        Config.clear(this);
        Utils.sensorsMonitor.unlisten(this);
        
        Config.clear(this.icon);
        
        if(this.valuesContainer) {
            Config.clear(this.valuesContainer);
            Utils.sensorsMonitor.unlisten(this.valuesContainer);
        }
        if(this.tooltipMenu) {
            Config.clear(this.tooltipMenu);
            Utils.sensorsMonitor.unlisten(this.tooltipMenu);
            this.tooltipMenu.close();
        }

        super.destroy();
    }
});
    