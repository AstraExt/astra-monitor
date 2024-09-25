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

import Config from '../config.js';
import Utils from '../utils/utils.js';
import Monitor from '../monitor.js';
import CancellableTaskManager from '../utils/cancellableTaskManager.js';
import PromiseValueHolder, { PromiseValueHolderStore } from '../utils/promiseValueHolder.js';

export type SensorNode = {
    name: string;
    children: Map<string, SensorNode>;
    attrs: {
        type?: string;
        value?: number;
        unit?: string;
        adapter?: string;
    };
};

export type SensorsData = {
    lm_sensors?: SensorNode;
    hwmon?: SensorNode;
};

type SensorSource = {
    service: string;
    path: string[];
};

export default class SensorsMonitor extends Monitor {
    private updateSensorsDataTask: CancellableTaskManager<boolean>;

    private prefSensorsSource!: string;

    private prefSensor1Source?: SensorSource;
    private prefSensor2Source?: SensorSource;

    private prefTooltipSensor1Source?: SensorSource;
    private prefTooltipSensor2Source?: SensorSource;
    private prefTooltipSensor3Source?: SensorSource;
    private prefTooltipSensor4Source?: SensorSource;
    private prefTooltipSensor5Source?: SensorSource;

    private ignoredSensorsRegex!: RegExp | null;
    private ignoredSensorsCategoryRegex!: RegExp | null;
    private ignoredSensorsAttributeRegex!: RegExp | null;

    constructor() {
        super('Sensors Monitor');

        // Setup tasks
        this.updateSensorsDataTask = new CancellableTaskManager();

        this.reset();

        const enabled = Config.get_boolean('sensors-header-show');
        if(enabled) this.start();

        Config.connect(this, 'changed::sensors-header-show', () => {
            if(Config.get_boolean('sensors-header-show')) this.start();
            else this.stop();
        });

        Config.connect(this, 'changed::sensors-update', this.restart.bind(this));

        const updateSensorsSource = () => {
            this.prefSensorsSource = Config.get_string('sensors-source') || 'auto';
        };
        const updateSensorSource = (config: string, variable: string) => {
            const value = Config.get_string(config) || '""';
            try {
                const parsed = JSON.parse(value);
                if(parsed && parsed.service && parsed.path) {
                    if(parsed.service === 'sensors') parsed.service = 'lm-sensors';
                    (this as any)[variable] = parsed;
                    return;
                }
            } catch(e) {
                /* empty */
            }

            (this as any)[variable] = undefined;
        };

        const updateSensorsSourceBind = updateSensorsSource.bind(this);
        const updateSensor1SourceBind = updateSensorSource.bind(
            this,
            'sensors-header-sensor1',
            'prefSensor1Source'
        );
        const updateSensor2SourceBind = updateSensorSource.bind(
            this,
            'sensors-header-sensor2',
            'prefSensor2Source'
        );
        const updateTooltipSensor1SourceBind = updateSensorSource.bind(
            this,
            'sensors-header-tooltip-sensor1',
            'prefTooltipSensor1Source'
        );
        const updateTooltipSensor2SourceBind = updateSensorSource.bind(
            this,
            'sensors-header-tooltip-sensor2',
            'prefTooltipSensor2Source'
        );
        const updateTooltipSensor3SourceBind = updateSensorSource.bind(
            this,
            'sensors-header-tooltip-sensor3',
            'prefTooltipSensor3Source'
        );
        const updateTooltipSensor4SourceBind = updateSensorSource.bind(
            this,
            'sensors-header-tooltip-sensor4',
            'prefTooltipSensor4Source'
        );
        const updateTooltipSensor5SourceBind = updateSensorSource.bind(
            this,
            'sensors-header-tooltip-sensor5',
            'prefTooltipSensor5Source'
        );

        updateSensorsSourceBind();
        updateSensor1SourceBind();
        updateSensor2SourceBind();
        updateTooltipSensor1SourceBind();
        updateTooltipSensor2SourceBind();
        updateTooltipSensor3SourceBind();
        updateTooltipSensor4SourceBind();
        updateTooltipSensor5SourceBind();

        Config.connect(this, 'changed::sensors-source', updateSensorsSourceBind);
        Config.connect(this, 'changed::sensors-header-sensor1', updateSensor1SourceBind);
        Config.connect(this, 'changed::sensors-header-sensor2', updateSensor2SourceBind);
        Config.connect(
            this,
            'changed::sensors-header-tooltip-sensor1',
            updateTooltipSensor1SourceBind
        );
        Config.connect(
            this,
            'changed::sensors-header-tooltip-sensor2',
            updateTooltipSensor2SourceBind
        );
        Config.connect(
            this,
            'changed::sensors-header-tooltip-sensor3',
            updateTooltipSensor3SourceBind
        );
        Config.connect(
            this,
            'changed::sensors-header-tooltip-sensor4',
            updateTooltipSensor4SourceBind
        );
        Config.connect(
            this,
            'changed::sensors-header-tooltip-sensor5',
            updateTooltipSensor5SourceBind
        );

        // Regex ignored sensors
        const updateIgnoredSensorsRegex = () => {
            const regex = Config.get_string('sensors-ignored-regex');
            try {
                if(regex === null || regex === '') this.ignoredSensorsRegex = null;
                else this.ignoredSensorsRegex = new RegExp(`^${regex}$`, 'i');
            } catch(e) {
                this.ignoredSensorsRegex = null;
            }
        };

        Config.connect(this, 'changed::sensors-ignored-regex', () => {
            this.reset();
            updateIgnoredSensorsRegex();
        });
        updateIgnoredSensorsRegex();

        // Regex ignored sensors category
        const updateIgnoredSensorsCategoryRegex = () => {
            const regex = Config.get_string('sensors-ignored-category-regex');
            try {
                if(regex === null || regex === '') this.ignoredSensorsCategoryRegex = null;
                else this.ignoredSensorsCategoryRegex = new RegExp(`^${regex}$`, 'i');
            } catch(e) {
                this.ignoredSensorsCategoryRegex = null;
            }
        };

        Config.connect(this, 'changed::sensors-ignored-category-regex', () => {
            this.reset();
            updateIgnoredSensorsCategoryRegex();
        });
        updateIgnoredSensorsCategoryRegex();

        // Regex ignored sensors attribute
        const updateIgnoredSensorsAttributeRegex = () => {
            const regex = Config.get_string('sensors-ignored-attribute-regex');
            try {
                if(regex === null || regex === '') this.ignoredSensorsAttributeRegex = null;
                else this.ignoredSensorsAttributeRegex = new RegExp(`^${regex}$`, 'i');
            } catch(e) {
                this.ignoredSensorsAttributeRegex = null;
            }
        };

        Config.connect(this, 'changed::sensors-ignored-attribute-regex', () => {
            this.reset();
            updateIgnoredSensorsAttributeRegex();
        });
        updateIgnoredSensorsAttributeRegex();
    }

