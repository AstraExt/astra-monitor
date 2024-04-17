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

import St from 'gi://St';
import Clutter from 'gi://Clutter';

import { gettext as _, ngettext } from 'resource:///org/gnome/shell/extensions/extension.js';
import MenuBase from '../menu.js';
import Grid from '../grid.js';
import Utils from '../utils/utils.js';
import Config from '../config.js';
import { SensorNode } from './sensorsMonitor.js';

type SensorInfo = {
    data: any;
    container: St.Button;
    name: St.Label;
    adapter: St.Label;
    popup: MenuBase;
    categories: Map<
        string,
        {
            categoryLabel: St.Label;
            values: Map<
                string,
                {
                    icon: St.Icon;
                    name: St.Label;
                    value: St.Label;
                }
            >;
        }
    >;
};

export default class SensorsMenu extends MenuBase {
    /*private sensorsSectionLabel!: St.Label;*/

    private sensorsSection!: InstanceType<typeof Grid>;
    private noSensorsLabel!: St.Label;

    private sensors!: Map<string, SensorInfo>;

    constructor(sourceActor: St.Widget, arrowAlignment: number, arrowSide: St.Side) {
        super(sourceActor, arrowAlignment, { name: 'Sensors Menu', arrowSide });

        this.createSensorsList();
        this.addUtilityButtons('sensors');
    }

