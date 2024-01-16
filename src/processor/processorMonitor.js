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

export class ProcessorMonitor extends Monitor {
    //TODO: maybe make this configurable
    static get TOP_PROCESSES_LIMIT() {
        return 15;
    }
    
    constructor() {
        super();
        
        this.topProcessesCache = new TopProcessesCache(this.updateFrequency);
        
        // Setup tasks
        this.updateCpuUsageTask = new CancellableTaskManager();
        this.updateCoresUsageTask = new CancellableTaskManager();
        this.updateCoresFrequencyTask = new CancellableTaskManager();
        this.updateTopProcessesTask = new CancellableTaskManager();
        
        this.coresNum = -1;
        this.getNumberOfCores();
        
        this.getCpuInfoSync();
        
        this.reset();
        
        const enabled = Config.get_boolean('processor-header-show');
        if(enabled)
            this.start();
        
        Config.connect(this, 'changed::processor-header-show', () => {
            if(Config.get_boolean('processor-header-show'))
                this.start();
            else
                this.stop();
        });
        
        Config.connect(this, 'changed::processor-update', this.restart.bind(this));
    }
    
    get updateFrequency() {
        return Config.get_double('processor-update');
    }
    
    reset() {
        this.previousCpuUsage = {
            idle: -1,
            user: -1,
            system: -1,
            total: -1,
            
            raw: null
        };
        this.previousCpuCoresUsage = new Array(this.coresNum);
        for(let i = 0; i < this.coresNum; i++) {
            this.previousCpuCoresUsage[i] = {
                idle: -1,
                user: -1,
                system: -1,
                total: -1
            };
        }
        
        this.topProcessesCache.reset();
        this.topProcessesTime = -1;
        
        /**
         * @type {Map<number, {processTime: number, totalCpuTime: number}>}
         */
        this.previousPidsCpuTime = new Map();
        
        this.updateCpuUsageTask.cancel();
        this.updateCoresUsageTask.cancel();
        this.updateCoresFrequencyTask.cancel();
        this.updateTopProcessesTask.cancel();
    }
    
    start() {
        super.start();
    }
    
    stop() {
        super.stop();
        this.reset();
    }
    
    update() {
        const enabled = Config.get_boolean('processor-header-show');
        if(enabled) {
            const procStat = this.getProcStatAsync();
            
            this.runUpdate('cpuUsage', procStat);
            this.runUpdate('cpuCoresUsage', procStat);
            this.runUpdate('cpuCoresFrequency', procStat);
            
            if(this.isListeningFor('topProcesses')) {
                this.runUpdate('topProcesses', false, procStat);
            }
            else {
                this.topProcessesCache.updateNotSeen([]);
            }
        }
        return true;
    }
    
    requestUpdate(key) {
        if(key === 'cpuUsage') {
            if(!this.updateCpuUsageTask.isRunning) {
                const procStat = this.getProcStatAsync();
                this.runUpdate('cpuUsage', procStat);
            }
        }
        else if(key === 'cpuCoresUsage') {
            if(!this.updateCoresUsageTask.isRunning) {
                const procStat = this.getProcStatAsync();
                this.runUpdate('cpuCoresUsage', procStat);
            }
        }
        else if(key === 'cpuCoresFrequency') {
            if(!this.updateCoresFrequencyTask.isRunning) {
                this.runUpdate('cpuCoresFrequency');
            }
        }
        else if(key === 'topProcesses') {
            if(!this.updateTopProcessesTask.isRunning) {
                const procStat = this.getProcStatAsync();
                this.runUpdate('topProcesses', true, procStat);
                return; // Don't push to the queue
            }
        }
        
        super.requestUpdate(key);
    }
    
