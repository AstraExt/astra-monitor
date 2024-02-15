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
import Utils, { DiskInfo } from '../utils/utils.js';
import Monitor from '../monitor.js';
import CancellableTaskManager from '../utils/cancellableTaskManager.js';
import PromiseValueHolder, { PromiseValueHolderStore } from '../utils/promiseValueHolder.js';
import TopProcessesCache from '../utils/topProcessesCache.js';

export type StorageUsage = {
    size: number;
    usePercentage: number;
};

export type BlockDevice = {
    id: string;
    uuid: string;
    name: string;
    kname: string;
    pkname: string;
    label: string;
    type: string;
    subsystems: string[];
    mountpoints: string[];
    vendor: string;
    model: string;
    path: string;
    removable: boolean;
    readonly: boolean;
    state: string;
    owner: string;
    size: number;
    usage: number;
    filesystem: string;
    parents: BlockDevice[];
};

type DeviceStauts = {
    bytesRead: number;
    bytesWritten: number;
};

export type StorageIO = {
    bytesReadPerSec: number;
    bytesWrittenPerSec: number;
};

type PreviousStorageIO = DeviceStauts & {
    time: number;
};

type PreviousDetailedStorageIO = {
    devices: Map<string, DeviceStauts>|null;
    time: number;
};

type PidIO = {
    read: number,
    write: number,
    time: number
};

type StorageDataSources = {
    storageUsage?: string,
    topProcesses?: string,
    storageIO?: string
};

export default class StorageMonitor extends Monitor {
    //TODO: maybe make this configurable
    static get TOP_PROCESSES_LIMIT() {
        return 10;
    }
    
    private topProcessesCache: TopProcessesCache;
    private diskChecks: Record<string, boolean>;
    private sectorSizes: Record<string, number>;
    private ignored: string[];
    private ignoredRegex: RegExp|null;
    
    private updateMountpointCache: CancellableTaskManager<boolean>;
    
    private updateStorageUsageTask: CancellableTaskManager<boolean>;
    private updateTopProcessesTask: CancellableTaskManager<boolean>;
    private updateStorageIOTask: CancellableTaskManager<boolean>;
    
    private previousStorageIO!: PreviousStorageIO;
    private previousDetailedStorageIO!: PreviousDetailedStorageIO;
    private previousPidsIO!: Map<number, PidIO>;
    
    private dataSources!: StorageDataSources;
    
    //private disksCacheFilled: boolean = false;
    private disksCache: Map<string, DiskInfo> = new Map();
    
    constructor() {
        super('Storage Monitor');
        
        this.topProcessesCache = new TopProcessesCache(this.updateFrequency);
        
        this.diskChecks = {};
        this.sectorSizes = {};
        
        // Setup tasks
        this.updateMountpointCache = new CancellableTaskManager();
        
        this.updateStorageUsageTask = new CancellableTaskManager();
        this.updateTopProcessesTask = new CancellableTaskManager();
        this.updateStorageIOTask = new CancellableTaskManager();
        
        this.checkMainDisk();
        
        this.reset();
        this.dataSourcesInit();
        
        const enabled = Config.get_boolean('storage-header-show');
        if(enabled)
            this.start();
        
        Config.connect(this, 'changed::storage-header-show', () => {
            if(Config.get_boolean('storage-header-show'))
                this.start();
            else
                this.stop();
        });
        
        Config.connect(this, 'changed::storage-update', this.restart.bind(this));
        
        // Manually ignored devices
        this.ignored = Config.get_json('storage-ignored');
        if(this.ignored === null || !Array.isArray(this.ignored))
            this.ignored = [];
        Config.connect(this, 'changed::storage-ignored', () => {
            this.reset();
            
            this.ignored = Config.get_json('storage-ignored');
            if(this.ignored === null || !Array.isArray(this.ignored))
                this.ignored = [];
        });
        
        // Regex ignored devices
        const regex = Config.get_string('storage-ignored-regex');
        try {
            if(regex === null || regex === '')
                this.ignoredRegex = null;
            else
                this.ignoredRegex = new RegExp(`^${regex}$`, 'i');
        } catch(e) {
            this.ignoredRegex = null;
        }
        
        Config.connect(this, 'changed::storage-ignored-regex', () => {
            this.reset();
            
            const regex = Config.get_string('storage-ignored-regex');
            try {
                if(regex === null || regex === '')
                    this.ignoredRegex = null;
                else
                    this.ignoredRegex = new RegExp(`^${regex}$`, 'i');
            } catch(e) {
                this.ignoredRegex = null;
            }
        });
    }
    
