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
import TopProcessesCache from '../utils/topProcessesCache.js';
import CancellableTaskManager from '../utils/cancellableTaskManager.js';
import PromiseValueHolder, { PromiseValueHolderStore } from '../utils/promiseValueHolder.js';

export type MemoryUsage = {
    active: number;
    allocated: number;
    allocatable: number;
    used: number;
    total: number;
    available: number;
    free: number;
    buffers: number;
    cached: number;
};

export type SwapUsage = {
    total: number;
    used: number;
    free: number;
    cached: number;
    zswap: number;
    zswapped: number;
    devices?: {
        device: string;
        type: string;
        size: number;
        used: number;
        priority: number;
    }[];
};

type MemoryDataSources = {
    memoryUsage?: string;
    topProcesses?: string;
};

export default class MemoryMonitor extends Monitor {
    //TODO: maybe make this configurable
    static get TOP_PROCESSES_LIMIT() {
        return 15;
    }

    private topProcessesCache: TopProcessesCache;

    private updateMemoryUsageTask: CancellableTaskManager<boolean>;
    private updateTopProcessesTask: CancellableTaskManager<boolean>;
    private updateSwapUsageTask: CancellableTaskManager<boolean>;

    private usedPref: string | null;
    private dataSources!: MemoryDataSources;

    constructor() {
        super('Memory Monitor');

        this.topProcessesCache = new TopProcessesCache(this.updateFrequency);

        // Setup tasks
        this.updateMemoryUsageTask = new CancellableTaskManager();
        this.updateTopProcessesTask = new CancellableTaskManager();
        this.updateSwapUsageTask = new CancellableTaskManager();

        this.usedPref = Config.get_string('memory-used');
        this.dataSourcesInit();

        const enabled = Config.get_boolean('memory-header-show');
        if(enabled) this.start();

        Config.connect(this, 'changed::memory-used', () => {
            this.usedPref = Config.get_string('memory-used');
            this.reset();
            this.resetData();
        });

        Config.connect(this, 'changed::memory-header-show', () => {
            if(Config.get_boolean('memory-header-show')) this.start();
            else this.stop();
        });

        Config.connect(this, 'changed::memory-update', this.restart.bind(this));
    }

    get updateFrequency() {
        return Config.get_double('memory-update');
    }

