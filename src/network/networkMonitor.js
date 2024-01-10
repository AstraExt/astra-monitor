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
import { CancellableTaskManager } from '../utils/cancellableTaskManager.js';
import { PromiseValueHolder } from '../utils/promiseValueHolder.js';

export class NetworkMonitor extends Monitor {
    constructor() {
        super();
        
        //TODO: let the user choose max speeds / save max speeds
        this.detectedMaxSpeedsValues = {
            bytesUploadedPerSec: 0,
            bytesDownloadedPerSec: 0
        };
        
        this.interfaceChecks = {};
        
        // Setup tasks
        this.updateNetworkIOTask = new CancellableTaskManager();
        
        this.reset();
        
        const enabled = Config.get_boolean('network-header-show');
        if(enabled)
            this.start();
        
        Config.connect(this, 'changed::network-header-show', () => {
            if(Config.get_boolean('network-header-show'))
                this.start();
            else
                this.stop();
        });
        
        Config.connect(this, 'changed::network-update', this.restart.bind(this));
    }
    
    get updateFrequency() {
        return Config.get_double('network-update');
    }
    
    get detectedMaxSpeeds() {
        return this.detectedMaxSpeedsValues;
    }
    
    reset() {
        this.previousNetworkIO = {
            bytesUploaded: -1,
            bytesDownloaded: -1,
            time: -1
        };
        
        this.previousDetailedNetworkIO = {
            devices: null,
            time: -1
        };
        
        this.updateNetworkIOTask.cancel();
    }
    
    start() {
        super.start();
    }
    
    stop() {
        super.stop();
        this.reset();
    }
    
    stopListeningFor(key) {
        super.stopListeningFor(key);
        
        if(key === 'detailedNetworkIO') {
            this.previousDetailedNetworkIO.devices = null;
            this.previousDetailedNetworkIO.time = -1;
        }
    }
    
    update() {
        const enabled = Config.get_boolean('network-header-show');
        if(enabled) {
            const procNetDev = this.getProNetDevAsync();
            
            let detailed = false;
            if(this.isListeningFor('detailedNetworkIO'))
                detailed = true;
            
            this.runUpdate('networkIO', detailed, procNetDev);
        }
        
        return true;
    }
    
    requestUpdate(key) {
        if(key === 'networkIO' || key === 'detailedNetworkIO') {
            const procNetDev = this.getProNetDevAsync();
            
            let detailed = key === 'detailedNetworkIO';
            
            this.runUpdate('networkIO', detailed, procNetDev);
            
            if(detailed)
                super.requestUpdate('networkIO'); // override also the storageIO update
        }
        super.requestUpdate(key);
    }
    