    get showConfig() {
        return 'storage-header-show';
    }
    
    get updateFrequency() {
        return Config.get_double('storage-update');
    }
    
    reset() {
        this.previousStorageIO = {
            bytesRead: -1,
            bytesWritten: -1,
            time: -1
        };
        
        this.previousDetailedStorageIO = {
            devices: null,
            time: -1
        };
        
        this.topProcessesCache.reset();
        this.previousPidsIO = new Map();
        
        this.updateMountpointCache.cancel();
        
        this.updateStorageUsageTask.cancel();
        this.updateTopProcessesTask.cancel();
        this.updateStorageIOTask.cancel();
        
        //this.disksCacheFilled = false;
        this.disksCache.clear();
    }
    
    checkMainDisk(): string|null {
        let storageMain = Config.get_string('storage-main');
        const disks = Utils.listDisksSync();
        if(!storageMain || storageMain === '[default]' || !disks.has(storageMain)) {
            const defaultId = Utils.findDefaultDisk(disks);
            if(defaultId !== null) {
                Config.set('storage-main', defaultId, 'string');
                storageMain = defaultId;
            }
        }
        return storageMain;
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
            storageUsage: Config.get_string('storage-source-storage-usage') ?? undefined,
            topProcesses: Config.get_string('storage-source-top-processes') ?? undefined,
            storageIO: Config.get_string('storage-source-storage-io') ?? undefined
        };
        
        Config.connect(this, 'changed::storage-source-storage-usage', () => {
            this.dataSources.storageUsage = Config.get_string('storage-source-storage-usage') ?? undefined;
            //this.disksCacheFilled = false;
            this.disksCache.clear();
            this.resetUsageHistory('storageUsage');
        });
        
        Config.connect(this, 'changed::storage-source-top-processes', () => {
            this.dataSources.topProcesses = Config.get_string('storage-source-top-processes') ?? undefined;
            this.topProcessesCache.reset();
            this.previousPidsIO = new Map();
            this.resetUsageHistory('topProcesses');
        });
        
