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

import St from 'gi://St';
import Clutter from 'gi://Clutter';

import {gettext as _} from 'resource:///org/gnome/shell/extensions/extension.js';
import {MenuBase} from '../menu.js';
import { Grid } from '../grid.js';
import Utils from '../utils/utils.js';
import Config from '../config.js';

export class SensorsMenu extends MenuBase {
    constructor(sourceActor, arrowAlignment, arrowSide) {
        super(sourceActor, arrowAlignment, arrowSide);
        
        this.createSensorsList();
        this.addUtilityButtons('sensors');
    }
    
    createSensorsList() {
        if(this.sensorsSection === undefined) {
            this.sensorsSectionLabel = this.addMenuSection(_('Sensors'), 'centered');
            
            this.sensorsSection = new Grid({ styleClass: 'astra-monitor-menu-subgrid' });
            this.noSensorsLabel = new St.Label({
                text: _('No sensor found'),
                style_class: 'astra-monitor-menu-label-warning',
                style: 'font-style:italic;',
                x_expand: true
            });
            this.sensorsSection.addToGrid(this.noSensorsLabel, 2);
            this.sensors = new Map();
            this.addToMenu(this.sensorsSection, 2);
        }
    }
    
    updateSensorsList(sensors) {
        if(sensors.size > 0)
            this.noSensorsLabel.hide();
        else
            this.noSensorsLabel.show();
        
        // remove all sensors that are not present anymore
        for(const [id, sensor] of this.sensors.entries()) {
            if(!sensors.has(id)) {
                this.sensorsSection.remove_child(sensor.container);
                this.sensors.delete(id);
            }
        }
        
        // add new sensors / update existing sensors
        const idList = Array.from(sensors.keys());
        
        for(const id of idList) {
            const sensorData = sensors.get(id);
            
            let sensor;
            if(!this.sensors.has(id)) {
                let valueTree = new Map();
                for(const category in sensorData) {
                    if(category === 'Adapter' || category === 'name')
                        continue;
                    
                    const valuesIds = [];
                    for(const value in sensorData[category])
                        valuesIds.push(value);
                    valueTree.set(category, valuesIds);
                }
                
                sensor = this.createSensor(valueTree);
                this.sensorsSection.addToGrid(sensor.container, 2);
                this.sensors.set(id, sensor);
            }
            else {
                sensor = this.sensors.get(id);
            }
            
            //Update sensor info
            try {
                this.updateSensor(sensor, sensorData);
            }
            catch(e) {
                Utils.error(e);
            }
        }
    }
    
    /**
     * @param {Map<string[]>} valueTree 
     * @returns 
     */
    createSensor(valueTree) {
        const defaultStyle = 'padding-top:0.25em;margin-bottom:0.25em;';
        const container = new St.Button({
            reactive: true,
            track_hover: true,
            x_expand: true,
            style: defaultStyle
        });
        
        const grid = new Grid({
            x_expand: true,
            styleClass: 'astra-monitor-menu-subgrid'
        });
        container.add_actor(grid);
        
        const name = new St.Label({
            text: '',
            style_class: 'astra-monitor-menu-sensors-name',
            x_expand: true
        });
        grid.addToGrid(name, 2);
        
        const adapter = new St.Label({
            text: '',
            style_class: 'astra-monitor-menu-sensors-adapter',
            x_expand: true
        });
        grid.addToGrid(adapter, 2);
        
        //Pop-up menu
        //{
            const popup = new MenuBase(container, 0.05, St.Side.RIGHT);
            
            const popupGrid = new Grid({
                numCols: 2,
                styleClass: 'astra-monitor-menu-subgrid',
                x_expand: true,
            });
            
            const categories = new Map();
            
            for(const [categoryName, category] of valueTree.entries()) {
                const categoryGrid = new Grid({
                    numCols: 3,
                    styleClass: 'astra-monitor-menu-subgrid',
                    x_expand: true,
                });
                 
                const categoryLabel = new St.Label({
                    text: '',
                    style_class: 'astra-monitor-menu-sensors-category',
                    x_expand: true,
                });
                categoryGrid.addToGrid(categoryLabel, 3);
                
                const values = new Map();
                for(const valueId of category) {
                    //Icon
                    const icon = new St.Icon({
                        style_class: 'astra-monitor-menu-icon-mini',
                        content_gravity: Clutter.ContentGravity.CENTER,
                    });
                    categoryGrid.addToGrid(icon);
                    
                    //Name
                    const name = new St.Label({
                        text: '',
                        style_class: 'astra-monitor-menu-sensors-label',
                        x_expand: true,
                    });
                    categoryGrid.addToGrid(name);
                    
                    //Value
                    const value = new St.Label({
                        text: '-',
                        style_class: 'astra-monitor-menu-sensors-key',
                        x_expand: true,
                    });
                    categoryGrid.addToGrid(value);
                    
                    values.set(valueId, { icon, name, value });
                }
                popupGrid.addToGrid(categoryGrid, 2);
                
                categories.set(categoryName, { categoryLabel, values });
            }
            popup.addToMenu(popupGrid, 2);
        //}
        
        container.connect('enter-event', () => {
            container.style = defaultStyle + this.selectionStyle;
            
            popup.open(true);
        });
        
        container.connect('leave-event', () => {
            container.style = defaultStyle;
            
            popup.close(true);
        });
        
        return {
            data: null,
            container,
            name,
            adapter,
            popup,
            categories
        };
    }
    