    runUpdate(key, ...params) {
        if(key === 'networkIO') {
            const detailed = params[0];
            
            this.updateNetworkIOTask
                .run(this.updateNetworkIO.bind(this, ...params))
                .then(function() {
                    this.notify('networkIO');
                    if(detailed)
                        this.notify('detailedNetworkIO');
                }.bind(this))
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
    getProNetDevAsync() {
        return new PromiseValueHolder(new Promise((resolve, reject) => {
            Utils.readFileAsync('/proc/net/dev').then(fileContent => {
                resolve(fileContent.split('\n'));
            }).catch(e => {
                reject(e);
            });
        }));
    }
    
    isMonitoredInterface(interfaceName) {
        if(this.interfaceChecks[interfaceName] !== undefined)
            return this.interfaceChecks[interfaceName];
        
        let monitored = true;
        if(interfaceName === 'lo')
            monitored = false;
        
        //TODO: Add the possibility to choose the interfaces to monitor
        this.interfaceChecks[interfaceName] = monitored;
        return monitored;
    }
    
    /**
     * @param {boolean} detailed
     * @param {PromiseValueHolder} procNetDev
     * @returns {Promise<boolean>}
     */
    async updateNetworkIO(detailed = false, procNetDev) {
        let procNetDevValue = await procNetDev.getValue();
        if(procNetDevValue.length < 1)
            return false;
        
        let bytesUploaded = 0;
        let bytesDownloaded = 0;
        
        let devices;
        if(detailed)
            devices = new Map();
        
        procNetDevValue = procNetDevValue.slice(2);  // Remove the first two lines
        
        for(const device of procNetDevValue) {
            const fields = device.trim().split(/\s+/);
            if(fields.length < 10)
                continue;
            
            const interfaceName = fields[0].slice(0, -1); // Remove the trailing ':'
            if (!this.isMonitoredInterface(interfaceName))
                continue;
            
            if(detailed) {
                devices.set(interfaceName, {
                    bytesUploaded: parseInt(fields[9]),
                    //packetsUploaded: parseInt(fields[10]),
                    //errorsUpload: parseInt(fields[11]),
                    //dropUpload: parseInt(fields[12]),
                    
                    bytesDownloaded: parseInt(fields[1]),
                    //packetsDownloaded: parseInt(fields[2]),
                    //errorsDownload: parseInt(fields[3]),
                    //dropDownload: parseInt(fields[4])
                });
            }
            
            bytesUploaded += parseInt(fields[9]);
            bytesDownloaded += parseInt(fields[1]);
        }
        
        const now = GLib.get_monotonic_time();
        
        if(detailed) {
            if(this.previousDetailedNetworkIO.devices === null || this.previousDetailedNetworkIO.time === -1) {
                this.previousDetailedNetworkIO.devices = devices;
                this.previousDetailedNetworkIO.time = now;
            }
        }
        
        if(this.previousNetworkIO.bytesUploaded === -1 || this.previousNetworkIO.bytesDownloaded === -1 || this.previousNetworkIO.time === -1) {
            this.previousNetworkIO.bytesUploaded = bytesUploaded;
            this.previousNetworkIO.bytesDownloaded = bytesDownloaded;
            this.previousNetworkIO.time = now;
            return false;
        }
        
        const interval = (now - this.previousNetworkIO.time) / 1000000;
        const bytesUploadedPerSec = Math.round((bytesUploaded - this.previousNetworkIO.bytesUploaded) / interval);
        const bytesDownloadedPerSec = Math.round((bytesDownloaded - this.previousNetworkIO.bytesDownloaded) / interval);
        
        if(bytesUploadedPerSec > this.detectedMaxSpeeds.bytesUploadedPerSec)
            this.detectedMaxSpeeds.bytesUploadedPerSec = bytesUploadedPerSec;
        if(bytesDownloadedPerSec > this.detectedMaxSpeeds.bytesDownloadedPerSec)
            this.detectedMaxSpeeds.bytesDownloadedPerSec = bytesDownloadedPerSec;
        
        this.previousNetworkIO.bytesUploaded = bytesUploaded;
        this.previousNetworkIO.bytesDownloaded = bytesDownloaded;
        this.previousNetworkIO.time = now;
        
        this.pushUsageHistory('networkIO', {
            bytesUploadedPerSec,
            bytesDownloadedPerSec
        });
        
        if(detailed) {
            if(this.previousDetailedNetworkIO.time === now)
                return false;
            
            const finalData = new Map();
            
            const interval = (now - this.previousDetailedNetworkIO.time) / 1000000;
            for(const [deviceName, { bytesUploaded, bytesDownloaded }] of devices) {
                const previousData = this.previousDetailedNetworkIO.devices.get(deviceName);
                if(previousData) {
                    const bytesUploadedPerSec = Math.round((bytesUploaded - previousData.bytesUploaded) / interval);
                    const bytesDownloadedPerSec = Math.round((bytesDownloaded - previousData.bytesDownloaded) / interval);    
                    finalData.set(deviceName, { bytesUploadedPerSec, bytesDownloadedPerSec });
                }
            }
            
            this.previousDetailedNetworkIO.devices = devices;
            this.previousDetailedNetworkIO.time = now;
            
            this.pushUsageHistory('detailedNetworkIO', finalData);
        }
        return true;
    }
    
    /**
     * @typedef {{}} InterfaceDevice
     */
    
    /**
     * This function is sync, but it spawns only once the user opens the network menu
     * May be convered to async but this will introduce a graphical update lag (minor)
     * Impact measured to be ~15ms: relevant but not a priority
     * @returns {Map<string, InterfaceDevice>}
     */
    getNetworkInterfacesSync() {
        const devices = new Map();
        
        try {
            const [result, stdout, stderr] = GLib.spawn_command_line_sync('ip -d -j addr');
            
            if (result && stdout) {
                const decoder = new TextDecoder("utf-8");
                const output = decoder.decode(stdout);
                
                const json = JSON.parse(output);
                
                for(const data of json) {
                    const name = data.ifname;
                    if(name === 'lo')
                        continue;
                    
                    const flags = data.flags || [];
                    if(flags.includes('NO-CARRIER') || flags.includes('LOOPBACK'))
                        continue;
                    
                    const ifindex = data.ifindex;
                    if(data.ifindex === undefined)
                        continue;
                    
                    const device = {
                        name,
                        flags,
                        ifindex
                    };
                    
                    if(data.mtu)
                        device.mtu = data.mtu;
                    if(data.qdisc)
                        device.qdisc = data.qdisc;
                    if(data.operstate)
                        device.operstate = data.operstate;
                    if(data.linkmode)
                        device.linkmode = data.linkmode;
                    if(data.group)
                        device.group = data.group;
                    if(data.txqlen)
                        device.txqlen = data.txqlen;
                    if(data.link_type)
                        device.link_type = data.link_type;
                    if(data.address)
                        device.address = data.address;
                    if(data.broadcast)
                        device.broadcast = data.broadcast;
                    if(data.netmask)
                        device.netmask = data.netmask;
                    if(data.altnames)
                        device.altnames = data.altnames;
                    if(data.addr_info)
                        device.addr_info = data.addr_info;
                        
                    devices.set(name, device);
                }
            }
        }
        catch(e) {
            Utils.error(e.message);
        }
        
        return devices;
    }
    
    destroy() {
        Config.clear(this);
        super.destroy();
    }
}