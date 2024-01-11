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
        
        this.maxWidths = [];
        
        Config.bind('sensors-header-show', this, 'visible', Gio.SettingsBindFlags.GET);
    }
    
    buildIcon() {
        //TODO: icon should be a setting
        this.icon = new St.Icon({
            gicon: Utils.getLocalIcon('temperature-symbolic'),
            fallback_icon_name: 'temperature-symbolic',
            style_class: 'system-status-icon astra-monitor-header-icon',
        });
        this.insert_child_at_index(this.icon, 0);
        Config.bind('sensors-header-icon', this.icon, 'visible', Gio.SettingsBindFlags.GET);
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
            }
            
            this.fixContainerWidth(Math.max(this.sensor1.width, this.sensor2.width));
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
        
        if(this.maxWidths.length > 60)
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
    