    updateSensor(sensor, sensorData) {
        sensor.data = sensorData;
        
        sensor.name.text = sensorData.name;
        if(sensorData.Adapter)
            sensor.adapter.text = `[${sensorData.Adapter}]`;
        else
            sensor.adapter.text = '';
        
        for(const categoryName in sensorData) {
            if(categoryName === 'Adapter' || categoryName === 'name')
                continue;
            
            const categoryData = sensor.categories.get(categoryName);
            
            categoryData.categoryLabel.text = Utils.sensorsNameFormat(categoryName);
            
            for(const valueName in sensorData[categoryName]) {
                if(!categoryData.values.has(valueName))
                    continue;
                
                const value = categoryData.values.get(valueName);
                if(value) {
                    value.name.text = Utils.sensorsNameFormat(valueName);
                    
                    let unit = Utils.inferMeasurementUnit(valueName);
                    
                    const icon = {
                        fallback_icon_name: 'am-am-dialog-info-symbolic',
                    };
                    if(unit === '°C') {
                        icon.gicon = Utils.getLocalIcon('am-temperature-symbolic');
                        icon.fallback_icon_name = 'temperature-symbolic';
                    }
                    else if(unit === 'RPM') {
                        icon.gicon = Utils.getLocalIcon('am-fan-symbolic');
                        icon.fallback_icon_name = 'fan-symbolic';
                    }
                    else if(unit === 'V') {
                        icon.gicon = Utils.getLocalIcon('am-voltage-symbolic');
                        icon.fallback_icon_name = 'battery-symbolic';
                    }
                    else if(unit === 'W') {
                        icon.gicon = Utils.getLocalIcon('am-power-symbolic');
                        icon.fallback_icon_name = 'plug-symbolic';
                    }
                    else if(unit === 'A') {
                        icon.gicon = Utils.getLocalIcon('am-current-symbolic');
                        icon.fallback_icon_name = 'battery-symbolic';
                    }
                    else if(unit === 'J') {
                        icon.gicon = Utils.getLocalIcon('am-power-symbolic');
                        icon.fallback_icon_name = 'battery-symbolic';
                    }
                    
                    if(icon.gicon)
                        value.icon.gicon = icon.gicon;
                    value.icon.fallback_icon_name = icon.fallback_icon_name;
                    
                    let numericValue = sensorData[categoryName][valueName];
                    
                    if(unit === '°C') {
                        if(Config.get_string('sensors-temperature-unit') === 'fahrenheit') {
                            numericValue = Utils.celsiusToFahrenheit(value)
                            unit = '°F';
                        }
                        numericValue = numericValue.toFixed(1);
                    }
                    else if(unit === 'W') {
                        numericValue = numericValue.toFixed(1);
                        unit = ' ' + unit;
                    }
                    else if(unit === 'V') {
                        numericValue = numericValue.toFixed(2);
                        unit = ' ' + unit;
                    }
                    else if(unit === 'RPM') {
                        unit = ' ' + unit;
                    }
                    
                    value.value.text = numericValue + unit;
                    
                }
            }
        }
    }
    
    onOpen() {
        Utils.sensorsMonitor.listen(this, 'sensorsData', this.update.bind(this, 'sensorsData'));
        Utils.sensorsMonitor.requestUpdate('sensorsData');
    }
    
    onClose() {
        Utils.sensorsMonitor.unlisten(this, 'sensorsData');
    }
    
    update(code) {
        if(code === 'sensorsData') {
            const sensorsData = Utils.sensorsMonitor.getCurrentValue('sensorsData');
            if(sensorsData) {
                const sensorsList = new Map();
                
                //list all by "sensors" provider
                if(sensorsData.sensors) {
                    for(const sensorName in sensorsData.sensors) {
                        const sensorData = sensorsData.sensors[sensorName];
                        sensorData.name = sensorName;
                        
                        sensorsList.set('sensors/' + sensorName, sensorData);
                    }
                }
                
                this.updateSensorsList(sensorsList);
            }
            return;
        }
    }
    
    destroy() {
        this.close(true);
        this.removeAll();
        
        super.destroy();
    }
};
