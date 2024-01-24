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

import Config from '../config.js';
import Utils from '../utils/utils.js';
import { Monitor } from '../monitor.js';
import { CancellableTaskManager } from '../utils/cancellableTaskManager.js';
import { PromiseValueHolder } from '../utils/promiseValueHolder.js';

export class SensorsMonitor extends Monitor {
    constructor() {
        super();
        
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
    
    requestUpdate(key) {
        if(key === 'sensorsData') {
            const sensorsData = this.getSensorsDataAsync();
            this.runUpdate('sensorsData', sensorsData);
        }
        super.requestUpdate(key);
    }
    
    runUpdate(key, ...params) {
        if(key === 'sensorsData') {
            this.updateSensorsDataTask
                .run(this.updateSensorsData.bind(this, ...params))
                .then(this.notify.bind(this, 'sensorsData'))
                .catch(e => {
                    if(e.isCancelled) {
                        Utils.log('Sensor Monitor update canceled: ' + key);
                    }
                    else {
                        Utils.error(e);
                    }
                });
        }
    }
    
    /**
     * @returns {PromiseValueHolder}
     */
    getSensorsDataAsync() {
        return new PromiseValueHolder(new Promise((resolve, reject) => {
            try {
                Utils.executeCommandAsync('sensors -j').then(result => {
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
    
    /**
     * @param {PromiseValueHolder} sensorsData 
     * @returns {Promise<boolean>}
     */
    async updateSensorsData(sensorsData) {
        let sensorsDataValue = await sensorsData.getValue();
        if(sensorsDataValue.length < 1)
            return false;
        
        let sensors = {};
        
        // "sensors" provider
        try {
            const parsedData = JSON.parse(sensorsDataValue);
            if(parsedData)
                sensors = parsedData;
        }
        catch(e) {
            Utils.error(e.message);
        }
        
        //TODO add other providers
        
        this.pushUsageHistory('sensorsData', {
            sensors
        });
        return true;
    }
    
    destroy() {
        Config.clear(this);
        super.destroy();
    }
}