    get updateFrequency() {
        return Config.get_double('sensors-update');
    }

    get sensorsSourceSetting() {
        return this.prefSensorsSource;
    }

    reset() {
        this.updateSensorsDataTask.cancel();

        this.ignoredSensorsRegex = null;
        this.ignoredSensorsCategoryRegex = null;
        this.ignoredSensorsAttributeRegex = null;
    }

    start() {
        super.start();
    }

    stop() {
        super.stop();
        this.reset();
    }

    update(): boolean {
        Utils.verbose('Updating Sensors Monitor');

        const enabled = Config.get_boolean('sensors-header-show');
        if(enabled) {
            const lmSensorsData = new PromiseValueHolderStore<string | null>(
                this.getLmSensorsDataAsync.bind(this)
            );
            this.runUpdate('sensorsData', lmSensorsData);
        }
        return true;
    }

    requestUpdate(key: string) {
        if(key === 'sensorsData') {
            const lmSensorsData = new PromiseValueHolderStore<string | null>(
                this.getLmSensorsDataAsync.bind(this)
            );
            this.runUpdate('sensorsData', lmSensorsData);
        }
        super.requestUpdate(key);
    }

    runUpdate(key: string, ...params: any[]) {
        if(key === 'sensorsData') {
            this.runTask({
                key,
                task: this.updateSensorsDataTask,
                run: this.updateSensorsData.bind(this, ...params),
                callback: this.notify.bind(this, 'sensorsData'),
            });
            return;
        }
    }