        Config.connect(this, 'changed::storage-source-storage-io', () => {
            this.dataSources.storageIO = Config.get_string('storage-source-storage-io') ?? undefined;
            //this.disksCacheFilled = false;
            this.disksCache.clear();
            this.previousStorageIO = {
                bytesRead: -1,
                bytesWritten: -1,
                time: -1
            };
            this.previousDetailedStorageIO = {
                devices: null,
                time: -1
            };
            this.resetUsageHistory('storageIO');
            this.resetUsageHistory('detailedStorageIO');
        });
    }
    
    stopListeningFor(key: string) {
        super.stopListeningFor(key);
        
        if(key === 'detailedStorageIO') {
            this.previousDetailedStorageIO.devices = null;
            this.previousDetailedStorageIO.time = -1;
        }
    }
    
    update() {
        const enabled = Config.get_boolean('storage-header-show');
        if(enabled) {
            this.runUpdate('storageUsage');
            
            // Only GTop supports for now
            if(Utils.GTop) {
                if(this.isListeningFor('topProcesses'))
                    this.runUpdate('topProcesses');
                else
                    this.topProcessesCache.updateNotSeen([]);
            }
            
            const detailed = this.isListeningFor('detailedStorageIO');
            const procDiskstats = new PromiseValueHolderStore<string[]>(this.getProcDiskStatsAsync.bind(this));
            this.runUpdate('updateStorageIO', detailed, procDiskstats);
        }
        return true;
    }
    
    requestUpdate(key: string) {
        if(key === 'storageUsage') {
            this.runUpdate('storageUsage');
        }
        else if(key === 'storageIO' || key === 'detailedStorageIO') {
            const procDiskstats = new PromiseValueHolderStore<string[]>(this.getProcDiskStatsAsync.bind(this));
            const detailed = key === 'detailedStorageIO';
            
            this.runUpdate('updateStorageIO', detailed, procDiskstats);
            if(detailed)
                super.requestUpdate('storageIO'); // override also the storageIO update
        }
        else if(key === 'topProcesses') {
            if(!this.updateTopProcessesTask.isRunning && Utils.GTop) // Only GTop supports for now
                this.runUpdate('topProcesses');
            return; // Don't push to the queue
        }
        super.requestUpdate(key);
    }
    
    runUpdate(key: string, ...params: any[]) {
        if(key === 'storageUsage') {
            let run;
            if(this.dataSources.storageUsage === 'GTop')
                run = this.updateStorageUsageGTop.bind(this, ...params);
            else if(this.dataSources.storageUsage === 'proc')
                run = this.updateStorageUsageProc.bind(this, ...params);
            else
                run = this.updateStorageUsageAuto.bind(this, ...params);
            
            this.runTask({
                key,
                task: this.updateStorageUsageTask,
                run,
                callback: this.notify.bind(this, 'storageUsage')
            });
            return;
        }
        if(key === 'topProcesses') {
            let run;
            if(this.dataSources.topProcesses === 'GTop')
                run = this.updateTopProcessesGTop.bind(this, ...params);
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
        if(key === 'updateStorageIO') {
            const detailed = params[0];
            const callback = () => {
                this.notify('storageIO');
                if(detailed)
                    this.notify('detailedStorageIO');
            };
            
            let run;
            
            /**!
             * GTop cannot be used until it's fixed:
             * check the function content for more info
             **/
            // eslint-disable-next-line no-constant-condition
            if(this.dataSources.storageIO === 'GTop' && false)
                run = this.updateStorageIOGTop.bind(this, ...params);
            else if(this.dataSources.storageIO === 'proc')
                run = this.updateStorageIOProc.bind(this, ...params);
            else
                run = this.updateStorageIOAuto.bind(this, ...params);
            
            this.runTask({
                key,
                task: this.updateStorageIOTask,
                run,
                callback
            });
            return;
        }
    }
    
    getProcDiskStatsAsync(): PromiseValueHolder<string[]> {
        return new PromiseValueHolder(new Promise((resolve, reject) => {
            Utils.readFileAsync('/proc/diskstats').then(fileContent => {
                resolve(fileContent.split('\n'));
            }).catch(e => {
                reject(e);
            });
        }));
    }
    
    async updateStorageUsageAuto(): Promise<boolean> {
        if(Utils.GTop)
            return await this.updateStorageUsageGTop();
        return await this.updateStorageUsageProc();
    }
    
    async updateStorageUsageProc(): Promise<boolean> {
        let mainDisk = Config.get_string('storage-main');
        const disks = await Utils.listDisksAsync(this.updateStorageUsageTask);
        
        try {
            if(!mainDisk || mainDisk === '[default]')
                mainDisk = this.checkMainDisk();
            
            let disk = disks.get(mainDisk || '');
            if(!disk) {
                mainDisk = this.checkMainDisk();
                disk = disks.get(mainDisk || '');
            }
            
            if(!disk || !disk.path)
                return false;
            
            const path = disk.path.replace(/[^a-zA-Z0-9/-]/g, '');
            const result = await Utils.executeCommandAsync(`lsblk -Jb -o ID,SIZE,FSUSE% ${path}`, this.updateStorageUsageTask);
            
            if(result) {
                const json = JSON.parse(result);
                
                if(json.blockdevices && json.blockdevices.length > 0) {
                    const usage = parseInt(json.blockdevices[0]['fsuse%'], 10);
                    const size = json.blockdevices[0]['size'];
                    this.pushUsageHistory('storageUsage', {
                        size: size,
                        usePercentage: usage
                    });
                    return true;
                }
            }
        }
        catch(e: any) {
            Utils.error(e);
        }
        return false;
    }
    
    async updateStorageUsageGTop(): Promise<boolean> {
        const GTop = Utils.GTop;
        if(!GTop)
            return false;
        
        let mainDisk = Config.get_string('storage-main');
        try {
            if(!mainDisk || mainDisk === '[default]')
                mainDisk = this.checkMainDisk();
            if(!mainDisk)
                return false;
            
            const disk = await this.getCachedDisk(mainDisk);
            const mountpoints = disk?.mountpoints;
            if(!mountpoints || mountpoints.length === 0 || (mountpoints.length === 1 && mountpoints[0] === '[SWAP]'))
                return false;
            
            const buf = new GTop.glibtop_fsusage();
            let mnt = 0;
            while(buf.blocks === 0 && mnt <= mountpoints.length)
                GTop.glibtop_get_fsusage(buf, mountpoints[mnt++]);
            
            if(buf.blocks === 0)
                return false;
            
            const size = buf.blocks * buf.block_size;
            const free = buf.bfree * buf.block_size;
            
            this.pushUsageHistory('storageUsage', {
                size: size,
                usePercentage: Math.round((size - free) / size * 100)
            });
            return true;
        }
        catch(e: any) { /* EMPTY */ }
        return false;
    }
    
    /**
     * This function is Sync but it caches the result
     */
    getSectorSize(device: string): number {
        if(this.sectorSizes[device] === undefined) {
            const fileContents = GLib.file_get_contents(`/sys/block/${device}/queue/hw_sector_size`);
            if(fileContents && fileContents[0]) {
                const decoder = new TextDecoder('utf8');
                this.sectorSizes[device] = parseInt(decoder.decode(fileContents[1]));
            }
            else {
                this.sectorSizes[device] = 512;
            }
        }
        return this.sectorSizes[device];
    }
    
    /**
     * This function is Sync but it caches the result
     */
    isDisk(deviceName: string): boolean {
        if(this.diskChecks[deviceName] !== undefined)
            return this.diskChecks[deviceName];
        
        try {
            const path = `/sys/block/${deviceName}`;
            const fileType = GLib.file_test(path, GLib.FileTest.IS_DIR);
            this.diskChecks[deviceName] = fileType;
            return fileType;
        } catch(e) {
            return false;
        }
    }
    
    async updateStorageIOAuto(detailed: boolean, procDiskstats: PromiseValueHolder<string[]>): Promise<boolean> {
        /**!
         * GTop cannot be used until it's fixed:
         * check the function content for more info
         **/
        // eslint-disable-next-line no-constant-condition
        if(Utils.GTop && false)
            return await this.updateStorageIOGTop(detailed);
        return await this.updateStorageIOProc(detailed, procDiskstats);
    }
    
    async updateStorageIOProc(detailed: boolean, procDiskstats: PromiseValueHolder<string[]>): Promise<boolean> {
        const procDiskstatsValue = await procDiskstats.getValue();
        if(procDiskstatsValue.length < 1)
            return false;
        
        let bytesRead = 0;
        let bytesWritten = 0;
        
        let devices: Map<string, DeviceStauts>|null = null;
        if(detailed)
            devices = new Map();
        
        let lastSectorSize = -1;
        
        for(const device of procDiskstatsValue) {
            const fields = device.trim().split(/\s+/);
            if(fields.length < 10)
                continue;
            
            const deviceName = fields[2];
            
            if(deviceName.startsWith('loop'))
                continue;
            
            if(this.ignored.includes(deviceName))
                continue;
            
            if(this.ignoredRegex !== null && this.ignoredRegex.test(deviceName))
                continue;
            
            const isPartition = !this.isDisk(deviceName);
            
            const readSectors = parseInt(fields[5]);
            const writtenSectors = parseInt(fields[9]);
            
            // TODO: Ugly hack to get the sector size of a partition
            if(!isPartition)
                lastSectorSize = this.getSectorSize(deviceName);
            
            if(detailed && devices !== null) {
                devices.set(deviceName, {
                    bytesRead: readSectors * lastSectorSize,
                    bytesWritten: writtenSectors * lastSectorSize
                });
            }
            
            // Filter partitions
            if(!isPartition) {
                bytesRead += readSectors * lastSectorSize;
                bytesWritten += writtenSectors * lastSectorSize;
            }
        }
        
        const now = GLib.get_monotonic_time();
        
        if(detailed) {
            if(this.previousDetailedStorageIO.devices === null || this.previousDetailedStorageIO.time === -1) {
                this.previousDetailedStorageIO.devices = devices;
                this.previousDetailedStorageIO.time = now;
            }
        }
        
        if(this.previousStorageIO.bytesRead === -1 || this.previousStorageIO.bytesWritten === -1 || this.previousStorageIO.time === -1) {
            this.previousStorageIO.bytesRead = bytesRead;
            this.previousStorageIO.bytesWritten = bytesWritten;
            this.previousStorageIO.time = now;
            return false;
        }
        
        const interval = (now - this.previousStorageIO.time) / 1000000;
        const bytesReadPerSec = Math.round((bytesRead - this.previousStorageIO.bytesRead) / interval);
        const bytesWrittenPerSec = Math.round((bytesWritten - this.previousStorageIO.bytesWritten) / interval);
        
        this.previousStorageIO.bytesRead = bytesRead;
        this.previousStorageIO.bytesWritten = bytesWritten;
        this.previousStorageIO.time = now;
        
        this.pushUsageHistory('storageIO', {
            bytesReadPerSec,
            bytesWrittenPerSec
        });
        
        if(detailed && devices !== null) {
            if(this.previousDetailedStorageIO.time === now)
                return false;
            if(this.previousDetailedStorageIO.devices === null)
                return false;
            
            const finalData = new Map();
            
            const interval = (now - this.previousDetailedStorageIO.time) / 1000000;
            
            for(const [deviceName, { bytesRead, bytesWritten }] of devices) {
                const previousData = this.previousDetailedStorageIO.devices.get(deviceName);
                if(previousData) {
                    const bytesReadPerSec = Math.round((bytesRead - previousData.bytesRead) / interval);
                    const bytesWrittenPerSec = Math.round((bytesWritten - previousData.bytesWritten) / interval);    
                    finalData.set(deviceName, { bytesReadPerSec, bytesWrittenPerSec });
                }
            }
            
            this.previousDetailedStorageIO.devices = devices;
            this.previousDetailedStorageIO.time = now;
            this.pushUsageHistory('detailedStorageIO', finalData);
        }
        return true;
    }
    
    async updateStorageIOGTop(detailed: boolean): Promise<boolean> {
        const GTop = Utils.GTop;
        if(!GTop)
            return false;
        
        /**!
         * TODO:
         * CANNOT USE GTOP MOUNTPOINTS BECAUSE IT CAUSES A SHELL SIGSEGV
         * https://gitlab.gnome.org/GNOME/gjs/-/issues/601
         */
        /*try {
            Utils.log('glibtop_mountlist');
            
            const buf = new GTop.glibtop_mountlist();
            const mountlist = GTop.glibtop_get_mountlist(buf, 0);
            
            Utils.log('mountlist.length: ' + mountlist.length);
            Utils.log('buf.number: ' + buf.number);
            Utils.log('buf.size: ' + buf.size);
            Utils.log('buf.total: ' + buf.total);
            
            for(const mount of mountlist) {
                const devname = Utils.convertCharListToString(mount.devname);
                const mountdir = Utils.convertCharListToString(mount.mountdir);
                const type = Utils.convertCharListToString(mount.type);
                
                Utils.log(`devname: ${devname}, mountdir: ${mountdir}, type: ${type}`);
            }
        }
        catch(e: any) {
            Utils.error(e);
        }*/
        
        /**!
         * TODO:
         * glibtop_get_fsusage is broken too for NVMe disks
         * https://gitlab.gnome.org/GNOME/libgtop/-/issues/43
         * and
         * https://bugs.launchpad.net/ubuntu/+source/libgtop2/+bug/2025476
         */
        /*let bytesRead = 0;
        let bytesWritten = 0;
        
        for(const disk of this.disksCache.values()) {
            if(this.ignored.includes(disk.name))
                continue;
            
            if(this.ignoredRegex !== null && this.ignoredRegex.test(disk.name))
                continue;
            
            const mountpoints = disk.mountpoints;
            if(!mountpoints || mountpoints.length === 0 || (mountpoints.length === 1 && mountpoints[0] === '[SWAP]'))
                return false;
            
            let mnt = 0;
            const buf = new GTop.glibtop_fsusage();
            
            while(buf.blocks === 0 && mnt <= mountpoints.length)
                GTop.glibtop_get_fsusage(buf, mountpoints[mnt++]);
            
            Utils.log('------------');
            Utils.log('glibtop_get_fsusage: ' + disk.path);
            Utils.log('buf.blocks: ' + buf.blocks);
            Utils.log('buf.read: ' + buf.read);
            Utils.log('buf.write: ' + buf.write);
            Utils.log('buf.block_size: ' + buf.block_size);
            
            if(buf.blocks === 0 || buf.block_size === 0 || (buf.read === 0 && buf.write === 0))
                continue;
            
            bytesRead += buf.read * buf.block_size;
            bytesWritten += buf.write * buf.block_size;
        }
        
        Utils.log('bytesRead: ' + bytesRead);
        Utils.log('bytesWritten: ' + bytesWritten);
        
        const now = GLib.get_monotonic_time();
        
        if(this.previousStorageIO.bytesRead === -1 || this.previousStorageIO.bytesWritten === -1 || this.previousStorageIO.time === -1) {
            this.previousStorageIO.bytesRead = bytesRead;
            this.previousStorageIO.bytesWritten = bytesWritten;
            this.previousStorageIO.time = now;
            return false;
        }
        
        const interval = (now - this.previousStorageIO.time) / 1000000;
        const bytesReadPerSec = Math.round((bytesRead - this.previousStorageIO.bytesRead) / interval);
        const bytesWrittenPerSec = Math.round((bytesWritten - this.previousStorageIO.bytesWritten) / interval);
        
        this.previousStorageIO.bytesRead = bytesRead;
        this.previousStorageIO.bytesWritten = bytesWritten;
        this.previousStorageIO.time = now;
        
        this.pushUsageHistory('storageIO', {
            bytesReadPerSec,
            bytesWrittenPerSec
        });*/
        
        if(detailed) {
            /* TODO: */
        }
        return false;
    }
    
    async updateTopProcessesAuto(): Promise<boolean> {
        if(Utils.GTop)
            return await this.updateTopProcessesGTop();
        return false;
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
        
        const io = new GTop.glibtop_proc_io();
        
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
            
            GTop.glibtop_get_proc_io(io, pid);
            const currentRead = io.disk_rbytes;
            const currentWrite = io.disk_wbytes;
            
            const previous = this.previousPidsIO.get(pid);
            this.previousPidsIO.set(pid, {
                read: currentRead,
                write: currentWrite,
                time: GLib.get_monotonic_time()
            });
            
            if(!previous)
                continue;
            
            const {
                read: previousRead,
                write: previousWrite,
                time: previousTime
            } = previous;
            
            const read = Math.round((currentRead - previousRead) / ((GLib.get_monotonic_time() - previousTime) / 1000000));
            const write = Math.round((currentWrite - previousWrite) / ((GLib.get_monotonic_time() - previousTime) / 1000000));
            if(read + write === 0)
                continue;
            
            topProcesses.push({ process, read, write });
        }
        
        topProcesses.sort((a, b) => (b.read + b.write) - (a.read + a.write));
        topProcesses.splice(StorageMonitor.TOP_PROCESSES_LIMIT);
        
        for(const pid of this.previousPidsIO.keys()) {
            if(!seenPids.includes(pid))
                this.previousPidsIO.delete(pid);
        }
        
        this.topProcessesCache.updateNotSeen(seenPids);
        this.setUsageValue('topProcesses', topProcesses);
        return true;
    }
    
    async getCachedDisk(device: string): Promise<DiskInfo|undefined> {
        if(this.disksCache.has(device))
            return this.disksCache.get(device);
        
        const disks = await Utils.listDisksAsync(this.updateMountpointCache);
        
        const disk = disks.get(device);
        if(!disk || !disk.mountpoints || disk.mountpoints.length === 0)
            return;
        
        this.disksCache.set(device, disk);
        return disk;
    }
    
    destroy() {
        Config.clear(this);
        super.destroy();
    }
}