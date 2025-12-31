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
import Gio from 'gi://Gio';

import Config from '../config.js';
import Signal from '../signal.js';
import ProcessorMonitor from '../processor/processorMonitor.js';
import GpuMonitor from '../gpu/gpuMonitor.js';
import MemoryMonitor from '../memory/memoryMonitor.js';
import StorageMonitor, { BlockDevice } from '../storage/storageMonitor.js';
import NetworkMonitor from '../network/networkMonitor.js';
import SensorsMonitor from '../sensors/sensorsMonitor.js';
import CancellableTaskManager from './cancellableTaskManager.js';
import CommandSubprocess from './commandSubprocess.js';
import CommandHelper from './commandHelper.js';
import XMLParser from './xmlParser.js';

type GTop = typeof import('gi://GTop').default;

type Extension = import('resource:///org/gnome/shell/extensions/extension.js').Extension;
type ExtensionMetadata =
    import('resource:///org/gnome/shell/extensions/extension.js').ExtensionMetadata;

type UtilsInitProps = {
    service: string;

    extension?: Extension;
    metadata?: ExtensionMetadata;
    settings: Gio.Settings;

    ProcessorMonitor?: typeof ProcessorMonitor;
    GpuMonitor?: typeof GpuMonitor;
    MemoryMonitor?: typeof MemoryMonitor;
    StorageMonitor?: typeof StorageMonitor;
    NetworkMonitor?: typeof NetworkMonitor;
    SensorsMonitor?: typeof SensorsMonitor;
};

export type GpuInfo = {
    domain: string;
    bus: string;
    vendor: string;
    slot: string;
    model: string;
    vendorId?: string;
    productId?: string;
    drivers?: string[];
    modules?: string[];
};

export type DiskInfo = {
    id: string;
    name: string;
    label: string;
    mountpoints: string[];
    path: string;
    children?: DiskInfo[];
};

export type InterfaceInfo = {
    name: string;
    flags: string[];
    ifindex: number;
    speed?: number;
    duplex?: string;
    mtu?: number;
    qdisc?: string;
    operstate?: string;
    linkmode?: string;
    group?: string;
    txqlen?: number;
    link_type?: string;
    address?: string;
    broadcast?: string;
    netmask?: string;
    altnames?: string[];
    parentbus?: string;
    parentdev?: string;
    addr_info?: {
        local?: string;
        peer?: string;
        family?: string;
        broadcast?: string;
        anycast?: string;
        label?: string;
        prefixlen?: number;
        scope?: string;
    }[];
    linkinfo?: any;
};

export type RouteInfo = {
    type: string;
    destination: string;
    gateway: string;
    device: string;
    protocol: string;
    scope: string;
    metric: number;
    flags: string[];
};

export type HwMonAttribute = {
    type: string;
    path: string;
};
export type HwMonSensor = Map<string, HwMonAttribute>;
export type HwMonDevice = Map<string, HwMonSensor>;
export type HwMonDevices = Map<string, HwMonDevice>;

export type Color = { red: number; green: number; blue: number; alpha: number };

export type UptimeTimer = { stop: () => void };

interface IconData {
    gicon?: any;
    fallbackIconName: string;
}

export default class Utils {
    static debug = false;
    static defaultMonitors = ['processor', 'gpu', 'memory', 'storage', 'network', 'sensors'];
    static defaultIndicators = {
        processor: ['icon', 'bar', 'graph', 'percentage', 'frequency'],
        gpu: [
            'icon',
            'activity bar',
            'activity graph',
            'activity percentage',
            'memory bar',
            'memory graph',
            'memory percentage',
            'memory value',
        ],
        memory: ['icon', 'bar', 'graph', 'percentage', 'value', 'free'],
        storage: ['icon', 'bar', 'percentage', 'value', 'free', 'IO bar', 'IO graph', 'IO speed'],
        network: ['icon', 'IO bar', 'IO graph', 'IO speed'],
        sensors: ['icon', 'value'],
    };

    static GTop?: GTop | false;
    static extension?: Extension;
    static metadata?: ExtensionMetadata;

    static processorMonitor: ProcessorMonitor;
    static gpuMonitor: GpuMonitor;
    static memoryMonitor: MemoryMonitor;
    static storageMonitor: StorageMonitor;
    static networkMonitor: NetworkMonitor;
    static sensorsMonitor: SensorsMonitor;
    static xmlParser: XMLParser | null = null;

    static ready = false;

    static performanceMap: Map<string, { start: number; mean: number; count: number }> | null =
        null;

    static lastCachedHwmonDevices: number = 0;
    static cachedHwmonDevices: HwMonDevices = new Map();
    static explicitZero: boolean = false;

    static commandsPath: Map<string, string> | null = null;

    static init({
        service,

        extension,
        metadata,
        settings,

        /* eslint-disable no-shadow */
        ProcessorMonitor,
        GpuMonitor,
        MemoryMonitor,
        StorageMonitor,
        NetworkMonitor,
        SensorsMonitor,
        /* eslint-enable no-shadow */
    }: UtilsInitProps) {
        if(extension) Utils.extension = extension;
        Utils.metadata = metadata;
        Config.settings = settings;
        Utils.xmlParser = new XMLParser();
        Utils.commandsPath = new Map();

        Utils.debug = Config.get_boolean('debug-mode');
        if(Utils.debug && service === 'astra-monitor') {
            Utils.performanceMap = new Map();

            try {
                const log = Utils.getLogFile();
                if(log) {
                    if(log.query_exists(null)) log.delete(null);
                    log.create_readwrite(Gio.FileCreateFlags.REPLACE_DESTINATION, null);
                }
            } catch(e) {
                console.error(e);
            }
        }

        Utils.configUpdateFixes();

        if(ProcessorMonitor) Utils.processorMonitor = new ProcessorMonitor();
        if(GpuMonitor) Utils.gpuMonitor = new GpuMonitor();
        if(MemoryMonitor) Utils.memoryMonitor = new MemoryMonitor();
        if(StorageMonitor) Utils.storageMonitor = new StorageMonitor();
        if(NetworkMonitor) Utils.networkMonitor = new NetworkMonitor();
        if(SensorsMonitor) Utils.sensorsMonitor = new SensorsMonitor();

        Utils.getCachedHwmonDevicesAsync();
        Utils.initializeGTop();

        const updateExplicitZero = () => (Utils.explicitZero = Config.get_boolean('explicit-zero'));
        Config.connect(this, 'changed::explicit-zero', updateExplicitZero);
        updateExplicitZero();
    }

    static clear() {
        for(const task of Utils.lowPriorityTasks) {
            try {
                GLib.source_remove(task);
            } catch(e) {
                Utils.warn('Error removing lowPriorityTask', e instanceof Error ? e : undefined);
            }
        }
        Utils.lowPriorityTasks = [];

        for(const task of Utils.timeoutTasks) {
            try {
                GLib.source_remove(task);
            } catch(e) {
                Utils.warn('Error removing timeoutTask', e instanceof Error ? e : undefined);
            }
        }
        Utils.timeoutTasks = [];

        try {
            Config.clearAll();
        } catch(e: any) {
            Utils.error('Error clearing config', e);
        }

        try {
            Signal.clearAll();
        } catch(e: any) {
            Utils.error('Error clearing signal', e);
        }

        try {
            Utils.processorMonitor?.stop();
            Utils.processorMonitor?.destroy();

            Utils.gpuMonitor?.stop();
            Utils.gpuMonitor?.destroy();

            Utils.memoryMonitor?.stop();
            Utils.memoryMonitor?.destroy();

            Utils.storageMonitor?.stop();
            Utils.storageMonitor?.destroy();

            Utils.networkMonitor?.stop();
            Utils.networkMonitor?.destroy();

            Utils.sensorsMonitor?.stop();
            Utils.sensorsMonitor?.destroy();
        } catch(e: any) {
            Utils.error('Error stopping or destroying monitor', e);
        }

        Utils.xmlParser = null;
        Utils.performanceMap = null;
        Utils.commandsPath = null;
        Utils.lspciCached = undefined;
        Utils.lastCachedHwmonDevices = 0;
        Utils.cachedHwmonDevices = undefined as any;
        Utils.processorMonitor = undefined as any;
        Utils.gpuMonitor = undefined as any;
        Utils.memoryMonitor = undefined as any;
        Utils.storageMonitor = undefined as any;
        Utils.networkMonitor = undefined as any;
        Utils.sensorsMonitor = undefined as any;

        Utils.extension = undefined;
        Utils.metadata = undefined;
        Config.settings = undefined;

        if(Utils.uptimeTimer) {
            try {
                GLib.source_remove(Utils.uptimeTimer);
                Utils.uptimeTimer = 0;
            } catch(e) {
                Utils.warn('Error removing uptime timer', e instanceof Error ? e : undefined);
            }
        }
    }

    static async initializeGTop() {
        try {
            const res = await import('gi://GTop');
            Utils.GTop = res.default as any;
        } catch(e: any) {
            Utils.GTop = false;
        }
    }

    static get logHeader(): string {
        if(!Utils.metadata) return '';
        if(Utils.debug) return '###### ' + (Utils.metadata.name ?? '') + ' ######';
        return Utils.metadata.name ?? '';
    }

    static log(message: string) {
        if(Utils.debug) {
            console.log(Utils.logHeader + ' ' + message);
            Utils.logToFile(message);
        }
    }

    static verbose(message: string) {
        if(Utils.debug) {
            Utils.logToFile(message);
        }
    }

    static warn(message: string, error?: Error) {
        if(error === undefined) error = new Error();
        console.warn(error, Utils.logHeader + ' WARNING: ' + message);

        if(Utils.debug) {
            Utils.logToFile('WARNING: ' + message);
            Utils.logToFile(error.message);
            Utils.logToFile(error.stack ?? '');
        }
    }

    static error(message: string, error?: Error) {
        if(error === undefined) error = new Error();
        console.error(error, Utils.logHeader + ' ERROR: ' + message);

        if(Utils.debug) {
            Utils.logToFile('ERROR: ' + message);
            Utils.logToFile(error.message);
            Utils.logToFile(error.stack ?? '');
        }
    }

    static getLogFile(): Gio.File | null {
        try {
            const dataDir = GLib.get_user_cache_dir();
            const destination = GLib.build_filenamev([dataDir, 'astra-monitor', 'debug.log']);
            const destinationFile = Gio.File.new_for_path(destination);
            if(
                destinationFile &&
                GLib.mkdir_with_parents(destinationFile.get_parent()!.get_path()!, 0o755) === 0
            )
                return destinationFile;
        } catch(e: any) {
            console.error(e);
        }
        return null;
    }

    static logToFile(message: string) {
        const log = Utils.getLogFile();
        if(log) {
            try {
                const date = new Date();
                const time = date.toISOString().split('T')[1].slice(0, -1);

                const outputStream = log.append_to(Gio.FileCreateFlags.NONE, null);
                const buffer: Uint8Array = new TextEncoder().encode(`${time} - ${message}\n`);
                outputStream.write_all(buffer, null);
            } catch(e: any) {
                console.error(e);
            }
        }
    }

    static get startupDelay(): number {
        const delay = Config.get_double('startup-delay');
        if(Number.isNaN(delay) || delay < 1 || delay > 10) return 2;
        return delay;
    }

