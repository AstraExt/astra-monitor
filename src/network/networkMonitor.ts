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
import ContinuousTaskManager, {
    ContinuousTaskManagerData,
} from '../utils/continuousTaskManager.js';

export type NetworkIO = {
    bytesUploadedPerSec: number;
    bytesDownloadedPerSec: number;
};

export type MaxSpeeds = NetworkIO;

type DeviceStautsBase = {
    bytesUploaded: number;
    bytesDownloaded: number;
};

type DeviceStauts = DeviceStautsBase & {
    packetsUploaded: number;
    packetsDownloaded: number;
    errorsUpload: number;
    errorsDownload: number;
};

type PreviousNetworkIO = DeviceStautsBase & {
    time: number;
};

type PreviousDetailedNetworkIO = {
    devices: Map<string, DeviceStauts> | null;
    time: number;
};

type NetworkDataSources = {
    networkIO?: string;
    wireless?: string;
    topProcesses?: string;
};

export type NetworkWirelessInfo = {
    name: string;
    IEEE?: string;
    EESSID?: string;
    mode?: string;
    frequency?: string;
    accessPoint?: string;
    bitRate?: string;
    txPower?: string;
    linkQuality?: string;
    signalLevel?: string;
};

export default class NetworkMonitor extends Monitor {
    //TODO: maybe make this configurable
    static get TOP_PROCESSES_LIMIT() {
        return 10;
    }

    private detectedMaxSpeedsValues: MaxSpeeds;
    private interfaceChecks: Record<string, boolean>;
    private ignored: string[];
    private ignoredRegex: RegExp | null;

    private updateNetworkIOTask: CancellableTaskManager<boolean>;
    private updateRoutesTask: CancellableTaskManager<boolean>;
    private updateWirelessTask: CancellableTaskManager<boolean>;

    private updateNethogsTask: ContinuousTaskManager;

    private previousNetworkIO!: PreviousNetworkIO;
    private previousDetailedNetworkIO!: PreviousDetailedNetworkIO;

    private dataSources!: NetworkDataSources;

    private publicIpsUpdaterID: number | null = null;
    private lastIpsUpdate: number = 0;

    constructor() {
        super('Network Monitor');

        //TODO: let the user choose max speeds / save max speeds
        this.detectedMaxSpeedsValues = {
            bytesUploadedPerSec: 0,
            bytesDownloadedPerSec: 0,
        };

        this.interfaceChecks = {};

        // Setup tasks
        this.updateNetworkIOTask = new CancellableTaskManager();
        this.updateRoutesTask = new CancellableTaskManager();
        this.updateWirelessTask = new CancellableTaskManager();

        this.updateNethogsTask = new ContinuousTaskManager();
        this.updateNethogsTask.listen(this, this.updateNethogs.bind(this));

        this.reset();
        this.dataSourcesInit();

        const enabled = Config.get_boolean('network-header-show');
        if(enabled) {
            this.updatePublicIps();
            this.start();
        }

        Config.connect(this, 'changed::network-header-show', () => {
            if(Config.get_boolean('network-header-show')) this.start();
            else this.stop();
        });

        Config.connect(this, 'changed::network-update', this.restart.bind(this));

        // Manually ignored interfaces
        this.ignored = Config.get_json('network-ignored');
        if(this.ignored === null || !Array.isArray(this.ignored)) this.ignored = [];
        Config.connect(this, 'changed::network-ignored', () => {
            this.reset();

            this.ignored = Config.get_json('network-ignored');
            if(this.ignored === null || !Array.isArray(this.ignored)) this.ignored = [];
        });

        // Regex ignored interfaces
        {
            const regex = Config.get_string('network-ignored-regex');
            try {
                if(regex === null || regex === '') this.ignoredRegex = null;
                else this.ignoredRegex = new RegExp(`^${regex}$`, 'i');
            } catch(e) {
                this.ignoredRegex = null;
            }
        }

        Config.connect(this, 'changed::network-ignored-regex', () => {
            this.reset();

            const regex = Config.get_string('network-ignored-regex');
            try {
                if(regex === null || regex === '') this.ignoredRegex = null;
                else this.ignoredRegex = new RegExp(`^${regex}$`, 'i');
            } catch(e) {
                this.ignoredRegex = null;
            }
        });

        Config.connect(
            this,
            'changed::network-source-public-ipv4',
            this.updatePublicIps.bind(this)
        );
        Config.connect(
            this,
            'changed::network-source-public-ipv6',
            this.updatePublicIps.bind(this)
        );
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
            time: -1,
        };

