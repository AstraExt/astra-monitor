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
import PromiseValueHolder from '../utils/promiseValueHolder.js';

export type SensorDevice = {
    name: string;
    Adapter: string;
    [key: string]: any;
};

type SensorsData = {
    sensors: any;
};

export default class SensorsMonitor extends Monitor {
    private updateSensorsDataTask: CancellableTaskManager<boolean>;
    
    constructor() {
        super('Sensors Monitor');
        
        // Setup tasks
        this.updateSensorsDataTask = new CancellableTaskManager();
        
        this.reset();
        
        const enabled = Config.get_boolean('sensors-header-show');
        if(enabled)
            this.start();
        
        Config.connect(this, 'changed::sensors-header-show', () => {
            if(Config.get_boolean('sensors-header-show'))
                this.start();
            else
                this.stop();
        });
        
        Config.connect(this, 'changed::sensors-update', this.restart.bind(this));
    }
    
    get updateFrequency() {
        return Config.get_double('sensors-update');
    }
    
    reset() {
        this.updateSensorsDataTask.cancel();
    }
    
    start() {
        super.start();
    }
    
    stop() {
        super.stop();
        this.reset();
    }
    
    update() {
        const enabled = Config.get_boolean('sensors-header-show');
        if(enabled) {
            const sensorsData = this.getSensorsDataAsync();
            this.runUpdate('sensorsData', sensorsData);
        }
        return true;
    }
    
    requestUpdate(key: string) {
        if(key === 'sensorsData') {
            const sensorsData = this.getSensorsDataAsync();
            this.runUpdate('sensorsData', sensorsData);
        }
        super.requestUpdate(key);
    }
    
    runUpdate(key: string, ...params: any[]) {
        if(key === 'sensorsData') {
            this.runTask({
                key,
                task: this.updateSensorsDataTask,
                run: this.updateSensorsData.bind(this, ...params),
                callback: this.notify.bind(this, 'sensorsData')
            });
            return;
        }
    }
    
    getSensorsDataAsync(): PromiseValueHolder<string> {
        return new PromiseValueHolder(new Promise((resolve, reject) => {
            try {
                Utils.executeCommandAsync('sensors -j', this.updateSensorsDataTask).then(result => {
                    resolve(result);
                }).catch(e => {
                    reject(e);
                });
            }
            catch(e) {
                reject(e);
            }
        }));
    }
    
    async updateSensorsData(sensorsData: PromiseValueHolder<string>): Promise<boolean> {
        const data:SensorsData = {
            sensors: {}
        };
        
        // "sensors" provider
        try {
            const sensorsDataValue = await sensorsData.getValue();
            if(sensorsDataValue.length < 1)
                return false;
            
            const parsedData = JSON.parse(sensorsDataValue);
            if(parsedData)
            data.sensors = parsedData;
        }
        catch(e: any) {
            Utils.error(e.message);
        }
        
        //TODO add other providers
        
        this.pushUsageHistory('sensorsData', data);
        return true;
    }
    
    destroy() {
        Config.clear(this);
        super.destroy();
    }
}