    static get themeStyle(): string {
        if(Config.get_string('theme-style') === 'light') return 'light';
        return 'dark';
    }

    static get zeroStr(): string {
        return Utils.explicitZero ? '0' : '-';
    }

    static getMonitorsOrder(): string[] {
        let monitors = Config.get_json('monitors-order');
        if(!monitors) monitors = [];
        if(monitors.length < Utils.defaultMonitors.length) {
            for(const monitor of Utils.defaultMonitors) {
                if(!monitors.includes(monitor)) monitors.push(monitor);
            }
            Config.set('monitors-order', JSON.stringify(monitors), 'string');
        }
        return monitors;
    }

    static getIndicatorsOrder(category: keyof typeof Utils.defaultIndicators): string[] {
        let indicators = Config.get_json(category + '-indicators-order');
        if(!indicators) indicators = [];
        if(indicators.length < Utils.defaultIndicators[category].length) {
            for(const indicator of Utils.defaultIndicators[category]) {
                if(!indicators.includes(indicator)) indicators.push(indicator);
            }
            Config.set(category + '-indicators-order', JSON.stringify(indicators), 'string');
        }
        return indicators;
    }

    static commandPathLookup(fullCommand: string): string | false {
        const [command, ..._args] = fullCommand.split(' ');

        if(Utils.commandsPath!.has(command)) {
            return Utils.commandsPath!.get(command) ?? false;
        }

        for(const path of [
            '',
            '/bin/',
            '/usr/bin/',
            '/sbin/',
            '/usr/sbin/',
            '/usr/local/bin/',
            '/usr/local/sbin/',
            '/opt/',
            '/opt/bin/',
            '/opt/sbin/',
        ]) {
            try {
                const fullPath = path + command;
                const program = GLib.find_program_in_path(fullPath);
                if(program) {
                    Utils.commandsPath!.set(command, path);
                    return path;
                }
                if(GLib.file_test(fullPath, GLib.FileTest.IS_EXECUTABLE)) {
                    Utils.commandsPath!.set(command, path);
                    return path;
                }
                const [result, stdout, stderr] = GLib.spawn_command_line_sync(path + fullCommand);
                if(result && stdout && (!stderr || !stderr.length)) {
                    Utils.commandsPath!.set(command, path);
                    return path;
                }
            } catch(e: any) {
                /* EMPTY */
            }
        }
        return false;
    }

    static hasProcStat(): boolean {
        try {
            const fileContents = GLib.file_get_contents('/proc/stat');
            return fileContents && fileContents[0];
        } catch(e: any) {
            return false;
        }
    }

    static hasProcCpuinfo(): boolean {
        try {
            const fileContents = GLib.file_get_contents('/proc/cpuinfo');
            return fileContents && fileContents[0];
        } catch(e: any) {
            return false;
        }
    }

    static hasProcMeminfo(): boolean {
        try {
            const fileContents = GLib.file_get_contents('/proc/meminfo');
            return fileContents && fileContents[0];
        } catch(e: any) {
            return false;
        }
    }

    static hasProcDiskstats(): boolean {
        try {
            const fileContents = GLib.file_get_contents('/proc/diskstats');
            return fileContents && fileContents[0];
        } catch(e: any) {
            return false;
        }
    }

    static hasProcNetDev(): boolean {
        try {
            const fileContents = GLib.file_get_contents('/proc/net/dev');
            return fileContents && fileContents[0];
        } catch(e: any) {
            return false;
        }
    }

    static hasLmSensors(): boolean {
        return Utils.commandPathLookup('sensors -v') !== false;
    }

    static hasHwmon(): boolean {
        try {
            const hwmonDir = Gio.File.new_for_path('/sys/class/hwmon');
            if(!hwmonDir.query_exists(null)) return false;
            const hwmonEnum = hwmonDir.enumerate_children(
                'standard::name',
                Gio.FileQueryInfoFlags.NONE,
                null
            );
            if(!hwmonEnum) return false;
            return hwmonEnum.next_file(null) !== null;
        } catch(e: any) {
            return false;
        }
    }

    static hasLscpu(): boolean {
        return Utils.commandPathLookup('lscpu -V') !== false;
    }

    static hasLspci(): boolean {
        return Utils.commandPathLookup('lspci --version') !== false;
    }

    static hasLsblk(): boolean {
        return Utils.commandPathLookup('lsblk -V') !== false;
    }

    static hasNethogs(): boolean {
        Utils.nethogsHasCaps();
        return Utils.commandPathLookup('nethogs -V') !== false;
    }

    static hasIp(): boolean {
        return Utils.commandPathLookup('ip -V') !== false;
    }

    static hasIw(): boolean {
        return Utils.commandPathLookup('iw --version') !== false;
    }

    static hasIwconfig(): boolean {
        return Utils.commandPathLookup('iwconfig --version') !== false;
    }

    static hasIotop(): boolean {
        return Utils.commandPathLookup('iotop --version') !== false;
    }

    static hasAMDGpu(): boolean {
        const gpus = Utils.getGPUsList();
        for(const gpu of gpus) {
            if(Utils.isAmdGpu(gpu)) return true;
        }
        return false;
    }

    static hasNVidiaGpu(): boolean {
        const gpus = Utils.getGPUsList();
        for(const gpu of gpus) {
            if(Utils.isNvidiaGpu(gpu)) return true;
        }
        return false;
    }

    static hasIntelGpu(): boolean {
        const gpus = Utils.getGPUsList();
        for(const gpu of gpus) {
            if(Utils.isIntelGpu(gpu)) return true;
        }
        return false;
    }

    static isAmdGpu(gpu: GpuInfo) {
        return gpu.vendorId === '1002';
    }

    static isNvidiaGpu(gpu: GpuInfo) {
        return gpu.vendorId === '10de' || gpu.vendorId === '12d2';
    }

    static isIntelGpu(gpu: GpuInfo) {
        return gpu.vendorId === '8086';
    }

    static canMonitorGpu(gpu: GpuInfo): boolean {
        if(Utils.isAmdGpu(gpu)) return Utils.hasAmdGpuTop();
        if(Utils.isNvidiaGpu(gpu)) return Utils.hasNvidiaSmi();
        //if(Utils.isIntelGpu(gpu)) return Utils.hasIntelGpuTop();
        return false;
    }

    static async hasGTop(): Promise<boolean> {
        while(Utils.GTop === undefined) {
            // eslint-disable-next-line no-await-in-loop
            await new Promise(r => {
                setTimeout(r, 100);
            });
        }
        return Utils.GTop !== false;
    }

    static filterLspciOutput(
        lspciOutput: string,
        keywords: string[],
        op: 'and' | 'or' = 'or',
        collect: number = 1
    ): string[] {
        const lines = lspciOutput.split('\n');
        const keywordsLower = keywords.map(keyword => keyword.toLowerCase());
        const results = [];
        let collecting = 0;

        let result = [];
        for(let i = 0; i < lines.length; i++) {
            if(collecting === 0 && result.length > 0) {
                results.push(result.join('\n'));
                result = [];
            }

            if(collecting > 0) {
                result.push(lines[i]);
                collecting--;
                continue;
            }

            if(op === 'and') {
                // check if the line contains all the keywords
                let containsAll = true;
                for(const keyword of keywordsLower) {
                    if(!lines[i].toLowerCase().includes(keyword)) {
                        containsAll = false;
                        break;
                    }
                }
                if(!containsAll) continue;
            } else {
                // check if the line contains any of the keywords
                let containsAny = false;
                for(const keyword of keywordsLower) {
                    if(lines[i].toLowerCase().includes(keyword)) {
                        containsAny = true;
                        break;
                    }
                }
                if(!containsAny) continue;
            }

            result.push(lines[i]);
            collecting = collect;
            collecting--;
        }
        return results;
    }

    static hasAmdGpuTop(): boolean {
        return Utils.commandPathLookup('amdgpu_top -V') !== false;
    }

    static hasRadeonTop(): boolean {
        return Utils.commandPathLookup('radeontop -v') !== false;
    }

    static hasNvidiaSmi(): boolean {
        return Utils.commandPathLookup('nvidia-smi -h') !== false;
    }

    static hasIntelGpuTop(): boolean {
        return Utils.commandPathLookup('intel_gpu_top -h') !== false;
    }

    static hasCoresFrequency(): boolean {
        const paths = Utils.generateCpuFreqPaths(1);
        try {
            for(const path of paths) {
                const fileContents = GLib.file_get_contents(path);
                if(!fileContents || !fileContents[0]) return false;
            }
        } catch(e) {
            return false;
        }
        return true;
    }

    static hasPs(): boolean {
        try {
            const [result, stdout, stderr] = GLib.spawn_command_line_sync('ps -V');
            return result && !!stdout && (!stderr || !stderr.length);
        } catch(e: any) {
            return false;
        }
    }

    static generateCpuFreqPaths(numCores: number): string[] {
        const basePath = '/sys/devices/system/cpu/cpu';
        const freqPath = '/cpufreq/scaling_cur_freq';
        const paths = [];

        for(let i = 0; i < numCores; i++) paths.push(basePath + i + freqPath);
        return paths;
    }

    static unitMap = {
        'kB/s': { base: 1000, mult: 1, labels: ['B/s', 'kB/s', 'MB/s', 'GB/s', 'TB/s'] },
        'KiB/s': { base: 1024, mult: 1, labels: ['B/s', 'KiB/s', 'MiB/s', 'GiB/s', 'TiB/s'] },
        'kb/s': { base: 1000, mult: 8, labels: ['b/s', 'kb/s', 'Mb/s', 'Gb/s', 'Tb/s'] },
        'Kibit/s': {
            base: 1024,
            mult: 8,
            labels: ['bit/s', 'Kibit/s', 'Mibit/s', 'Gibit/s', 'Tibit/s'],
        },
        kBps: { base: 1000, mult: 1, labels: ['Bps', 'kBps', 'MBps', 'GBps', 'TBps'] },
        KiBps: { base: 1024, mult: 1, labels: ['Bps', 'KiBps', 'MiBps', 'GiBps', 'TiBps'] },
        Kibps: { base: 1024, mult: 8, labels: ['bps', 'Kibps', 'Mibps', 'Gibps', 'Tibps'] },
        kbps: { base: 1000, mult: 8, labels: ['bps', 'kbps', 'Mbps', 'Gbps', 'Tbps'] },
        Kibitps: {
            base: 1024,
            mult: 8,
            labels: ['bitps', 'Kibitps', 'Mibitps', 'Gibitps', 'Tibitps'],
        },
        'k ': { base: 1000, mult: 1, labels: [' ', 'k', 'M', 'G', 'T'] },
        Ki: { base: 1024, mult: 1, labels: ['  ', 'Ki', 'Mi', 'Gi', 'Ti'] },
    };

