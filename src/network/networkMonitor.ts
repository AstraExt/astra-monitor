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
import CancellableTaskManager from '../utils/cancellableTaskManager.js';
import PromiseValueHolder, { PromiseValueHolderStore } from '../utils/promiseValueHolder.js';

export type NetworkIO = {
    bytesUploadedPerSec: number;
    bytesDownloadedPerSec: number;
};

export type MaxSpeeds = NetworkIO;

type DeviceStauts = {
    bytesUploaded: number;
    bytesDownloaded: number;
};

type PreviousNetworkIO = DeviceStauts & {
    time: number;
};

type PreviousDetailedNetworkIO = {
    devices: Map<string, DeviceStauts>|null;
    time: number;
};

type NetworkDataSources = {
    networkIO?: string
};

export default class NetworkMonitor extends Monitor {
    private detectedMaxSpeedsValues: MaxSpeeds;
    private interfaceChecks: Record<string, boolean>;
    private ignored: string[];
    private ignoredRegex: RegExp|null;
    
    private updateNetworkIOTask: CancellableTaskManager<boolean>;
    
    private previousNetworkIO!: PreviousNetworkIO;
    private previousDetailedNetworkIO!: PreviousDetailedNetworkIO;
    
    private dataSources!: NetworkDataSources;
    
    private publicIpsUpdaterID: number|null = null;
    