        this.previousDetailedNetworkIO = {
            devices: null,
            time: -1,
        };

        this.updateNetworkIOTask.cancel();
        this.updateRoutesTask.cancel();
        this.updateWirelessTask.cancel();
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
            wireless: Config.get_string('network-source-wireless') ?? undefined,
            topProcesses: Config.get_string('network-source-top-processes') ?? undefined,
        };

        Config.connect(this, 'changed::network-source-network-io', () => {
            this.dataSources.networkIO =
                Config.get_string('network-source-network-io') ?? undefined;
            this.updateNetworkIOTask.cancel();
            this.previousNetworkIO = {
                bytesUploaded: -1,
                bytesDownloaded: -1,
                time: -1,
            };
            this.previousDetailedNetworkIO = {
                devices: null,
                time: -1,
            };
            this.resetUsageHistory('networkIO');
            this.resetUsageHistory('detailedNetworkIO');
        });

        Config.connect(this, 'changed::network-source-wireless', () => {
            this.dataSources.wireless = Config.get_string('network-source-wireless') ?? undefined;
            this.updateWirelessTask.cancel();
            this.resetUsageHistory('wireless');
        });

        Config.connect(this, 'changed::network-source-top-processes', () => {
            this.dataSources.topProcesses =
                Config.get_string('network-source-top-processes') ?? undefined;
            this.topProcessesSourceChanged();
            this.resetUsageHistory('topProcesses');
        });
    }

    startListeningFor(key: string) {
        super.startListeningFor(key);

        if(key === 'topProcesses') {
            if(Utils.nethogsHasCaps()) {
                if(
                    this.dataSources.networkIO === 'nethogs' ||
                    this.dataSources.networkIO === 'auto'
                ) {
                    this.startNethogs();
                }
            }
        }
    }

    stopListeningFor(key: string) {
        super.stopListeningFor(key);

        if(key === 'detailedNetworkIO') {
            this.previousDetailedNetworkIO.devices = null;
            this.previousDetailedNetworkIO.time = -1;
        }
        if(key === 'topProcesses') {
            if(Utils.nethogsHasCaps()) {
                if(
                    this.dataSources.networkIO === 'nethogs' ||
                    this.dataSources.networkIO === 'auto'
                ) {
                    this.stopNethogs();
                }
            }
        }
    }

    update(): boolean {
        Utils.verbose('Updating Network Monitor');

        const enabled = Config.get_boolean('network-header-show');
        if(enabled) {
            const procNetDev = new PromiseValueHolderStore<string[]>(
                this.getProNetDevAsync.bind(this)
            );

            let detailed = false;
            if(this.isListeningFor('detailedNetworkIO')) detailed = true;

            this.runUpdate('networkIO', detailed, procNetDev);

            if(this.isListeningFor('wireless')) this.runUpdate('wireless');
        }
        return true;
    }

    requestUpdate(key: string) {
        if(key === 'networkIO' || key === 'detailedNetworkIO') {
            const procNetDev = new PromiseValueHolderStore<string[]>(
                this.getProNetDevAsync.bind(this)
            );

            const detailed = key === 'detailedNetworkIO';

            this.runUpdate('networkIO', detailed, procNetDev);

            if(detailed) super.requestUpdate('networkIO'); // override also the storageIO update
        }
        if(key === 'routes') {
            this.runUpdate('routes');
        }
        if(key === 'wireless') {
            this.runUpdate('wireless');
        }
        super.requestUpdate(key);
    }

    runUpdate(key: string, ...params: any[]) {
        if(key === 'networkIO') {
            const detailed = params[0];
            const callback = () => {
                this.notify('networkIO');
                if(detailed) this.notify('detailedNetworkIO');
            };

            let run;
            if(this.dataSources.networkIO === 'GTop')
                run = this.updateNetworkIOGTop.bind(this, ...params);
            else if(this.dataSources.networkIO === 'proc')
                run = this.updateNetworkIOProc.bind(this, ...params);
            else run = this.updateNetworkIOAuto.bind(this, ...params);

            this.runTask({
                key,
                task: this.updateNetworkIOTask,
                run,
                callback,
            });
            return;
        }
        if(key === 'routes') {
            this.runTask({
                key,
                task: this.updateRoutesTask,
                run: this.updateRoutes.bind(this),
                callback: () => this.notify('routes'),
            });
            return;
        }
        if(key === 'wireless') {
            let run;
            if(this.dataSources.wireless === 'iw')
                run = this.updateWirelessIw.bind(this, ...params);
            else if(this.dataSources.wireless === 'iwconfig')
                run = this.updateWirelessIwconfig.bind(this, ...params);
            else run = this.updateWirelessAuto.bind(this, ...params);

            this.runTask({
                key,
                task: this.updateWirelessTask,
                run,
                callback: () => this.notify('wireless'),
            });
            return;
        }
    }

    getProNetDevAsync(): PromiseValueHolder<string[]> {
        return new PromiseValueHolder(
            new Promise((resolve, reject) => {
                Utils.readFileAsync('/proc/net/dev')
                    .then(fileContent => {
                        resolve(fileContent.split('\n'));
                    })
                    .catch(e => {
                        reject(e);
                    });
            })
        );
    }

    isMonitoredInterface(interfaceName: string): boolean {
        if(this.interfaceChecks[interfaceName] !== undefined)
            return this.interfaceChecks[interfaceName];

        let monitored = true;
        if(interfaceName === 'lo') monitored = false;

        //TODO: Add the possibility to choose the interfaces to monitor
        this.interfaceChecks[interfaceName] = monitored;
        return monitored;
    }

    updateNetworkIOAuto(
        detailed: boolean,
        procNetDev: PromiseValueHolder<string[]>
    ): Promise<boolean> {
        if(Utils.GTop) return this.updateNetworkIOGTop(detailed);
        return this.updateNetworkIOProc(detailed, procNetDev);
    }

    async updateNetworkIOProc(
        detailed: boolean,
        procNetDev: PromiseValueHolder<string[]>
    ): Promise<boolean> {
        let procNetDevValue = await procNetDev.getValue();
        if(procNetDevValue.length < 1) return false;

        let bytesUploaded = 0;
        let bytesDownloaded = 0;

        let packetsUploaded = 0;
        let packetsDownloaded = 0;

        let errorsUpload = 0;
        let errorsDownload = 0;

        let devices: Map<string, DeviceStauts> | null = null;
        if(detailed) devices = new Map();

        procNetDevValue = procNetDevValue.slice(2); // Remove the first two lines

        for(const device of procNetDevValue) {
            const fields = device.trim().split(/\s+/);
            if(fields.length < 10) continue;

            const interfaceName = fields[0].slice(0, -1); // Remove the trailing ':'
            if(!this.isMonitoredInterface(interfaceName)) continue;

            if(this.ignored.includes(interfaceName)) continue;

            if(this.ignoredRegex !== null && this.ignoredRegex.test(interfaceName)) continue;

            if(detailed && devices) {
                devices.set(interfaceName, {
                    bytesUploaded: parseInt(fields[9]),
                    packetsUploaded: parseInt(fields[10]),
                    errorsUpload: parseInt(fields[11]) + parseInt(fields[12]),

                    bytesDownloaded: parseInt(fields[1]),
                    packetsDownloaded: parseInt(fields[2]),
                    errorsDownload: parseInt(fields[3]) + parseInt(fields[4]),
                });
            }

            bytesUploaded += parseInt(fields[9]);
            bytesDownloaded += parseInt(fields[1]);

            packetsUploaded += parseInt(fields[10]);
            packetsDownloaded += parseInt(fields[2]);

            errorsUpload += parseInt(fields[11]) + parseInt(fields[12]);
            errorsDownload += parseInt(fields[3]) + parseInt(fields[4]);
        }

        return this.updateNetworkIOCommon({
            bytesUploaded,
            bytesDownloaded,

            packetsUploaded,
            packetsDownloaded,

            errorsUpload,
            errorsDownload,

            detailed,
            devices,
        });
    }

    async updateNetworkIOGTop(detailed: boolean): Promise<boolean> {
        const GTop = Utils.GTop;
        if(!GTop) return false;

        const buf = new GTop.glibtop_netlist();
        const netlist = GTop.glibtop_get_netlist(buf);

        let bytesUploaded = 0;
        let bytesDownloaded = 0;

        let packetsUploaded = 0;
        let packetsDownloaded = 0;

        let errorsUpload = 0;
        let errorsDownload = 0;

        let devices: Map<string, DeviceStauts> | null = null;
        if(detailed) devices = new Map();

        for(const interfaceName of netlist) {
            if(!this.isMonitoredInterface(interfaceName)) continue;

            if(this.ignored.includes(interfaceName)) continue;

            if(this.ignoredRegex !== null && this.ignoredRegex.test(interfaceName)) continue;

            const netload = new GTop.glibtop_netload();
            GTop.glibtop_get_netload(netload, interfaceName);

            if(detailed && devices) {
                devices.set(interfaceName, {
                    bytesUploaded: netload.bytes_out,
                    bytesDownloaded: netload.bytes_in,
                    packetsUploaded: netload.packets_out,
                    packetsDownloaded: netload.packets_in,
                    errorsUpload: netload.errors_out,
                    errorsDownload: netload.errors_in,
                });
            }

            bytesUploaded += netload.bytes_out;
            bytesDownloaded += netload.bytes_in;

            packetsUploaded += netload.packets_out;
            packetsDownloaded += netload.packets_in;

            errorsUpload += netload.errors_out;
            errorsDownload += netload.errors_in;
        }

        return this.updateNetworkIOCommon({
            bytesUploaded,
            bytesDownloaded,

            packetsUploaded,
            packetsDownloaded,

            errorsUpload,
            errorsDownload,

            detailed,
            devices,
        });
    }

    private updateNetworkIOCommon(data: {
        bytesUploaded: number;
        bytesDownloaded: number;
        packetsUploaded: number;
        packetsDownloaded: number;
        errorsUpload: number;
        errorsDownload: number;
        detailed: boolean;
        devices: Map<string, DeviceStauts> | null;
    }): boolean {
        const {
            bytesUploaded,
            bytesDownloaded,
            packetsUploaded,
            packetsDownloaded,
            errorsUpload,
            errorsDownload,
            detailed,
            devices,
        } = data;

        const now = GLib.get_monotonic_time();

        if(detailed) {
            if(
                this.previousDetailedNetworkIO.devices === null ||
                this.previousDetailedNetworkIO.time === -1
            ) {
                this.previousDetailedNetworkIO.devices = devices;
                this.previousDetailedNetworkIO.time = now;
            }
        }

        if(
            this.previousNetworkIO.bytesUploaded === -1 ||
            this.previousNetworkIO.bytesDownloaded === -1 ||
            this.previousNetworkIO.time === -1
        ) {
            this.previousNetworkIO.bytesUploaded = bytesUploaded;
            this.previousNetworkIO.bytesDownloaded = bytesDownloaded;
            this.previousNetworkIO.time = now;
            return false;
        }

        let interval = (now - this.previousNetworkIO.time) / 1000000;
        let bytesUploadedPerSec = Math.round(
            (bytesUploaded - this.previousNetworkIO.bytesUploaded) / interval
        );
        let bytesDownloadedPerSec = Math.round(
            (bytesDownloaded - this.previousNetworkIO.bytesDownloaded) / interval
        );

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
            packetsUploaded: packetsUploaded,
            packetsDownloaded: packetsDownloaded,
            errorsUpload: errorsUpload,
            errorsDownload: errorsDownload,
            bytesUploadedPerSec,
            bytesDownloadedPerSec,
        });

        if(detailed && devices !== null) {
            if(this.previousDetailedNetworkIO.time === now) return false;
            if(this.previousDetailedNetworkIO.devices === null) return false;

            const finalData = new Map();

            interval = (now - this.previousDetailedNetworkIO.time) / 1000000;
            for(const [deviceName, devicesData] of devices) {
                const {
                    bytesUploaded: deviceBytesUploaded,
                    bytesDownloaded: deviceBytesDownloaded,
                    packetsUploaded: devicePacketsUploaded,
                    packetsDownloaded: devicePacketsDownloaded,
                    errorsUpload: deviceErrorsUpload,
                    errorsDownload: deviceErrorsDownload,
                } = devicesData;

                const previousData = this.previousDetailedNetworkIO.devices.get(deviceName);
                if(previousData) {
                    bytesUploadedPerSec = Math.round(
                        (deviceBytesUploaded - previousData.bytesUploaded) / interval
                    );
                    bytesDownloadedPerSec = Math.round(
                        (deviceBytesDownloaded - previousData.bytesDownloaded) / interval
                    );
                    finalData.set(deviceName, {
                        totalBytesUploaded: deviceBytesUploaded,
                        totalBytesDownloaded: deviceBytesDownloaded,
                        packetsUploaded: devicePacketsUploaded,
                        packetsDownloaded: devicePacketsDownloaded,
                        errorsUpload: deviceErrorsUpload,
                        errorsDownload: deviceErrorsDownload,
                        bytesUploadedPerSec,
                        bytesDownloadedPerSec,
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
            60 * 5, // 5 minute
            this.updatePublicIps.bind(this)
        );
    }

    private stopPublicIpsUpdater() {
        if(this.publicIpsUpdaterID !== null) {
            GLib.source_remove(this.publicIpsUpdaterID);
            this.publicIpsUpdaterID = null;
        }
    }

    public get secondsSinceLastIpsUpdate(): number {
        return (GLib.get_monotonic_time() - this.lastIpsUpdate) / 1000000;
    }

    public updatePublicIps(force: boolean = false): boolean {
        (async () => {
            try {
                this.lastIpsUpdate = GLib.get_monotonic_time();
                const ipv4 = await this.updatePublicIpv4Address();
                const ipv6 = await this.updatePublicIpv6Address();
                if(ipv4 || ipv6 || force) this.notify('publicIps');
            } catch(e) {
                /* EMPTY */
            }
        })();
        return true;
    }

    private resetIPv4(): boolean {
        if(this.getCurrentValue('publicIpv4Address') === '') return false;
        this.setUsageValue('publicIpv4Address', '');
        return true;
    }

    private async updatePublicIpv4Address(): Promise<boolean> {
        const publicIpv4Address = Config.get_string('network-source-public-ipv4');
        if(!publicIpv4Address) return this.resetIPv4();

        const value = await Utils.getUrlAsync(publicIpv4Address, true);
        if(!value) return this.resetIPv4();

        const regex =
            /(\b25[0-5]|\b2[0-4][0-9]|\b[01]?[0-9][0-9]?)(\.(25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)){3}/;
        const match = value.match(regex);

        if(!match) return this.resetIPv4();

        const ip = match[0];

        const currentIp = this.getCurrentValue('publicIpv4Address');
        if(currentIp === ip) return false;

        this.pushUsageHistory('publicIpv4Address', ip);
        return true;
    }

    private resetIPv6(): boolean {
        if(this.getCurrentValue('publicIpv6Address') === '') return false;
        this.setUsageValue('publicIpv6Address', '');
        return true;
    }

    private async updatePublicIpv6Address(): Promise<boolean> {
        const publicIpv6Address = Config.get_string('network-source-public-ipv6');
        if(!publicIpv6Address) return this.resetIPv6();

        const value = await Utils.getUrlAsync(publicIpv6Address, true);
        if(!value) return this.resetIPv6();

        const regex =
            /(?:[\da-f]{0,4}:){2,7}(?:(?<ipv4>(?:(?:25[0-5]|2[0-4]\d|1?\d\d?)\.){3}(?:25[0-5]|2[0-4]\d|1?\d\d?))|[\da-f]{0,4}|:)/i;
        const match = value.match(regex);

        if(!match) return this.resetIPv6();

        const ip = match[0];

        const currentIp = this.getCurrentValue('publicIpv6Address');
        if(currentIp === ip) return false;

        this.pushUsageHistory('publicIpv6Address', ip);
        return true;
    }

    private async updateRoutes(): Promise<boolean> {
        const routes = await Utils.getNetworkRoutesAsync();
        if(!routes) return false;
        this.setUsageValue('routes', routes);
        return true;
    }

    private async updateWirelessAuto(): Promise<boolean> {
        if(Utils.hasIwconfig()) return this.updateWirelessIwconfig();
        if(Utils.hasIw()) return this.updateWirelessIw();
        return false;
    }

    private async updateWirelessIwconfig(): Promise<boolean> {
        const path = Utils.commandPathLookup('iwconfig --version');

        let result = '';
        try {
            result = await Utils.executeCommandAsync(`${path}iwconfig`);
        } catch(e) {
            /* NO NETWORK FOUND */
        }
        if(!result) return false;

        const devices: Map<string, NetworkWirelessInfo> = new Map();
        const deviceBlocks = result.split('\n\n');

        for(const block of deviceBlocks) {
            const lines = block.split('\n').filter(line => line.trim() !== '');
            if(lines.length <= 1) continue;

            const deviceName = lines[0].split(' ')[0];
            if(!deviceName) continue;

            lines[0] = lines[0].substring(deviceName.length);

            const info: NetworkWirelessInfo = { name: deviceName };

            for(const line of lines) {
                const pairs = line.trim().split(/\s{2,}/);
                for(const pair of pairs) {
                    if(pair.startsWith('IEEE')) info.IEEE = pair.split(':')[1];
                    else if(pair.startsWith('ESSID'))
                        info.EESSID = pair.split(':')[1].replace(/^"|"$/g, '');
                    else if(pair.startsWith('Mode')) info.mode = pair.split(':')[1];
                    else if(pair.startsWith('Frequency')) info.frequency = pair.split(':')[1];
                    else if(pair.startsWith('Access Point'))
                        info.accessPoint = pair.substring(pair.indexOf(':') + 1).trim();
                    else if(pair.startsWith('Bit Rate')) info.bitRate = pair.split('=')[1];
                    else if(pair.startsWith('Tx-Power')) info.txPower = pair.split('=')[1];
                    else if(pair.startsWith('Link Quality')) info.linkQuality = pair.split('=')[1];
                    else if(pair.startsWith('Signal level')) info.signalLevel = pair.split('=')[1];
                }
            }

            if(!info.EESSID || info.EESSID === 'off/any') continue;

            devices.set(deviceName, info);
        }

        this.setUsageValue('wireless', devices);

        return true;
    }

    private async updateWirelessIw(): Promise<boolean> {
        // List all wireless interfaces
        const list = await Utils.listDirAsync('/sys/class/net', { folders: true, files: false });
        if(!list) return false;

        const devices: Map<string, NetworkWirelessInfo> = new Map();
        const devicePromises: Promise<void>[] = [];

        for(const { name: dev } of list) {
            if(this.ignored.includes(dev)) continue;

            if(this.ignoredRegex !== null && this.ignoredRegex.test(dev)) continue;

            if(
                !Utils.checkFolderExists('/sys/class/net/' + dev + '/wireless') &&
                !Utils.checkFolderExists('/sys/class/net/' + dev + '/phy80211')
            )
                continue;

            devicePromises.push(
                (async () => {
                    try {
                        const path = Utils.commandPathLookup('iw --version');
                        const str = await Utils.executeCommandAsync(`${path}iw dev ${dev} link`);
                        if(!str) return;

                        // Parse info
                        const data: NetworkWirelessInfo = { name: dev };
                        const lines = str.split('\n');
                        const firstLine = lines.shift();
                        if(firstLine === undefined) return;

                        const mac = firstLine.match(/([0-9a-f]{2}:){5}[0-9a-f]{2}/i);
                        if(mac === null) return;

                        data.accessPoint = mac[0];

                        for(const line of lines) {
                            const parts = line.split(':');
                            if(parts.length < 2) continue;

                            const key = parts[0].trim();
                            const value = parts[1].trim();

                            if(key === 'SSID') data.EESSID = value;
                            else if(key === 'freq') data.frequency = value + ' MHz';
                            else if(key === 'signal') data.signalLevel = value;
                            else if(key === 'tx bitrate')
                                data.bitRate = value.split(' ')[0] + ' MBit/s';
                        }

                        devices.set(dev, data);
                    } catch(e) {
                        /* EMPTY */
                    }
                })()
            );
        }

        await Promise.all(devicePromises);

        this.setUsageValue('wireless', devices);
        return true;
    }

    topProcessesSourceChanged() {
        if(
            this.dataSources.topProcesses === 'nethogs' ||
            this.dataSources.topProcesses === 'auto'
        ) {
            //TODO: for continuous monitoring, start nethogs
        } else {
            this.stopNethogs();
        }
    }

    startNethogs() {
        if(this.updateNethogsTask.isRunning) return;
        const interval = Math.max(1, Math.min(Math.round(this.updateFrequency), 15));
        const path = Utils.commandPathLookup('nethogs -V');

        if(Utils.nethogsHasCaps()) {
            if(path !== false) {
                const command = `nethogs -tb -d ${interval}`;
                this.updateNethogsTask.start(command, {
                    flush: { idle: 100 },
                });
            }
        } else {
            const pkexecPath = Utils.commandPathLookup('pkexec --version');
            if(pkexecPath === false) {
                Utils.error('pkexec not found');
                return;
            }
            const num = Math.max(1, Math.round(60 / interval));

            const command = `${pkexecPath}pkexec ${path}nethogs -tb -d ${interval} -c ${num}`;
            this.updateNethogsTask.start(command, {
                flush: { idle: 100 },
            });
        }
    }

    stopNethogs() {
        if(!this.updateNethogsTask.isRunning) return;
        this.updateNethogsTask.stop();
    }

    async updateNethogs(data: ContinuousTaskManagerData) {
        if(data.exit) {
            if(!Utils.nethogsHasCaps()) {
                this.notify('topProcessesStop');
            }
            return;
        }
        if(!data.result) return;

        const topProcesses = [];

        try {
            const output = data.result;

            if(!output.startsWith('Refreshing:')) {
                //Not a data update
                return;
            }

            const lines = output.substring(output.indexOf('\n') + 1).split('\n');
            for(const line of lines) {
                if(line === '') continue;

                const fields = line.trim().split(/\s+/);

                if(fields.length < 3) continue;

                const processInfo = fields[0].replace(/^"|"$/g, '').split('/');
                const pid = parseInt(processInfo[processInfo.length - 2], 10);

                if(Number.isNaN(pid)) continue;

                const uid = parseInt(processInfo[processInfo.length - 1], 10);
                if(Number.isNaN(uid)) continue;

                const cmd = processInfo.slice(0, -2).join('/');
                const exec = Utils.extractCommandName(cmd);

                const interfacePattern =
                    /^(\d{1,3}\.){3}\d{1,3}:\d+-\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}:\d+$/;
                const ipv6Pattern = /^[a-fA-F0-9:]+:\d+-[a-fA-F0-9:]+:\d+$/;
                if(interfacePattern.test(exec) || ipv6Pattern.test(exec)) {
                    continue;
                }

                const uploadKB = parseFloat(fields[1].replace(/^"|"$/g, ''));
                if(Number.isNaN(uploadKB)) continue;
                const upload = Math.floor(uploadKB * 1024);

                const downloadKB = parseFloat(fields[2].replace(/^"|"$/g, ''));
                if(Number.isNaN(downloadKB)) continue;
                const download = Math.floor(downloadKB * 1024);

                if(download === 0 && download === 0) continue;

                const process = {
                    pid,
                    exec,
                    cmd,
                };

                topProcesses.push({ process, upload, download });
            }

            topProcesses.sort((a, b) => b.upload + b.download - (a.upload + a.download));
            topProcesses.splice(NetworkMonitor.TOP_PROCESSES_LIMIT);
        } catch(e) {
            /* EMPTY */
        }

        this.setUsageValue('topProcesses', topProcesses);
        this.notify('topProcesses');
    }

    destroy() {
        Config.clear(this);
        super.destroy();
    }
}