    runUpdate(key, ...params) {
        if(key === 'cpuUsage') {
            this.updateCpuUsageTask
                .run(this.updateCpuUsage.bind(this, ...params))
                .then(this.notify.bind(this, 'cpuUsage'))
                .catch(e => {
                    if(e.isCancelled) {
                        Utils.log('Update canceled: ' + key);
                    }
                    else {
                        Utils.error(e.message);
                    }
                });
        }
        if(key === 'cpuCoresUsage') {
            this.updateCoresUsageTask
                .run(this.updateCpuCoresUsage.bind(this, ...params))
                .then(this.notify.bind(this, 'cpuCoresUsage'))
                .catch(e => {
                    if(e.isCancelled) {
                        Utils.log('Update canceled: ' + key);
                    }
                    else {
                        Utils.error(e.message);
                    }
                });
        }
        else if(key === 'cpuCoresFrequency') {
            this.updateCoresFrequencyTask
                .run(this.updateCpuCoresFrequency.bind(this, ...params))
                .then(this.notify.bind(this, 'cpuCoresFrequency'))
                .catch(e => {
                    if(e.isCancelled) {
                        Utils.log('Update canceled: ' + key);
                    }
                    else {
                        Utils.error(e.message);
                    }
                });
        }
        else if(key === 'topProcesses') {
            //Top processes should never be called more than twice per second
            //unless it's forced
            const forced = params.shift();
            const now = GLib.get_monotonic_time();
            if(!forced && now - this.topProcessesTime < 500000) // 0,5s
                return;
            this.topProcessesTime = now;
            
            this.updateTopProcessesTask
                .run(this.updateTopProcesses.bind(this, ...params))
                .then(this.notify.bind(this, 'topProcesses'))
                .catch(e => {
                    if(e.isCancelled) {
                        Utils.log('Update canceled: ' + key);
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
    getProcStatAsync() {
        return new PromiseValueHolder(new Promise((resolve, reject) => {
            Utils.readFileAsync('/proc/stat').then(fileContent => {
                resolve(fileContent.split('\n'));
            }).catch(e => {
                reject(e);
            });
        }));
    }
    
    getProcStatSync() {
        // this is used very rarely, only on first setup
        // takes ~0.2ms but could be more on slower systems
        const fileContents = GLib.file_get_contents('/proc/stat');
        if(fileContents && fileContents[0]) {
            const decoder = new TextDecoder("utf-8");
            return decoder.decode(fileContents[1]).split('\n');
        }
        return [];
    }
    
    /**
     * This is a sync function but caches the result
     * @returns {number}
     */
    getNumberOfCores() {
        if(this.coresNum !== -1)
            return this.coresNum;
        
        let procstat = this.getProcStatSync();
        if(procstat.length < 1)
            return 0;
        
        let cores = 0;
        for(let i = 0; i < procstat.length; i++) {
            if(procstat[i].startsWith('cpu'))
                cores++;
        }
        this.coresNum = cores - 1;
        return this.coresNum;
    }
    
    getCpuInfoSync() {
        if(this.cpuInfo !== undefined)
            return this.cpuInfo;
        
        try {
            //TODO: switch to lscpu --json!?
            const [result, stdout, stderr] = GLib.spawn_command_line_sync('lscpu');
            if (result && stdout) {
                const decoder = new TextDecoder("utf-8");
                const output = decoder.decode(stdout);
                
                const lines = output.split('\n');
                const cpuInfo = {};
                let currentCategory = cpuInfo;
                let lastKey = null;

                lines.forEach(line => {
                    if (line.trim() === '')
                        return;

                    if (line.endsWith(':')) {
                        // New category
                        const categoryName = line.slice(0, -1).trim();
                        cpuInfo[categoryName] = {};
                        currentCategory = cpuInfo[categoryName];
                        lastKey = null;
                    } else if (line.includes(':')) {
                        // Key-value pair
                        const [key, value] = line.split(':').map(s => s.trim());
                        if (key === 'Flags') {
                            currentCategory[key] = value.split(' ');
                        } else {
                            currentCategory[key] = value;
                        }
                        lastKey = key;
                    } else if (lastKey && lastKey === 'Flags') {
                        // Continuation of Flags
                        currentCategory[lastKey] = currentCategory[lastKey].concat(line.trim().split(' '));
                    } else if (lastKey) {
                        // Continuation of the last key in the current category
                        currentCategory[lastKey] += '\n' + line.trim();
                    }
                });
                
                this.cpuInfo = cpuInfo;
                
                if(!this.cpuInfo['Model name']) {
                    // lscpu is localized, so we need to fallback to /proc/cpuinfo
                    // TODO: fix flags too
                    
                    const fileContents = GLib.file_get_contents('/proc/cpuinfo');
                    if(fileContents && fileContents[0]) {
                        const decoder = new TextDecoder("utf-8");
                        const lines = decoder.decode(fileContents[1]).split('\n');
                        
                        for(const line of lines) {
                            if(line.startsWith('model name')) {
                                const [key, value] = line.split(':').map(s => s.trim());
                                this.cpuInfo['Model name'] = value;
                                break;
                            }
                        }
                    }
                }
            } else {
                this.cpuInfo = {};
            }
        } catch (e) {
            this.cpuInfo = {};
        }
    }
    
    /**
     * @param {PromiseValueHolder} procStat 
     * @returns {Promise<boolean>}
     */
    async updateCpuUsage(procStat) {
        let procStatValue = await procStat.getValue();
        if(procStatValue.length < 1)
            return false;
        
        //TODO: check dual socket systems
        let cpuLine = procStatValue[0].split(' ').filter(n => n.trim() !== '');
        if(cpuLine.length < 9)
            return false;
        
        // Parse the individual times
        const user = parseInt(cpuLine[1], 10);
        const nice = parseInt(cpuLine[2], 10);
        const system = parseInt(cpuLine[3], 10);
        const idle = parseInt(cpuLine[4], 10);
        const iowait = parseInt(cpuLine[5], 10);
        const irq = parseInt(cpuLine[6], 10);
        const softirq = parseInt(cpuLine[7], 10);
        const steal = parseInt(cpuLine[8], 10);
        
        // Calculate total time and total idle time
        const totalIdle = idle + iowait + steal;
        const totalUser = user + nice;
        const totalSystem = system + irq + softirq;
        const total = user + nice + system + idle + iowait + irq + softirq + steal;
        
        if(this.previousCpuUsage.total === -1) {
            this.previousCpuUsage.idle = totalIdle;
            this.previousCpuUsage.user = totalUser;
            this.previousCpuUsage.system = totalSystem;
            this.previousCpuUsage.total = total;
            
            this.previousCpuUsage.raw = {
                user: user,
                nice: nice,
                system: system,
                idle: idle,
                iowait: iowait,
                irq: irq,
                softirq: softirq,
                steal: steal
            };
            return false;
        }
        
        // Calculate the deltas (difference) compared to the previous read
        const idleDelta = totalIdle - this.previousCpuUsage.idle;
        const userDelta = totalUser - this.previousCpuUsage.user;
        const systemDelta = totalSystem - this.previousCpuUsage.system;
        const totalDelta = total - this.previousCpuUsage.total;
        
        const rawUserDelta = user - this.previousCpuUsage.raw.user;
        const rawNiceDelta = nice - this.previousCpuUsage.raw.nice;
        const rawSystemDelta = system - this.previousCpuUsage.raw.system;
        const rawIdleDelta = idle - this.previousCpuUsage.raw.idle;
        const rawIowaitDelta = iowait - this.previousCpuUsage.raw.iowait;
        const rawIrqDelta = irq - this.previousCpuUsage.raw.irq;
        const rawSoftirqDelta = softirq - this.previousCpuUsage.raw.softirq;
        const rawStealDelta = steal - this.previousCpuUsage.raw.steal;
        
        this.previousCpuUsage.idle = totalIdle;
        this.previousCpuUsage.user = totalUser;
        this.previousCpuUsage.system = totalSystem;
        this.previousCpuUsage.total = total;
        
        this.previousCpuUsage.raw = {
            user: user,
            nice: nice,
            system: system,
            idle: idle,
            iowait: iowait,
            irq: irq,
            softirq: softirq,
            steal: steal
        };
        
        // Calculate the percentage of CPU usage
        const cpuUsage = (totalDelta - idleDelta) / totalDelta * 100;
        const userUsage = userDelta / totalDelta * 100;
        const systemUsage = systemDelta / totalDelta * 100;
        const idleUsage = idleDelta / totalDelta * 100;
        
        const rawUserUsage = rawUserDelta / totalDelta * 100;
        const rawNiceUsage = rawNiceDelta / totalDelta * 100;
        const rawSystemUsage = rawSystemDelta / totalDelta * 100;
        const rawIdleUsage = rawIdleDelta / totalDelta * 100;
        const rawIowaitUsage = rawIowaitDelta / totalDelta * 100;
        const rawIrqUsage = rawIrqDelta / totalDelta * 100;
        const rawSoftirqUsage = rawSoftirqDelta / totalDelta * 100;
        const rawStealUsage = rawStealDelta / totalDelta * 100;
        
        this.pushUsageHistory('cpuUsage', {
            total: cpuUsage,
            user: userUsage,
            system: systemUsage,
            idle: idleUsage,
            
            raw: {
                user: rawUserUsage,
                nice: rawNiceUsage,
                system: rawSystemUsage,
                idle: rawIdleUsage,
                iowait: rawIowaitUsage,
                irq: rawIrqUsage,
                softirq: rawSoftirqUsage,
                steal: rawStealUsage
            }
        });
        return true;
    }
    
    /**
     * @param {PromiseValueHolder} procStat 
     * @returns {Promise<boolean>}
     */
    async updateCpuCoresUsage(procStat) {
        let procStatValue = await procStat.getValue();
        if(procStatValue.length < 1)
            return false;
        
        // Remove the first line (total CPU usage)
        procStatValue = procStatValue.slice(1);
        
        const cpuCoresUsage = [];
        for(let i = 0; i < procStatValue.length; i++) {
            if(!procStatValue[i].startsWith('cpu'))
                break;
            
            let cpuLine = procStatValue[i].split(' ').filter(n => n.trim() !== '');
            if(cpuLine.length < 9)
                continue;
            
            // Parse the individual times
            const user = parseInt(cpuLine[1], 10);
            const nice = parseInt(cpuLine[2], 10);
            const system = parseInt(cpuLine[3], 10);
            const idle = parseInt(cpuLine[4], 10);
            const iowait = parseInt(cpuLine[5], 10);
            const irq = parseInt(cpuLine[6], 10);
            const softirq = parseInt(cpuLine[7], 10);
            const steal = parseInt(cpuLine[8], 10);
            
            // Calculate total time and total idle time
            const totalIdle = idle + iowait + steal;
            const totalUser = user + nice;
            const totalSystem = system + irq + softirq;
            const total = user + nice + system + idle + iowait + irq + softirq + steal;
            
            if(this.previousCpuCoresUsage[i].total === -1) {
                this.previousCpuCoresUsage[i].idle = totalIdle;
                this.previousCpuCoresUsage[i].user = totalUser;
                this.previousCpuCoresUsage[i].system = totalSystem;
                this.previousCpuCoresUsage[i].total = total;
                continue;
            }
            
            // Calculate the deltas (difference) compared to the previous read
            const idleDelta = totalIdle - this.previousCpuCoresUsage[i].idle;
            const userDelta = totalUser - this.previousCpuCoresUsage[i].user;
            const systemDelta = totalSystem - this.previousCpuCoresUsage[i].system;
            const totalDelta = total - this.previousCpuCoresUsage[i].total;
            
            this.previousCpuCoresUsage[i].idle = totalIdle;
            this.previousCpuCoresUsage[i].user = totalUser;
            this.previousCpuCoresUsage[i].system = totalSystem;
            this.previousCpuCoresUsage[i].total = total;
            
            // Calculate the percentage of CPU usage
            const cpuUsage = (totalDelta - idleDelta) / totalDelta * 100;
            const userUsage = userDelta / totalDelta * 100;
            const systemUsage = systemDelta / totalDelta * 100;
            const idleUsage = idleDelta / totalDelta * 100;
            
            cpuCoresUsage.push({
                total: cpuUsage,
                user: userUsage,
                system: systemUsage,
                idle: idleUsage
            });
        }
        
        this.pushUsageHistory(`cpuCoresUsage`, cpuCoresUsage);
        return false;
    }
    
    /**
     * @returns {Promise<boolean>}
     */
    async updateCpuCoresFrequency() {
        const frequencies = [];
        
        if(this.isListeningFor('cpuCoresFrequency')) {
            const paths = Utils.generateCpuFreqPaths(this.coresNum);
            try {
                for(const path of paths) {
                    const fileContent = await Utils.readFileAsync(path);
                    if(fileContent) {
                        if(Utils.isIntOrIntString(fileContent))
                            frequencies.push(Number.NaN);
                        else
                            frequencies.push(parseInt(fileContent, 10)/1000);
                    }
                    else {
                        frequencies.push(Number.NaN);
                    }
                }
                this.pushUsageHistory(`cpuCoresFrequency`, frequencies);
                return;
            }
            catch(e) {}
        }
        
        for(let i = 0; i < this.coresNum; i++)
            frequencies.push(Number.NaN);
        this.pushUsageHistory(`cpuCoresFrequency`, frequencies);
        return true;
    }
    
    /**
     * Checking all /proc/pid/stat to gather the cpu time of each process.
     * This is a very slow operation but it's async so it doesn't block the UI.
     * It still can take up to ~150ms, so it shouldn't be called too often.
     * Note: this approach won't show all processes.
     * @param {PromiseValueHolder} procStat 
     * @returns {Promise<boolean>}
     */
    async updateTopProcesses(procStat) {
        let procStatValue = await procStat.getValue();
        if(procStatValue.length < 1)
            return false;
            
        const topProcesses = [];
        const seenPids = [];
        
        try {
            let cpuLine = procStatValue[0].split(' ').filter(n => n.trim() !== '');
            let totalCpuTime = cpuLine.slice(1, -1).reduce((acc, time) => acc + parseInt(time, 10), 0);
            
            const files = await Utils.readDirAsync('/proc');
            const pids = files.filter(file => /^\d+$/.test(file));
            
            /**
             * @type {Map<number, {processTime: number, totalCpuTime: number}>}
             */
            const cpuTimes = new Map();
            
            for(const pid of pids) {
                try {
                    const stat = await Utils.readFileAsync('/proc/' + pid + '/stat');
                    
                    const statParts = stat.split(' ');
                    const utime = parseInt(statParts[13], 10);
                    const stime = parseInt(statParts[14], 10);
                    
                    cpuTimes.set(pid, { processTime: utime + stime, totalCpuTime });
                }
                catch(e) {
                    //Avoid spamming the log with errors for processes that are gone
                    //Utils.log(e.message);
                    continue;
                }
            }
            
            for(const [pid, cpuTime] of cpuTimes) {
                if(!this.previousPidsCpuTime.has(pid)) {
                    this.previousPidsCpuTime.set(pid, cpuTime);
                    continue;
                }
                
                const {
                    processTime: previousProcessTime,
                    totalCpuTime: previousTotalCpuTime
                } = this.previousPidsCpuTime.get(pid);
                
                let totalCpuTimeDiff = totalCpuTime - previousTotalCpuTime;
                let cpuTimeDiff = cpuTime.processTime - previousProcessTime;
                let cpuUsagePercent = (cpuTimeDiff / totalCpuTimeDiff) * 100.0;
                
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
                        seenPids.push(pid);
                    }
                    catch(e) {
                        continue;
                    }
                }
                topProcesses.push({ process, cpu: cpuUsagePercent });
                
                this.previousPidsCpuTime.set(pid, cpuTime);
            }
        }
        catch(e) {
            Utils.error(e.message);
            return false;
        }
        
        topProcesses.sort((a, b) => b.cpu - a.cpu);
        topProcesses.splice(ProcessorMonitor.TOP_PROCESSES_LIMIT);
        
        this.topProcessesCache.updateNotSeen(seenPids);
        this.setUsageValue('topProcesses', topProcesses);
        return true;
    }
    
    destroy() {
        Config.clear(this);
        super.destroy();
    }
}