    constructor() {
        super('Network Monitor');
        
        //TODO: let the user choose max speeds / save max speeds
        this.detectedMaxSpeedsValues = {
            bytesUploadedPerSec: 0,
            bytesDownloadedPerSec: 0
        };
        
        this.interfaceChecks = {};
        
        // Setup tasks
        this.updateNetworkIOTask = new CancellableTaskManager();
        
        this.reset();
        this.dataSourcesInit();
        
        const enabled = Config.get_boolean('network-header-show');
        if(enabled) {
            this.updatePublicIps();
            this.start();
        }
        
        Config.connect(this, 'changed::network-header-show', () => {
            if(Config.get_boolean('network-header-show'))
                this.start();
            else
                this.stop();
        });
        
        Config.connect(this, 'changed::network-update', this.restart.bind(this));
        
        // Manually ignored interfaces
        this.ignored = Config.get_json('network-ignored');
        if(this.ignored === null || !Array.isArray(this.ignored))
            this.ignored = [];
        Config.connect(this, 'changed::network-ignored', () => {
            this.reset();
            
            this.ignored = Config.get_json('network-ignored');
            if(this.ignored === null || !Array.isArray(this.ignored))
                this.ignored = [];
        });
        
        // Regex ignored interfaces
        const regex = Config.get_string('network-ignored-regex');
        try {
            if(regex === null || regex === '')
                this.ignoredRegex = null;
            else
                this.ignoredRegex = new RegExp(`^${regex}$`, 'i');
        } catch(e) {
            this.ignoredRegex = null;
        }
        
        Config.connect(this, 'changed::network-ignored-regex', () => {
            this.reset();
            
            const regex = Config.get_string('network-ignored-regex');
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
        
        this.startPublicIpsUpdater();
    }
    
    stop() {
        super.stop();
        
        this.stopPublicIpsUpdater();
        
        this.reset();
    }
    
    dataSourcesInit() {
        this.dataSources = {
            networkIO: Config.get_string('network-source-network-io') ?? undefined,
        };
        
        Config.connect(this, 'changed::network-source-network-io', () => {
            this.dataSources.networkIO = Config.get_string('network-source-network-io') ?? undefined;
            this.updateNetworkIOTask.cancel();
            this.previousNetworkIO = {
                bytesUploaded: -1,
                bytesDownloaded: -1,
                time: -1
            };
            this.previousDetailedNetworkIO = {
                devices: null,
                time: -1
            };
            this.resetUsageHistory('networkIO');
            this.resetUsageHistory('detailedNetworkIO');
        });
    }
    
    stopListeningFor(key: string) {
        super.stopListeningFor(key);
        
        if(key === 'detailedNetworkIO') {
            this.previousDetailedNetworkIO.devices = null;
            this.previousDetailedNetworkIO.time = -1;
        }
    }
    
    update(): boolean {
        const enabled = Config.get_boolean('network-header-show');
        if(enabled) {
            const procNetDev = new PromiseValueHolderStore<string[]>(this.getProNetDevAsync.bind(this));
            
            let detailed = false;
            if(this.isListeningFor('detailedNetworkIO'))
                detailed = true;
            
            this.runUpdate('networkIO', detailed, procNetDev);
        }
        return true;
    }
    
    requestUpdate(key: string) {
        if(key === 'networkIO' || key === 'detailedNetworkIO') {
            const procNetDev = new PromiseValueHolderStore<string[]>(this.getProNetDevAsync.bind(this));
            
            const detailed = key === 'detailedNetworkIO';
            
            this.runUpdate('networkIO', detailed, procNetDev);
            
            if(detailed)
                super.requestUpdate('networkIO'); // override also the storageIO update
        }
        super.requestUpdate(key);
    }
    
    runUpdate(key: string, ...params: any[]) {
        if(key === 'networkIO') {
            const detailed = params[0];
            const callback = () => {
                this.notify('networkIO');
                if(detailed)
                    this.notify('detailedNetworkIO');
            };
            
            let run;
            if(this.dataSources.networkIO === 'GTop')
                run = this.updateNetworkIOGTop.bind(this, ...params);
            else if(this.dataSources.networkIO === 'proc')
                run = this.updateNetworkIOProc.bind(this, ...params);
            else
                run = this.updateNetworkIOAuto.bind(this, ...params);
            
            this.runTask({
                key,
                task: this.updateNetworkIOTask,
                run,
                callback
            });
            return;
        }
    }
    
    getProNetDevAsync(): PromiseValueHolder<string[]> {
        return new PromiseValueHolder(new Promise((resolve, reject) => {
            Utils.readFileAsync('/proc/net/dev').then(fileContent => {
                resolve(fileContent.split('\n'));
            }).catch(e => {
                reject(e);
            });
        }));
    }
    
    isMonitoredInterface(interfaceName: string): boolean {
        if(this.interfaceChecks[interfaceName] !== undefined)
            return this.interfaceChecks[interfaceName];
        
        let monitored = true;
        if(interfaceName === 'lo')
            monitored = false;
        
        //TODO: Add the possibility to choose the interfaces to monitor
        this.interfaceChecks[interfaceName] = monitored;
        return monitored;
    }
    
    updateNetworkIOAuto(detailed: boolean, procNetDev: PromiseValueHolder<string[]>): Promise<boolean> {
        if(Utils.GTop)
            return this.updateNetworkIOGTop(detailed);
        return this.updateNetworkIOProc(detailed, procNetDev);
    }
    
    async updateNetworkIOProc(detailed: boolean, procNetDev: PromiseValueHolder<string[]>): Promise<boolean> {
        let procNetDevValue = await procNetDev.getValue();
        if(procNetDevValue.length < 1)
            return false;
        
        let bytesUploaded = 0;
        let bytesDownloaded = 0;
        
        let devices: Map<string, DeviceStauts>|null = null;
        if(detailed)
            devices = new Map();
        
        procNetDevValue = procNetDevValue.slice(2);  // Remove the first two lines
        
        for(const device of procNetDevValue) {
            const fields = device.trim().split(/\s+/);
            if(fields.length < 10)
                continue;
            
            const interfaceName = fields[0].slice(0, -1); // Remove the trailing ':'
            if(!this.isMonitoredInterface(interfaceName))
                continue;
            
            if(this.ignored.includes(interfaceName))
                continue;
            
            if(this.ignoredRegex !== null && this.ignoredRegex.test(interfaceName))
                continue;
            
            if(detailed && devices) {
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
        
        return this.updateNetworkIOCommon({
            bytesUploaded,
            bytesDownloaded,
            detailed,
            devices
        });
    }
    
    async updateNetworkIOGTop(detailed: boolean): Promise<boolean> {
        const GTop = Utils.GTop;
        if(!GTop)
            return false;
        
        const buf = new GTop.glibtop_netlist();
        const netlist = GTop.glibtop_get_netlist(buf);
        
        let bytesUploaded = 0;
        let bytesDownloaded = 0;
        
        let devices: Map<string, DeviceStauts>|null = null;
        if(detailed)
            devices = new Map();
        
        for(const interfaceName of netlist) {
            if(!this.isMonitoredInterface(interfaceName))
                continue;
            
            if(this.ignored.includes(interfaceName))
                continue;
            
            if(this.ignoredRegex !== null && this.ignoredRegex.test(interfaceName))
                continue;
            
            const netload = new GTop.glibtop_netload();
            GTop.glibtop_get_netload(netload, interfaceName);
            
            if(detailed && devices) {
                devices.set(interfaceName, {
                    bytesUploaded: netload.bytes_out,
                    bytesDownloaded: netload.bytes_in,
                });
            }
            
            bytesUploaded += netload.bytes_out;
            bytesDownloaded += netload.bytes_in;
        }
        
        return this.updateNetworkIOCommon({
            bytesUploaded,
            bytesDownloaded,
            detailed,
            devices
        });
    }
    
    private updateNetworkIOCommon({bytesUploaded, bytesDownloaded, detailed, devices}: {
        bytesUploaded: number;
        bytesDownloaded: number;
        detailed: boolean;
        devices: Map<string, DeviceStauts>|null;
    }): boolean {
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
            totalBytesUploaded: bytesUploaded,
            totalBytesDownloaded: bytesDownloaded,
            bytesUploadedPerSec,
            bytesDownloadedPerSec
        });
        
        if(detailed && devices !== null) {
            if(this.previousDetailedNetworkIO.time === now)
                return false;
            if(this.previousDetailedNetworkIO.devices === null)
                return false;
            
            const finalData = new Map();
            
            const interval = (now - this.previousDetailedNetworkIO.time) / 1000000;
            for(const [deviceName, { bytesUploaded, bytesDownloaded }] of devices) {
                const previousData = this.previousDetailedNetworkIO.devices.get(deviceName);
                if(previousData) {
                    const bytesUploadedPerSec = Math.round((bytesUploaded - previousData.bytesUploaded) / interval);
                    const bytesDownloadedPerSec = Math.round((bytesDownloaded - previousData.bytesDownloaded) / interval);    
                    finalData.set(deviceName, {
                        totalBytesUploaded: bytesUploaded,
                        totalBytesDownloaded: bytesDownloaded,
                        bytesUploadedPerSec,
                        bytesDownloadedPerSec
                    });
                }
            }
            
            this.previousDetailedNetworkIO.devices = devices;
            this.previousDetailedNetworkIO.time = now;
            
            this.pushUsageHistory('detailedNetworkIO', finalData);
        }
        return true;
    }
    
    private startPublicIpsUpdater() {
        this.publicIpsUpdaterID = GLib.timeout_add_seconds(
            GLib.PRIORITY_DEFAULT,
            60*5, // 5 minute
            this.updatePublicIps.bind(this)
        );
    }
    
    private stopPublicIpsUpdater() {
        if(this.publicIpsUpdaterID !== null) {
            GLib.source_remove(this.publicIpsUpdaterID);
            this.publicIpsUpdaterID = null;
        }
    }
    
    private updatePublicIps() {
        (async () => {
            try {
                const ipv4 = await this.updatePublicIpv4Address();
                const ipv6 = await this.updatePublicIpv6Address();
                
                if(ipv4 || ipv6)
                    this.notify('publicIps');
            }
            catch(e) { /* EMPTY */}
        })();
        return true;
    }
    
    private async updatePublicIpv4Address(): Promise<boolean> {
        const publicIpv4Address = Config.get_string('network-source-public-ipv4');
        if(!publicIpv4Address)
            return false;
        
        const value = await Utils.getUrlAsync(publicIpv4Address, true);
        if(!value)
            return false;
        
        const regex = /(\b25[0-5]|\b2[0-4][0-9]|\b[01]?[0-9][0-9]?)(\.(25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)){3}/;
        const match = value.match(regex);
        
        if(!match)
            return false;
        
        const ip = match[0];
        
        const currentIp = this.getCurrentValue('publicIpv4Address');
        if(currentIp === ip)
            return false;
        
        this.pushUsageHistory('publicIpv4Address', ip);
        return true;
    }
    
    private async updatePublicIpv6Address(): Promise<boolean> {
        const publicIpv6Address = Config.get_string('network-source-public-ipv6');
        if(!publicIpv6Address)
            return false;
        
        const value = await Utils.getUrlAsync(publicIpv6Address, true);
        if(!value)
            return false;
        
        const regex = /(?:[\da-f]{0,4}:){2,7}(?:(?<ipv4>(?:(?:25[0-5]|2[0-4]\d|1?\d\d?)\.){3}(?:25[0-5]|2[0-4]\d|1?\d\d?))|[\da-f]{0,4}|:)/i;
        const match = value.match(regex);
        
        if(!match)
            return false;
        
        const ip = match[0];
        
        const currentIp = this.getCurrentValue('publicIpv6Address');
        if(currentIp === ip)
            return false;
        
        this.pushUsageHistory('publicIpv6Address', ip);
        return true;
    }
    
    destroy() {
        Config.clear(this);
        super.destroy();
    }
}