    createSensorsList() {
        if(this.sensorsSection === undefined) {
            /*this.sensorsSectionLabel = */ this.addMenuSection(_('Sensors'));

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

    updateSensorsList(sensors: Map<string, SensorNode>) {
        if(sensors.size > 0) this.noSensorsLabel.hide();
        else this.noSensorsLabel.show();

        // remove all sensors that are not present anymore
        for(const [id, sensor] of this.sensors.entries()) {
            if(!sensors.has(id)) {
                this.sensorsSection.remove_child(sensor.container);
                this.sensors.delete(id);
            }
        }

        // add new sensors / update existing sensors
        const idList: string[] = Array.from(sensors.keys());

        for(const id of idList) {
            const sensorData = sensors.get(id);
            if(!sensorData) continue;

            let sensor;
            if(!this.sensors.has(id)) {
                const valueTree = new Map();
                for(const [categoryName, categories] of sensorData.children.entries()) {
                    const valuesIds = [];
                    for(const value of categories.children.keys()) valuesIds.push(value);
                    valueTree.set(categoryName, valuesIds);
                }

                sensor = this.createSensor(valueTree);
                this.sensorsSection.addToGrid(sensor.container, 2);
                this.sensors.set(id, sensor);
            } else {
                sensor = this.sensors.get(id);
            }

            if(!sensor) continue;

            //Update sensor info
            try {
                this.updateSensor(sensor, sensorData);
            } catch(e: any) {
                Utils.error(e);
            }
        }
    }

    createSensor(valueTree: Map<string, string[]>): SensorInfo {
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
        container.set_child(grid);

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
        const popup = new MenuBase(container, 0.05);

        const valueTreeExtimatedHeight = Utils.valueTreeExtimatedHeight(valueTree);
        const actorBox = popup.box.get_allocation_box();
        const monitorSize = MenuBase.getMonitorSize(actorBox);

        let cols = 1;
        if(valueTreeExtimatedHeight > monitorSize.height * 0.8) cols = 2;

        const popupGrid = new Grid({
            numCols: cols * 2,
            styleClass: 'astra-monitor-menu-subgrid',
            x_expand: true
        });

        const categories = new Map();

        let num = 0;
        for(const [categoryName, category] of valueTree.entries()) {
            let style = '';
            if(cols === 2) {
                if(num % 2 === 0) style = 'margin-right:1em;';
            }

            const categoryGrid = new Grid({
                numCols: 3,
                styleClass: 'astra-monitor-menu-subgrid',
                style: style,
                x_expand: true
            });

            const categoryLabel = new St.Label({
                text: '',
                style_class: 'astra-monitor-menu-sensors-category',
                x_expand: true
            });
            categoryGrid.addToGrid(categoryLabel, 3);

            const values = new Map();
            for(const valueId of category) {
                //Icon
                const icon = new St.Icon({
                    style_class: 'astra-monitor-menu-sensors-icon',
                    content_gravity: Clutter.ContentGravity.CENTER
                });
                categoryGrid.addToGrid(icon);

                //Name
                const name = new St.Label({
                    text: '',
                    style_class: 'astra-monitor-menu-sensors-label',
                    x_expand: true
                });
                categoryGrid.addToGrid(name);

                //Value
                const value = new St.Label({
                    text: '-',
                    style_class: 'astra-monitor-menu-sensors-key',
                    x_expand: true
                });
                categoryGrid.addToGrid(value);

                values.set(valueId, { icon, name, value });
                num++;
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

    updateSensor(sensor: SensorInfo, sensorData: SensorNode) {
        sensor.data = sensorData;
        sensor.name.text = sensorData.name;

        if(sensorData.attrs.adapter) {
            sensor.adapter.text = `[${sensorData.attrs.adapter}]`;
        } else {
            const count = (node: SensorNode) => {
                if(node.children.size === 0) return 1;

                let num = 0;
                for(const child of node.children.values()) num += count(child);
                return num;
            };

            const numSensors = count(sensorData);
            sensor.adapter.text = `[${ngettext('%d sensor', '%d sensors', numSensors).format(numSensors)}]`;
        }

        for(const [categoryName, category] of sensorData.children.entries()) {
            const categoryData = sensor.categories.get(categoryName);
            if(!categoryData) continue;

            categoryData.categoryLabel.text = Utils.sensorsNameFormat(categoryName);

            for(const [valueName, value] of category.children.entries()) {
                if(!categoryData.values.has(valueName)) continue;

                const valueData = categoryData.values.get(valueName);
                if(valueData) {
                    let prepend = '';
                    if(value.attrs.type && !valueName.includes(value.attrs.type))
                        prepend = value.attrs.type + ' ';

                    valueData.name.text = Utils.sensorsNameFormat(prepend + valueName);

                    let unit: string;
                    if(value.attrs.unit !== undefined) unit = value.attrs.unit;
                    else unit = Utils.inferMeasurementUnit(valueName);

                    const icon = Utils.unitToIcon(unit);
                    if(icon.gicon) valueData.icon.gicon = icon.gicon;
                    valueData.icon.fallback_icon_name = icon.fallback_icon_name;

                    let numericValue = value.attrs.value;
                    if(numericValue === undefined) numericValue = 0;

                    let strValue = numericValue + '';
                    if(unit === '°C') {
                        if(Config.get_string('sensors-temperature-unit') === 'fahrenheit') {
                            numericValue = Utils.celsiusToFahrenheit(numericValue);
                            unit = '°F';
                        }
                        strValue = numericValue.toFixed(1);
                    } else if(unit === 'W') {
                        strValue = numericValue.toFixed(1);
                        unit = ' ' + unit;
                    } else if(unit === 'V') {
                        strValue = numericValue.toFixed(2);
                        unit = ' ' + unit;
                    } else if(unit === 'RPM') {
                        strValue = numericValue.toFixed(0);
                        unit = ' ' + unit;
                    }

                    valueData.value.text = strValue + unit;
                }
            }
        }
    }

    async onOpen() {
        Utils.sensorsMonitor.listen(this, 'sensorsDataAll', () => {});

        Utils.sensorsMonitor.listen(this, 'sensorsData', this.update.bind(this, 'sensorsData'));
        Utils.sensorsMonitor.requestUpdate('sensorsData');
    }

    async onClose() {
        Utils.sensorsMonitor.unlisten(this, 'sensorsDataAll');
        Utils.sensorsMonitor.unlisten(this, 'sensorsData');
    }

    update(code: string) {
        if(code === 'sensorsData') {
            const sensorsData = Utils.sensorsMonitor.getCurrentValue('sensorsData');
            if(sensorsData) {
                const sensorsList: Map<string, SensorNode> = new Map();

                //list all by "lm-sensors" provider
                if(
                    sensorsData.lm_sensors &&
                    Utils.sensorsMonitor.sensorsSourceSetting === 'lm-sensors'
                ) {
                    for(const [
                        sensorName,
                        sensorData
                    ] of sensorsData.lm_sensors.children.entries()) {
                        sensorsList.set('sensors/' + sensorName, sensorData);
                    }
                }

                //list all by "hwmon" provider
                if(
                    sensorsData.hwmon &&
                    Utils.sensorsMonitor.sensorsSourceSetting !== 'lm-sensors'
                ) {
                    for(const [sensorName, sensorData] of sensorsData.hwmon.children.entries()) {
                        sensorsList.set('hwmon/' + sensorName, sensorData);
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
}
