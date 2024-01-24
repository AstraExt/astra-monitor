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

import GLib from 'gi://GLib';

import Config from '../config.js';
import Utils from '../utils/utils.js';
import { Monitor } from '../monitor.js';
import { CancellableTaskManager } from '../utils/cancellableTaskManager.js';
import { PromiseValueHolder } from '../utils/promiseValueHolder.js';
import TopProcessesCache from '../utils/topProcessesCache.js';

export class StorageMonitor extends Monitor {
    //TODO: maybe make this configurable
    static get TOP_PROCESSES_LIMIT() {
        return 10;
    }
    
    constructor() {
        super();
        
        this.topProcessesCache = new TopProcessesCache(this.updateFrequency);
        
        this.diskChecks = {};
        this.sectorSizes = {};
        
        // Setup tasks
        this.updateStorageUsageTask = new CancellableTaskManager();
        this.updateTopProcessesTask = new CancellableTaskManager();
        this.updateStorageIOTask = new CancellableTaskManager();
        
        this.checkMainDisk();
        
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
        /**
         * @type {Map<number, {read: number, write: number, time: number}>}
         */
        this.previousPidsIO = new Map();
        
        this.updateStorageUsageTask.cancel();
        this.updateTopProcessesTask.cancel();
        this.updateStorageIOTask.cancel();
    }
    
    checkMainDisk() {
        const storageMain = Config.get_string('storage-main');
        const disks = Utils.listDisksSync();
        if(storageMain === '[default]' || !disks.has(storageMain)) {
            const defaultId = Utils.findDefaultDisk(disks);
            if(defaultId !== null)
                Config.set('storage-main', defaultId, 'string');
        }
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
            topProcesses: Config.get_string('storage-source-top-processes')
        };
        
