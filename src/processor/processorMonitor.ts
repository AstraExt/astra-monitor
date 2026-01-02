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
import PromiseValueHolder, { PromiseValueHolderStore } from '../utils/promiseValueHolder.js';

export type ProcessorUsage = {
    idle: number;
    user: number;
    system: number;
    total: number;
    offline?: boolean;

    raw?: {
        user: number;
        nice: number;
        system: number;
        idle: number;
        iowait: number;
        irq: number;
        softirq: number;
        steal: number;
    };
};

type PreviousCpuCoresUsage = Array<ProcessorUsage>;

type ProcessorDataSources = {
    cpuUsage?: string;
    cpuCoresUsage?: string;
    topProcesses?: string;
    loadAvg?: string;
};

type CpuTime = {
    processTime: number;
    totalCpuTime: number;
};

export type CpuInfo = { [key: string]: any };

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
    private updateLoadAvgTask: CancellableTaskManager<boolean>;

    private previousCpuUsage!: ProcessorUsage;
    private previousCpuCoresUsage!: PreviousCpuCoresUsage;
    private previousPidsCpuTime!: Map<number, CpuTime>;

    private cpuPresent: number[] | null;
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
        this.updateLoadAvgTask = new CancellableTaskManager();

        this.cpuPresent = null;
        this.getCpuTopology();

        this.getCpuInfoSync();

        this.reset();
        this.dataSourcesInit();

        const enabled = Config.get_boolean('processor-header-show');
        if(enabled) this.start();

        Config.connect(this, 'changed::processor-header-show', () => {
            if(Config.get_boolean('processor-header-show')) this.start();
            else this.stop();
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
        };
        const numCores = this.getCpuTopology().length;
        this.previousCpuCoresUsage = new Array(numCores);
        for(let i = 0; i < numCores || 0; i++) {
            this.previousCpuCoresUsage[i] = {
                idle: -1,
                user: -1,
                system: -1,
                total: -1,
            };
        }

        this.topProcessesCache?.reset();
        this.topProcessesTime = -1;

        this.previousPidsCpuTime = new Map();

        this.updateCpuUsageTask?.cancel();
        this.updateCoresUsageTask?.cancel();
        this.updateCoresFrequencyTask?.cancel();
        this.updateTopProcessesTask?.cancel();
        this.updateLoadAvgTask?.cancel();
    }

    override start() {
        super.start();
    }

    override stop() {
        super.stop();
        this.reset();
    }

    dataSourcesInit() {
        this.dataSources = {
            cpuUsage: Config.get_string('processor-source-cpu-usage') ?? undefined,
            cpuCoresUsage: Config.get_string('processor-source-cpu-cores-usage') ?? undefined,
            topProcesses: Config.get_string('processor-source-top-processes') ?? undefined,
            loadAvg: Config.get_string('processor-source-load-avg') ?? undefined,
        };

        Config.connect(this, 'changed::processor-source-cpu-usage', () => {
            this.dataSources.cpuUsage =
                Config.get_string('processor-source-cpu-usage') ?? undefined;
            this.updateCpuUsageTask.cancel();
            this.previousCpuUsage = {
                idle: -1,
                user: -1,
                system: -1,
                total: -1,
            };
            this.resetUsageHistory('cpuUsage');
        });

        Config.connect(this, 'changed::processor-source-cpu-cores-usage', () => {
            this.dataSources.cpuCoresUsage =
                Config.get_string('processor-source-cpu-cores-usage') ?? undefined;
            this.updateCoresUsageTask.cancel();
            const numCores = this.getCpuTopology().length;
            this.previousCpuCoresUsage = new Array(numCores);
            for(let i = 0; i < numCores; i++) {
                this.previousCpuCoresUsage[i] = {
                    idle: -1,
                    user: -1,
                    system: -1,
                    total: -1,
                };
            }
            this.resetUsageHistory('cpuCoresUsage');
        });

        Config.connect(this, 'changed::processor-source-top-processes', () => {
            this.dataSources.topProcesses =
                Config.get_string('processor-source-top-processes') ?? undefined;
            this.updateTopProcessesTask.cancel();
            this.topProcessesCache.reset();
            this.topProcessesTime = -1;
            this.previousPidsCpuTime = new Map();
            this.resetUsageHistory('topProcesses');
        });

        Config.connect(this, 'changed::processor-source-load-avg', () => {
            this.dataSources.loadAvg = Config.get_string('processor-source-load-avg') ?? undefined;
            this.updateLoadAvgTask.cancel();
            this.resetUsageHistory('loadAverage');
        });
    }

    stopListeningFor(code: string) {
        if(code === 'topProcesses') {
            this.previousPidsCpuTime = new Map();
        }
    }

    update(): boolean {
        Utils.verbose('Updating Processor Monitor');

        const enabled = Config.get_boolean('processor-header-show');
        if(enabled) {
            const procStat = new PromiseValueHolderStore<string[]>(
                this.getProcStatAsync.bind(this)
            );

            this.runUpdate('cpuUsage', procStat);
            this.runUpdate('cpuCoresUsage', procStat);
            this.runUpdate('cpuCoresFrequency');

            if(this.isListeningFor('topProcesses'))
                this.runUpdate('topProcesses', false, procStat);
            else this.topProcessesCache.updateNotSeen([]);

            if(this.isListeningFor('loadAverage')) {
                const procLoadAvgStore = new PromiseValueHolderStore<string[]>(
                    this.getProcLoadAvgAsync.bind(this)
                );
                this.runUpdate('loadAverage', procLoadAvgStore);
            }
        }
        return true;
    }

    override requestUpdate(key: string) {
        if(key === 'cpuUsage') {
            if(!this.updateCpuUsageTask.isRunning) {
                const procStatStore = new PromiseValueHolderStore<string[]>(
                    this.getProcStatAsync.bind(this)
                );
                this.runUpdate('cpuUsage', procStatStore);
            }
        } else if(key === 'cpuCoresUsage') {
            if(!this.updateCoresUsageTask.isRunning) {
                const procStatStore = new PromiseValueHolderStore<string[]>(
                    this.getProcStatAsync.bind(this)
                );
                this.runUpdate('cpuCoresUsage', procStatStore);
            }
        } else if(key === 'cpuCoresFrequency') {
            if(!this.updateCoresFrequencyTask.isRunning) {
                this.runUpdate('cpuCoresFrequency');
            }
        } else if(key === 'topProcesses') {
            if(!this.updateTopProcessesTask.isRunning) {
                const procStatStore = new PromiseValueHolderStore<string[]>(
                    this.getProcStatAsync.bind(this)
                );
                this.runUpdate('topProcesses', true, procStatStore);
            }
            // Don't push to the queue
            return;
        } else if(key === 'loadAverage') {
            if(!this.updateLoadAvgTask.isRunning) {
                const procLoadAvgStore = new PromiseValueHolderStore<string[]>(
                    this.getProcLoadAvgAsync.bind(this)
                );
                this.runUpdate('loadAverage', procLoadAvgStore);
            }
        }

        super.requestUpdate(key);
    }

    runUpdate(key: string, ...params: any[]) {
        if(key === 'cpuUsage') {
            let run;
            if(this.dataSources.cpuUsage === 'GTop')
                run = this.updateCpuUsageGTop.bind(this, ...params);
            else if(this.dataSources.cpuUsage === 'proc')
                run = this.updateCpuUsageProc.bind(this, ...params);
            else run = this.updateCpuUsageAuto.bind(this, ...params);

            this.runTask({
                key,
                task: this.updateCpuUsageTask,
                run,
                callback: this.notify.bind(this, 'cpuUsage'),
            });
            return;
        }
        if(key === 'cpuCoresUsage') {
            let run;
            if(this.dataSources.cpuCoresUsage === 'GTop')
                run = this.updateCpuCoresUsageGTop.bind(this, ...params);
            else if(this.dataSources.cpuCoresUsage === 'proc')
                run = this.updateCpuCoresUsageProc.bind(this, ...params);
            else run = this.updateCpuCoresUsageAuto.bind(this, ...params);

            this.runTask({
                key,
                task: this.updateCoresUsageTask,
                run,
                callback: this.notify.bind(this, 'cpuCoresUsage'),
            });
            return;
        }
        if(key === 'cpuCoresFrequency') {
            this.runTask({
                key,
                task: this.updateCoresFrequencyTask,
                run: this.updateCpuCoresFrequencyProc.bind(this, ...params),
                callback: this.notify.bind(this, 'cpuCoresFrequency'),
            });
            return;
        }
        if(key === 'topProcesses') {
            const forced = params.shift();

            //Top processes should never be called more than twice per second
            //unless it's forced
            const now = GLib.get_monotonic_time();
            if(!forced && now - this.topProcessesTime < 500000)
                // 0.5s
                return;
            if(!forced) this.topProcessesTime = now;

            let run;
            if(this.dataSources.topProcesses === 'GTop')
                run = this.updateTopProcessesGTop.bind(this, ...params);
            else if(this.dataSources.topProcesses === 'proc')
                run = this.updateTopProcessesProc.bind(this, ...params);
            else run = this.updateTopProcessesAuto.bind(this, ...params);

            this.runTask({
                key,
                task: this.updateTopProcessesTask,
                run,
                callback: this.notify.bind(this, 'topProcesses'),
            });
            return;
        }
        if(key === 'loadAverage') {
            let run;
            if(this.dataSources.loadAvg === 'proc')
                run = this.updateLoadAvgProc.bind(this, ...params);
            else run = this.updateLoadAvgAuto.bind(this, ...params);

            this.runTask({
                key,
                task: this.updateLoadAvgTask,
                run,
                callback: this.notify.bind(this, 'loadAverage'),
            });
            return;
        }
    }

    getProcStatAsync(): PromiseValueHolder<string[]> {
        return new PromiseValueHolder(
            new Promise((resolve, reject) => {
                Utils.readFileAsync('/proc/stat')
                    .then(fileContent => {
                        resolve(fileContent.split('\n'));
                    })
                    .catch(e => {
                        reject(e);
                    });
            })
        );
    }

    getCpuPresentSync(): number[] {
        // this is used very rarely, only on first setup
        // takes ~0.02ms but could be more on slower systems
        const fileContents = GLib.file_get_contents('/sys/devices/system/cpu/present');
        if(fileContents && fileContents[0]) {
            const decoder = new TextDecoder('utf8');
            return Utils.parseCpuPresentFile(decoder.decode(fileContents[1]));
        }
        return [];
    }

    /**
     * This is a sync function but caches the result
     */
    getCpuTopology(): number[] {
        if(this.cpuPresent !== null) return this.cpuPresent;
        this.cpuPresent = this.getCpuPresentSync();
        return this.cpuPresent;
    }

    /**
     * This is a sync function but caches the result
     */
    getCpuInfoSync(): CpuInfo {
        if(this.cpuInfo !== undefined) return this.cpuInfo;

        this.cpuInfo = {};

        try {
            if(!Utils.hasLscpu()) return this.cpuInfo;

            //TODO: switch to lscpu --json!?
            const path = Utils.commandPathLookup('lscpu --version');
            const [result, stdout, _stderr] = GLib.spawn_command_line_sync(`${path}lscpu`);

            if(!result || !stdout) return this.cpuInfo;

            const decoder = new TextDecoder('utf8');
            const output = decoder.decode(stdout);

            let lines = output.split('\n');
            const cpuInfo: CpuInfo = {};
            let currentCategory = cpuInfo;
            let lastKey: string | null = null;

            for(const line of lines) {
                if(line.trim() === '') continue;

                if(line.endsWith(':')) {
                    // New category
                    const categoryName = line.slice(0, -1).trim();
                    cpuInfo[categoryName] = {};
                    currentCategory = cpuInfo[categoryName];
                    lastKey = null;
                } else if(line.includes(':')) {
                    // Key-value pair
                    const [key, value] = line.split(':').map(s => s.trim());
                    if(key === 'Flags') {
                        currentCategory[key] = value.split(' ');
                    } else {
                        currentCategory[key] = value;
                    }
                    lastKey = key;
                } else if(lastKey && lastKey === 'Flags') {
                    // Continuation of Flags
                    currentCategory[lastKey] = currentCategory[lastKey].concat(
                        line.trim().split(' ')
                    );
                } else if(lastKey) {
                    // Continuation of the last key in the current category
                    currentCategory[lastKey] += '\n' + line.trim();
                }
            }

            this.cpuInfo = cpuInfo;

            if(!this.cpuInfo['Model name']) {
                // lscpu is localized, so we need to fallback to /proc/cpuinfo
                // TODO: fix flags too

                const fileContents = GLib.file_get_contents('/proc/cpuinfo');
                if(fileContents && fileContents[0]) {
                    lines = decoder.decode(fileContents[1]).split('\n');

                    for(const line of lines) {
                        if(line.startsWith('model name')) {
                            const [, value] = line.split(':').map(s => s.trim());
                            this.cpuInfo['Model name'] = value;
                            break;
                        }
                    }
                }
            }
        } catch(e) {
            this.cpuInfo = {};
        }

        return this.cpuInfo;
    }

    updateCpuUsageAuto(procStat: PromiseValueHolderStore<string[]>): Promise<boolean> {
        if(Utils.GTop) return this.updateCpuUsageGTop();
        return this.updateCpuUsageProc(procStat);
    }

    async updateCpuUsageProc(procStat: PromiseValueHolderStore<string[]>): Promise<boolean> {
        const procStatValue = await procStat.getValue();
        if(procStatValue.length < 1) return false;

        //TODO: check dual socket systems
        const cpuLine = procStatValue[0].split(' ').filter(n => n.trim() !== '');
        if(cpuLine.length < 9) return false;

        // Parse the individual times
        return this.updateCpuUsageCommon({
            user: parseInt(cpuLine[1], 10),
            nice: parseInt(cpuLine[2], 10),
            system: parseInt(cpuLine[3], 10),
            idle: parseInt(cpuLine[4], 10),
            iowait: parseInt(cpuLine[5], 10),
            irq: parseInt(cpuLine[6], 10),
            softirq: parseInt(cpuLine[7], 10),
            steal: parseInt(cpuLine[8], 10),
        });
    }

    async updateCpuUsageGTop(): Promise<boolean> {
        const GTop = Utils.GTop;
        if(!GTop) return false;

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
            steal: 0,
        });
    }

    private updateCpuUsageCommon({
        user,
        nice,
        system,
        idle,
        iowait,
        irq,
        softirq,
        steal,
    }: {
        user: number;
        nice: number;
        system: number;
        idle: number;
        iowait: number;
        irq: number;
        softirq: number;
        steal: number;
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
                steal: steal,
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
            steal: steal,
        };

        // Calculate the percentage of CPU usage
        const cpuUsage = ((totalDelta - idleDelta) / totalDelta) * 100;
        const userUsage = (userDelta / totalDelta) * 100;
        const systemUsage = (systemDelta / totalDelta) * 100;
        const idleUsage = (idleDelta / totalDelta) * 100;

        const rawUserUsage = (rawUserDelta / totalDelta) * 100;
        const rawNiceUsage = (rawNiceDelta / totalDelta) * 100;
        const rawSystemUsage = (rawSystemDelta / totalDelta) * 100;
        const rawIdleUsage = (rawIdleDelta / totalDelta) * 100;
        const rawIowaitUsage = (rawIowaitDelta / totalDelta) * 100;
        const rawIrqUsage = (rawIrqDelta / totalDelta) * 100;
        const rawSoftirqUsage = (rawSoftirqDelta / totalDelta) * 100;
        const rawStealUsage = (rawStealDelta / totalDelta) * 100;

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
                steal: rawStealUsage,
            },
        });
        return true;
    }

    updateCpuCoresUsageAuto(procStat: PromiseValueHolderStore<string[]>): Promise<boolean> {
        if(Utils.GTop) return this.updateCpuCoresUsageGTop();
        return this.updateCpuCoresUsageProc(procStat);
    }

    async updateCpuCoresUsageProc(procStat: PromiseValueHolderStore<string[]>): Promise<boolean> {
        const procStatValue = await procStat.getValue();
        if(procStatValue.length < 1) return false;

        // Map cpu id to line parts
        const cpuLines = new Map<number, string[]>();
        // Skip first line (total CPU usage)
        for(let i = 1; i < procStatValue.length; i++) {
            const line = procStatValue[i];
            if(!line.startsWith('cpu')) break;

            const parts = line.split(' ').filter(n => n.trim() !== '');
            if(parts.length < 9) continue;

            const cpuIdStr = parts[0].substring(3);
            const cpuId = parseInt(cpuIdStr, 10);
            if(!isNaN(cpuId)) {
                cpuLines.set(cpuId, parts);
            }
        }

        const topology = this.getCpuTopology();
        const cpuCoresUsage: any[] = [];

        for(let i = 0; i < topology.length; i++) {
            const coreId = topology[i];
            const cpuLine = cpuLines.get(coreId);

            if(cpuLine) {
                const usage = this.updateCpuCoresUsageCommon(i, {
                    user: parseInt(cpuLine[1], 10),
                    nice: parseInt(cpuLine[2], 10),
                    system: parseInt(cpuLine[3], 10),
                    idle: parseInt(cpuLine[4], 10),
                    iowait: parseInt(cpuLine[5], 10),
                    irq: parseInt(cpuLine[6], 10),
                    softirq: parseInt(cpuLine[7], 10),
                    steal: parseInt(cpuLine[8], 10),
                });

                if(usage) cpuCoresUsage.push(usage);
                else cpuCoresUsage.push({ total: 0, user: 0, system: 0, idle: 0 });
            } else {
                // Offline
                this.previousCpuCoresUsage[i] = {
                    idle: -1,
                    user: -1,
                    system: -1,
                    total: -1,
                };
                cpuCoresUsage.push({
                    total: 0,
                    user: 0,
                    system: 0,
                    idle: 0,
                    offline: true,
                });
            }
        }

        this.pushUsageHistory('cpuCoresUsage', cpuCoresUsage);
        return false;
    }

    async updateCpuCoresUsageGTop(): Promise<boolean> {
        const GTop = Utils.GTop;
        if(!GTop) return false;

        const cpu = new GTop.glibtop_cpu();
        GTop.glibtop_get_cpu(cpu);

        const cpuCoresUsage = [];
        const topology = this.getCpuTopology();

        for(let i = 0; i < topology.length; i++) {
            const coreId = topology[i];

            // Check if we have data for this core (GTop returns 0 for offline cores)
            if(coreId < cpu.xcpu_total.length && cpu.xcpu_total[coreId] > 0) {
                const cpuCoreUsage = this.updateCpuCoresUsageCommon(i, {
                    user: cpu.xcpu_user[coreId],
                    nice: cpu.xcpu_nice[coreId],
                    system: cpu.xcpu_sys[coreId],
                    idle: cpu.xcpu_idle[coreId],
                    iowait: cpu.xcpu_iowait[coreId],
                    irq: cpu.xcpu_irq[coreId],
                    softirq: cpu.xcpu_softirq[coreId],
                    steal: 0,
                });

                if(cpuCoreUsage !== null) cpuCoresUsage.push(cpuCoreUsage);
                else cpuCoresUsage.push({ total: 0, user: 0, system: 0, idle: 0 });
            } else {
                // Offline
                this.previousCpuCoresUsage[i] = {
                    idle: -1,
                    user: -1,
                    system: -1,
                    total: -1,
                };
                cpuCoresUsage.push({
                    total: 0,
                    user: 0,
                    system: 0,
                    idle: 0,
                    offline: true,
                });
            }
        }

        this.pushUsageHistory('cpuCoresUsage', cpuCoresUsage);
        return true;
    }

    updateCpuCoresUsageCommon(
        i: number,
        {
            user,
            nice,
            system,
            idle,
            iowait,
            irq,
            softirq,
            steal,
        }: {
            user: number;
            nice: number;
            system: number;
            idle: number;
            iowait: number;
            irq: number;
            softirq: number;
            steal: number;
        }
    ): { total: number; user: number; system: number; idle: number } | null {
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
        const cpuUsage = ((totalDelta - idleDelta) / totalDelta) * 100;
        const userUsage = (userDelta / totalDelta) * 100;
        const systemUsage = (systemDelta / totalDelta) * 100;
        const idleUsage = (idleDelta / totalDelta) * 100;

        return {
            total: cpuUsage,
            user: userUsage,
            system: systemUsage,
            idle: idleUsage,
        };
    }

    /**
     * Reading frequency from /sys/devices/system/cpu/cpu<N>/cpufreq/scaling_cur_freq
     * This read frequency in KHz. This function read the frequency and converts it in MHz
     * by dividing it with 1000.
     *
     * source: https://www.kernel.org/doc/Documentation/cpu-freq/user-guide.txt#:~:text=scaling_cur_freq%20%3A%20Current%20frequency%20of%20the,and%20cpufreq%20core%2C%20in%20KHz.
     *
     */
    async updateCpuCoresFrequencyProc(): Promise<boolean> {
        const topology = this.getCpuTopology();

        if(this.isListeningFor('cpuCoresFrequency')) {
            try {
                const paths = topology.map(
                    coreId => `/sys/devices/system/cpu/cpu${coreId}/cpufreq/scaling_cur_freq`
                );

                const readFiles = paths.map(path => {
                    return Utils.readFileAsync(path)
                        .then(fileContent => {
                            if(fileContent) {
                                if(Utils.isIntOrIntString(fileContent)) return Number.NaN;
                                else return parseInt(fileContent, 10) / 1000;
                            } else {
                                return Number.NaN;
                            }
                        })
                        .catch(() => {
                            return Number.NaN;
                        });
                });

                const frequencies = await Promise.all(readFiles);
                this.pushUsageHistory('cpuCoresFrequency', frequencies);
                return true;
            } catch(e) {
                /* empty */
            }
        }

        const frequencies: number[] = [];
        for(let i = 0; i < topology.length; i++) frequencies.push(Number.NaN);
        this.pushUsageHistory('cpuCoresFrequency', frequencies);
        return true;
    }

    updateTopProcessesAuto(procStat: PromiseValueHolderStore<string[]>): Promise<boolean> {
        if(Utils.GTop) return this.updateTopProcessesGTop();
        return this.updateTopProcessesProc(procStat);
    }

    /**
     * Checking all /proc/pid/stat to gather the cpu time of each process.
     * This is a very slow operation but it's async so it doesn't block the UI.
     * It still can take up to ~150ms, so it shouldn't be called too often.
     * Note: this approach won't show all processes.
     */
    async updateTopProcessesProc(procStat: PromiseValueHolderStore<string[]>): Promise<boolean> {
        const procStatValue = await procStat.getValue();
        if(procStatValue.length < 1) return false;

        const seenPids: number[] = [];
        const cpuLine = procStatValue[0].split(' ').filter(n => n.trim() !== '');
        const totalCpuTime = cpuLine
            .slice(1, -1)
            .reduce((acc, time) => acc + parseInt(time, 10), 0);

        const files = await Utils.readDirAsync('/proc');
        const pids = files.filter(file => /^\d+$/.test(file));

        const cpuTimesPromises = pids.map(async pid => {
            try {
                const stat = await Utils.readFileAsync('/proc/' + pid + '/stat');
                const statParts = stat.split(' ');
                const utime = parseInt(statParts[13], 10);
                const stime = parseInt(statParts[14], 10);

                const nPid = parseInt(pid, 10);
                if(nPid) return { nPid, cpuTime: { processTime: utime + stime, totalCpuTime } };
                return null;
            } catch(_e) {
                return null; // Avoid logging errors for gone processes
            }
        });

        const cpuTimesResults = await Promise.all(cpuTimesPromises);
        const cpuTimes = new Map();

        for(const result of cpuTimesResults) {
            if(result) cpuTimes.set(result.nPid, result.cpuTime);
        }

        const processInfoPromises = Array.from(cpuTimes).map(async ([pid, cpuTime]) => {
            seenPids.push(pid);

            const previous = this.previousPidsCpuTime.get(pid);
            this.previousPidsCpuTime.set(pid, cpuTime);

            if(!previous) return null;

            const { processTime: previousProcessTime, totalCpuTime: previousTotalCpuTime } =
                previous;

            const totalCpuTimeDiff = totalCpuTime - previousTotalCpuTime;
            const cpuTimeDiff = cpuTime.processTime - previousProcessTime;
            const cpuUsagePercent = (cpuTimeDiff / totalCpuTimeDiff) * 100.0;

            try {
                let fileContent = await Utils.readFileAsync(`/proc/${pid}/cmdline`);
                let process;
                if(fileContent === '') {
                    fileContent = await Utils.readFileAsync(`/proc/${pid}/comm`);
                    process = {
                        pid: pid,
                        exec: Utils.extractCommandName(fileContent),
                        cmd: fileContent,
                        notSeen: 0,
                    };
                } else {
                    process = {
                        pid: pid,
                        exec: Utils.extractCommandName(fileContent),
                        cmd: fileContent,
                        notSeen: 0,
                    };
                }
                return { process, cpu: cpuUsagePercent };
            } catch(_e) {
                return null;
            }
        });

        const processes = await Promise.all(processInfoPromises);
        const topProcesses: any[] = processes.filter(proc => proc !== null);
        topProcesses.sort((a, b) => b.cpu - a.cpu);
        topProcesses.splice(ProcessorMonitor.TOP_PROCESSES_LIMIT);

        this.topProcessesCache.updateNotSeen(seenPids);
        this.setUsageValue('topProcesses', topProcesses);
        return true;
    }

    async updateTopProcessesGTop(): Promise<boolean> {
        const GTop = Utils.GTop;
        if(!GTop) return false;

        const buf = new GTop.glibtop_proclist();
        const pids = GTop.glibtop_get_proclist(buf, GTop.GLIBTOP_KERN_PROC_ALL, 0);

        pids.length = buf.number;

        const topProcesses = [];
        const seenPids = [];

        const cpuData = new GTop.glibtop_cpu();
        GTop.glibtop_get_cpu(cpuData);
        const totalCpuTime = cpuData.total;

        const time = new GTop.glibtop_proc_time();
        let procState = null;
        let argSize = null;

        for(const pid of pids) {
            seenPids.push(pid);

            let process = this.topProcessesCache.getProcess(pid);
            if(!process) {
                if(!argSize) argSize = new GTop.glibtop_proc_args();
                let cmd = GTop.glibtop_get_proc_args(argSize, pid, 0);

                if(!cmd) {
                    if(!procState) procState = new GTop.glibtop_proc_state();
                    GTop.glibtop_get_proc_state(procState, pid);
                    if(procState && procState.cmd) {
                        let str = '';
                        for(let i = 0; i < procState.cmd.length; i++) {
                            if(procState.cmd[i] === 0) break;
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
                    notSeen: 0,
                };
                this.topProcessesCache.setProcess(process);
            }

            GTop.glibtop_get_proc_time(time, pid);

            const cpuTime = { processTime: time.utime + time.stime, totalCpuTime };

            const previous = this.previousPidsCpuTime.get(pid);
            this.previousPidsCpuTime.set(pid, cpuTime);

            if(!previous) continue;

            const { processTime: previousProcessTime, totalCpuTime: previousTotalCpuTime } =
                previous;

            const totalCpuTimeDiff = totalCpuTime - previousTotalCpuTime;
            const cpuTimeDiff = cpuTime.processTime - previousProcessTime;
            const cpuUsagePercent = (cpuTimeDiff / totalCpuTimeDiff) * 100.0;

            topProcesses.push({ process, cpu: cpuUsagePercent });
        }

        topProcesses.sort((a, b) => b.cpu - a.cpu);
        topProcesses.splice(ProcessorMonitor.TOP_PROCESSES_LIMIT);

        for(const pid of this.previousPidsCpuTime.keys()) {
            if(!seenPids.includes(pid)) this.previousPidsCpuTime.delete(pid);
        }

        this.topProcessesCache.updateNotSeen(seenPids);
        this.setUsageValue('topProcesses', topProcesses);
        return true;
    }

    getProcLoadAvgAsync(): PromiseValueHolder<string[]> {
        return new PromiseValueHolder(
            new Promise((resolve, reject) => {
                Utils.readFileAsync('/proc/loadavg')
                    .then(fileContent => {
                        resolve(fileContent.split(' '));
                    })
                    .catch(e => {
                        reject(e);
                    });
            })
        );
    }

    updateLoadAvgAuto(procLoadAvg: PromiseValueHolderStore<string>): Promise<boolean> {
        return this.updateLoadAvgProc(procLoadAvg);
    }

    async updateLoadAvgProc(procLoadAvg: PromiseValueHolderStore<string>): Promise<boolean> {
        const procLoadAvgValue = await procLoadAvg.getValue();
        if(procLoadAvgValue.length < 4) return false;

        this.setUsageValue('loadAverage', {
            load1m: parseFloat(procLoadAvgValue[0]),
            load5m: parseFloat(procLoadAvgValue[1]),
            load15m: parseFloat(procLoadAvgValue[2]),
            threadsActive: parseInt(procLoadAvgValue[3].split('/')[0], 10),
            threadsTotal: parseInt(procLoadAvgValue[3].split('/')[1], 10),
        });
        return true;
    }

    override destroy() {
        this.stop();
        Config.clear(this);

        this.topProcessesCache?.reset();
        this.topProcessesCache = undefined as any;

        this.updateCpuUsageTask?.cancel();
        this.updateCpuUsageTask = undefined as any;

        this.updateCoresUsageTask?.cancel();
        this.updateCoresUsageTask = undefined as any;

        this.updateCoresFrequencyTask?.cancel();
        this.updateCoresFrequencyTask = undefined as any;

        this.updateTopProcessesTask?.cancel();
        this.updateTopProcessesTask = undefined as any;

        this.updateLoadAvgTask?.cancel();
        this.updateLoadAvgTask = undefined as any;

        this.previousPidsCpuTime.clear();

        super.destroy();
    }
}