    getLmSensorsDataAsync(): PromiseValueHolder<string | null> {
        return new PromiseValueHolder(
            new Promise((resolve, reject) => {
                if(!Utils.hasLmSensors()) {
                    resolve(null);
                    return;
                }

                try {
                    const path = Utils.commandPathLookup('sensors -v');
                    Utils.executeCommandAsync(`${path}sensors -j`, this.updateSensorsDataTask)
                        .then(result => {
                            resolve(result);
                        })
                        .catch(e => {
                            reject(e);
                        });
                } catch(e) {
                    reject(e);
                }
            })
        );
    }

    shouldUpdate(service: string, path?: string[]) {
        if(this.isListeningFor('sensorsDataAll')) {
            if(this.prefSensorsSource === 'auto' || this.prefSensorsSource === 'hwmon') {
                if(service === 'hwmon') return true;
            } else if(this.prefSensorsSource === 'lm-sensors') {
                if(service === 'lm_sensors') return true;
            }
        }

        if(this.prefSensor1Source?.service === service) {
            if(!path) return true;
            if(Utils.comparePaths(path, this.prefSensor1Source.path)) return true;
        }

        if(this.prefSensor2Source?.service === service) {
            if(!path) return true;
            if(Utils.comparePaths(path, this.prefSensor2Source.path)) return true;
        }

        if(this.prefTooltipSensor1Source?.service === service) {
            if(!path) return true;
            if(Utils.comparePaths(path, this.prefTooltipSensor1Source.path)) return true;
        }

        if(this.prefTooltipSensor2Source?.service === service) {
            if(!path) return true;
            if(Utils.comparePaths(path, this.prefTooltipSensor2Source.path)) return true;
        }

        if(this.prefTooltipSensor3Source?.service === service) {
            if(!path) return true;
            if(Utils.comparePaths(path, this.prefTooltipSensor3Source.path)) return true;
        }

        if(this.prefTooltipSensor4Source?.service === service) {
            if(!path) return true;
            if(Utils.comparePaths(path, this.prefTooltipSensor4Source.path)) return true;
        }

        if(this.prefTooltipSensor5Source?.service === service) {
            if(!path) return true;
            if(Utils.comparePaths(path, this.prefTooltipSensor5Source.path)) return true;
        }

        return false;
    }

    async updateSensorsData(lmSensorsData: PromiseValueHolder<string>): Promise<boolean> {
        const data: SensorsData = {};

        if(this.shouldUpdate('hwmon')) {
            data.hwmon = { name: 'hwmon', children: new Map(), attrs: {} };

            try {
                const baseDir = '/sys/class/hwmon';
                const hwmonDevices = Utils.getCachedHwmonDevices();

                const readPromises = [];

                for(const [deviceName, hwmonDevice] of hwmonDevices) {
                    if(!this.shouldUpdate('hwmon', [deviceName])) continue;

                    let device = data.hwmon.children.get(deviceName);
                    if(!device) {
                        let deviceLabel;
                        const split = deviceName.split('-{$');
                        const deviceNames = Array.from(hwmonDevices.keys()).map(
                            name => name.split('-{$')[0]
                        );
                        if(deviceNames.filter(name => name === split[0]).length === 1)
                            deviceLabel = Utils.capitalize(split[0]);
                        else
                            deviceLabel =
                                Utils.capitalize(split[0]) + ' - ' + split[1].replace(/}$/, '');

                        if(
                            this.ignoredSensorsRegex !== null &&
                            this.ignoredSensorsRegex.test(deviceLabel)
                        ) {
                            continue;
                        }

                        device = { name: deviceLabel, children: new Map(), attrs: {} };
                        data.hwmon.children.set(deviceName, device);
                    }

                    for(const [categoryName, hwmonCategory] of hwmonDevice) {
                        if(
                            this.ignoredSensorsCategoryRegex !== null &&
                            this.ignoredSensorsCategoryRegex.test(categoryName)
                        ) {
                            continue;
                        }

                        if(!this.shouldUpdate('hwmon', [deviceName, categoryName])) continue;

                        let category = device.children.get(categoryName);
                        if(!category) {
                            category = { name: categoryName, children: new Map(), attrs: {} };
                            device.children.set(categoryName, category);
                        }

                        for(const [attributeName, hwmonAttribute] of hwmonCategory) {
                            if(
                                this.ignoredSensorsAttributeRegex !== null &&
                                this.ignoredSensorsAttributeRegex.test(attributeName)
                            ) {
                                continue;
                            }

                            if(
                                !this.shouldUpdate('hwmon', [
                                    deviceName,
                                    categoryName,
                                    attributeName,
                                ])
                            )
                                continue;

                            readPromises.push(
                                (async () => {
                                    const strValue = await Utils.readFileAsync(
                                        `${baseDir}/${hwmonAttribute.path}`,
                                        true
                                    );
                                    if(strValue !== null && strValue !== '') {
                                        let value = parseFloat(strValue);

                                        if(hwmonAttribute.type === 'temp') value /= 1000;
                                        else if(hwmonAttribute.type === 'in') value /= 1000;
                                        else if(hwmonAttribute.type === 'power') value /= 1000000;
                                        else if(hwmonAttribute.type === 'curr') value /= 1000;
                                        else if(hwmonAttribute.type === 'energy') value /= 1000000;
                                        else if(hwmonAttribute.type === 'freq') value /= 1000000;

                                        let unit = '';
                                        if(attributeName !== 'enable')
                                            unit = Utils.inferMeasurementUnit(hwmonAttribute.type);

                                        category.children.set(attributeName, {
                                            name: attributeName,
                                            children: new Map(),
                                            attrs: {
                                                type: hwmonAttribute.type,
                                                value,
                                                unit,
                                            },
                                        });
                                    }
                                })()
                            );
                        }
                    }
                }

                await Promise.all(readPromises);
            } catch(e: any) {
                Utils.error(`Update hwmon data error: ${e.message}`);
            }
        }

