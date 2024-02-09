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

import GLib from 'gi://GLib';

import Config from '../config.js';
import Utils from '../utils/utils.js';
import Monitor from '../monitor.js';

import TopProcessesCache from '../utils/topProcessesCache.js';
import CancellableTaskManager from '../utils/cancellableTaskManager.js';
import ContinuosTaskManager, { ContinuosTaskManagerData } from '../utils/continuosTaskManager.js';
import PromiseValueHolder, { PromiseValueHolderStore } from '../utils/promiseValueHolder.js';

export type ProcessorUsage = {
    idle: number,
    user: number,
    system: number,
    total: number,
    
    raw?: {
        user: number,
        nice: number,
        system: number,
        idle: number,
        iowait: number,
        irq: number,
        softirq: number,
        steal: number
    }
};

type PreviousCpuCoresUsage = Array<ProcessorUsage>;

type ProcessorDataSources = {
    cpuUsage?: string,
    cpuCoresUsage?: string,
    topProcesses?: string
};

type CpuTime = {
    processTime: number, totalCpuTime: number
};

export type GenericGpuInfo = {
    id: string,
    family: 'AMD' | 'NVIDIA' | 'Intel',
    vram: {
        percent?: number,
        total?: number,
        used?: number,
    },
    activity: {
        GFX?: number,
    }
    raw: any
}

export type AmdInfo = GenericGpuInfo & {
    raw: {
        GRBM?: any,
        GRBM2?: any,
        Info?: any,
        Sensors?: any,
        VRAM?: any,
        fdinfo?: any,
        gpu_activity?: any,
        gpu_metrics?: any,
    }
};

export type NvidiaInfo = GenericGpuInfo & {
    raw: any
};

export type CpuInfo = { [key:string]: any };

export default class ProcessorMonitor extends Monitor {
    //TODO: maybe make this configurable
    static get TOP_PROCESSES_LIMIT() {
        return 15;
    }
    
    private topProcessesCache: TopProcessesCache;
    private topProcessesTime!: number;
    
    private updateCpuUsageTask: CancellableTaskManager<boolean>;
    private updateCoresUsageTask: CancellableTaskManager<boolean>;
    private updateCoresFrequencyTask: CancellableTaskManager<boolean>;
    private updateTopProcessesTask: CancellableTaskManager<boolean>;
    private updateAmdGpuTask: ContinuosTaskManager;
    private updateNvidiaGpuTask: ContinuosTaskManager;
    
    private previousCpuUsage!: ProcessorUsage;
    private previousCpuCoresUsage!: PreviousCpuCoresUsage;
    private previousPidsCpuTime!:Map<number, CpuTime>;
    
    private coresNum: number;
    private dataSources!: ProcessorDataSources;
    private cpuInfo?: CpuInfo;
    
    constructor() {
        super('Processor Monitor');
        
        this.topProcessesCache = new TopProcessesCache(this.updateFrequency);
        
        // Setup tasks
        this.updateCpuUsageTask = new CancellableTaskManager();
        this.updateCoresUsageTask = new CancellableTaskManager();
        this.updateCoresFrequencyTask = new CancellableTaskManager();
        this.updateTopProcessesTask = new CancellableTaskManager();
        
        this.updateAmdGpuTask = new ContinuosTaskManager();
        this.updateAmdGpuTask.listen(this, this.updateAmdGpu.bind(this));
        
        this.updateNvidiaGpuTask = new ContinuosTaskManager();
        this.updateNvidiaGpuTask.listen(this, this.updateNvidiaGpu.bind(this));
        
        this.coresNum = -1;
        this.getNumberOfCores();
        
        this.getCpuInfoSync();
        
        this.reset();
        this.dataSourcesInit();
        
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
            total: -1
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
        this.stopGpuTask();
        this.reset();
    }
    