    reset() {
        this.topProcessesCache.reset();

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

    dataSourcesInit() {
        this.dataSources = {
            memoryUsage: Config.get_string('memory-source-memory-usage') ?? undefined,
            topProcesses: Config.get_string('memory-source-top-processes') ?? undefined,
        };

        Config.connect(this, 'changed::memory-source-memory-usage', () => {
            this.dataSources.memoryUsage =
                Config.get_string('memory-source-memory-usage') ?? undefined;
            this.updateMemoryUsageTask.cancel();
            this.resetUsageHistory('memoryUsage');
        });

        Config.connect(this, 'changed::memory-source-top-processes', () => {
            this.dataSources.topProcesses =
                Config.get_string('memory-source-top-processes') ?? undefined;
            this.topProcessesCache.reset();
            this.resetUsageHistory('topProcesses');
        });
    }

    update() {
        Utils.verbose('Updating Memory Monitor');

        const enabled = Config.get_boolean('memory-header-show');
        if(enabled) {
            const procMeminfo = new PromiseValueHolderStore<string[]>(
                this.getProcMeminfoAsync.bind(this)
            );

            this.runUpdate('memoryUsage', procMeminfo);

            if(this.isListeningFor('topProcesses')) this.runUpdate('topProcesses');
            else this.topProcessesCache.updateNotSeen([]);

            if(this.isListeningFor('swapUsage')) this.runUpdate('swapUsage', procMeminfo);
        }
        return true;
    }

    requestUpdate(key: string) {
        if(key === 'memoryUsage') {
            if(!this.updateMemoryUsageTask.isRunning) {
                const procMeminfo = new PromiseValueHolderStore<string[]>(
                    this.getProcMeminfoAsync.bind(this)
                );
                this.runUpdate('memoryUsage', procMeminfo);
            }
        } else if(key === 'topProcesses') {
            if(!this.updateTopProcessesTask.isRunning) {
                this.runUpdate('topProcesses');
            }
            return; // Don't push to the queue
        } else if(key === 'swapUsage') {
            if(!this.updateSwapUsageTask.isRunning) {
                const procMeminfo = new PromiseValueHolderStore<string[]>(
                    this.getProcMeminfoAsync.bind(this)
                );
                this.runUpdate('swapUsage', procMeminfo);
            }
        }
        super.requestUpdate(key);
    }

    runUpdate(key: string, ...params: any[]) {
        if(key === 'memoryUsage') {
            let run;
            if(this.dataSources.memoryUsage === 'GTop')
                run = this.updateMemoryUsageGTop.bind(this, ...params);
            else if(this.dataSources.memoryUsage === 'proc')
                run = this.updateMemoryUsageProc.bind(this, ...params);
            else run = this.updateMemoryUsageAuto.bind(this, ...params);

            this.runTask({
                key,
                task: this.updateMemoryUsageTask,
                run,
                callback: this.notify.bind(this, 'memoryUsage'),
            });
            return;
        }
        if(key === 'topProcesses') {
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
        if(key === 'swapUsage') {
            this.runTask({
                key,
                task: this.updateSwapUsageTask,
                run: this.updateSwapUsageProc.bind(this, ...params),
                callback: this.notify.bind(this, 'swapUsage'),
            });
            return;
        }
    }

    getProcMeminfoAsync(): PromiseValueHolder<string[]> {
        return new PromiseValueHolder(
            new Promise((resolve, reject) => {
                Utils.readFileAsync('/proc/meminfo')
                    .then(fileContent => {
                        resolve(fileContent.split('\n'));
                    })
                    .catch(e => {
                        reject(e);
                    });
            })
        );
    }

    updateMemoryUsageAuto(procMeminfo: PromiseValueHolderStore<string[]>): Promise<boolean> {
        if(Utils.GTop) return this.updateMemoryUsageGTop();
        return this.updateMemoryUsageProc(procMeminfo);
    }

    async updateMemoryUsageProc(procMeminfo: PromiseValueHolderStore<string[]>): Promise<boolean> {
        const procMeminfoValue = await procMeminfo.getValue();
        if(procMeminfoValue.length < 1) return false;

        let total = 0,
            free = 0,
            buffers = 0,
            cached = 0,
            available = 0,
            active = 0;

        for(let i = 0; i < procMeminfoValue.length; i++) {
            const parts = procMeminfoValue[i].split(/\s+/);
            const key = parts[0].trim();
            const value = parseInt(parts[1]);

            switch(key) {
                case 'MemTotal:':
                    total = value * 1024;
                    break;
                case 'MemFree:':
                    free = value * 1024;
                    break;
                case 'Buffers:':
                    buffers = value * 1024;
                    break;
                case 'Cached:':
                    cached += value * 1024;
                    break;
                case 'MemAvailable:':
                    available = value * 1024;
                    break;
                case 'Active:':
                    active = value * 1024;
                    break;
                case 'Slab:':
                    cached += value * 1024;
                    break; // GTop includes Slab in Cached
            }
        }

        return this.updateMemoryUsageCommon({ active, total, available, free, buffers, cached });
    }

    async updateMemoryUsageGTop(): Promise<boolean> {
        const GTop = Utils.GTop;
        if(!GTop) return false;

        const mem = new GTop.glibtop_mem();
        GTop.glibtop_get_mem(mem);

        const total = mem.total;
        const free = mem.free;
        const buffers = mem.buffer;
        const cached = mem.cached;
        const available = mem.free + mem.buffer + mem.cached;
        const active = mem.used - (mem.buffer + mem.cached);

        return this.updateMemoryUsageCommon({
            active,
            total,
            available,
            free,
            buffers,
            cached,
        });
    }

    private updateMemoryUsageCommon({
        active,
        total,
        available,
        free,
        buffers,
        cached,
    }: {
        active: number;
        total: number;
        available: number;
        free: number;
        buffers: number;
        cached: number;
    }): boolean {
        let used;
        if(this.usedPref === 'active') used = active;
        else if(this.usedPref === 'total-available') used = total - available;
        else if(this.usedPref === 'total-free') used = total - free;
        else used = total - free - buffers - cached;

        const allocated = total - free;
        const allocatable = available - free;

        this.pushUsageHistory('memoryUsage', {
            active,
            allocated,
            allocatable,
            used,
            total,
            available,
            free,
            buffers,
            cached,
        });
        return true;
    }

    updateTopProcessesAuto(): Promise<boolean> {
        if(Utils.GTop) return this.updateTopProcessesGTop();
        return this.updateTopProcessesProc();
    }

    async updateTopProcessesProc(): Promise<boolean> {
        const topProcesses = [];
        const seenPids = [];
        const processPromises = [];

        try {
            const result = await Utils.runAsyncCommand(
                'ps -eo pid,rss,%mem --sort=-%mem',
                this.updateTopProcessesTask
            );
            if(result) {
                let lines = result.split('\n');
                lines.shift(); // Remove the first line (header)
                if(lines.length > MemoryMonitor.TOP_PROCESSES_LIMIT)
                    lines = lines.slice(0, MemoryMonitor.TOP_PROCESSES_LIMIT);

                for(const line of lines) {
                    if(line.trim() === '') continue;

                    const [spid, susage, sperc] = line.split(' ').filter(n => n.trim() !== '');

                    if(
                        !Utils.isIntOrIntString(spid) ||
                        !Utils.isNumeric(susage) ||
                        !Utils.isNumeric(sperc)
                    )
                        continue;
                    const pid = parseInt(spid, 10);
                    const usage = parseInt(susage) * 1024;
                    const percentage = parseFloat(sperc);

                    seenPids.push(pid);

                    processPromises.push(
                        (async () => {
                            let process = this.topProcessesCache.getProcess(pid);
                            if(!process) {
                                try {
                                    let fileContent = await Utils.readFileAsync(
                                        `/proc/${pid}/cmdline`
                                    );
                                    fileContent =
                                        fileContent ||
                                        (await Utils.readFileAsync(`/proc/${pid}/comm`));
                                    process = {
                                        pid: pid,
                                        exec: Utils.extractCommandName(fileContent),
                                        cmd: fileContent,
                                        notSeen: 0,
                                    };
                                    this.topProcessesCache.setProcess(process);
                                } catch(e) {
                                    return null;
                                }
                            }
                            return { process, usage, percentage };
                        })()
                    );
                }

                const resolvedProcesses = (await Promise.all(processPromises)).filter(
                    p => p !== null
                );
                topProcesses.push(...resolvedProcesses);
            }
        } catch(e: any) {
            Utils.error('Error updating memory top processes', e);
        }

        this.topProcessesCache.updateNotSeen(seenPids);
        this.setUsageValue('topProcesses', topProcesses);
        return true;
    }

    async updateTopProcessesGTop() {
        const GTop = Utils.GTop;
        if(!GTop) return false;

        const buf = new GTop.glibtop_proclist();
        const pids = GTop.glibtop_get_proclist(buf, GTop.GLIBTOP_KERN_PROC_ALL, 0); // GLIBTOP_EXCLUDE_IDLE
        pids.length = buf.number;

        const topProcesses = [];
        const seenPids = [];

        const procMem = new GTop.glibtop_proc_mem();
        const mem = new GTop.glibtop_mem();

        GTop.glibtop_get_mem(mem);
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

            GTop.glibtop_get_proc_mem(procMem, pid);
            const usage = procMem.rss;
            const percentage = (usage / mem.total) * 100;

            topProcesses.push({ process, usage, percentage });
        }

        topProcesses.sort((a, b) => b.usage - a.usage);
        topProcesses.splice(MemoryMonitor.TOP_PROCESSES_LIMIT);

        this.topProcessesCache.updateNotSeen(seenPids);
        this.setUsageValue('topProcesses', topProcesses);
        return true;
    }

    async updateSwapUsageProc(procMeminfo: PromiseValueHolderStore<string[]>): Promise<boolean> {
        const procMeminfoValue = await procMeminfo.getValue();
        if(procMeminfoValue.length < 1) return false;

        let total = 0,
            free = 0,
            cached = 0,
            zswap = 0,
            zswapped = 0;

        for(let i = 0; i < procMeminfoValue.length; i++) {
            const parts = procMeminfoValue[i].split(/\s+/);

            const key = parts[0].trim();
            const value = parseInt(parts[1]);

            switch(key) {
                case 'SwapTotal:':
                    total = value * 1024;
                    break;
                case 'SwapFree:':
                    free = value * 1024;
                    break;
                case 'SwapCached:':
                    cached = value * 1024;
                    break;
                case 'Zswap:':
                    zswap = value * 1024;
                    break;
                case 'Zswapped:':
                    zswapped = value * 1024;
                    break;
            }
        }

        const swapUsage: SwapUsage = {
            total,
            used: total - free,
            free,
            cached,
            zswap,
            zswapped,
        };

        try {
            const fileContent = await Utils.readFileAsync('/proc/swaps');
            if(fileContent) {
                const lines = fileContent.split('\n');
                lines.shift(); // Remove the first line (header)

                const swapDevices = [];
                for(const line of lines) {
                    if(line.trim() === '') continue;

                    const [device, type, size, used, priority] = line.split(/\s+/);

                    if(!Utils.isNumeric(size) || !Utils.isNumeric(used)) continue;

                    swapDevices.push({
                        device,
                        type,
                        size: parseInt(size, 10) * 1024,
                        used: parseInt(used, 10) * 1024,
                        priority: parseInt(priority, 10),
                    });
                }
                swapUsage.devices = swapDevices;
            }
        } catch(e: any) {
            Utils.error('Error updating swap usage', e);
        }

        this.setUsageValue('swapUsage', swapUsage);
        return true;
    }

    destroy() {
        Config.clear(this);
        super.destroy();
    }
}
