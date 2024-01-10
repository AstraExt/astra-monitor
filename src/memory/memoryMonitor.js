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

import GLib from 'gi://GLib';

import Config from '../config.js';
import Utils from '../utils/utils.js';
import { Monitor } from '../monitor.js';
import TopProcessesCache from '../utils/topProcessesCache.js';
import { CancellableTaskManager } from '../utils/cancellableTaskManager.js';
import { PromiseValueHolder } from '../utils/promiseValueHolder.js';

export class MemoryMonitor extends Monitor {
    //TODO: maybe make this configurable
    static get TOP_PROCESSES_LIMIT() {
        return 15;
    }
    
    constructor() {
        super();
        
        this.topProcessesCache = new TopProcessesCache(this.updateFrequency);
        
        // Setup tasks
        this.updateMemoryUsageTask = new CancellableTaskManager();
        this.updateTopProcessesTask = new CancellableTaskManager();
        this.updateSwapUsageTask = new CancellableTaskManager();
        
        const enabled = Config.get_boolean('memory-header-show');
        if(enabled)
            this.start();
        
        Config.connect(this, 'changed::memory-header-show', () => {
            if(Config.get_boolean('memory-header-show'))
                this.start();
            else
                this.stop();
        });
        
        Config.connect(this, 'changed::memory-update', this.restart.bind(this));
    }
    
    get updateFrequency() {
        return Config.get_double('memory-update');
    }
    
    reset() {
        this.updateMemoryUsageTask.cancel();
        this.updateTopProcessesTask.cancel();
        this.updateSwapUsageTask.cancel();
    }
    
    start() {
        super.start();
    }
    
    stop() {
        super.stop();
        this.reset();
    }
    
    update() {
        const enabled = Config.get_boolean('memory-header-show');
        if(enabled) {
            const procMeminfo = this.getProcMeminfoAsync();
            
            this.runUpdate('memoryUsage', procMeminfo);
            
            if(this.isListeningFor('topProcesses')) {
                this.runUpdate('topProcesses');
            }
            else {
                this.topProcessesCache.updateNotSeen([]);
            }
            
            if(this.isListeningFor('swapUsage')) {
                this.runUpdate('swapUsage');
            }
        }
        
        return true;
    }
    
    requestUpdate(key) {
        if(key === 'memoryUsage') {
            if(!this.updateMemoryUsageTask.isRunning) {
                const procMeminfo = this.getProcMeminfoAsync();
                this.runUpdate('memoryUsage', procMeminfo);
            }
        }
        else if(key === 'topProcesses') {
            if(!this.updateTopProcessesTask.isRunning) {
                this.runUpdate('topProcesses');
            }
            return; // Don't push to the queue
        }
        else if(key === 'swapUsage') {
            if(!this.updateSwapUsageTask.isRunning) {
                this.runUpdate('swapUsage');
            }
        }
        super.requestUpdate(key);
    }
    
    runUpdate(key, ...params) {
        if(key === 'memoryUsage') {
            this.updateMemoryUsageTask
                .run(this.updateMemoryUsage.bind(this, ...params))
                .then(this.notify.bind(this, 'memoryUsage'))
                .catch(e => {
                    if(e.isCancelled) {
                        //TODO: manage canceled update
                        Utils.log('Canceled update: ' + key);
                    }
                    else {
                        Utils.error(e.message);
                    }
                });
        }
        if(key === 'topProcesses') {
            this.updateTopProcessesTask
                .run(this.updateTopProcesses.bind(this, ...params))
                .then(this.notify.bind(this, 'topProcesses'))
                .catch(e => {
                    if(e.isCancelled) {
                        //TODO: manage canceled update
                        Utils.log('Canceled update: ' + key);
                    }
                    else {
                        Utils.error(e.message);
                    }
                });
        }
        else if(key === 'swapUsage') {
            this.updateSwapUsageTask
                .run(this.updateSwapUsage.bind(this, ...params))
                .then(this.notify.bind(this, 'swapUsage'))
                .catch(e => {
                    if(e.isCancelled) {
                        //TODO: manage canceled update
                        Utils.log('Canceled update: ' + key);
                    }
                    else {
                        Utils.error(e.message);
                    }
                });
        }
    }
    
    /**
     * @returns {PromiseValueHolder}
     */
    getProcMeminfoAsync() {
        return new PromiseValueHolder(new Promise((resolve, reject) => {
            Utils.readFileAsync('/proc/meminfo').then(fileContent => {
                resolve(fileContent.split('\n'));
            }).catch(e => {
                reject(e);
            });
        }));
    }
    