    static unit2Map = {
        'kB-kiB': { base: 1024, mult: 1, labels: [' B', 'kB', 'MB', 'GB', 'TB'] },
        'kB-KB': { base: 1000, mult: 1, labels: [' B', 'kB', 'MB', 'GB', 'TB'] },
        kiB: { base: 1024, mult: 1, labels: [' B', 'kiB', 'MiB', 'GiB', 'TiB'] },
        KiB: { base: 1024, mult: 1, labels: [' B/s', 'KiB', 'MiB', 'GiB', 'TiB'] },
        KB: { base: 1000, mult: 1, labels: [' B', 'KB', 'MB', 'GB', 'TB'] },
        'k ': { base: 1000, mult: 1, labels: [' ', 'k', 'M', 'G', 'T'] },
        Ki: { base: 1024, mult: 1, labels: ['  ', 'Ki', 'Mi', 'Gi', 'Ti'] },
    };

    static unit3Map = {
        Q: { base: 1000, mult: 1, labels: ['', 'K', 'M', 'B', 'T', 'Q'] },
    };

    static unit4Map = {
        Hz: { base: 1000, mult: 1, labels: ['Hz', 'kHz', 'MHz', 'GHz', 'THz'] },
        kHz: { base: 1000, mult: 1, labels: ['kHz', 'MHz', 'GHz', 'THz'] },
        MHz: { base: 1000, mult: 1, labels: ['MHz', 'GHz', 'THz'] },
        GHz: { base: 1000, mult: 1, labels: ['GHz', 'THz'] },
        THz: { base: 1000, mult: 1, labels: ['THz'] },
    };

    static formatBytesPerSec(
        value: number,
        unit: keyof typeof Utils.unitMap,
        maxNumbers: number = 2,
        padded: boolean = false
    ): string {
        if(!Object.prototype.hasOwnProperty.call(Utils.unitMap, unit)) unit = 'kB/s';

        if(!value || isNaN(value))
            return Utils.zeroStr + (padded ? '   ' : ' ') + Utils.unitMap[unit].labels[0];

        value *= Utils.unitMap[unit].mult;

        let unitIndex = 0;
        while(
            value >= Math.pow(10, maxNumbers) &&
            unitIndex < Utils.unitMap[unit].labels.length - 1
        ) {
            value /= Utils.unitMap[unit].base;
            unitIndex++;
        }

        // Convert to string and truncate to maxNumbers significant figures
        let result = value.toString();
        if(result.indexOf('.') !== -1) {
            const parts = result.split('.');
            if(parts[0].length >= maxNumbers)
                result = parts[0]; // If the integer part is already at max length, ignore decimal part
            else result = parts[0] + '.' + parts[1].substr(0, maxNumbers - parts[0].length);
        } else if(result.length > maxNumbers) {
            result = result.substr(0, maxNumbers);
        }
        return `${result} ${Utils.unitMap[unit].labels[unitIndex]}`;
    }

    static formatBytes(
        bytes: number,
        unit: keyof typeof Utils.unit2Map = 'kB-KB',
        maxNumbers: number = 2
    ): string {
        if(!Object.prototype.hasOwnProperty.call(Utils.unit2Map, unit)) unit = 'kB-KB';

        if(!bytes || isNaN(bytes)) return Utils.zeroStr + Utils.unit2Map[unit].labels[0];

        bytes *= Utils.unit2Map[unit].mult;

        let unitIndex = 0;
        while(
            bytes >= Math.pow(10, maxNumbers) &&
            unitIndex < Utils.unit2Map[unit].labels.length - 1
        ) {
            bytes /= Utils.unit2Map[unit].base;
            unitIndex++;
        }

        // Convert to string and truncate to maxNumbers significant figures
        let result = bytes.toString();
        if(result.indexOf('.') !== -1) {
            const parts = result.split('.');
            if(parts[0].length >= maxNumbers)
                result = parts[0]; // If the integer part is already at max length, ignore decimal part
            else result = parts[0] + '.' + parts[1].substr(0, maxNumbers - parts[0].length);
        } else if(result.length > maxNumbers) {
            result = result.substr(0, maxNumbers);
        }
        return `${result} ${Utils.unit2Map[unit].labels[unitIndex]}`;
    }

    static formatHugeNumber(
        value: number,
        unit: keyof typeof Utils.unit3Map = 'Q',
        maxNumbers: number = 4
    ): string {
        if(!Object.prototype.hasOwnProperty.call(Utils.unit3Map, unit)) unit = 'Q';

        if(!value || isNaN(value)) return Utils.zeroStr + Utils.unit3Map[unit].labels[0];

        let unitIndex = 0;
        while(
            value >= Math.pow(10, maxNumbers) &&
            unitIndex < Utils.unit3Map[unit].labels.length - 1
        ) {
            value /= Utils.unit3Map[unit].base;
            unitIndex++;
        }

        // Convert to string and truncate to maxNumbers significant figures
        let result = value.toString();
        if(result.indexOf('.') !== -1) {
            const parts = result.split('.');
            if(parts[0].length >= maxNumbers)
                result = parts[0]; // If the integer part is already at max length, ignore decimal part
            else result = parts[0] + '.' + parts[1].substr(0, maxNumbers - parts[0].length);
        } else if(result.length > maxNumbers) {
            result = result.substr(0, maxNumbers);
        }

        const finalUnit = Utils.unit3Map[unit].labels[unitIndex];
        if(finalUnit.length > 0) return `${result} ${finalUnit}`;
        return `${result}`;
    }

    static formatFrequency(
        frequency: number,
        unit: keyof typeof Utils.unit4Map = 'Hz',
        maxNumbers: number = 4,
        forceDecimals: boolean = false
    ): string {
        if(!Object.prototype.hasOwnProperty.call(Utils.unit4Map, unit)) unit = 'Hz';

        if(!frequency || isNaN(frequency)) return Utils.zeroStr + Utils.unit4Map[unit].labels[0];

        let unitIndex = 0;
        while(
            frequency >= Math.pow(10, maxNumbers) &&
            unitIndex < Utils.unit4Map[unit].labels.length - 1
        ) {
            frequency /= Utils.unit4Map[unit].base;
            unitIndex++;
        }

        let result = frequency.toFixed(maxNumbers - 1);
        if(result.indexOf('.') !== -1) {
            const parts = result.split('.');
            if(parts[0].length >= maxNumbers && !forceDecimals) {
                result = parts[0]; // If the integer part is already at max length, ignore decimal part
            } else {
                const decimalPart = parts[1].substr(0, maxNumbers - parts[0].length);
                result = parts[0] + '.' + decimalPart.padEnd(maxNumbers - parts[0].length, '0');
            }
        } else if(forceDecimals) {
            result = result + '.' + '0'.repeat(maxNumbers - result.length);
        }

        return `${result} ${Utils.unit4Map[unit].labels[unitIndex]}`;
    }

    static convertToBytes(value: number | string, unit: string): number {
        if(typeof value === 'string') {
            value = parseFloat(value);
            if(isNaN(value)) return -1;
        }

        if(unit === 'B') return value;
        if(unit === 'kB' || unit === 'KB') return value * 1000;
        if(unit === 'MB') return value * 1000 * 1000;
        if(unit === 'GB') return value * 1000 * 1000 * 1000;
        if(unit === 'TB') return value * 1000 * 1000 * 1000 * 1000;
        if(unit === 'kiB' || unit === 'KiB') return value * 1024;
        if(unit === 'MiB') return value * 1024 * 1024;
        if(unit === 'GiB') return value * 1024 * 1024 * 1024;
        if(unit === 'TiB') return value * 1024 * 1024 * 1024 * 1024;
        if(unit === 'ki' || unit === 'Ki') return value * 1024;
        if(unit === 'Mi') return value * 1024 * 1024;
        if(unit === 'Gi') return value * 1024 * 1024 * 1024;
        if(unit === 'Ti') return value * 1024 * 1024 * 1024 * 1024;
        return value;
    }

    static async getCachedHwmonDevicesAsync(): Promise<HwMonDevices> {
        const devices = await Utils.getHwmonDevices();
        Utils.lastCachedHwmonDevices = Date.now();
        Utils.cachedHwmonDevices = devices;
        return Utils.cachedHwmonDevices;
    }

    static getCachedHwmonDevices(): HwMonDevices {
        // 5 minutes
        if(Utils.lastCachedHwmonDevices + 300000 < Date.now()) {
            Utils.lastCachedHwmonDevices = Date.now();
            Utils.getHwmonDevices().then(devices => {
                Utils.cachedHwmonDevices = devices;
            });
        }
        return Utils.cachedHwmonDevices;
    }

    static sensorsPrefix = ['temp', 'fan', 'in', 'power', 'curr', 'energy', 'pwm', 'freq'];
    static async getHwmonDevices(): Promise<HwMonDevices> {
        const baseDir = '/sys/class/hwmon';
        const devices: HwMonDevices = new Map();

        try {
            const hwmons = await Utils.listDirAsync(baseDir, { folders: true, files: false });

            await Promise.all(
                hwmons.map(async hwmonInfo => {
                    const hwmon = hwmonInfo.name;
                    let name = await Utils.readFileAsync(`${baseDir}/${hwmon}/name`, true);
                    if(!name) return;
                    name = name.trim();

                    let addressAdded = false;
                    let address = await Utils.readFileAsync(
                        `${baseDir}/${hwmon}/device/address`,
                        true
                    );
                    if(address) {
                        address = address.trim();
                        address = address.replace(/^0+:/, '');
                        address = address.replace(/\.[0-9]*$/, '');
                        address = address.replace(/:/g, '');
                        name = `${name}-{$${address}}`;

                        addressAdded = true;
                    }

                    if(!addressAdded) {
                        address = await Utils.readFileAsync(
                            `${baseDir}/${hwmon}/device/device`,
                            true
                        );
                        if(address) {
                            address = address.trim();
                            address = address.replace(/^0x/, '');
                            name = `${name}-{$${address}}`;
                        }
                    }

                    const files = await Utils.listDirAsync(`${baseDir}/${hwmon}`, {
                        folders: false,
                        files: true,
                    });

                    const sensorPromises = files.map(async file => {
                        const fileName = file.name;
                        if(fileName === 'name' || fileName === 'uevent') {
                            return;
                        }

                        const prefix = Utils.sensorsPrefix.find(str => fileName.startsWith(str));
                        if(prefix) {
                            let sensorName = fileName.split('_')[0];
                            let attrName = fileName.split('_')[1];

                            if(attrName === 'label') {
                                return;
                            }

                            if(files.find(a => a.name === `${sensorName}_label`)) {
                                const label = await Utils.readFileAsync(
                                    `${baseDir}/${hwmon}/${sensorName}_label`,
                                    true
                                );
                                if(label) sensorName = label.trim();
                            }

                            let device = devices.get(name);
                            if(!device) {
                                device = new Map();
                                devices.set(name, device);
                            }

                            let sensor = device.get(sensorName);
                            if(!sensor) {
                                sensor = new Map();
                                device.set(sensorName, sensor);
                            }

                            if(attrName === '' || attrName === undefined) attrName = 'value';

                            let attribute = sensor.get(attrName);
                            if(!attribute) {
                                attribute = {
                                    type: prefix,
                                    path: `${hwmon}/${fileName}`,
                                };
                                sensor.set(attrName, attribute);
                            }
                        }
                    });

                    await Promise.all(sensorPromises);
                })
            );

            // order devices by name
            const orderedDevices = new Map([...devices.entries()].sort());
            return orderedDevices;
        } catch(e: any) {
            Utils.error('Error getting hwmon devices', e);
            return new Map();
        }
    }