        Config.connect(this, 'changed::storage-source-top-processes', () => {
            this.dataSources.topProcesses = Config.get_string('storage-source-top-processes');
            this.topProcessesCache.reset();
            this.previousPidsIO = new Map();
            this.resetUsageHistory('topProcesses');
        });
    }
    
    stopListeningFor(key) {
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
            
            let detailed = false;
            if(this.isListeningFor('detailedStorageIO'))
                detailed = true;
            
            if(this.isListeningFor('topProcesses')) {
                if(Utils.GTop) // Only GTop supports for now
                    this.runUpdate('topProcesses');
            }
            else {
                this.topProcessesCache.updateNotSeen([]);
            }
            
            const procDiskstats = this.getProcDiskStatsAsync();
            this.runUpdate('updateStorageIO', detailed, procDiskstats);
        }
        return true;
    }
    
    requestUpdate(key) {
        if(key === 'storageUsage') {
            this.runUpdate('storageUsage');
        }
        else if(key === 'storageIO' || key === 'detailedStorageIO') {
            const procDiskstats = this.getProcDiskStatsAsync();
            let detailed = key === 'detailedStorageIO';
            
            this.runUpdate('updateStorageIO', detailed, procDiskstats);
            
            if(detailed)
                super.requestUpdate('storageIO'); // override also the storageIO update
        }
        else if(key === 'topProcesses') {
            if(!this.updateTopProcessesTask.isRunning) {
                if(Utils.GTop) // Only GTop supports for now
                    this.runUpdate('topProcesses');
            }
            return; // Don't push to the queue
        }
        super.requestUpdate(key);
    }
    
    runUpdate(key, ...params) {
        if(key === 'storageUsage') {
            this.updateStorageUsageTask
                .run(this.updateStorageUsage.bind(this, ...params))
                .then(this.notify.bind(this, 'storageUsage'))
                .catch(e => {
                    if(e.isCancelled) {
                        Utils.log('Storage Monitor update canceled: ' + key);
                    }
                    else {
                        Utils.error(e.message);
                    }
                });
        }
        else if(key === 'topProcesses') {
            let updateTopProcessesFunc;
            if(this.dataSources.topProcesses === 'GTop')
                updateTopProcessesFunc = this.updateTopProcessesGTop.bind(this, ...params);
            else
                updateTopProcessesFunc = this.updateTopProcessesAuto.bind(this, ...params);
            
            this.updateTopProcessesTask
                .run(updateTopProcessesFunc)
                .then(this.notify.bind(this, 'topProcesses'))
                .catch(e => {
                    if(e.isCancelled) {
                        //TODO: manage canceled update
                        Utils.log('Storage Monitor update canceled: ' + key);
                    }
                    else {
                        Utils.error(e.message);
                    }
                });
        }
        else if(key === 'updateStorageIO') {
            const detailed = params[0];
            
            this.updateStorageIOTask
                .run(this.updateStorageIO.bind(this, ...params))
                .then(function() {
                    this.notify('storageIO');
                    if(detailed)
                        this.notify('detailedStorageIO');
                }.bind(this))
                .catch(e => {
                    if(e.isCancelled) {
                        Utils.log('Storage Monitor update canceled: ' + key);
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
    getProcDiskStatsAsync() {
        return new PromiseValueHolder(new Promise((resolve, reject) => {
            Utils.readFileAsync('/proc/diskstats').then(fileContent => {
                resolve(fileContent.split('\n'));
            }).catch(e => {
                reject(e);
            });
        }));
    }
    
    /**
     * @returns {Promise<boolean>}
     */
    async updateStorageUsage() {
        const mainDisk = Config.get_string('storage-main');
        const disks = await Utils.listDisksAsync();
        
        try {
            const disk = disks.get(mainDisk);
            if(!disk) {
                this.checkMainDisk();
                return;
            }
            
            if(!disk || !disk.path)
                return false;
            
            const path = disk.path.replace(/[^a-zA-Z0-9\/-]/g, '');
            const result = await Utils.executeCommandAsync(`lsblk -Jb -o ID,SIZE,FSUSE% ${path}`);
            
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
        catch (e) {
            Utils.error(e);
        }
        return false;
    }
    
    /**
     * This function is Sync but it caches the result, so it's not a problem
     * @param {string} device 
     * @returns {number}
     */
    getSectorSize(device) {
        const diskDevice = device.replace(/[0-9]+$/, '');
        
        if(this.sectorSizes[device] === undefined) {
            const fileContents = GLib.file_get_contents(`/sys/block/${device}/queue/hw_sector_size`);
            if(fileContents && fileContents[0]) {
                const decoder = new TextDecoder("utf-8");
                this.sectorSizes[device] = parseInt(decoder.decode(fileContents[1]));
            } else {
                this.sectorSizes[device] = 512;
            }
        }
        return this.sectorSizes[device];
    }
    
    isDisk(deviceName) {
        if(this.diskChecks[deviceName] !== undefined)
            return this.diskChecks[deviceName];
        
        try {
            const path = `/sys/block/${deviceName}`;
            const fileType = GLib.file_test(path, GLib.FileTest.IS_DIR);
            this.diskChecks[deviceName] = fileType;
            return fileType;
        } catch (e) {
            return false;
        }
    }
    
    /**
     * @param {boolean} detailed
     * @param {PromiseValueHolder} procDiskstats 
     * @returns {Promise<boolean>}
     */
    async updateStorageIO(detailed = false, procDiskstats = null) {
        let procDiskstatsValue = await procDiskstats.getValue();
        if(procDiskstatsValue.length < 1)
            return false;
        
        let bytesRead = 0;
        let bytesWritten = 0;
        
        let devices;
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
            
            const isPartition = !this.isDisk(deviceName);
            
            const readSectors = parseInt(fields[5]);
            const writtenSectors = parseInt(fields[9]);
            
            // TODO: Ugly hack to get the sector size of a partition
            if(!isPartition)
                lastSectorSize = this.getSectorSize(deviceName);
            
            if(detailed) {
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
        
        if(detailed) {
            if(this.previousDetailedStorageIO.time === now)
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
    
    /**
     * @typedef {{id: string, uuid: string, name: string, kname: string, pkname: string, label: string, type: string, subsystems: string[], mountpoints: string[], vendor: string, model: string, path: string, removable: boolean, readonly: boolean, state: string, owner: string, size: number, usage: number, filesystem: string, parents:BlockDevice}} BlockDevice
     */
    
    /**
     * This function is sync, but it spawns only once the user opens the storage menu
     * May be convered to async but this will introduce a graphical update lag (minor)
     * Impact measured to be ~25ms: relevant but not a priority
     * @returns {Map<string, BlockDevice>}
     */
    getBlockDevicesSync() {
        const devices = new Map();
        
        try {
            const [result, stdout, stderr] = GLib.spawn_command_line_sync('lsblk -Jb -o ID,UUID,NAME,KNAME,PKNAME,LABEL,TYPE,SUBSYSTEMS,MOUNTPOINTS,VENDOR,MODEL,PATH,RM,RO,STATE,OWNER,SIZE,FSUSE%,FSTYPE');
            
            if (result && stdout) {
                const decoder = new TextDecoder("utf-8");
                const output = decoder.decode(stdout);
                
                const json = JSON.parse(output);
                
                const processDevice = (device, parent = null) => {
                    const id = device.id;
                    if(!id)
                        return;
                    
                    if(devices.has(id)) {
                        if(parent)
                            devices.get(id).parents.push(parent);
                        return;
                    }
                    
                    const uuid = device.uuid;
                    const name = device.name;
                    const kname = device.kname;
                    const pkname = device.pkname;
                    const label = device.label;
                    const type = device.type;
                    
                    if(type === 'loop')
                        return;
                    
                    const subsystems = device.subsystems;
                    
                    let mountpoints = [];
                    if(device.mountpoints && device.mountpoints.length > 0 && device.mountpoints[0])
                        mountpoints = device.mountpoints;
                    
                    const vendor = device.vendor?.trim();
                    const model = device.model?.trim();
                    const path = device.path;
                    const removable = device.rm;
                    const readonly = device.ro;
                    const state = device.state;
                    const owner = device.owner;
                    const size = device.size;
                    const usage = parseInt(device['fsuse%'], 10);
                    const filesystem = device.fstype;
                    
                    const deviceObj = {
                        id,
                        uuid,
                        name,
                        kname,
                        pkname,
                        label,
                        type,
                        subsystems,
                        mountpoints,
                        vendor,
                        model,
                        path,
                        removable,
                        readonly,
                        state,
                        owner,
                        size,
                        usage,
                        filesystem,
                        parents: [],
                    };
                    
                    if(parent) {
                        deviceObj.parents.push(parent);
                    }
                    
                    if(device.children && device.children.length > 0) {
                        for(const child of device.children) {
                            processDevice(child, deviceObj);
                        }
                    }
                    else {
                        devices.set(id, deviceObj);
                    }
                }
                
                for(const device of json.blockdevices) {
                    processDevice(device);
                }
            }
        }
        catch (e) {
            Utils.error(e);
        }
        
        return devices;
    }
    
    /**
     * GTop is faster here, use it if available
     * @returns {Promise<boolean>}
     */
    async updateTopProcessesAuto() {
        if(Utils.GTop)
            return await this.updateTopProcessesGTop();
        return false;
    }
    
    async updateTopProcessesGTop() {
        let GTop = Utils.GTop;
        if(!GTop)
            return false;
        
        let buf = new GTop.glibtop_proclist();
        let pids = GTop.glibtop_get_proclist(buf, GTop.GLIBTOP_KERN_PROC_ALL, 0); // GLIBTOP_EXCLUDE_IDLE
        pids.length = buf.number;
        
        const topProcesses = [];
        const seenPids = [];
        
        let io = new GTop.glibtop_proc_io();
        
        for(const pid of pids) {
            seenPids.push(pid);
            
            let process = this.topProcessesCache.getProcess(pid);
            if(!process) {
                const argSize = new GTop.glibtop_proc_args();
                let cmd = GTop.glibtop_get_proc_args(argSize, pid, 0);
                
                if(!cmd) {
                    let procState = new GTop.glibtop_proc_state();
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
    
    destroy() {
        Config.clear(this);
        super.destroy();
    }
}