    /**
     * @param {PromiseValueHolder} procMeminfo 
     * @returns {Promise<boolean>}
     */
    async updateMemoryUsage(procMeminfo) {
        let procMeminfoValue = await procMeminfo.getValue();
        if(procMeminfoValue.length < 1)
            return false;
    
        let total = 0, free = 0, buffers = 0, cached = 0, available = 0, active = 0;
    
        for (let i = 0; i < procMeminfoValue.length; i++) {
            let parts = procMeminfoValue[i].split(/\s+/);
            let key = parts[0].trim();
            let value = parseInt(parts[1]);
            
            switch (key) {
                case 'MemTotal:': total = value * 1024; break;
                case 'MemFree:': free = value * 1024; break;
                case 'Buffers:': buffers = value * 1024; break;
                case 'Cached:': cached = value * 1024; break;
                case 'MemAvailable:': available = value * 1024; break;
                case 'Active:': active = value * 1024; break;
            }
        }
        
        //TODO: add option to exclude "Cache" from used memory
        const used = total - free/* - buffers - cached*/;
        const allocatable = available - free;
        
        const memoryUsage = {
            active,
            allocatable,
            used,
            total,
            available,
            free,
            buffers,
            cached
        };
    
        this.pushUsageHistory('memoryUsage', memoryUsage);
        return true;
    }
    
    /**
     * @returns {Promise<boolean>}
     */
    async updateTopProcesses() {
        const topProcesses = [];
        const seenPids = [];
        
        try {
            const result = await Utils.executeCommandAsync('ps -eo pid,rss,%mem --sort=-%mem');
            if(result) {
                let lines = result.split('\n');
                lines.shift(); // Remove the first line (header)
                if(lines.length > MemoryMonitor.TOP_PROCESSES_LIMIT)
                    lines = lines.slice(0, MemoryMonitor.TOP_PROCESSES_LIMIT);
                
                for(let line of lines) {
                    if(line.trim() === '')
                        continue;
                    
                    const [spid, susage, sperc] = line.split(' ').filter(n => n.trim() !== '');
                    
                    if(!Utils.isIntOrIntString(spid) || !Utils.isNumeric(susage) || !Utils.isNumeric(sperc))
                        continue;
                    const pid = parseInt(spid, 10);
                    const usage = parseInt(susage) * 1024;
                    const percentage = parseFloat(sperc);
                    
                    seenPids.push(pid);
                    
                    let process = this.topProcessesCache.getProcess(pid);
                    if(!process) {
                        try {
                            let fileContent = await Utils.readFileAsync(`/proc/${pid}/cmdline`);
                            if(fileContent === '') {
                                fileContent = await Utils.readFileAsync(`/proc/${pid}/comm`);
                                process = {
                                    pid: pid,
                                    exec: Utils.extractCommandName(fileContent),
                                    cmd: fileContent,
                                    notSeen: 0
                                };
                            }
                            else {
                                process = {
                                    pid: pid,
                                    exec: Utils.extractCommandName(fileContent),
                                    cmd: fileContent,
                                    notSeen: 0
                                };
                            }
                            
                            this.topProcessesCache.setProcess(process);
                        }
                        catch(e) {
                            continue;
                        }
                    }
                    topProcesses.push({ process, usage, percentage });
                };
            }
        }
        catch(e) {
            Utils.error(e.message);
        }
        
        this.topProcessesCache.updateNotSeen(seenPids);
        this.setUsageValue('topProcesses', topProcesses);
        return true;
    }
    
    /**
     * @returns {Promise<boolean>}
     */
    async updateSwapUsage() {
        //TODO: add cat /proc/swaps support to get swap location
        
        const swapUsage = {};
        
        try {
            const result = await Utils.executeCommandAsync('free -b');
            if(result) {
                const lines = result.split('\n');
                lines.shift(); // Remove the first line (header)
                
                for(let line of lines) {
                    if(line.trim() === '')
                        continue;
                    
                    const [name, total, used, free] = line.split(' ').filter(n => n.trim() !== '');
                    
                    if(name === 'Swap:') {
                        swapUsage.total = parseInt(total);
                        swapUsage.used = parseInt(used);
                        swapUsage.free = parseInt(free);
                        break;
                    }
                };
            }
        }
        catch(e) {
            Utils.error(e.message);
            return false;
        }
        
        this.setUsageValue('swapUsage', swapUsage);
        return true;
    }
    
    destroy() {
        Config.clear(this);
        super.destroy();
    }
}