    static getSensorSources(): { value: any; text: string }[] {
        const sensors = [];

        try {
            /**
             * hwmon
             */
            const hwmonDevices = Utils.getCachedHwmonDevices();

            const deviceNames = [];
            for(const deviceName of hwmonDevices.keys())
                deviceNames.push(deviceName.split('-{$')[0]);

            for(const [deviceName, sensorsMap] of hwmonDevices) {
                for(const [sensorName, attributes] of sensorsMap) {
                    for(const [attrName, attr] of attributes) {
                        let deviceLabel;

                        const split = deviceName.split('-{$');
                        if(deviceNames.filter(name => name === split[0]).length === 1)
                            deviceLabel = Utils.capitalize(split[0]);
                        else
                            deviceLabel =
                                Utils.capitalize(split[0]) + ' - ' + split[1].replace(/}$/, '');

                        const sensorLabel = Utils.capitalize(sensorName);
                        const attrLabel = Utils.capitalize(attrName);
                        const type = Utils.capitalize(attr.type);

                        sensors.push({
                            value: {
                                service: 'hwmon',
                                path: [deviceName, sensorName, attrName],
                            },
                            text: `[hwmon] ${deviceLabel} -> ${sensorLabel} -> ${type} ${attrLabel}`,
                        });
                    }
                }
            }

            /**
             * lm-sensors
             */
            if(Utils.hasLmSensors()) {
                const path = Utils.commandPathLookup('sensors -v');

                const [_result, stdout, _stderr] = GLib.spawn_command_line_sync(
                    `${path}sensors -j`
                );
                if(stdout && stdout.length > 0) {
                    const decoder = new TextDecoder('utf8');
                    let stdoutString = decoder.decode(stdout);

                    // remove trailing commas
                    stdoutString = stdoutString.replace(/,\s*(?=}|])/g, '');
                    const parsedData = JSON.parse(stdoutString);

                    for(const sensorName in parsedData) {
                        for(const sensor in parsedData[sensorName]) {
                            if(sensor === 'Adapter') continue;

                            for(const sensorData in parsedData[sensorName][sensor]) {
                                sensors.push({
                                    value: {
                                        service: 'sensors',
                                        path: [sensorName, sensor, sensorData],
                                    },
                                    text: `[lm-sensors] ${sensorName} -> ${sensor} -> ${sensorData}`,
                                });
                            }
                        }
                    }
                } else {
                    Utils.log('No sensor data found or sensors command failed');
                }
            }

            /*if(Utils.hasAMDGpu()) {
                //TODO: add support for radeontop
                if(Utils.hasAmdGpuTop()) {
                    const path = Utils.commandPathLookup('amdgpu_top --version');
                    const [result, stdout, stderr] = GLib.spawn_command_line_sync(`${path}amdgpu_top -J -n 1`);
                    
                    if(stdout.length > 0) {
                        const decoder = new TextDecoder('utf8');
                        const stdoutString = decoder.decode(stdout);
                        
                        const parsedData = JSON.parse(stdoutString);
                        
                        if(parsedData.devices && parsedData.devices.length > 0) {
                            for(const gpuId in parsedData.devices) {
                                const gpu = parsedData.devices[gpuId];
                                
                                if(gpu.hasOwnProperty('Info') && gpu.Info.hasOwnProperty('DeviceName') &&
                                gpu.hasOwnProperty('Sensors')) {
                                    for(const sensor in gpu.Sensors) {
                                        Utils.log('sensor: ' + sensor);
                                        sensors.push({
                                            value: {
                                                service: 'amdgpu_top',
                                                path: [gpuId, sensor]
                                            },
                                            text: gpu.Info.DeviceName + ' -> ' + sensor
                                        });
                                    }
                                }
                            }
                        }
                    }
                    else {\   
                        Utils.log('No AMD GPU data found or amdgpu_top command failed');
                    }
                }
            }*/
        } catch(e: any) {
            Utils.log('Error getting sensors sources: ' + e);
        }

        return sensors;
    }

    static inferMeasurementUnit(key: string): string {
        if(key.startsWith('temp')) return '°C';
        if(key.startsWith('fan')) return 'RPM';
        if(key.startsWith('in')) return 'V';
        if(key.startsWith('power')) return 'W';
        if(key.startsWith('curr')) return 'A';
        if(key.startsWith('energy')) return 'J';
        if(key.startsWith('pwm')) return '';
        if(key.startsWith('freq')) return 'MHz';
        return '';
    }

    static sensorsNameFormat(name: string): string {
        return Utils.capitalize(name.replace(/_/g, ' '));
    }

    static isNumeric(value: string | number): boolean {
        if(typeof value === 'number') return !isNaN(value);
        if(typeof value === 'string')
            return value.trim() !== '' && !isNaN(parseFloat(value)) && isFinite(parseFloat(value));
        return false;
    }

    static isIntOrIntString(value: string | number): boolean {
        if(Number.isInteger(value)) return true;
        if(typeof value === 'string') {
            const parsed = parseInt(value, 10);
            return parsed.toString() === value;
        }
        return false;
    }

    static celsiusToFahrenheit(celsius: number) {
        return celsius * 1.8 + 32;
    }

    static extractCommandName(cmdLine: string): string {
        if(cmdLine.trim().startsWith('[') && cmdLine.trim().endsWith(']')) return cmdLine.trim();

        // eslint-disable-next-line no-control-regex
        const sanitizedCmdLine = cmdLine.replace(/\u0000/g, ' ');
        const elements = sanitizedCmdLine.split(' ');
        const fullPath = elements[0];
        const pathParts = fullPath.split('/');
        const commandName = pathParts[pathParts.length - 1];
        return commandName.replace(/[\r\n]/g, '');
    }

    static parseSize(size: string): number {
        const sizeRegex = /^([\d,.]+)([KMGTP]?)$/;
        const match = sizeRegex.exec(size);

        if(!match) return Number.NaN;

        const value = parseFloat(match[1].replace(',', '.'));
        const unit = match[2].toLowerCase();

        if(Number.isNaN(value)) return Number.NaN;

        switch(unit) {
            case 'k':
                return Math.round(value * 1000);
            case 'm':
                return Math.round(value * 1000 * 1000);
            case 'g':
                return Math.round(value * 1000 * 1000 * 1000);
            case 't':
                return Math.round(value * 1000 * 1000 * 1000 * 1000);
            default:
                return value;
        }
    }

    static getCPUModelShortify(model: string): string {
        // replace (R)
        model = model.replace(/\(R\)/g, '');

        // replace (TM)
        model = model.replace(/\(TM\)/g, '');

        // replace (C)
        model = model.replace(/\(C\)/g, '');

        // replace multiple spaces with single space
        model = model.replace(/\s+/g, ' ');

        // replace repeated words
        model = model.replace(/\b(\w+)\s+\1\b/g, '$1');

        // trim
        model = model.trim();

        return model;
    }

    static getVendorName(vendorId: string): string[] {
        const vendors = {
            '0x1002': ['AMD'], // AMD (Advanced Micro Devices, Inc.) - Major GPU and CPU manufacturer
            '0x10de': ['NVIDIA'], // NVIDIA Corporation - Prominent GPU manufacturer known for GeForce series
            '0x8086': ['Intel'], // Intel Corporation - Renowned CPU manufacturer and maker of integrated graphics
            '0x102b': ['Matrox'], // Matrox Electronic Systems Ltd. - Manufacturer of specialized graphics solutions
            '0x1039': ['SiS'], // Silicon Integrated Systems (SiS) - Company producing a variety of hardware, including GPUs
            '0x5333': ['S3'], // S3 Graphics, Ltd. - Producer of graphics hardware, known for older video cards
            '0x1a03': ['ASPEED'], // ASPEED Technology, Inc. - Maker of server management and embedded graphics solutions
            '0x80ee': ['Oracle', 'VirtualBox'], // Oracle VirtualBox - Identifier used for VirtualBox's virtual graphics adapter
            '0x1234': ['Bochs', 'QEMU'], // Bochs/QEMU - Common ID for virtual GPUs in Bochs or QEMU environments
            '0x15ad': ['VMware'], // VMware - Identifier for VMware's virtual graphics devices
            '0x1414': ['Microsoft', 'HyperV'], // Microsoft Hyper-V - ID for virtual GPUs in Microsoft's Hyper-V virtualization
            '0x1013': ['Cirrus', 'Logic'], // Cirrus Logic - A hardware manufacturer known for producing graphics chips in the past
            '0x12d2': ['NVIDIA'], // NVIDIA (early products) - Identifier for some of NVIDIA's early graphics products
            '0x18ca': ['XGI'], // XGI Technology Inc. - A former graphics chipset manufacturer
            '0x1de1': ['Tekram'], // Tekram Technology Co., Ltd. - A company known for various computer hardware, including graphics
        };
        return vendors[vendorId as keyof typeof vendors] || ['Unknown'];
    }

    static lspciCached?: GpuInfo[];
    static getGPUsList(): GpuInfo[] {
        if(Utils.lspciCached) return Utils.lspciCached;

        Utils.lspciCached = [];

        if(!Utils.hasLspci()) return Utils.lspciCached;

        try {
            const decoder = new TextDecoder('utf8');

            // Cannot use -mm because it doesn't show the driver and module
            const path = Utils.commandPathLookup('lspci --version');
            const [result, stdout, stderr] = GLib.spawn_command_line_sync(`${path}lspci -nnk`);
            if(!result || !stdout) {
                if(!stderr) throw new Error('Stream invalid');
                const lspciError = decoder.decode(stderr);
                Utils.error('Error getting GPUs list: ' + lspciError);
                return Utils.lspciCached;
            }

            const lspciOutput = decoder.decode(stdout);
            const filteredOutputs = Utils.filterLspciOutput(
                lspciOutput,
                ['vga', 'display controller', '3d controller'],
                'or',
                5
            );

            for(const filtered of filteredOutputs) {
                // remove unrelated lines and tabs
                const lines = filtered.split('\n');
                for(let i = lines.length - 1; i >= 1; i--) {
                    if(lines[i].startsWith('\t')) lines[i] = lines[i].substring(1);
                    else lines.splice(i, lines.length - i);
                }

                // parse address
                let firstLine = lines[0];
                const addressRegex =
                    /^((?:[0-9a-fA-F]{4}:)?[0-9a-fA-F]{2}):([0-9a-fA-F]{2})\.([0-9a-fA-F]) /;
                const addressMatch = addressRegex.exec(firstLine);
                if(!addressMatch) {
                    Utils.log('Error getting GPUs list: ' + firstLine + ' does not match address');
                    continue;
                }
                let domain = addressMatch[1];
                if(!domain.includes(':')) domain = '0000:' + domain;

                const [bus, slot] = [addressMatch[2], addressMatch[3]];
                firstLine = firstLine.replace(addressRegex, '');

                // parse vendor and model
                const vendorLine = firstLine.split(':');
                if(vendorLine.length < 3) {
                    Utils.warn('Error getting GPUs list: ' + firstLine + ' does not match vendor');
                    continue;
                }
                vendorLine.shift();

                let vendor = vendorLine.join(':').trim();
                const regex = /\[([\da-fA-F]{4}):([\da-fA-F]{4})\]\s*/g;

                let match;
                let vendorId = null;
                let productId = null;

                if((match = regex.exec(vendor)) !== null) {
                    vendorId = match[1];
                    productId = match[2];
                }
                vendor = vendor.replace(regex, '').trim();

                if(lines.length < 2) {
                    Utils.warn('Error getting GPUs list: lines length < 2');
                    continue;
                }
                const modelLine = lines[1].split(':');
                if(modelLine.length < 2) {
                    Utils.warn('Error getting GPUs list: model line missmatch');
                    continue;
                }
                modelLine.shift();
                let model = modelLine.join(':').trim();
                model = model.replace(regex, '').trim();

                // parse drivers and modules
                let drivers = null;
                if(lines.length >= 3) {
                    const driverLine = lines[2].split(':');
                    if(driverLine.length >= 2) {
                        driverLine.shift();
                        drivers = driverLine
                            .join(':')
                            .split(',')
                            .map(line => line.trim());
                    }
                }

                let modules = null;
                if(lines.length >= 4) {
                    const moduleLine = lines[3].split(':');
                    if(moduleLine.length >= 2) {
                        moduleLine.shift();
                        modules = moduleLine
                            .join(':')
                            .split(',')
                            .map(line => line.trim());
                    }
                }

                // add to cached list
                const gpu: GpuInfo = {
                    domain,
                    bus,
                    slot,
                    vendor,
                    model,
                };

                if(vendorId) gpu.vendorId = vendorId;
                if(productId) gpu.productId = productId;
                if(drivers) gpu.drivers = drivers;
                if(modules) gpu.modules = modules;

                Utils.lspciCached.push(gpu);
            }
        } catch(e: any) {
            Utils.log('Error getting GPUs list: ' + e.message);
        }

        return Utils.lspciCached;
    }

    static getGPUModelName(gpu: GpuInfo): string {
        let shortName = Utils.GPUModelShortify(gpu.model);
        const shortVendorName = Utils.GPUModelShortify(gpu.vendor);
        const vendorNames = Utils.getVendorName('0x' + gpu.vendorId);

        if(vendorNames[0] === 'Unknown') return shortName;

        if(shortVendorName.startsWith(shortName) && shortVendorName.length > shortName.length) {
            shortName = shortVendorName;
        } else if(shortName.length < 32) {
            const normalizedShortName = shortName.replace(/[^a-zA-Z0-9]/g, '').toLowerCase();
            if(
                !vendorNames.some(vendorName =>
                    normalizedShortName.includes(vendorName.toLowerCase())
                )
            ) {
                const normalizedVendorName = shortVendorName
                    .replace(/[^a-zA-Z0-9]/g, '')
                    .toLowerCase();
                if(
                    shortVendorName &&
                    vendorNames.some(vendorName =>
                        normalizedVendorName.includes(vendorName.toLowerCase())
                    )
                ) {
                    shortName = shortVendorName + ` [${shortName}]`;
                } else {
                    shortName = vendorNames.join(' / ') + ` ${shortName}`;
                }
            }
        }
        return shortName;
    }

    static GPUModelShortify(model: string): string {
        // replace ','
        model = model.replace(',', '');

        // replace '(R)'
        model = model.replace('(R)', '');

        // replace '(TM)'
        model = model.replace('(TM)', '');

        // replace '(C)'
        model = model.replace('(C)', '');

        // replace 'Inc.'
        model = model.replace(/\bInc\./g, '');

        // replace 'Corp.'
        model = model.replace(/\bCorp\./g, '');

        // replace 'Co.'
        model = model.replace(/\bCo\./g, '');

        // replace 'Co'
        model = model.replace(/\bCo\b/g, '');

        // replace 'Corporation'
        model = model.replace(/\bCorporation\b/g, '');

        // replace 'Incorporated'
        model = model.replace(/\bIncorporated\b/g, '');

        // replace 'Limited'
        model = model.replace(/\bLimited\b/g, '');

        // replace 'Ltd'
        model = model.replace(/\bLtd\b/g, '');

        // replace 'Company'
        model = model.replace(/\bCompany\b/g, '');

        // replace 'International'
        model = model.replace(/\bInternational\b/g, '');

        // replace 'Group'
        model = model.replace(/\bGroup\b/g, '');

        // replace 'Technologies'
        model = model.replace(/\bTechnologies\b/g, '');

        // replace 'Technology'
        model = model.replace(/\bTechnology\b/g, '');

        // replace 'Integrated Systems'
        model = model.replace(/\bIntegrated Systems\b/g, '');

        // replace 'Computers'
        model = model.replace(/\bComputers\b/g, '');

        // replace 'Computer'
        model = model.replace(/\bComputer\b/g, '');

        // replace 'Electronic'
        model = model.replace(/\bElectronic\b/g, '');

        // replace 'Advanced Micro Devices' with 'AMD'
        model = model.replace(/\bAdvanced Micro Devices\b/g, 'AMD');

        // replace 'Devices'
        model = model.replace(/\bDevices\b/g, '');

        // replace 'Device'
        model = model.replace(/\bDevice\b/g, '');

        // replace '[AMD/ATI]'
        model = model.replace('[AMD/ATI]', '');

        //replace 'ASUSTeK' with 'ASUS'
        model = model.replace(/\bASUSTeK\b/g, 'ASUS');

        // replace 'Hewlett-Packard' with 'HP'
        model = model.replace(/\bHewlett-Packard\b/g, 'HP');

        // replace (rev 00)
        model = model.replace(/\(rev\.?\s?\w+\)/g, '');

        // replace multiple spaces with single space
        model = model.replace(/\s+/g, ' ');

        // replace repeated words
        model = model.replace(/\b(\w+)\s+\1\b/g, '$1');

        // trim
        model = model.trim();

        return model;
    }

    static isSameGpu(gpu1: GpuInfo, gpu2: GpuInfo): boolean {
        if(!gpu1 || !gpu2) return false;

        return (
            gpu1.domain === gpu2.domain &&
            gpu1.bus === gpu2.bus &&
            gpu1.slot === gpu2.slot &&
            gpu1.vendorId === gpu2.vendorId &&
            gpu1.productId === gpu2.productId
        );
    }

    static getMonitoredGPUs(): GpuInfo[] {
        const gpusData = Config.get_json('gpu-data');
        if(!gpusData) return [];

        const gpus = Utils.getGPUsList();
        return gpusData.filter((gpuData: any) =>
            gpus.some((gpu: any) => Utils.isSameGpu(gpu, gpuData))
        );
    }

    static getMainGPU(): GpuInfo | undefined {
        const mainGpu = Config.get_json('gpu-main');
        if(!mainGpu) return undefined;

        const gpus = Utils.getGPUsList();
        for(const gpu of gpus) {
            if(Utils.isSameGpu(gpu, mainGpu)) return gpu;
        }
        return undefined;
    }

    static getPCI(gpu: GpuInfo | undefined): string {
        if(!gpu) return '';
        return `${gpu.domain}:${gpu.bus}.${gpu.slot}`;
    }

    static cachedUptimeSeconds: number = 0;
    static uptimeTimer: number = 0;
    static getUptime(callback: (uptime: number) => void): UptimeTimer {
        const syncTime = () => {
            if(Utils.uptimeTimer) {
                GLib.source_remove(Utils.uptimeTimer);
            }
            Utils.cachedUptimeSeconds = 0;

            try {
                const fileContents = GLib.file_get_contents('/proc/uptime');
                if(fileContents && fileContents[0]) {
                    const decoder = new TextDecoder('utf8');
                    const uptimeString = decoder.decode(fileContents[1]);
                    const uptimeSeconds = parseFloat(uptimeString.split(' ')[0]);
                    Utils.cachedUptimeSeconds = uptimeSeconds;
                }
            } catch(e) {
                /* empty */
            }

            callback(Utils.cachedUptimeSeconds);

            Utils.uptimeTimer = GLib.timeout_add(GLib.PRIORITY_DEFAULT, 1000, () => {
                Utils.cachedUptimeSeconds += 1.0;
                callback(Utils.cachedUptimeSeconds);
                return true;
            });
        };
        syncTime();

        return {
            stop: () => {
                if(Utils.uptimeTimer) {
                    GLib.source_remove(Utils.uptimeTimer);
                    Utils.uptimeTimer = 0;
                }
            },
        };
    }

    static formatUptime(seconds: number): string {
        const timeParts = {
            days: Math.floor(seconds / (3600 * 24)),
            hours: Math.floor((seconds % (3600 * 24)) / 3600),
            minutes: Math.floor((seconds % 3600) / 60),
            seconds: Math.floor(seconds % 60),
        };

        const formatPart = (value: number, isPadded: boolean) =>
            isPadded ? value.toString().padStart(2, '0') : value.toString();

        let formattedTime = '';
        let shouldPad = false;

        if(timeParts.days > 0) {
            formattedTime += `${timeParts.days}d `;
            shouldPad = true;
        }
        if(timeParts.hours > 0 || shouldPad) {
            formattedTime += `${formatPart(timeParts.hours, shouldPad)}h `;
            shouldPad = true;
        }
        if(timeParts.minutes > 0 || shouldPad) {
            formattedTime += `${formatPart(timeParts.minutes, shouldPad)}m `;
            shouldPad = true;
        }
        formattedTime += `${formatPart(timeParts.seconds, shouldPad)}s`;

        return formattedTime.trim();
    }

    static capitalize(str: string, lower: boolean = true) {
        if(!str) return str;
        if(lower) str = str.toLowerCase();
        return str.replace(/\b[a-z]/g, letter => {
            return letter.toUpperCase();
        });
    }

    static listDisksSync(): Map<string, DiskInfo> {
        const disks = new Map<string, DiskInfo>();

        if(!Utils.hasLsblk()) return disks;

        try {
            const path = Utils.commandPathLookup('lsblk -V');
            const [_result, stdout, _stderr] = GLib.spawn_command_line_sync(
                `${path}lsblk -J -o ID,NAME,LABEL,MOUNTPOINTS,PATH`
            );

            if(stdout && stdout.length > 0) {
                const decoder = new TextDecoder('utf8');
                const stdoutString = decoder.decode(stdout);
                const parsedData = JSON.parse(stdoutString);

                const findDevice = (device: DiskInfo) => {
                    if(
                        Object.prototype.hasOwnProperty.call(device, 'children') &&
                        device.children &&
                        device.children.length > 0
                    ) {
                        for(const child of device.children) findDevice(child);
                    } else {
                        disks.set(device.id, device);
                    }
                };

                if(parsedData.blockdevices && parsedData.blockdevices.length > 0) {
                    for(const device of parsedData.blockdevices) {
                        findDevice(device);
                    }
                }
            } else {
                Utils.log('No disk data found or lsblk command failed');
            }
        } catch(e: any) {
            Utils.log('Error getting disk list sync: ' + e);
        }

        return disks;
    }

    static async listDisksAsync(
        task: CancellableTaskManager<boolean>
    ): Promise<Map<string, DiskInfo>> {
        const disks = new Map<string, DiskInfo>();

        if(!Utils.hasLsblk()) return disks;

        try {
            const path = Utils.commandPathLookup('lsblk -V');
            const result = await Utils.runAsyncCommand(
                `${path}lsblk -J -o ID,NAME,LABEL,MOUNTPOINTS,PATH`,
                task
            );
            if(result) {
                const parsedData = JSON.parse(result);

                const findDevice = (device: DiskInfo) => {
                    if(
                        Object.prototype.hasOwnProperty.call(device, 'children') &&
                        device.children &&
                        device.children.length > 0
                    ) {
                        for(const child of device.children) findDevice(child);
                    } else {
                        disks.set(device.id, device);
                    }
                };

                if(parsedData.blockdevices && parsedData.blockdevices.length > 0) {
                    for(const device of parsedData.blockdevices) {
                        findDevice(device);
                    }
                }
            } else {
                Utils.error('No disk data found or lsblk command failed');
            }
        } catch(e: any) {
            Utils.error('Error getting disk list async: ' + e, e);
        }
        return disks;
    }

    static findDefaultDisk(disks: Map<string, DiskInfo>): string | null {
        for(const [id, disk] of disks.entries()) {
            if(
                disk.mountpoints &&
                Array.isArray(disk.mountpoints) &&
                disk.mountpoints.length > 0 &&
                disk.mountpoints.includes('/')
            ) {
                return id;
            }
        }
        if(disks.size > 0) return disks.keys().next().value || null;
        return null;
    }

    static movingAverage(values: number[], size: number): number[] {
        const smoothedPoints = new Array(values.length);
        let sum = 0;
        let count = 0;
        let avg;

        for(let i = 0; i < values.length; i++) {
            const value = values[i];

            sum += value;
            count++;

            if(i >= size) {
                sum -= values[i - size];
            } else {
                avg = sum / count;
                smoothedPoints[i] = avg;
                continue;
            }

            avg = sum / size;
            smoothedPoints[i] = avg;
        }

        return smoothedPoints;
    }

    static movingAveragePoints(points: number[][], size: number): number[][] {
        const smoothedPoints = new Array(points.length);
        let sum = 0;
        let count = 0;
        let avg;

        for(let i = 0; i < points.length; i++) {
            const point = points[i][1];

            sum += point;
            count++;

            if(i >= size) {
                sum -= points[i - size][1];
            } else {
                avg = sum / count;
                smoothedPoints[i] = [points[i][0], avg];
                continue;
            }

            avg = sum / size;
            smoothedPoints[i] = [points[i][0], avg];
        }

        return smoothedPoints;
    }

    static readDirAsync(path: string): Promise<string[]> {
        return new Promise((resolve, reject) => {
            // Check if the path is valid and not empty
            if(!path || typeof path !== 'string') {
                reject(new Error('Invalid directory path'));
                return;
            }

            let dir;
            try {
                dir = Gio.File.new_for_path(path);

                // Check if the directory exists
                // This is blocking, no need to check
                /*if(!dir.query_exists(null)) {
                    reject(new Error('Directory does not exist'));
                    return;
                }*/
            } catch(e: any) {
                reject(new Error(`Error creating directory object: ${e.message}`));
                return;
            }

            dir.enumerate_children_async(
                'standard::name',
                Gio.FileQueryInfoFlags.NONE,
                0,
                null,
                (sourceObject, result) => {
                    if(!sourceObject) {
                        reject(new Error('Source object invalid'));
                        return;
                    }

                    try {
                        const enumerator = sourceObject.enumerate_children_finish(result);

                        let fileInfo;
                        const files = [];

                        while((fileInfo = enumerator.next_file(null)) !== null) {
                            const name = fileInfo.get_name();
                            files.push(name);
                        }
                        resolve(files);
                    } catch(e: any) {
                        reject(new Error(`Error reading directory: ${e.message}`));
                    }
                }
            );
        });
    }

    static listDirAsync(
        path: string,
        options: { folders: boolean; files: boolean } = { folders: true, files: true }
    ): Promise<{ name: string; isFolder: boolean }[]> {
        return new Promise((resolve, reject) => {
            // Check if the path is valid and not empty
            if(!path || typeof path !== 'string') {
                reject(new Error('Invalid directory path'));
                return;
            }

            let dir;
            try {
                dir = Gio.File.new_for_path(path);
            } catch(e: any) {
                reject(new Error(`Error creating directory object: ${e.message}`));
                return;
            }

            dir.enumerate_children_async(
                'standard::name,standard::type',
                Gio.FileQueryInfoFlags.NONE,
                0,
                null,
                (sourceObject, result) => {
                    if(!sourceObject) {
                        reject(new Error('Source object invalid'));
                        return;
                    }

                    try {
                        const enumerator = sourceObject.enumerate_children_finish(result);

                        let fileInfo;
                        const files = [];

                        while((fileInfo = enumerator.next_file(null)) !== null) {
                            const type = fileInfo.get_file_type();
                            const isFolder = type === Gio.FileType.DIRECTORY;

                            if(options.folders === false && isFolder) continue;
                            if(options.files === false && !isFolder) continue;

                            const name = fileInfo.get_name();
                            files.push({ name, isFolder });
                        }
                        resolve(files);
                    } catch(e: any) {
                        reject(new Error(`Error reading directory: ${e.message}`));
                    }
                }
            );
        });
    }

    static checkFolderExists(path: string): boolean {
        try {
            const file = Gio.File.new_for_path(path);
            return file.query_exists(null);
        } catch(e: any) {
            return false;
        }
    }

    static readFileAsync(
        path: string,
        emptyOnFail: boolean = false,
        encoding: 'utf8' | 'str' | 'hex' = 'utf8'
    ): Promise<string> {
        return new Promise((resolve, reject) => {
            // Check if the path is valid and not empty
            if(!path || typeof path !== 'string') {
                if(emptyOnFail) resolve('');
                else reject(new Error('Invalid file path'));
                return;
            }

            let file;
            try {
                file = Gio.File.new_for_path(path);

                // Check if the file exists
                // This is blocking, no need to check
                /*if(!file.query_exists(null)) {
                    reject(new Error('File does not exist'));
                    return;
                }*/
            } catch(e: any) {
                if(emptyOnFail) resolve('');
                else reject(new Error(`Error creating file object: ${e.message}`));
                return;
            }

            file.load_contents_async(null, (sourceObject, res) => {
                if(!sourceObject) {
                    reject(new Error('Source object invalid'));
                    return;
                }

                try {
                    const [success, fileContent] = sourceObject.load_contents_finish(res);

                    // Check if the file read was successful
                    if(!success) {
                        if(emptyOnFail) resolve('');
                        else reject(new Error('Failed to read file'));
                        return;
                    }

                    if(fileContent.length === 0) {
                        if(emptyOnFail) resolve('');
                        else reject(new Error('File is empty'));
                        return;
                    }

                    // Decode the file content
                    if(encoding === 'utf8') {
                        const decoder = new TextDecoder('utf8');
                        resolve(decoder.decode(fileContent));
                    } else if(encoding === 'str') {
                        resolve(fileContent.toString());
                    } else if(encoding === 'hex') {
                        const hexString = Array.from(fileContent)
                            .map(byte => byte.toString(16).padStart(2, '0'))
                            .join('');
                        resolve(hexString);
                    } else {
                        reject(new Error('Invalid encoding'));
                    }
                } catch(e: any) {
                    if(emptyOnFail) resolve('');
                    else reject(new Error(`Error reading file: ${e.message}`));
                }
            });
        });
    }

    static readFileSync(path: string, emptyOnFail: boolean = false): string {
        // Check if the path is valid and not empty
        if(!path || typeof path !== 'string') {
            if(emptyOnFail) return '';
            throw new Error('Invalid file path');
        }

        let file;
        try {
            file = Gio.File.new_for_path(path);

            // Check if the file exists
            // This is blocking, no need to check
            /*if(!file.query_exists(null)) {
                if(emptyOnFail)
                    return '';
                throw new Error('File does not exist');
            }*/
        } catch(e: any) {
            if(emptyOnFail) return '';
            throw new Error(`Error creating file object: ${e.message}`);
        }

        try {
            const fileContent = file.load_contents(null);

            // Check if the file read was successful
            if(!fileContent[0]) {
                if(emptyOnFail) return '';
                throw new Error('Failed to read file');
            }

            if(fileContent[1].length === 0) {
                if(emptyOnFail) return '';
                throw new Error('File is empty');
            }

            // Decode the file content
            const decoder = new TextDecoder('utf8');
            return decoder.decode(fileContent[1]);
        } catch(e: any) {
            if(emptyOnFail) return '';
            throw new Error(`Error reading file: ${e.message}`);
        }
    }

    static getUrlAsync(url: string, emptyOnFail: boolean = false): Promise<string> {
        return new Promise((resolve, reject) => {
            // Check if the url is valid and not empty
            const urlRegex = /^(http|https|ftp):\/\/[^\s/$.?#].[^\s]*$/;
            if(!url || typeof url !== 'string' || !urlRegex.test(url)) {
                if(emptyOnFail) resolve('');
                else reject(new Error('Invalid url path'));
                return;
            }

            let file;
            try {
                file = Gio.File.new_for_uri(url);
            } catch(e: any) {
                if(emptyOnFail) resolve('');
                else reject(new Error(`Error creating file object: ${e.message}`));
                return;
            }

            file.load_contents_async(null, (sourceObject, res) => {
                if(!sourceObject) {
                    reject(new Error('Source object invalid'));
                    return;
                }

                try {
                    const [success, fileContent] = sourceObject.load_contents_finish(res);

                    // Check if the file read was successful
                    if(!success) {
                        if(emptyOnFail) resolve('');
                        else reject(new Error('Failed to read file'));
                        return;
                    }

                    if(fileContent.length === 0) {
                        if(emptyOnFail) resolve('');
                        else reject(new Error('File is empty'));
                        return;
                    }

                    // Decode the file content
                    const decoder = new TextDecoder('utf8');
                    resolve(decoder.decode(fileContent));
                } catch(e: any) {
                    if(emptyOnFail) resolve('');
                    else reject(new Error(`Error loading url: ${e.message}`));
                }
            });
        });
    }

    static experimentalPsSubprocess: boolean | undefined = undefined;
    static runAsyncCommand(
        command: string,
        task?: CancellableTaskManager<boolean>
    ): Promise<string> {
        if(Utils.experimentalPsSubprocess === undefined) {
            let features = Config.get_json('experimental-features');
            Utils.experimentalPsSubprocess = features?.includes('ps_subprocess') ?? false;
            Config.connect(this, 'changed::experimental-features', () => {
                features = Config.get_json('experimental-features');
                Utils.experimentalPsSubprocess = features?.includes('ps_subprocess') ?? false;
            });
        }

        if(Utils.experimentalPsSubprocess) {
            return CommandSubprocess.run(command, task);
        }
        return CommandHelper.runCommand(command, task);
    }

    static getLocalIcon(iconName: string): Gio.Icon | undefined {
        if(!Utils.metadata || !(Utils.metadata as any).path) return undefined;
        return Gio.icon_new_for_string(
            `${(Utils.metadata as any).path}/icons/hicolor/scalable/actions/${iconName}.svg`
        );
    }

    /**
     * This function is sync, but it spawns only once the user opens the network menu
     * May be convered to async but this will introduce a graphical update lag (minor)
     * Impact measured to be ~15ms: relevant but not a priority
     */
    static getNetworkInterfacesSync(): Map<string, InterfaceInfo> {
        const devices = new Map<string, InterfaceInfo>();

        if(!Utils.hasIp()) return devices;

        try {
            const path = Utils.commandPathLookup('ip -V');
            const [result, stdout, _stderr] = GLib.spawn_command_line_sync(`${path}ip -d -j addr`);

            if(result && stdout) {
                const decoder = new TextDecoder('utf8');
                const output = decoder.decode(stdout);

                const json = JSON.parse(output);

                for(const data of json) {
                    const name = data.ifname;
                    if(name === 'lo') continue;

                    const flags = data.flags || [];
                    if(flags.includes('LOOPBACK')) continue;

                    const ifindex = data.ifindex;
                    if(data.ifindex === undefined) continue;

                    const device: InterfaceInfo = {
                        name,
                        flags,
                        ifindex,
                    };

                    if(data.mtu) device.mtu = data.mtu;
                    if(data.qdisc) device.qdisc = data.qdisc;
                    if(data.operstate) device.operstate = data.operstate;
                    if(data.linkmode) device.linkmode = data.linkmode;
                    if(data.group) device.group = data.group;
                    if(data.txqlen) device.txqlen = data.txqlen;
                    if(data.link_type) device.link_type = data.link_type;
                    if(data.address) device.address = data.address;
                    if(data.broadcast) device.broadcast = data.broadcast;
                    if(data.netmask) device.netmask = data.netmask;
                    if(data.altnames) device.altnames = data.altnames;
                    if(data.parentbus) device.parentbus = data.parentbus;
                    if(data.parentdev) device.parentdev = data.parentdev;
                    if(data.addr_info) device.addr_info = data.addr_info;
                    if(data.linkinfo) device.linkinfo = data.linkinfo;

                    //try to get link speed
                    const speedStr = Utils.readFileSync(
                        `/sys/class/net/${name}/speed`,
                        true
                    ).trim();
                    if(speedStr) {
                        if(Utils.isIntOrIntString(speedStr)) {
                            const speed = parseInt(speedStr, 10);
                            if(speed > 0) device.speed = speed;
                        }
                    }

                    //try to get duplex
                    const duplex = Utils.readFileSync(`/sys/class/net/${name}/duplex`, true).trim();
                    if(duplex) device.duplex = duplex;

                    devices.set(name, device);
                }
            }
        } catch(e: any) {
            Utils.error('Error getting network interfaces', e);
        }

        return devices;
    }

    static async getNetworkInterfacesAsync(
        task?: CancellableTaskManager<boolean>
    ): Promise<Map<string, InterfaceInfo>> {
        const devices = new Map<string, InterfaceInfo>();
        if(!Utils.hasIp()) return devices;

        try {
            const path = Utils.commandPathLookup('ip -V');
            const result = await Utils.runAsyncCommand(`${path}ip -d -j addr`, task);
            if(result) {
                const json = JSON.parse(result);

                for(const data of json) {
                    const name = data.ifname;
                    if(name === 'lo') continue;

                    const flags = data.flags || [];
                    if(flags.includes('LOOPBACK')) continue;

                    const ifindex = data.ifindex;
                    if(data.ifindex === undefined) continue;

                    const device: InterfaceInfo = {
                        name,
                        flags,
                        ifindex,
                    };

                    if(data.mtu) device.mtu = data.mtu;
                    if(data.qdisc) device.qdisc = data.qdisc;
                    if(data.operstate) device.operstate = data.operstate;
                    if(data.linkmode) device.linkmode = data.linkmode;
                    if(data.group) device.group = data.group;
                    if(data.txqlen) device.txqlen = data.txqlen;
                    if(data.link_type) device.link_type = data.link_type;
                    if(data.address) device.address = data.address;
                    if(data.broadcast) device.broadcast = data.broadcast;
                    if(data.netmask) device.netmask = data.netmask;
                    if(data.altnames) device.altnames = data.altnames;
                    if(data.parentbus) device.parentbus = data.parentbus;
                    if(data.parentdev) device.parentdev = data.parentdev;
                    if(data.addr_info) device.addr_info = data.addr_info;
                    if(data.linkinfo) device.linkinfo = data.linkinfo;

                    devices.set(name, device);
                }

                const promises = Array.from(devices.entries()).map(async ([name, device]) => {
                    const [speedStr, duplex] = await Promise.all([
                        Utils.readFileAsync(`/sys/class/net/${name}/speed`, true),
                        Utils.readFileAsync(`/sys/class/net/${name}/duplex`, true),
                    ]);

                    if(speedStr.trim()) {
                        if(Utils.isIntOrIntString(speedStr.trim())) {
                            const speed = parseInt(speedStr.trim(), 10);
                            if(speed > 0) device.speed = speed;
                        }
                    }

                    if(duplex.trim()) {
                        device.duplex = duplex.trim();
                    }
                });

                await Promise.all(promises);
            }
        } catch(e: any) {
            Utils.error('Error getting network interfaces', e);
        }

        return devices;
    }

    static async getNetworkRoutesAsync(
        task?: CancellableTaskManager<boolean>
    ): Promise<RouteInfo[]> {
        const routes: RouteInfo[] = [];

        if(!Utils.hasIp()) return routes;

        try {
            const path = Utils.commandPathLookup('ip -V');
            const result = await Utils.runAsyncCommand(`${path}ip -d -j route show default`, task);
            if(result) {
                const json = JSON.parse(result);
                for(const data of json) {
                    const device = data.dev;
                    if(!device) continue;

                    const route: RouteInfo = {
                        type: data.type,
                        destination: data.dst,
                        gateway: data.gateway,
                        device: device,
                        protocol: data.protocol,
                        scope: data.scope,
                        metric: data.metric || 0,
                        flags: data.flags,
                    };
                    routes.push(route);
                }
            }
            return routes;
        } catch(e: any) {
            Utils.error('Error getting network routes', e);
            return routes;
        }
    }

    /**
     * This function is sync, but it spawns only once the user opens the storage menu
     * May be convered to async but this will introduce a graphical update lag (minor)
     * Impact measured to be ~25ms: relevant but not a priority
     */
    static getBlockDevicesSync(): Map<string, BlockDevice> {
        const devices = new Map();

        if(!Utils.hasLsblk()) return devices;

        try {
            const commandPath = Utils.commandPathLookup('lsblk -V');
            const [result, stdout, _stderr] = GLib.spawn_command_line_sync(
                `${commandPath}lsblk -Jb -o ID,UUID,NAME,KNAME,PKNAME,LABEL,TYPE,SUBSYSTEMS,MOUNTPOINTS,VENDOR,MODEL,PATH,RM,RO,STATE,OWNER,SIZE,FSUSE%,FSTYPE`
            );

            if(result && stdout) {
                const decoder = new TextDecoder('utf8');
                const output = decoder.decode(stdout);

                const json = JSON.parse(output);

                for(const device of json.blockdevices) {
                    Utils.parseBlockDevice(device, devices);
                }
            }
        } catch(e: any) {
            Utils.error('Error getting block devices', e);
        }

        return devices;
    }

    static async getBlockDevicesAsync(
        task?: CancellableTaskManager<boolean>
    ): Promise<Map<string, BlockDevice>> {
        const devices = new Map<string, BlockDevice>();
        if(!Utils.hasLsblk()) return devices;

        try {
            const commandPath = Utils.commandPathLookup('lsblk -V');
            const result = await Utils.runAsyncCommand(
                `${commandPath}lsblk -Jb -o ID,UUID,NAME,KNAME,PKNAME,LABEL,TYPE,SUBSYSTEMS,MOUNTPOINTS,VENDOR,MODEL,PATH,RM,RO,STATE,OWNER,SIZE,FSUSE%,FSTYPE`,
                task
            );
            if(result) {
                const json = JSON.parse(result);

                for(const device of json.blockdevices) {
                    Utils.parseBlockDevice(device, devices);
                }
            }
        } catch(e: any) {
            Utils.error('Error getting block devices', e);
        }

        return devices;
    }

    static parseBlockDevice(
        device: any,
        devices: Map<string, BlockDevice>,
        parent: BlockDevice | null = null
    ) {
        const id = device.id;
        if(!id) return;

        if(devices.has(id)) {
            if(parent) devices.get(id)?.parents.push(parent);
            return;
        }

        const uuid = device.uuid;
        const name = device.name;
        const kname = device.kname;
        const pkname = device.pkname;
        const label = device.label;
        const type = device.type;

        if(type === 'loop') return;

        const subsystems = device.subsystems;

        let mountpoints: string[] = [];
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

        const deviceObj: BlockDevice = {
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
                Utils.parseBlockDevice(child, devices, deviceObj);
            }
        } else {
            devices.set(id, deviceObj);
        }
    }

    static parseRGBA(colorString: string | null, fallbackValue?: string): Color {
        const color: Color = { red: 0, green: 0, blue: 0, alpha: 1 };

        if(!colorString) {
            if(fallbackValue) return Utils.parseRGBA(fallbackValue);
            throw new Error('Color string is empty');
        }

        if(colorString.startsWith('#')) {
            colorString = colorString.substring(1);
            if(colorString.length === 3)
                colorString = colorString
                    .split('')
                    .map(char => char + char)
                    .join('');
            if(colorString.length === 6 || colorString.length === 8) {
                color.red = parseInt(colorString.substring(0, 2), 16) / 255;
                color.green = parseInt(colorString.substring(2, 4), 16) / 255;
                color.blue = parseInt(colorString.substring(4, 6), 16) / 255;
                if(colorString.length === 8)
                    color.alpha = parseInt(colorString.substring(6, 8), 16) / 255;
            } else {
                if(fallbackValue) return Utils.parseRGBA(fallbackValue);
                throw new Error('Invalid hex color format');
            }
        } else if(colorString.toLowerCase().startsWith('rgb')) {
            const match = colorString.match(/\d+(\.\d+)?/g);
            if(!match) {
                if(fallbackValue) return Utils.parseRGBA(fallbackValue);
                throw new Error('Invalid RGB(A) format');
            }
            const values = match.map(Number);
            if(values.length === 3 || values.length === 4) {
                color.red = values[0] / 255;
                color.green = values[1] / 255;
                color.blue = values[2] / 255;
                if(values.length === 4) color.alpha = values[3];
                if(
                    values.some(
                        (value, index) =>
                            (index < 3 && (value < 0 || value > 255)) ||
                            (index === 3 && (value < 0 || value > 1))
                    )
                ) {
                    if(fallbackValue) return Utils.parseRGBA(fallbackValue);
                    throw new Error(
                        'RGB values must be between 0 and 255, and alpha value must be between 0 and 1'
                    );
                }
            } else {
                if(fallbackValue) return Utils.parseRGBA(fallbackValue);
                throw new Error('Invalid RGB(A) format');
            }
        } else {
            if(fallbackValue) return Utils.parseRGBA(fallbackValue);
            throw new Error('Invalid color format');
        }
        return color;
    }

    static valueTreeExtimatedHeight(valueTree: Map<string, string[]>): number {
        let length = valueTree.size;
        for(const value of valueTree.values()) length += value.length;
        return (length *= 20);
    }

    static xmlParse(xml: string, skips: string[] = []): any {
        if(!Utils.xmlParser) return undefined;
        return Utils.xmlParser.parse(xml, skips);
    }

    static performanceStart(name: string) {
        if(!Utils.debug) return;
        let performance = Utils.performanceMap?.get(name);
        if(!performance) {
            performance = { start: GLib.get_monotonic_time(), mean: 0, count: 0 };
        } else {
            performance.start = GLib.get_monotonic_time();
        }
        Utils.performanceMap?.set(name, performance);
    }

    static performanceEnd(name: string) {
        if(!Utils.debug) return;

        const performance = Utils.performanceMap?.get(name);
        if(performance) {
            const end = GLib.get_monotonic_time();
            const time = (end - performance.start) / 1000;
            performance.mean =
                (performance.mean * performance.count + time) / (performance.count + 1);
            performance.count++;
            Utils.log(
                `${name} took ${performance.mean.toFixed(2)}ms (mean: ${performance.mean.toFixed(2)}ms)`
            );
            Utils.performanceMap?.set(name, {
                start: GLib.get_monotonic_time(),
                mean: performance.mean,
                count: performance.count,
            });
        }
    }

    static convertCharListToString(value: number[]): string {
        const firstNullIndex = value.indexOf(0);
        if(firstNullIndex === -1) return String.fromCharCode.apply(null, value);
        else return String.fromCharCode.apply(null, value.slice(0, firstNullIndex));
    }

    static roundFloatingPointNumber(num: number): number {
        const numStr = num.toString();
        const decimalIndex = numStr.indexOf('.');

        if(decimalIndex === -1) return num;

        const fractionLength = numStr.length - decimalIndex - 1;
        let precision = Math.min(10, fractionLength);
        if(fractionLength > 10) precision = fractionLength - 10;

        return Number(num.toFixed(precision));
    }

    static mapToObject(map: Map<any, any>): any {
        const obj: { [key: string]: any } = {};
        map.forEach((value, key) => {
            obj[key] = value instanceof Map ? Utils.mapToObject(value) : value;
        });
        return obj;
    }

    static comparePaths(reference: any[], compare: any[]): boolean {
        if(reference.length > compare.length) return false;
        return reference.every((element, index) => element === compare[index]);
    }

    static lowPriorityTasks: Array<number> = [];
    static lowPriorityTask(
        callback: () => void,
        priority: number = GLib.PRIORITY_DEFAULT_IDLE
    ): void {
        const task = GLib.idle_add(priority, () => {
            callback();
            Utils.lowPriorityTasks = Utils.lowPriorityTasks.filter(id => id !== task);
            return GLib.SOURCE_REMOVE;
        });
        Utils.lowPriorityTasks.push(task);
    }

    static timeoutTasks: Array<number> = [];
    static timeoutTask(
        callback: () => void,
        timeout: number,
        priority: number = GLib.PRIORITY_DEFAULT
    ): void {
        const task = GLib.timeout_add(priority, timeout, () => {
            callback();
            Utils.timeoutTasks = Utils.timeoutTasks.filter(id => id !== task);
            return GLib.SOURCE_REMOVE;
        });
        Utils.timeoutTasks.push(task);
    }

    static configUpdateFixes() {
        //Fix GPU domain missing (v9 => v10)
        const selectedGpu = Config.get_json('processor-menu-gpu');
        if(selectedGpu && selectedGpu.domain) {
            if(!selectedGpu.domain.includes(':')) {
                selectedGpu.domain = '0000:' + selectedGpu.domain;
                Config.set('processor-menu-gpu', selectedGpu, 'json');
            }
        }

        //Fix default secondary color in memory bar (v15 => v16)
        const graphColor2 = Config.get_string('memory-header-graph-color2');
        if(graphColor2 === 'rgba(214,29,29,1.0)') {
            Config.set('memory-header-graph-color2', 'rgba(29,172,214,0.3)', 'string');
        }
        const barsColor2 = Config.get_string('memory-header-bars-color2');
        if(barsColor2 === 'rgba(214,29,29,1.0)') {
            Config.set('memory-header-bars-color2', 'rgba(29,172,214,0.3)', 'string');
        }

        //Fix GPU moved from processor (v19 => v20)
        const processorMenuGpu = Config.get_json('processor-menu-gpu');
        let gpuMain = Config.get_json('gpu-main');
        if(processorMenuGpu && !gpuMain) {
            Config.set('gpu-main', processorMenuGpu, 'json');
            Config.set('processor-menu-gpu', '""', 'string');
        }
        const processorMenuGpuColor = Config.get_string('processor-menu-gpu-color');
        if(processorMenuGpuColor) {
            Config.set('gpu-header-activity-bar-color1', processorMenuGpuColor, 'string');
            Config.set('gpu-header-activity-graph-color1', processorMenuGpuColor, 'string');
            Config.set('processor-menu-gpu-color', '', 'string');
        }

        //Fix headers-height moved to headers-height-override (v21 => v22)
        const height = Config.get_int('headers-height');
        if(height === 28) {
            Config.set('headers-height-override', 0, 'int');
            Config.set('headers-height', 0, 'int');
        } else if(height > 15 && height < 80) {
            Config.set('headers-height-override', height, 'int');
            Config.set('headers-height', 0, 'int');
        }

        //Fix profiles missing (v24 => v25)
        let profiles = Config.get_json('profiles');
        if(!profiles) {
            profiles = {};
            const currentProfile = Config.get_string('current-profile') || 'default';
            profiles[currentProfile] = Config.getCurrentSettingsData(Config.globalSettingsKeys);
            Config.set('profiles', profiles, 'json');
        }

        //Fix GPU moved from processor (v29 => v30)
        gpuMain = Config.get_json('gpu-main');
        if(gpuMain && gpuMain.domain) {
            let gpuData = Config.get_json('gpu-data');
            if(!gpuData) {
                gpuData = [];
                if(!gpuMain.domain.includes(':')) gpuMain.domain = '0000:' + gpuMain.domain;

                gpuMain.monitor = true;
                gpuData.push(gpuMain);
                Config.set('gpu-data', gpuData, 'json');
                //Config.set('gpu-main', '""', 'string');
            }
        }

        //Fix experimental-features (v31 => v32)
        let experimentalFeatures = Config.get_json('experimental-features');
        if(!experimentalFeatures) {
            Config.set('experimental-features', [], 'json');
            experimentalFeatures = [];
        }

        //Clean Removed Experimental Features
        experimentalFeatures = experimentalFeatures.filter((feature: string) =>
            Config.experimentalFeatures.includes(feature)
        );
        Config.set('experimental-features', experimentalFeatures, 'json');
    }

    static unitToIcon(unit: string): IconData {
        const icon: IconData = {
            gicon: Utils.getLocalIcon('am-dialog-info-symbolic'),
            fallbackIconName: 'dialog-info-symbolic',
        };
        if(unit === '°C' || unit === 'C' || unit === '°F' || unit === 'F') {
            icon.gicon = Utils.getLocalIcon('am-temperature-symbolic');
            icon.fallbackIconName = 'temperature-symbolic';
        } else if(unit === 'RPM') {
            icon.gicon = Utils.getLocalIcon('am-fan-symbolic');
            icon.fallbackIconName = 'fan-symbolic';
        } else if(unit === 'V' || unit === 'mV') {
            icon.gicon = Utils.getLocalIcon('am-voltage-symbolic');
            icon.fallbackIconName = 'battery-symbolic';
        } else if(unit === 'kW' || unit === 'W') {
            icon.gicon = Utils.getLocalIcon('am-power-symbolic');
            icon.fallbackIconName = 'plug-symbolic';
        } else if(unit === 'A' || unit === 'mA') {
            icon.gicon = Utils.getLocalIcon('am-current-symbolic');
            icon.fallbackIconName = 'battery-symbolic';
        } else if(unit === 'J') {
            icon.gicon = Utils.getLocalIcon('am-power-symbolic');
            icon.fallbackIconName = 'battery-symbolic';
        } else if(unit === 'GHz' || unit === 'MHz' || unit === 'Hz') {
            icon.gicon = Utils.getLocalIcon('am-frequency-symbolic');
            icon.fallbackIconName = 'battery-symbolic';
        }
        return icon;
    }

    static splitStringByLength(
        str: string,
        length: number,
        splitters: string[],
        range: number
    ): string[] {
        if(range >= length - 1) throw new Error('Range must be less than length');

        const linesNum = Math.ceil(str.length / length);
        const linesChars = Math.round(str.length / linesNum);
        const lines = [];

        for(let i = 1; i < linesNum; i++) {
            let splitPoint = linesChars;
            if(!splitters.includes(str[splitPoint])) {
                for(let j = 0; j < range; j++) {
                    if(splitters.includes(str[splitPoint + j])) {
                        splitPoint = splitPoint + j;
                        break;
                    }
                    if(splitters.includes(str[splitPoint - j])) {
                        splitPoint = splitPoint - j;
                        break;
                    }
                }
            }

            const line = str.substring(0, splitPoint + 1);
            str = str.substring(splitPoint + 1);
            lines.push(line.trim());
        }
        lines.push(str.trim());
        return lines;
    }

    static deepEqual(obj1: any, obj2: any): boolean {
        if(obj1 === obj2) return true;

        if(typeof obj1 !== 'object' || obj1 === null || typeof obj2 !== 'object' || obj2 === null)
            return false;

        const keys1 = Object.keys(obj1) as Array<keyof typeof obj1>;
        const keys2 = Object.keys(obj2) as Array<keyof typeof obj2>;

        if(keys1.length !== keys2.length) return false;

        for(const key of keys1) {
            if(!keys2.includes(key) || !Utils.deepEqual(obj1[key], obj2[key])) return false;
        }

        return true;
    }

    private static nethogsCaps: string[] | undefined = undefined;
    static nethogsHasCaps(): boolean {
        if(Utils.nethogsCaps !== undefined)
            return (
                Utils.nethogsCaps.includes('cap_net_admin') &&
                Utils.nethogsCaps.includes('cap_net_raw=ep')
            );

        let [result, stdout] = GLib.spawn_command_line_sync('which nethogs');
        if(result === false || !stdout) {
            Utils.nethogsCaps = [];
            return false;
        }

        const decoder = new TextDecoder();
        const nethogs = decoder.decode(stdout).trim();
        if(nethogs === '') {
            Utils.nethogsCaps = [];
            return false;
        }

        [result, stdout] = GLib.spawn_command_line_sync(`getcap ${nethogs}`);
        if(result === false || !stdout) {
            Utils.nethogsCaps = [];
            return false;
        }

        Utils.nethogsCaps = decoder.decode(stdout).split(/\s+|,/).slice(1);
        return (
            Utils.nethogsCaps.includes('cap_net_admin') &&
            Utils.nethogsCaps.includes('cap_net_raw=ep')
        );
    }

    static getGpuUUID(gpuInfo: GpuInfo): string {
        return `${gpuInfo.domain}:${gpuInfo.bus}.${gpuInfo.slot}`;
    }
}
