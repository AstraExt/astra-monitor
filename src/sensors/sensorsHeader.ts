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
import Gio from 'gi://Gio';
import St from 'gi://St';
import Pango from 'gi://Pango';
import Clutter from 'gi://Clutter';

import * as PopupMenu from 'resource:///org/gnome/shell/ui/popupMenu.js';
import * as Main from 'resource:///org/gnome/shell/ui/main.js';

import Header from '../header.js';
import Config from '../config.js';
import Utils from '../utils/utils.js';
import SensorsMenu from './sensorsMenu.js';
import { SensorsData } from './sensorsMonitor.js';
import MenuBase from '../menu.js';

type TooltipMenu = PopupMenu.PopupMenu & {
    actor: St.Widget;
};

type TooltipItem = PopupMenu.PopupMenuItem & {
    label: St.Label;
};

type SensorSource = {
    service: string;
    path: string[];
};

export default GObject.registerClass(
    class SensorsHeader extends Header {
        private icon!: St.Icon;
        private valuesContainer!: St.BoxLayout;
        private sensors!: St.Label;
        private sensorsNum: number = 1;
        private sensorsLayout!: string;

        private maxWidths: number[] = [];

        protected tooltipMenu!: TooltipMenu;
        protected tooltipItem!: TooltipItem;

        constructor() {
            super('Sensors Header');

            this.buildIcon();
            this.buildValues();
            this.addOrReorderIndicators();

            const menu = new SensorsMenu(this, 0.5, MenuBase.arrowAlignement);
            this.setMenu(menu);

            this.resetMaxWidths();

            Config.connect(
                this,
                'changed::sensors-indicators-order',
                this.addOrReorderIndicators.bind(this)
            );
            Config.bind('sensors-header-show', this, 'visible', Gio.SettingsBindFlags.GET);

            Config.connect(this, 'changed::visible', this.resetMaxWidths.bind(this));
            Config.connect(
                this,
                'changed::sensors-header-sensor1-show',
                this.resetMaxWidths.bind(this)
            );
            Config.connect(
                this,
                'changed::sensors-header-sensor2-show',
                this.resetMaxWidths.bind(this)
            );
            Config.connect(this, 'changed::headers-font-family', this.resetMaxWidths.bind(this));
            Config.connect(this, 'changed::headers-font-size', this.resetMaxWidths.bind(this));

            const updateSensorsLayout = () => {
                this.sensorsLayout =
                    Config.get_string('sensors-header-sensor2-layout') || 'vertical';
                this.sensors.text = '';
                this.resetMaxWidths();
            };
            Config.connect(
                this,
                'changed::sensors-header-sensor2-layout',
                updateSensorsLayout.bind(this)
            );
            updateSensorsLayout();
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
                    if(widget.get_parent()) this.remove_child(widget);
                    this.insert_child_at_index(widget, position++);
                }
            }
        }

        resetMaxWidths() {
            this.maxWidths = [];

            if(!this.sensors.get_stage()) return;

            this.fixContainerStyle();
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
                if(iconCustom) this.icon.icon_name = iconCustom;
                // @ts-expect-error gicon shouldn't be null, but we do have a fallback icon
                else this.icon.gicon = Utils.getLocalIcon('am-temperature-symbolic');
            };
            setIconName();

            const setIconColor = () => {
                const iconColor = Config.get_string('sensors-header-icon-color');
                if(iconColor) this.icon.style = defaultStyle + 'color:' + iconColor + ';';
                else this.icon.style = defaultStyle;
            };
            setIconColor();

            Config.bind('sensors-header-icon', this.icon, 'visible', Gio.SettingsBindFlags.GET);
            Config.bind(
                'sensors-header-icon-size',
                this.icon,
                'icon_size',
                Gio.SettingsBindFlags.GET
            );
            Config.connect(
                this.icon,
                'changed::sensors-header-icon-custom',
                setIconName.bind(this)
            );
            Config.connect(
                this.icon,
                'changed::sensors-header-icon-color',
                setIconColor.bind(this)
            );
        }

        buildValues() {
            this.valuesContainer = new St.BoxLayout({
                x_align: Clutter.ActorAlign.START,
                y_align: Clutter.ActorAlign.FILL,
                y_expand: true,
                vertical: true,
                width: 1,
            });

            this.sensors = new St.Label({
                text: '',
                style_class: 'astra-monitor-header-sensors-values-label',
                style: 'font-size: 0.65em;',
                y_align: Clutter.ActorAlign.CENTER,
                x_align: Clutter.ActorAlign.END,
                x_expand: true,
                y_expand: true,
            });
            this.sensors.clutter_text.ellipsize = Pango.EllipsizeMode.NONE;
            this.sensors.clutter_text.line_wrap = false;
            this.valuesContainer.add_child(this.sensors);

            Config.bind(
                'sensors-header-sensor1-show',
                this.valuesContainer,
                'visible',
                Gio.SettingsBindFlags.GET
            );

            Utils.sensorsMonitor.listen(this.valuesContainer, 'sensorsData', () => {
                if(
                    !Config.get_boolean('sensors-header-sensor1-show') &&
                    !Config.get_boolean('sensors-header-sensor2-show')
                )
                    return;

                let sensor1 = '-';
                let sensor2 = '-';

                const sensorsData = Utils.sensorsMonitor.getCurrentValue('sensorsData');
                if(sensorsData) {
                    const sensor1Source = Config.get_json('sensors-header-sensor1');
                    const sensor1Digits = Config.get_int('sensors-header-sensor1-digits');
                    sensor1 = this.applySource(sensorsData, sensor1Source, sensor1Digits);

                    if(Config.get_boolean('sensors-header-sensor2-show')) {
                        const sensor2Source = Config.get_json('sensors-header-sensor2');
                        const sensor2Digits = Config.get_int('sensors-header-sensor2-digits');
                        sensor2 = this.applySource(sensorsData, sensor2Source, sensor2Digits);
                    } else {
                        sensor2 = '';
                    }
                }

                if(sensor2) {
                    this.sensorsNum = 2;

                    if(this.sensorsLayout === 'horizontal')
                        this.sensors.text = `${sensor1} | ${sensor2}`;
                    else this.sensors.text = `${sensor1}\n${sensor2}`;
                } else {
                    this.sensorsNum = 1;
                    this.sensors.text = sensor1;
                }
                this.fixContainerStyle();
            });
        }

        applySource(
            sensorsData: SensorsData,
            sensorSource: SensorSource,
            sensorDigits: number = -1
        ): string {
            if(!sensorSource || !sensorSource.service) return '-';

            let service = sensorSource.service;
            if(service === 'sensors') service = 'lm_sensors';

            if(!sensorsData[service as keyof SensorsData]) return '-';

            let node = sensorsData[service as keyof SensorsData];

            let step;
            for(step of sensorSource.path) {
                if(!node) return '-';

                const tmp = node.children.get(step);
                if(!tmp) return '-';
                node = tmp;
            }

            if(!node) return '-';

            let value;
            let unit;

            if(!node.attrs.value) return '-';
            value = node.attrs.value;

            if(node.attrs.unit) unit = node.attrs.unit;
            else unit = Utils.inferMeasurementUnit(step || '');

            if(unit) {
                if(
                    unit === '°C' &&
                    Config.get_string('sensors-temperature-unit') === 'fahrenheit'
                ) {
                    value = Utils.celsiusToFahrenheit(value);
                    unit = '°F';
                }

                if(Utils.isNumeric(value)) {
                    if(sensorDigits >= 0) value = value.toFixed(sensorDigits);
                    else if(!Utils.isIntOrIntString(value)) value = value.toFixed(1);
                }
                return value + ' ' + unit;
            }
            if(!Utils.isIntOrIntString(value) && Utils.isNumeric(value)) value = value.toFixed(1);
            return value as string;
        }

        fixContainerStyle() {
            if(!this.valuesContainer.get_parent()) return;
            if(!this.sensors.get_parent()) return;

            const calculateStyle = () => {
                if(this.sensorsNum === 1 || this.sensorsLayout === 'horizontal')
                    return 'font-size:1em;';
                const superHeight = this.valuesContainer.get_parent()?.height ?? 0;
                let scaledHeight = superHeight / this.scaleFactor;
                if(scaledHeight <= 20) return 'font-size:0.65em;';
                scaledHeight = Math.round(scaledHeight / 3);

                const fontSize = Config.get_int('headers-font-size');
                if(fontSize && fontSize < scaledHeight) return `font-size:${fontSize}px;`;
                return `font-size:${scaledHeight}px;`;
            };
            const style = calculateStyle();

            if(this.sensors.style !== style) {
                this.sensors.style = style;
                this.sensors.queue_relayout();
                this.valuesContainer.queue_relayout();
            }

            const sensorsWidth = this.sensors.get_preferred_width(-1);
            const width = sensorsWidth ? sensorsWidth[1] : 0;

            this.maxWidths.push(width);

            if(this.maxWidths.length > Utils.sensorsMonitor.updateFrequency * 10)
                this.maxWidths.shift();

            const max = Math.max(...this.maxWidths);

            if(max === this.valuesContainer.width) return;
            this.valuesContainer.set_width(max);
        }

        update() {}

        createTooltip() {
            this.tooltipMenu = new PopupMenu.PopupMenu(this, 0.5, St.Side.TOP) as TooltipMenu;

            Main.uiGroup.add_child(this.tooltipMenu.actor);
            this.tooltipMenu.actor.add_style_class_name('astra-monitor-tooltip-menu');
            this.tooltipMenu.actor.x_expand = true;
            this.tooltipMenu.actor.hide();

            this.tooltipItem = new PopupMenu.PopupMenuItem('', {
                reactive: true,
                style_class: 'astra-monitor-tooltip-item',
            }) as TooltipItem;
            this.tooltipItem.actor.x_expand = true;
            this.tooltipItem.actor.x_align = Clutter.ActorAlign.CENTER;
            this.tooltipItem.sensitive = true;
            this.tooltipMenu.addMenuItem(this.tooltipItem);

            Config.connect(this.tooltipMenu, 'changed::sensors-header-tooltip', () => {
                if(!Config.get_boolean('sensors-header-tooltip')) this.tooltipMenu.close(true);
            });

            Utils.sensorsMonitor.listen(this.tooltipMenu, 'sensorsData', () => {
                if(!Config.get_boolean('sensors-header-tooltip')) return;

                const values: string[] = [];

                const sensorsData = Utils.sensorsMonitor.getCurrentValue('sensorsData');
                if(sensorsData) {
                    for(let sensorNum = 1; sensorNum <= 5; sensorNum++) {
                        const sensorSource = Config.get_json(
                            `sensors-header-tooltip-sensor${sensorNum}`
                        );
                        if(!sensorSource) continue;

                        const sensorName = Config.get_string(
                            `sensors-header-tooltip-sensor${sensorNum}-name`
                        );
                        const sensorDigits = Config.get_int(
                            `sensors-header-tooltip-sensor${sensorNum}-digits`
                        );

                        const text = this.applySource(sensorsData, sensorSource, sensorDigits);
                        if(!text || text === '-') continue;

                        if(sensorName) values.push(sensorName + ': ' + text);
                        else values.push(text);
                    }
                }

                if(values.length === 0) values.push('-');

                this.tooltipItem.label.text = values.join(' | ');
                const width = this.tooltipItem.get_preferred_width(-1)[1] + 30;
                this.tooltipMenu.actor.set_width(width);
            });
        }

        showTooltip() {
            if(!this.tooltipMenu) return;
            if(!Config.get_boolean('sensors-header-tooltip')) return;

            this.tooltipMenu.open(false);
        }

        hideTooltip() {
            if(!this.tooltipMenu) return;
            if(!Config.get_boolean('sensors-header-tooltip')) return;
            this.tooltipMenu.close(false);
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
                this.tooltipMenu.close(false);
            }

            super.destroy();
        }
    }
);
