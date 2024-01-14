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
import Pango from 'gi://Pango';
import Clutter from 'gi://Clutter';

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
        
        const menu = new SensorsMenu(this, 0.5, St.Side.TOP);
        this.setMenu(menu);
        
        this.resetMaxWidths();
        
        Config.bind('sensors-header-show', this, 'visible', Gio.SettingsBindFlags.GET);
        
        Config.connect(this, 'changed::visible', this.resetMaxWidths.bind(this));
        Config.connect(this, 'changed::sensors-header-sensor1-show', this.resetMaxWidths.bind(this));
        Config.connect(this, 'changed::sensors-header-sensor2-show', this.resetMaxWidths.bind(this));
    }
    
    resetMaxWidths() {
        this.maxWidths = [];
        
        if(!this.sensor1.get_stage())
            return;
        
        if(Config.get_boolean('sensors-header-sensor2-show'))
            this.fixContainerWidth(Math.max(this.sensor1.get_width(), this.sensor2.get_width()));
        else
            this.fixContainerWidth(this.sensor1.get_width());
    }
    
    buildIcon() {
        let iconSize = Config.get_int('storage-header-icon-size');
        iconSize = Math.max(8, Math.min(30, iconSize));
        this.icon = new St.Icon({
            gicon: Utils.getLocalIcon('am-temperature-symbolic'),
            fallback_icon_name: 'temperature-symbolic',
            style: 'margin-left:2px;margin-right:4px;',
            icon_size: iconSize,
            y_expand: false,
            y_align: Clutter.ActorAlign.CENTER,
        });
        this.insert_child_at_index(this.icon, 0);
        Config.bind('sensors-header-icon', this.icon, 'visible', Gio.SettingsBindFlags.GET);
        Config.bind('sensors-header-icon-size', this.icon, 'icon_size', Gio.SettingsBindFlags.GET);
    }
    
    buildValues() {
        this.valuesContainer = new St.BoxLayout({
            style_class: 'astra-monitor-header-sensors-values-container',
            x_align: Clutter.ActorAlign.CENTER,
            y_align: Clutter.ActorAlign.CENTER,
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
        
        this.insert_child_at_index(this.valuesContainer, 1);
        
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
            
            if(Config.get_boolean('sensors-header-sensor2-show')) {
                const sensor2Source = Config.get_json('sensors-header-sensor2');
                this.sensor2.text = this.applySource(sensorsData, sensor2Source);
                this.fixContainerWidth(Math.max(this.sensor1.get_width(), this.sensor2.get_width()));
            }
            else {
                this.fixContainerWidth(this.sensor1.get_width());
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
    
    destroy() {
        Config.clear(this);
        Config.clear(this.icon);
        Config.clear(this.valuesContainer);
        
        Utils.sensorsMonitor.unlisten(this);
        Utils.sensorsMonitor.unlisten(this.valuesContainer, 'sensorsData');

        super.destroy();
    }
});
    