    dataSourcesInit() {
        this.dataSources = {
            cpuUsage: Config.get_string('processor-source-cpu-usage') ?? undefined,
            cpuCoresUsage: Config.get_string('processor-source-cpu-cores-usage') ?? undefined,
            topProcesses: Config.get_string('processor-source-top-processes') ?? undefined
        };
        
        Config.connect(this, 'changed::processor-source-cpu-usage', () => {
            this.dataSources.cpuUsage = Config.get_string('processor-source-cpu-usage') ?? undefined;
            this.updateCpuUsageTask.cancel();
            this.previousCpuUsage = {
                idle: -1,
                user: -1,
                system: -1,
                total: -1
            };
            this.resetUsageHistory('cpuUsage');
        });
        
        Config.connect(this, 'changed::processor-source-cpu-cores-usage', () => {
            this.dataSources.cpuCoresUsage = Config.get_string('processor-source-cpu-cores-usage') ?? undefined;
            this.updateCoresUsageTask.cancel();
            this.previousCpuCoresUsage = new Array(this.coresNum);
            for(let i = 0; i < this.coresNum; i++) {
                this.previousCpuCoresUsage[i] = {
                    idle: -1,
                    user: -1,
                    system: -1,
                    total: -1
                };
            }
            this.resetUsageHistory('cpuCoresUsage');
        });
        
        Config.connect(this, 'changed::processor-source-top-processes', () => {
            this.dataSources.topProcesses = Config.get_string('processor-source-top-processes') ?? undefined;
            this.updateTopProcessesTask.cancel();
            this.topProcessesCache.reset();
            this.topProcessesTime = -1;
            this.previousPidsCpuTime = new Map();
            this.resetUsageHistory('topProcesses');
        });
    }
    
    startListeningFor(key: string) {
        if(key === 'gpuUpdate') {
            this.startGpuTask();
        }
    }
    
    stopListeningFor(key: string) {
        if(key === 'gpuUpdate') {
            this.stopGpuTask();
        }
    }
    
    private startGpuTask() {
        const selectedGpu = Utils.getSelectedGPU();
        if(!selectedGpu)
            return;
        
        if(Utils.hasAMDGpu() && Utils.hasAmdGpuTop() && Utils.isAmdGpu(selectedGpu)) {
            // Max 2 updates per second
            const timer = Math.round(Math.max(500, this.updateFrequency * 1000));
            this.updateAmdGpuTask.start(`amdgpu_top -J -u ${timer} -s ${timer} -n 0`);
        }
        
        if(Utils.hasNVidiaGpu() && Utils.hasNvidiaSmi() && Utils.isNvidiaGpu(selectedGpu)) {
            // Max 2 updates per second
            const timer = Math.round(Math.max(500, this.updateFrequency * 1000));
            /**
             * Using -q even though it has a lot of useless info and not -query-gpu because
             * the latter just gives a snapshot, not the proper values since the last call.
             * It also doesn't support processes monitoring and other features we might want
             * to add in the future.
             */
            this.updateNvidiaGpuTask.start(`nvidia-smi -q -x -lms ${timer}`, '</nvidia_smi_log>');
        }
    }
    
    private stopGpuTask() {
        if(this.updateAmdGpuTask.isRunning)
            this.updateAmdGpuTask.stop();
        
            if(this.updateNvidiaGpuTask.isRunning)
            this.updateNvidiaGpuTask.stop();
    }
    
    update(): boolean {
        const enabled = Config.get_boolean('processor-header-show');
        if(enabled) {
            const procStatStore = new PromiseValueHolderStore<string[]>(this.getProcStatAsync.bind(this));
            
            if(this.dataSources.cpuUsage === 'GTop')
                this.runUpdate('cpuUsage');
            else
                this.runUpdate('cpuUsage', procStatStore);
            
            if(this.dataSources.cpuCoresUsage === 'GTop')
                this.runUpdate('cpuCoresUsage', procStatStore);
            else
                this.runUpdate('cpuCoresUsage', procStatStore);
            
            this.runUpdate('cpuCoresFrequency');
            
            if(this.isListeningFor('topProcesses')) {
                if(this.dataSources.topProcesses === 'GTop')
                    this.runUpdate('topProcesses', false);
                else
                    this.runUpdate('topProcesses', false, procStatStore);
            }
            else {
                this.topProcessesCache.updateNotSeen([]);
            }
        }
        return true;
    }
    