        if(lmSensorsData && this.shouldUpdate('lm-sensors')) {
            data.lm_sensors = { name: 'lm-sensors', children: new Map(), attrs: {} };

            // "lm-sensors" provider
            try {
                let lmSensorsDataValue = await lmSensorsData.getValue();
                if(!lmSensorsDataValue) return false;

                // remove trailing commas
                lmSensorsDataValue = lmSensorsDataValue.replace(/,\s*(?=}|])/g, '');

                const parsedData = JSON.parse(lmSensorsDataValue) as any;
                if(parsedData) {
                    for(const [deviceName, deviceData] of Object.entries(parsedData)) {
                        if(
                            this.ignoredSensorsRegex !== null &&
                            this.ignoredSensorsRegex.test(deviceName)
                        ) {
                            continue;
                        }

                        let device = data.lm_sensors.children.get(deviceName);
                        if(!device) {
                            device = { name: deviceName, children: new Map(), attrs: {} };

                            if(
                                Object.prototype.hasOwnProperty.call(
                                    deviceData as Record<string, unknown>,
                                    'Adapter'
                                )
                            )
                                device.attrs.adapter =
                                    ((deviceData as Record<string, unknown>).Adapter as string) ??
                                    undefined;

                            data.lm_sensors.children.set(deviceName, device);
                        }

                        for(const [categoryName, categoryData] of Object.entries(
                            deviceData as Record<string, unknown>
                        )) {
                            if(
                                this.ignoredSensorsCategoryRegex !== null &&
                                this.ignoredSensorsCategoryRegex.test(categoryName)
                            ) {
                                continue;
                            }

                            if(categoryName === 'Adapter') continue;

                            let category = device.children.get(categoryName);
                            if(!category) {
                                category = { name: categoryName, children: new Map(), attrs: {} };
                                device.children.set(categoryName, category);
                            }

                            for(const [attributeName, attributeValue] of Object.entries(
                                categoryData as Record<string, unknown>
                            )) {
                                if(
                                    this.ignoredSensorsAttributeRegex !== null &&
                                    this.ignoredSensorsAttributeRegex.test(attributeName)
                                ) {
                                    continue;
                                }

                                const value = parseFloat(attributeValue as any);
                                let unit = '';
                                if(attributeName !== 'fan')
                                    unit = Utils.inferMeasurementUnit(attributeName);

                                category.children.set(attributeName, {
                                    name: attributeName,
                                    children: new Map(),
                                    attrs: { value, unit },
                                });
                            }
                        }
                    }
                }
            } catch(e: any) {
                Utils.error(`Update lm-sensors data error: ${e.message}`);
            }
        }

        this.pushUsageHistory('sensorsData', data);
        return true;
    }

    destroy() {
        Config.clear(this);
        super.destroy();
    }
}