    requestUpdate(key: string) {
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
                if(this.dataSources.topProcesses === 'GTop') {
                    this.runUpdate('topProcesses', true);
                }
                else {
                    const procStat = this.getProcStatAsync();
                    this.runUpdate('topProcesses', true, procStat);
                }
            }
            // Don't push to the queue
            return;
        }
        
        super.requestUpdate(key);
    }
    
    runUpdate(key: string, ...params: any[]) {
        if(key === 'cpuUsage') {
            let run;
            if(this.dataSources.cpuUsage === 'GTop')
                run = this.updateCpuUsageGTop.bind(this, ...params);
            else if(this.dataSources.topProcesses === 'proc')
                run = this.updateCpuUsageProc.bind(this, ...params);
            else
                run = this.updateCpuUsageAuto.bind(this, ...params);
            
            this.runTask({
                key,
                task: this.updateCpuUsageTask,
                run,
                callback: this.notify.bind(this, 'cpuUsage')
            });
            return;
        }
        if(key === 'cpuCoresUsage') {
            let run;
            if(this.dataSources.cpuCoresUsage === 'GTop')
                run = this.updateCpuCoresUsageGTop.bind(this, ...params);
            else if(this.dataSources.topProcesses === 'proc')
                run = this.updateCpuCoresUsageProc.bind(this, ...params);
            else
                run = this.updateCpuCoresUsageAuto.bind(this, ...params);
            
            this.runTask({
                key,
                task: this.updateCoresUsageTask,
                run,
                callback: this.notify.bind(this, 'cpuCoresUsage')
            });
            return;
        }
        if(key === 'cpuCoresFrequency') {
            this.runTask({
                key,
                task: this.updateCoresFrequencyTask,
                run: this.updateCpuCoresFrequencyProc.bind(this, ...params),
                callback: this.notify.bind(this, 'cpuCoresFrequency')
            });
            return;
        }
        if(key === 'topProcesses') {
            const forced = params.shift();
            
            //Top processes should never be called more than twice per second
            //unless it's forced
            const now = GLib.get_monotonic_time();
            if(!forced && now - this.topProcessesTime < 500000) // 0.5s
                return;
            if(!forced)
                this.topProcessesTime = now;
            
            let run;
            if(this.dataSources.topProcesses === 'GTop')
                run = this.updateTopProcessesGTop.bind(this, ...params);
            else if(this.dataSources.topProcesses === 'proc')
                run = this.updateTopProcessesProc.bind(this, ...params);
            else
                run = this.updateTopProcessesAuto.bind(this, ...params);
            
            this.runTask({
                key,
                task: this.updateTopProcessesTask,
                run,
                callback: this.notify.bind(this, 'topProcesses')
            });
            return;
        }
    }
    
    getProcStatAsync(): PromiseValueHolder<string[]> {
        return new PromiseValueHolder(new Promise((resolve, reject) => {
            Utils.readFileAsync('/proc/stat').then(fileContent => {
                resolve(fileContent.split('\n'));
            }).catch(e => {
                reject(e);
            });
        }));
    }
    
    getProcStatSync(): string[] {
        // this is used very rarely, only on first setup
        // takes ~0.2ms but could be more on slower systems
        const fileContents = GLib.file_get_contents('/proc/stat');
        if(fileContents && fileContents[0]) {
            const decoder = new TextDecoder('utf8');
            return decoder.decode(fileContents[1]).split('\n');
        }
        return [];
    }
    
    /**
     * This is a sync function but caches the result
     */
    getNumberOfCores(): number {
        if(this.coresNum !== -1)
            return this.coresNum;
        
        const procstat = this.getProcStatSync();
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
    
    /**
     * This is a sync function but caches the result
     */
    getCpuInfoSync(): CpuInfo {
        if(this.cpuInfo !== undefined)
            return this.cpuInfo;
        
        try {
            //TODO: switch to lscpu --json!?
            const [result, stdout, _stderr] = GLib.spawn_command_line_sync('lscpu');
            if(result && stdout) {
                const decoder = new TextDecoder('utf8');
                const output = decoder.decode(stdout);
                
                const lines = output.split('\n');
                const cpuInfo: CpuInfo = {};
                let currentCategory = cpuInfo;
                let lastKey:string|null = null;

                lines.forEach(line => {
                    if(line.trim() === '')
                        return;

                    if(line.endsWith(':')) {
                        // New category
                        const categoryName = line.slice(0, -1).trim();
                        cpuInfo[categoryName] = {};
                        currentCategory = cpuInfo[categoryName];
                        lastKey = null;
                    }
                    else if(line.includes(':')) {
                        // Key-value pair
                        const [key, value] = line.split(':').map(s => s.trim());
                        if(key === 'Flags') {
                            currentCategory[key] = value.split(' ');
                        }
                        else {
                            currentCategory[key] = value;
                        }
                        lastKey = key;
                    }
                    else if(lastKey && lastKey === 'Flags') {
                        // Continuation of Flags
                        currentCategory[lastKey] = currentCategory[lastKey].concat(line.trim().split(' '));
                    }
                    else if(lastKey) {
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
                        const decoder = new TextDecoder('utf8');
                        const lines = decoder.decode(fileContents[1]).split('\n');
                        
                        for(const line of lines) {
                            if(line.startsWith('model name')) {
                                const [, value] = line.split(':').map(s => s.trim());
                                this.cpuInfo['Model name'] = value;
                                break;
                            }
                        }
                    }
                }
            }
            else {
                this.cpuInfo = {};
            }
        } catch(e) {
            this.cpuInfo = {};
        }
        
        return this.cpuInfo;
    }
    
    async updateCpuUsageAuto(procStat: PromiseValueHolderStore<string[]>): Promise<boolean> {
        if(Utils.GTop)
            return await this.updateCpuUsageGTop();
        return await this.updateCpuUsageProc(procStat);
    }
    
    async updateCpuUsageProc(procStat: PromiseValueHolderStore<string[]>): Promise<boolean> {
        const procStatValue = await procStat.getValue();
        if(procStatValue.length < 1)
            return false;
        
        //TODO: check dual socket systems
        const cpuLine = procStatValue[0].split(' ').filter(n => n.trim() !== '');
        if(cpuLine.length < 9)
            return false;
        
        // Parse the individual times
        return this.updateCpuUsageCommon({
            user: parseInt(cpuLine[1], 10),
            nice: parseInt(cpuLine[2], 10),
            system: parseInt(cpuLine[3], 10),
            idle: parseInt(cpuLine[4], 10),
            iowait: parseInt(cpuLine[5], 10),
            irq: parseInt(cpuLine[6], 10),
            softirq: parseInt(cpuLine[7], 10),
            steal: parseInt(cpuLine[8], 10)
        });
    }
    
    async updateCpuUsageGTop(): Promise<boolean> {
        const GTop = Utils.GTop;
        if(!GTop)
            return false;
        
        const cpu = new GTop.glibtop_cpu();
        GTop.glibtop_get_cpu(cpu);
        
        return this.updateCpuUsageCommon({
            user: cpu.user,
            nice: cpu.nice,
            system: cpu.sys,
            idle: cpu.idle,
            iowait: cpu.iowait,
            irq: cpu.irq,
            softirq: cpu.softirq,
            steal: 0
        });
    }
    
    updateCpuUsageCommon({user, nice, system, idle, iowait, irq, softirq, steal}: {
        user: number,
        nice: number,
        system: number,
        idle: number,
        iowait: number,
        irq: number,
        softirq: number,
        steal: number
    }): boolean {
        
        // Calculate total time and total idle time
        const totalIdle = idle + iowait + steal;
        const totalUser = user + nice;
        const totalSystem = system + irq + softirq;
        const total = user + nice + system + idle + iowait + irq + softirq + steal;
        
        if(this.previousCpuUsage.total === -1 || !this.previousCpuUsage.raw) {
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
    
    async updateCpuCoresUsageAuto(procStat: PromiseValueHolderStore<string[]>): Promise<boolean> {
        if(Utils.GTop)
            return await this.updateCpuCoresUsageGTop();
        return await this.updateCpuCoresUsageProc(procStat);
    }
    
    async updateCpuCoresUsageProc(procStat: PromiseValueHolderStore<string[]>): Promise<boolean> {
        let procStatValue = await procStat.getValue();
        if(procStatValue.length < 1)
            return false;
        
        // Remove the first line (total CPU usage)
        procStatValue = procStatValue.slice(1);
        
        const cpuCoresUsage: PreviousCpuCoresUsage = [];
        for(let i = 0; i < procStatValue.length; i++) {
            if(!procStatValue[i].startsWith('cpu'))
                break;
            
            const cpuLine = procStatValue[i].split(' ').filter(n => n.trim() !== '');
            if(cpuLine.length < 9)
                continue;
            
            const cpuCoreUsage = this.updateCpuCoresUsageCommon(i, {
                user: parseInt(cpuLine[1], 10),
                nice: parseInt(cpuLine[2], 10),
                system: parseInt(cpuLine[3], 10),
                idle: parseInt(cpuLine[4], 10),
                iowait: parseInt(cpuLine[5], 10),
                irq: parseInt(cpuLine[6], 10),
                softirq: parseInt(cpuLine[7], 10),
                steal: parseInt(cpuLine[8], 10)
            });
            
            if(cpuCoreUsage !== null)
                cpuCoresUsage.push(cpuCoreUsage);
        }
        
        this.pushUsageHistory('cpuCoresUsage', cpuCoresUsage);
        return false;
    }
    
    async updateCpuCoresUsageGTop(): Promise<boolean> {
        const GTop = Utils.GTop;
        if(!GTop)
            return false;
        
        const buf = new GTop.glibtop_cpu();
        GTop.glibtop_get_cpu(buf);
        
        const cpuCoresUsage = [];
        for(let i = 0; i < this.coresNum; i++) {
            const cpu = new GTop.glibtop_cpu();
            GTop.glibtop_get_cpu(cpu);
            
            if(cpu.xcpu_total.length <= i)
                break;
            
            const cpuCoreUsage = this.updateCpuCoresUsageCommon(i, {
                user: cpu.xcpu_user[i],
                nice: cpu.xcpu_nice[i],
                system: cpu.xcpu_sys[i],
                idle: cpu.xcpu_idle[i],
                iowait: cpu.xcpu_iowait[i],
                irq: cpu.xcpu_irq[i],
                softirq: cpu.xcpu_softirq[i],
                steal: 0
            });
            
            if(cpuCoreUsage !== null)
                cpuCoresUsage.push(cpuCoreUsage);
        }
        
        this.pushUsageHistory('cpuCoresUsage', cpuCoresUsage);
        return true;
    }
    
    updateCpuCoresUsageCommon(i: number, {user, nice, system, idle, iowait, irq, softirq, steal}: {
        user: number,
        nice: number,
        system: number,
        idle: number,
        iowait: number,
        irq: number,
        softirq: number,
        steal: number
    }): {total: number, user: number, system: number, idle: number} | null {
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
            return null;
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
        
        return {
            total: cpuUsage,
            user: userUsage,
            system: systemUsage,
            idle: idleUsage
        };
    }
    
    async updateCpuCoresFrequencyProc(): Promise<boolean> {
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
                this.pushUsageHistory('cpuCoresFrequency', frequencies);
                return true;
            }
            catch(e) { /* empty */ }
        }
        
        for(let i = 0; i < this.coresNum; i++)
            frequencies.push(Number.NaN);
        this.pushUsageHistory('cpuCoresFrequency', frequencies);
        return true;
    }
    
    async updateTopProcessesAuto(procStat: PromiseValueHolderStore<string[]>): Promise<boolean> {
        if(Utils.GTop)
            return await this.updateTopProcessesGTop();
        return await this.updateTopProcessesProc(procStat);
    }
    
    /**
     * Checking all /proc/pid/stat to gather the cpu time of each process.
     * This is a very slow operation but it's async so it doesn't block the UI.
     * It still can take up to ~150ms, so it shouldn't be called too often.
     * Note: this approach won't show all processes.
     */
    async updateTopProcessesProc(procStat: PromiseValueHolderStore<string[]>): Promise<boolean> {
        const procStatValue = await procStat.getValue();
        if(procStatValue.length < 1)
            return false;
        
        const topProcesses = [];
        const seenPids = [];
        
        try {
            const cpuLine = procStatValue[0].split(' ').filter(n => n.trim() !== '');
            const totalCpuTime = cpuLine.slice(1, -1).reduce((acc, time) => acc + parseInt(time, 10), 0);
            
            const files = await Utils.readDirAsync('/proc');
            const pids = files.filter(file => /^\d+$/.test(file));
            
            const cpuTimes:Map<number, CpuTime> = new Map();
            
            for(const pid of pids) {
                try {
                    const stat = await Utils.readFileAsync('/proc/' + pid + '/stat');
                    
                    const statParts = stat.split(' ');
                    const utime = parseInt(statParts[13], 10);
                    const stime = parseInt(statParts[14], 10);
                    
                    const nPid = parseInt(pid, 10);
                    if(nPid)
                        cpuTimes.set(nPid, { processTime: utime + stime, totalCpuTime });
                }
                catch(e) {
                    //Avoid spamming the log with errors for processes that are gone
                    //Utils.log(e.message);
                    continue;
                }
            }
            
            for(const [pid, cpuTime] of cpuTimes) {
                seenPids.push(pid);
                
                const previous = this.previousPidsCpuTime.get(pid);
                this.previousPidsCpuTime.set(pid, cpuTime);
                
                if(!previous)
                    continue;
                
                const {
                    processTime: previousProcessTime,
                    totalCpuTime: previousTotalCpuTime
                } = previous;
                
                const totalCpuTimeDiff = totalCpuTime - previousTotalCpuTime;
                const cpuTimeDiff = cpuTime.processTime - previousProcessTime;
                const cpuUsagePercent = (cpuTimeDiff / totalCpuTimeDiff) * 100.0;
                
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
                topProcesses.push({ process, cpu: cpuUsagePercent });
            }
        }
        catch(e: any) {
            Utils.error(e.message);
            return false;
        }
        
        topProcesses.sort((a, b) => b.cpu - a.cpu);
        topProcesses.splice(ProcessorMonitor.TOP_PROCESSES_LIMIT);
        
        for(const pid of this.previousPidsCpuTime.keys()) {
            if(!seenPids.includes(pid))
                this.previousPidsCpuTime.delete(pid);
        }
        
        this.topProcessesCache.updateNotSeen(seenPids);
        this.setUsageValue('topProcesses', topProcesses);
        return true;
    }
    
    async updateTopProcessesGTop(): Promise<boolean> {
        const GTop = Utils.GTop;
        if(!GTop)
            return false;
        
        const buf = new GTop.glibtop_proclist();
        const pids = GTop.glibtop_get_proclist(buf, GTop.GLIBTOP_KERN_PROC_ALL, 0); // GLIBTOP_EXCLUDE_IDLE
        pids.length = buf.number;
        
        const topProcesses = [];
        const seenPids = [];
        
        for(const pid of pids) {
            seenPids.push(pid);
            
            let process = this.topProcessesCache.getProcess(pid);
            if(!process) {
                const argSize = new GTop.glibtop_proc_args();
                let cmd = GTop.glibtop_get_proc_args(argSize, pid, 0);
                
                if(!cmd) {
                    const procState = new GTop.glibtop_proc_state();
                    GTop.glibtop_get_proc_state(procState, pid);
                    if(procState && procState.cmd) {
                        let str = '';
                        for(let i = 0; i < procState.cmd.length; i++) {
                            if(procState.cmd[i] === 0)
                                break;
                            str += String.fromCharCode(procState.cmd[i]);
                        }
                        cmd = str ? `[${str}]` : cmd;
                    }
                }
                
                if(!cmd) {
                    //Utils.log('cmd is null for pid: ' + pid);
                    continue;
                }
                
                process = {
                    pid: pid,
                    exec: Utils.extractCommandName(cmd),
                    cmd: cmd,
                    notSeen: 0
                };
                this.topProcessesCache.setProcess(process);
            }
            
            const cpuData = new GTop.glibtop_cpu();
            GTop.glibtop_get_cpu(cpuData);
            const totalCpuTime = cpuData.total;
            
            const time = new GTop.glibtop_proc_time();
            GTop.glibtop_get_proc_time(time, pid);
            
            const cpuTime = { processTime: time.utime + time.stime, totalCpuTime };
            
            const previous = this.previousPidsCpuTime.get(pid);
            this.previousPidsCpuTime.set(pid, cpuTime);
            
            if(!previous)
                continue;
            
            const {
                processTime: previousProcessTime,
                totalCpuTime: previousTotalCpuTime
            } = previous;
            
            const totalCpuTimeDiff = totalCpuTime - previousTotalCpuTime;
            const cpuTimeDiff = cpuTime.processTime - previousProcessTime;
            const cpuUsagePercent = (cpuTimeDiff / totalCpuTimeDiff) * 100.0;
            
            topProcesses.push({ process, cpu: cpuUsagePercent });
        }
        
        topProcesses.sort((a, b) => b.cpu - a.cpu);
        topProcesses.splice(ProcessorMonitor.TOP_PROCESSES_LIMIT);
        
        for(const pid of this.previousPidsCpuTime.keys()) {
            if(!seenPids.includes(pid))
                this.previousPidsCpuTime.delete(pid);
        }
        
        this.topProcessesCache.updateNotSeen(seenPids);
        this.setUsageValue('topProcesses', topProcesses);
        return true;
    }
    
    updateAmdGpu(data: ContinuosTaskManagerData) {
        if(data.exit || !data.result)
            return;
        
        try {
            const json = JSON.parse(data.result);
            
            const gpus = new Map<string, any>();
            for(const gpuInfo of json.devices) {
                const id = gpuInfo.Info?.PCI;
                
                const gpu:AmdInfo = {
                    id,
                    family: 'AMD',
                    vram: {},
                    activity: {},
                    raw: gpuInfo
                };
                
                if(gpuInfo.VRAM) {
                    const toalData = gpuInfo.VRAM['Total VRAM'];
                    if(toalData && toalData.value && toalData.unit) {
                        const total = Utils.convertToBytes(toalData.value, toalData.unit);
                        if(total >= 0)
                            gpu.vram.total = total;
                    }
                    
                    const usedData = gpuInfo.VRAM['Total VRAM Usage'];
                    if(usedData && usedData.value && usedData.unit) {
                        const used = Utils.convertToBytes(usedData.value, usedData.unit);
                        if(used >= 0)
                            gpu.vram.used = used;
                    }
                    
                    if(gpu.vram.total !== undefined && gpu.vram.used !== undefined)
                        gpu.vram.percent = (gpu.vram.used / gpu.vram.total) * 100;
                }
                
                if(gpuInfo.gpu_activity && gpuInfo.gpu_activity.GFX && Object.prototype.hasOwnProperty.call(gpuInfo.gpu_activity.GFX, 'value') && gpuInfo.gpu_activity.GFX.unit === '%') {
                    const GFX = gpuInfo.gpu_activity.GFX.value;
                    if(typeof GFX === 'string')
                        gpu.activity.GFX = parseFloat(GFX);
                    else
                        gpu.activity.GFX = GFX;
                }
                else if(gpuInfo.GRBM && gpuInfo.GRBM['Graphics Pipe'] && Object.prototype.hasOwnProperty.call(gpuInfo.GRBM['Graphics Pipe'], 'value') && gpuInfo.GRBM['Graphics Pipe'].unit === '%') {
                    const gfx = gpuInfo.GRBM['Graphics Pipe'].value;
                    if(typeof gfx === 'string')
                        gpu.activity.GFX = parseFloat(gfx);
                    else
                        gpu.activity.GFX = gfx;
                }
                
                gpus.set(id, gpu);
            }
            
            this.notify('gpuUpdate', gpus);
        }
        catch(e: any) {
            Utils.error(`updateAmdGpu: ${e.message}`);
        }
    }
    
    updateNvidiaGpu(data: ContinuosTaskManagerData) {
        if(data.exit || !data.result)
            return;
        
        try {
            const xml = Utils.xmlParse(data.result);
            
            if(!xml.nvidia_smi_log)
                return;
            
            let gpuInfoList = xml.nvidia_smi_log.gpu;
            if(!gpuInfoList || gpuInfoList.length === 0)
                return;
            
            if(!Array.isArray(gpuInfoList))
                gpuInfoList = [gpuInfoList];
            
            const gpus = new Map<string, any>();
            
            for(const gpuInfo of gpuInfoList) {
                if(!gpuInfo['@id'])
                    continue;
                
                let id = gpuInfo['@id'];
                if(id.startsWith('00000000:'))
                    id = id.slice(4);
                
                const gpu:NvidiaInfo = {
                    id,
                    family: 'NVIDIA',
                    vram: {},
                    activity: {},
                    raw: gpuInfo
                };
                
                if(gpuInfo.fb_memory_usage) {
                    const toalData = gpuInfo.fb_memory_usage.total;
                    if(toalData && toalData['#text']) {
                        const [value, unit] = toalData['#text'].split(' ');
                        
                        const total = Utils.convertToBytes(value, unit);
                        if(total >= 0)
                            gpu.vram.total = total;
                    }
                    
                    const usedData = gpuInfo.fb_memory_usage.used;
                    if(usedData && usedData['#text']) {
                        const [value, unit] = usedData['#text'].split(' ');
                        
                        const used = Utils.convertToBytes(value, unit);
                        if(used >= 0)
                            gpu.vram.used = used;
                    }
                    
                    if(gpu.vram.total !== undefined && gpu.vram.used !== undefined)
                        gpu.vram.percent = (gpu.vram.used / gpu.vram.total) * 100;
                }
                
                if(gpuInfo.utilization && gpuInfo.utilization.gpu_util && Object.prototype.hasOwnProperty.call(gpuInfo.utilization.gpu_util, '#text')) {
                    const [value, unit] = gpuInfo.utilization.gpu_util['#text'].split(' ');
                    if(unit === '%')
                        gpu.activity.GFX = parseFloat(value);
                }
                
                gpus.set(id, gpu);
            }
            
            this.notify('gpuUpdate', gpus);
        }
        catch(e: any) {
            Utils.error(`updateNvidiaGpu: ${e.message}`);
        }
    }
    
    destroy() {
        Config.clear(this);
        super.destroy();
    }
}