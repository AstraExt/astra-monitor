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
import Utils, { GpuInfo } from '../utils/utils.js';
import Monitor from '../monitor.js';

import ContinuosTaskManager, { ContinuosTaskManagerData } from '../utils/continuosTaskManager.js';

// eslint-disable-next-line no-shadow
enum GpuSensorPriority {
    NONE,
    LOW,
    MEDIUM,
    HIGH,
    MAX,
}

type GpuSensor = {
    name: string;
    value: number | string;
    unit: string;
    priority: GpuSensorPriority;
};

export type GenericGpuInfo = {
    id: string;
    family: 'AMD' | 'NVIDIA' | 'Intel';
    info: {
        pipes: {
            name: string;
            data: string;
        }[];
    };
    vram: {
        percent?: number;
        total?: number;
        used?: number;
        pipes: {
            name: string;
            percent: number;
            used: number;
            total: number;
        }[];
    };
    activity: {
        GFX?: number;
        pipes: {
            name: string;
            percent: number;
        }[];
    };
    topProcesses: {
        name: string;
        pid: number;
        pipes: {
            name: string;
            value: number;
            unit: string;
        }[];
    }[];
    sensors: {
        categories: {
            name: string;
            sensors: GpuSensor[];
        }[];
        list: GpuSensor[];
    };
    raw: any;
};

type AmdValue = {
    unit?: string;
    value?: number;
};

type PcieValue = {
    gen?: number;
    width?: number;
};

type AmdInfoRaw = {
    GRBM?: {
        [key: string]: AmdValue;
    };
    GRBM2?: {
        [key: string]: AmdValue;
    };
    Info?: {
        'ASIC Name'?: string;
        'Chip Class'?: string;
        DeviceID?: number;
        DeviceName?: string;
        'GL1 Cache per Shader Array'?: number;
        'GPU Family'?: string;
        'GPU Type'?: string;
        'L1 Cache per CU'?: number;
        'L2 Cache'?: number;
        'L3 Cache'?: number;
        'Power Profiles'?: string[];
        PCI?: string;
        RenderBackend?: number;
        ResizableBAR?: boolean;
        RevisionID?: number;
        'Shader Array per Shader Engine'?: number;
        'Shader Engine'?: number;
        'Total Compute Unit'?: number;
        'Total ROP'?: number;
        VBIOS?: {
            date?: string;
            name?: string;
            pn?: string;
            ver_str?: string;
        };
        'VRAM Bit width'?: number;
        'VRAM Size'?: number;
        'VRAM Type'?: string;
        'Video Caps'?: {
            [key: string]: {
                Decode?: {
                    height: number;
                    width: number;
                };
                Encode?: {
                    height: number;
                    width: number;
                };
            };
        };
        drm_version?: {
            major?: number;
            minor?: number;
            patchlevel?: number;
        };
        'GTT Size': number;
        VRAM?: {
            [key: string]: AmdValue;
        };
        'GPU Clock'?: {
            min?: number;
            max?: number;
        };
        'Memory Clock'?: {
            min?: number;
            max?: number;
        };
        'PCIe Link'?: {
            max_dpm_link?: {
                gen?: number;
                width?: number;
            };
            max_gpu_link?: {
                gen?: number;
                width?: number;
            };
            max_system_link?: {
                gen?: number;
                width?: number;
            };
            min_dpm_link?: {
                gen?: number;
                width?: number;
            };
        };
        'Power Cap'?: {
            current?: number;
            min?: number;
            max?: number;
        };
    };
    Sensors?: {
        [key: string]: AmdValue & PcieValue;
    };
    VRAM?: {
        [key: string]: AmdValue;
    };
    fdinfo?: {
        [key: string]: {
            name?: string;
            usage: {
                [key: string]: AmdValue;
            };
        };
    };
    gpu_activity?: {
        [key: string]: AmdValue;
    };
    gpu_metrics?: {
        [key: string]: AmdValue;
    };
};

export type AmdInfo = GenericGpuInfo & {
    raw: AmdInfoRaw;
};

type NvidiaField = {
    '#text'?: string;
};

type GenericField = {
    text?: string;
    value?: number;
    unit?: string;
};

type NvidiaInfoRaw = {
    '@id'?: string;
    product_name?: NvidiaField;
    product_brand?: NvidiaField;
    product_architecture?: NvidiaField;
    display_mode?: NvidiaField;
    display_active?: NvidiaField;
    persistence_mode?: NvidiaField;
    addressing_mode?: NvidiaField;
    mig_devices?: NvidiaField;
    accounting_mode?: NvidiaField;
    accounting_mode_buffer_size?: NvidiaField;
    serial?: NvidiaField;
    uuid?: NvidiaField;
    minor_number?: NvidiaField;
    vbios_version?: NvidiaField;
    multigpu_board?: NvidiaField;
    board_id?: NvidiaField;
    board_part_number?: NvidiaField;
    gpu_part_number?: NvidiaField;
    gpu_fru_part_number?: NvidiaField;
    gpu_module_id?: NvidiaField;
    inforom_version?: {
        img_version?: NvidiaField;
        oem_object?: NvidiaField;
        ecc_object?: NvidiaField;
        pwr_object?: NvidiaField;
    };
    gsp_firmware_version?: NvidiaField;
    gpu_virtualization_mode?: {
        virtualization_mode?: NvidiaField;
        host_vgpu_mode?: NvidiaField;
    };
    compute_mode?: NvidiaField;
    fb_memory_usage?: {
        total?: NvidiaField;
        reserverd?: NvidiaField;
        used?: NvidiaField;
        free?: NvidiaField;
    };
    bar1_memory_usage?: {
        total?: NvidiaField;
        used?: NvidiaField;
        free?: NvidiaField;
    };
    cc_protected_memory_usage?: {
        total?: NvidiaField;
        used?: NvidiaField;
        free?: NvidiaField;
    };
    utilization?: {
        [key: string]: NvidiaField;
    };
    processes?: {
        process_info?: {
            process_name: NvidiaField;
            pid: NvidiaField;
            used_memory: NvidiaField;
        }[];
    };
    pci?: {
        pci_gpu_link_info?: {
            max_link_gen?: NvidiaField;
            current_link_gen?: NvidiaField;
            device_current_link_gen?: NvidiaField;
            max_device_link_gen?: NvidiaField;
        };
        link_widths?: {
            max_link_width?: NvidiaField;
            current_link_width?: NvidiaField;
        };
        tx_util?: NvidiaField;
        rx_util?: NvidiaField;
    };
    fan_speed?: NvidiaField;
    temperature?: {
        gpu_temp?: NvidiaField;
        gpu_temp_max_threshold?: NvidiaField;
        gpu_temp_slow_threshold?: NvidiaField;
        gpu_target_temperature?: NvidiaField;
        memory_temp?: NvidiaField;
        gpu_temp_max_mem_threshold?: NvidiaField;
    };
    gpu_power_readings?: {
        power_state?: NvidiaField;
        power_draw?: NvidiaField;
        current_power_limit?: NvidiaField;
        requested_power_limit?: NvidiaField;
        default_power_limit?: NvidiaField;
        min_power_limit?: NvidiaField;
        max_power_limit?: NvidiaField;
    };
    clocks?: {
        graphics_clock?: NvidiaField;
        sm_clock?: NvidiaField;
        mem_clock?: NvidiaField;
        video_clock?: NvidiaField;
    };
    max_clocks?: {
        graphics_clock?: NvidiaField;
        sm_clock?: NvidiaField;
        mem_clock?: NvidiaField;
        video_clock?: NvidiaField;
    };
};

export type NvidiaInfo = GenericGpuInfo & {
    raw: NvidiaInfoRaw;
};

export default class GpuMonitor extends Monitor {
    private status = false;
    private updateAmdGpuTask: ContinuosTaskManager;
    private updateNvidiaGpuTask: ContinuosTaskManager;

    private infoPipesCache?: {
        name: string;
        data: string;
    }[];
    private infoPipesCacheTime = 0;

    private selectedGpu?: GpuInfo | undefined;

    constructor() {
        super('Gpu Monitor');

        this.updateAmdGpuTask = new ContinuosTaskManager();
        this.updateAmdGpuTask.listen(this, this.updateAmdGpu.bind(this));

        this.updateNvidiaGpuTask = new ContinuosTaskManager();
        this.updateNvidiaGpuTask.listen(this, this.updateNvidiaGpu.bind(this));

        this.reset();

        Config.connect(this, 'changed::gpu-header-show', this.updateMonitorStatus.bind(this));
        Config.connect(this, 'changed::gpu-update', this.restart.bind(this));

        const updateGpu = () => {
            this.selectedGpu = Utils.getSelectedGPU();
        };
        Config.connect(this, 'changed::gpu-main', updateGpu.bind(this));
        updateGpu();

        this.updateMonitorStatus();
    }

    get updateFrequency() {
        return Config.get_double('gpu-update');
    }

    getSelectedGpu() {
        return this.selectedGpu;
    }

    updateMonitorStatus() {
        if(Config.get_boolean('gpu-header-show') || this.isListeningFor('gpuUpdateProcessor')) {
            this.start();
        } else {
            this.stop();
        }
    }

    restart() {
        if(!Config.get_boolean('gpu-header-show') && !this.isListeningFor('gpuUpdateProcessor'))
            return;
        super.restart();
    }

    reset() {
        this.infoPipesCache = undefined;
        this.infoPipesCacheTime = 0;
    }

    start() {
        if(this.status) return;
        this.status = true;

        super.start();
        this.startGpuTask();
    }

    stop() {
        if(!this.status) return;
        this.status = false;

        super.stop();
        this.stopGpuTask();
        this.reset();
    }

    startListeningFor(key: string) {
        if(key === 'gpuUpdateProcessor') {
            Utils.lowPriorityTask(() => {
                this.updateMonitorStatus();
            }, GLib.PRIORITY_HIGH_IDLE);
        }
    }

    stopListeningFor(key: string) {
        if(key === 'gpuUpdateProcessor') {
            this.updateMonitorStatus();
        }
    }

    private startGpuTask() {
        Utils.log('startGpuTask!');

        const selectedGpu = Utils.getSelectedGPU();
        if(!selectedGpu) return;

        if(Utils.hasAMDGpu() && Utils.hasAmdGpuTop() && Utils.isAmdGpu(selectedGpu)) {
            // Max 2 updates per second
            const timer = Math.round(Math.max(500, this.updateFrequency * 1000));
            const path = Utils.commandPathLookup('amdgpu_top');
            this.updateAmdGpuTask.start(`${path}amdgpu_top -J -u 5 -s ${timer} -n 0`);
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
            const path = Utils.commandPathLookup('nvidia-smi');
            this.updateNvidiaGpuTask.start(
                `${path}nvidia-smi -q -x -lms ${timer}`,
                '</nvidia_smi_log>'
            );
        }
    }

    private stopGpuTask() {
        if(this.updateAmdGpuTask.isRunning) this.updateAmdGpuTask.stop();
        if(this.updateNvidiaGpuTask.isRunning) this.updateNvidiaGpuTask.stop();
    }

    update(): boolean {
        Utils.verbose('Updating Gpu Monitor');

        return true;
    }

    requestUpdate(key: string) {
        super.requestUpdate(key);
    }

    /*runUpdate(key: string, ...params: any[]) {
        
    }*/

    static nvidiaToGenericField(
        nvidia: NvidiaField | undefined,
        plainText: boolean = false
    ): GenericField | undefined {
        if(!nvidia || !nvidia['#text'] || nvidia['#text'] === 'N/A') return undefined;

        if(plainText) return { text: nvidia['#text'] };

        const tokens = nvidia['#text'].split(' ');
        if(tokens.length < 2) {
            if(Utils.isNumeric(tokens[0])) return { value: parseFloat(tokens[0]) };
            else return { text: tokens[0] };
        } else if(tokens.length > 2) {
            return { text: nvidia['#text'] };
        }

        //Look for a unit
        const units = [
            'kW',
            'W',
            'mW',
            'V',
            'mV',
            'A',
            'mA',
            'J',
            'Hz',
            'KHz',
            'MHz',
            'GHz',
            'GB',
            'GiB',
            'MB',
            'MiB',
            'KB',
            'KiB',
            'B',
            'MB/s',
            'MiB/s',
            'KB/s',
            'KiB/s',
            'B/s',
            'C',
            'F',
            '°C',
            '°F',
            'RPM',
            '%',
        ];
        if(units.includes(tokens[1])) {
            if(Utils.isNumeric(tokens[0]))
                return { value: parseFloat(tokens[0]), unit: tokens[1] };
            else return { text: nvidia['#text'] };
        }

        return { text: nvidia['#text'] };
    }

    updateAmdGpu(data: ContinuosTaskManagerData) {
        if(data.exit || !data.result) return;

        try {
            const json: { devices: AmdInfoRaw[] } = JSON.parse(data.result);

            const gpus = new Map<string, AmdInfo>();
            for(const gpuInfo of json.devices) {
                const id = gpuInfo.Info?.PCI;
                if(!id) continue;

                const gpu: AmdInfo = {
                    id,
                    family: 'AMD',
                    info: { pipes: [] },
                    vram: { pipes: [] },
                    activity: { pipes: [] },
                    topProcesses: [],
                    sensors: { categories: [], list: [] },
                    raw: gpuInfo,
                };

                //Info
                // Use cache if it's been update in the last 10 minutes
                if(
                    this.infoPipesCache &&
                    GLib.get_monotonic_time() - this.infoPipesCacheTime < 600000
                ) {
                    gpu.info.pipes = this.infoPipesCache;
                } else {
                    if(gpuInfo.Info) {
                        const asicName = gpuInfo.Info['ASIC Name'];
                        if(asicName) gpu.info.pipes.push({ name: 'ASIC Name', data: asicName });

                        const ChipClass = gpuInfo.Info['Chip Class'];
                        if(ChipClass) gpu.info.pipes.push({ name: 'Chip Class', data: ChipClass });

                        const deviceName = gpuInfo.Info.DeviceName;
                        if(deviceName)
                            gpu.info.pipes.push({ name: 'Device Name', data: deviceName });

                        const deviceID = gpuInfo.Info.DeviceID;
                        if(deviceID)
                            gpu.info.pipes.push({ name: 'Device ID', data: deviceID.toString() });

                        const gpuFamily = gpuInfo.Info['GPU Family'];
                        if(gpuFamily) gpu.info.pipes.push({ name: 'GPU Family', data: gpuFamily });

                        const gpuType = gpuInfo.Info['GPU Type'];
                        if(gpuType) gpu.info.pipes.push({ name: 'GPU Type', data: gpuType });

                        const revisionID = gpuInfo.Info.RevisionID;
                        if(revisionID)
                            gpu.info.pipes.push({
                                name: 'Revision ID',
                                data: revisionID.toString(),
                            });

                        const vBios = gpuInfo.Info.VBIOS;
                        if(vBios) {
                            const name = vBios.name ?? '';
                            const date = vBios.date ?? '';
                            const pn = vBios.pn ?? '';
                            const verStr = vBios.ver_str ?? '';

                            const biosData = [];
                            if(name) biosData.push('name: ' + name);
                            if(date) biosData.push('date: ' + date);
                            if(pn) biosData.push('pn: ' + pn);
                            if(verStr) biosData.push('ver: ' + verStr);

                            gpu.info.pipes.push({ name: 'VBIOS', data: biosData.join('\n') });
                        }

                        const drmVersion = gpuInfo.Info.drm_version;
                        if(drmVersion) {
                            const version = [];
                            version.push(drmVersion.major ?? '');
                            version.push(drmVersion.minor ?? '');
                            version.push(drmVersion.patchlevel ?? '');
                            gpu.info.pipes.push({
                                name: 'DRM Version',
                                data: version.join('.'),
                            });
                        }

                        const l1CachePerCU = gpuInfo.Info['L1 Cache per CU'];
                        if(l1CachePerCU)
                            gpu.info.pipes.push({
                                name: 'L1 Cache per CU',
                                data: l1CachePerCU.toString(),
                            });

                        const l2Cache = gpuInfo.Info['L2 Cache'];
                        if(l2Cache)
                            gpu.info.pipes.push({ name: 'L2 Cache', data: l2Cache.toString() });

                        const l3Cache = gpuInfo.Info['L3 Cache'];
                        if(l3Cache)
                            gpu.info.pipes.push({ name: 'L3 Cache', data: l3Cache.toString() });

                        const renderBackend = gpuInfo.Info.RenderBackend;
                        if(renderBackend)
                            gpu.info.pipes.push({
                                name: 'Render Backend',
                                data: renderBackend.toString(),
                            });

                        const shaderEngine = gpuInfo.Info['Shader Engine'];
                        if(shaderEngine)
                            gpu.info.pipes.push({
                                name: 'Shader Engine',
                                data: shaderEngine.toString(),
                            });

                        const resizableBar = gpuInfo.Info.ResizableBAR;
                        if(resizableBar)
                            gpu.info.pipes.push({
                                name: 'Resizable BAR',
                                data: resizableBar.toString(),
                            });

                        const vramBitWidth = gpuInfo.Info['VRAM Bit width'];
                        if(vramBitWidth)
                            gpu.info.pipes.push({
                                name: 'VRAM Bit width',
                                data: vramBitWidth.toString(),
                            });

                        const vramType = gpuInfo.Info['VRAM Type'];
                        if(vramType) gpu.info.pipes.push({ name: 'VRAM Type', data: vramType });

                        const powerProfiles = gpuInfo.Info['Power Profiles'];
                        if(powerProfiles && powerProfiles.length > 0) {
                            const profileData = powerProfiles.join(', ');
                            gpu.info.pipes.push({ name: 'Power Profiles', data: profileData });
                        }

                        const totalComputeUnit = gpuInfo.Info['Total Compute Unit'];
                        if(totalComputeUnit)
                            gpu.info.pipes.push({
                                name: 'Total Compute Unit',
                                data: totalComputeUnit.toString(),
                            });

                        const totalROP = gpuInfo.Info['Total ROP'];
                        if(totalROP)
                            gpu.info.pipes.push({ name: 'Total ROP', data: totalROP.toString() });

                        const gl1CachePerShaderArray = gpuInfo.Info['GL1 Cache per Shader Array'];
                        if(gl1CachePerShaderArray)
                            gpu.info.pipes.push({
                                name: 'GL1 Cache per Shader Array',
                                data: gl1CachePerShaderArray.toString(),
                            });

                        const shaderArrayPerShaderEngine =
                            gpuInfo.Info['Shader Array per Shader Engine'];
                        if(shaderArrayPerShaderEngine)
                            gpu.info.pipes.push({
                                name: 'Shader Array per Shader Engine',
                                data: shaderArrayPerShaderEngine.toString(),
                            });

                        const videoCaps = gpuInfo.Info['Video Caps'];
                        if(videoCaps) {
                            const caps = [];
                            for(const key in videoCaps) {
                                const cap = videoCaps[key];
                                if(cap.Encode || cap.Decode) {
                                    const decenc = [];

                                    if(cap.Decode)
                                        decenc.push(
                                            `[Dec] ${cap.Decode.width}x${cap.Decode.height}`
                                        );
                                    if(cap.Encode)
                                        decenc.push(
                                            `[Enc] ${cap.Encode.width}x${cap.Encode.height}`
                                        );
                                    caps.push(`${key} ${decenc.join(' ')}`);
                                }
                            }
                            gpu.info.pipes.push({ name: 'Video Caps', data: caps.join('\n') });
                        }

                        this.infoPipesCache = gpu.info.pipes;
                        this.infoPipesCacheTime = GLib.get_monotonic_time();
                    }
                }

                // Vram
                if(gpuInfo.VRAM) {
                    const toalData = gpuInfo.VRAM['Total VRAM'];
                    if(toalData && toalData.value && toalData.unit) {
                        const total = Utils.convertToBytes(toalData.value, toalData.unit);
                        if(total >= 0) gpu.vram.total = total;
                    }

                    const usedData = gpuInfo.VRAM['Total VRAM Usage'];
                    if(usedData && usedData.value && usedData.unit) {
                        const used = Utils.convertToBytes(usedData.value, usedData.unit);
                        if(used >= 0) gpu.vram.used = used;
                    }

                    if(gpu.vram.total != null && gpu.vram.used != null)
                        gpu.vram.percent = (gpu.vram.used / gpu.vram.total) * 100;

                    for(const name in gpuInfo.VRAM) {
                        const pipe = gpuInfo.VRAM[name];
                        const usage = gpuInfo.VRAM[name + ' Usage'];

                        if(
                            pipe?.value != null &&
                            pipe.unit &&
                            usage?.value != null &&
                            usage.unit
                        ) {
                            const total = Utils.convertToBytes(pipe.value, pipe.unit);
                            const used = Utils.convertToBytes(usage.value, usage.unit);
                            if(total && used != null)
                                gpu.vram.pipes.push({
                                    name,
                                    percent: (used / total) * 100,
                                    used,
                                    total,
                                });
                        }
                    }
                }

                //Activity
                if(
                    gpuInfo.gpu_activity?.GFX?.value != null &&
                    gpuInfo.gpu_activity.GFX.unit === '%'
                ) {
                    const GFX = gpuInfo.gpu_activity.GFX.value;
                    if(typeof GFX === 'string') gpu.activity.GFX = parseFloat(GFX);
                    else gpu.activity.GFX = GFX;
                } else if(
                    gpuInfo.GRBM?.['Graphics Pipe']?.value != null &&
                    gpuInfo.GRBM['Graphics Pipe'].unit === '%'
                ) {
                    const gfx = gpuInfo.GRBM!['Graphics Pipe'].value;
                    if(typeof gfx === 'string') gpu.activity.GFX = parseFloat(gfx);
                    else gpu.activity.GFX = gfx;
                }

                if(gpuInfo.GRBM) {
                    for(const name in gpuInfo.GRBM) {
                        const pipe = gpuInfo.GRBM[name];
                        if(pipe?.value != null && pipe.unit === '%') {
                            const percent = pipe.value;
                            if(!isNaN(percent)) gpu.activity.pipes.push({ name, percent });
                        }
                    }
                }

                if(gpuInfo.GRBM2) {
                    for(const name in gpuInfo.GRBM2) {
                        const pipe = gpuInfo.GRBM2[name];
                        if(pipe?.value != null && pipe.unit === '%') {
                            const percent = pipe.value;
                            if(!isNaN(percent)) gpu.activity.pipes.push({ name, percent });
                        }
                    }
                }

                //Top Processes
                if(gpuInfo.fdinfo) {
                    for(const pid in gpuInfo.fdinfo) {
                        const process = gpuInfo.fdinfo[pid];
                        if(process?.name) {
                            const topProcess = {
                                name: process.name,
                                pid: parseInt(pid),
                                pipes: [] as any[],
                            };

                            for(const name in process.usage) {
                                const pipe = process.usage[name];
                                if(pipe && pipe.value != null && pipe.unit) {
                                    let value = pipe.value;
                                    let unit = pipe.unit;

                                    if(unit !== '%') {
                                        value = Utils.convertToBytes(value, unit);
                                        unit = 'B';
                                        if(value < 0) continue;
                                    }

                                    if(!isNaN(value)) {
                                        topProcess.pipes.push({ name, value, unit });
                                    }
                                }
                            }

                            // Order pipes
                            const defaultOrder = [
                                'GFX',
                                'VRAM',
                                'GTT',
                                'Compute',
                                'Media',
                                'Encode',
                                'Decode',
                                'DMA',
                                'CPU',
                            ];
                            topProcess.pipes.sort((a, b) => {
                                let aIndex = defaultOrder.indexOf(a.name);
                                if(aIndex < 0) aIndex = defaultOrder.length;
                                let bIndex = defaultOrder.indexOf(b.name);
                                if(bIndex < 0) bIndex = defaultOrder.length;
                                return aIndex - bIndex;
                            });

                            gpu.topProcesses.push(topProcess);
                        }
                    }

                    // Order by points giving for every % usage these points:
                    // GFX: 10, VRAM: 5, GTT: 3, Compute: 2, Media: 2, Encode: 1, Decode: 1, DMA: 1

                    const totalVram = gpu.vram.total;
                    const totalGtt: number | null = gpuInfo.Info?.['GTT Size'] ?? null;

                    gpu.topProcesses.sort((a, b) => {
                        let aPoints = 0;
                        let bPoints = 0;

                        const calculatePoints = (pipe: any) => {
                            if(pipe.name === 'GFX' && pipe.unit === '%' && pipe.value)
                                return pipe.value * 10;
                            if(
                                pipe.name === 'VRAM' &&
                                pipe.unit !== '%' &&
                                pipe.value &&
                                totalVram
                            )
                                return (pipe.value / totalVram) * 5;
                            if(pipe.name === 'GTT' && pipe.unit !== '%' && pipe.value && totalGtt)
                                return (pipe.value / totalGtt) * 3;
                            if(pipe.name === 'Compute' && pipe.unit === '%' && pipe.value)
                                return pipe.value * 2;
                            if(pipe.name === 'Media' && pipe.unit === '%' && pipe.value)
                                return pipe.value * 2;
                            if(pipe.name === 'Encode' && pipe.unit === '%' && pipe.value)
                                return pipe.value * 1;
                            if(pipe.name === 'Decode' && pipe.unit === '%' && pipe.value)
                                return pipe.value * 1;
                            if(pipe.name === 'DMA' && pipe.unit === '%' && pipe.value)
                                return pipe.value * 1;
                            return 0;
                        };

                        for(const pipe of a.pipes) {
                            aPoints += calculatePoints(pipe);
                        }

                        for(const pipe of b.pipes) {
                            bPoints += calculatePoints(pipe);
                        }

                        return bPoints - aPoints;
                    });
                }

                // Sensors
                const getOrAddCategory = (name: string) => {
                    let category = gpu.sensors.categories.find(c => c.name === name);
                    if(category) return category;

                    category = { name, sensors: [] };
                    gpu.sensors.categories.push(category);
                    return category;
                };
                const addSensor = ({
                    category,
                    name,
                    value,
                    unit,
                    priority,
                }: { category: string } & GpuSensor) => {
                    const sensor = { name, value, unit, priority };
                    getOrAddCategory(category).sensors.push(sensor);
                    gpu.sensors.list?.push(sensor);
                };

                if(gpuInfo.Sensors) {
                    for(let name in gpuInfo.Sensors) {
                        const sensor = gpuInfo.Sensors[name];
                        if(sensor?.value != null && sensor.unit) {
                            const value = sensor.value;
                            const unit = sensor.unit;

                            if(!isNaN(value)) {
                                let category = 'Generic';
                                if(unit === 'W' || unit === 'mW' || unit === 'V' || unit === 'mV')
                                    category = 'Power';
                                else if(unit === 'MHz') category = 'Clocks';
                                else if(unit === 'RPM') category = 'Fan Speed';
                                else if(
                                    unit === 'C' ||
                                    unit === '°C' ||
                                    unit === 'F' ||
                                    unit === '°F'
                                )
                                    category = 'Temperature';

                                let priority = GpuSensorPriority.NONE;
                                if(name === 'GFX_SCLK') priority = GpuSensorPriority.MAX;
                                else if(name === 'GFX Power') priority = GpuSensorPriority.HIGH;
                                else if(name === 'Fan') priority = GpuSensorPriority.MEDIUM;
                                else if(name === 'Junction Temperature')
                                    priority = GpuSensorPriority.LOW;

                                if(name === 'GFX_SCLK') name = 'GPU Clock';
                                if(name === 'GFX_MCLK') name = 'Memory Clock';

                                addSensor({ category, name, value, unit, priority });
                            }
                        } else if(name === 'PCIe Link Speed' && sensor?.gen && sensor?.width) {
                            addSensor({
                                category: 'PCIe Link',
                                name: 'PCIe Link Speed',
                                value: `Gen${sensor.gen}x${sensor.width}`,
                                unit: '',
                                priority: GpuSensorPriority.NONE,
                            });
                        }
                    }
                }
                if(gpuInfo.Info) {
                    const gpuClock = gpuInfo.Info['GPU Clock'];
                    if(gpuClock) {
                        if(gpuClock.min != null) {
                            addSensor({
                                category: 'Clocks',
                                name: 'GPU Clock Min',
                                value: gpuClock.min,
                                unit: 'MHz',
                                priority: GpuSensorPriority.NONE,
                            });
                        }
                        if(gpuClock.max != null) {
                            addSensor({
                                category: 'Clocks',
                                name: 'GPU Clock Max',
                                value: gpuClock.max,
                                unit: 'MHz',
                                priority: GpuSensorPriority.NONE,
                            });
                        }
                    }

                    const memoryClock = gpuInfo.Info['Memory Clock'];
                    if(memoryClock) {
                        if(memoryClock.min != null) {
                            addSensor({
                                category: 'Clocks',
                                name: 'Memory Clock Min',
                                value: memoryClock.min,
                                unit: 'MHz',
                                priority: GpuSensorPriority.NONE,
                            });
                        }
                        if(memoryClock.max != null) {
                            addSensor({
                                category: 'Clocks',
                                name: 'Memory Clock Max',
                                value: memoryClock.max,
                                unit: 'MHz',
                                priority: GpuSensorPriority.NONE,
                            });
                        }
                    }

                    const pcieLink = gpuInfo.Info['PCIe Link'];
                    if(pcieLink) {
                        if(
                            pcieLink.min_dpm_link &&
                            pcieLink.min_dpm_link.gen != null &&
                            pcieLink.min_dpm_link.width != null
                        ) {
                            addSensor({
                                category: 'PCIe Link',
                                name: 'Min DPM Link',
                                value: `Gen${pcieLink.min_dpm_link.gen}x${pcieLink.min_dpm_link.width}`,
                                unit: '',
                                priority: GpuSensorPriority.NONE,
                            });
                        }
                        if(
                            pcieLink.max_dpm_link &&
                            pcieLink.max_dpm_link.gen != null &&
                            pcieLink.max_dpm_link.width != null
                        ) {
                            addSensor({
                                category: 'PCIe Link',
                                name: 'Max DPM Link',
                                value: `Gen${pcieLink.max_dpm_link.gen}x${pcieLink.max_dpm_link.width}`,
                                unit: '',
                                priority: GpuSensorPriority.NONE,
                            });
                        }
                        if(
                            pcieLink.max_gpu_link &&
                            pcieLink.max_gpu_link.gen != null &&
                            pcieLink.max_gpu_link.width != null
                        ) {
                            addSensor({
                                category: 'PCIe Link',
                                name: 'Max GPU Link',
                                value: `Gen${pcieLink.max_gpu_link.gen}x${pcieLink.max_gpu_link.width}`,
                                unit: '',
                                priority: GpuSensorPriority.NONE,
                            });
                        }
                        if(
                            pcieLink.max_system_link &&
                            pcieLink.max_system_link.gen != null &&
                            pcieLink.max_system_link.width != null
                        ) {
                            addSensor({
                                category: 'PCIe Link',
                                name: 'Max System Link',
                                value: `Gen${pcieLink.max_system_link.gen}x${pcieLink.max_system_link.width}`,
                                unit: '',
                                priority: GpuSensorPriority.NONE,
                            });
                        }
                    }

                    const powerCap = gpuInfo.Info['Power Cap'];
                    if(powerCap) {
                        if(powerCap.current != null) {
                            addSensor({
                                category: 'Power',
                                name: 'Power Cap',
                                value: powerCap.current,
                                unit: 'W',
                                priority: GpuSensorPriority.NONE,
                            });
                        }

                        if(powerCap.min != null) {
                            addSensor({
                                category: 'Power',
                                name: 'Power Cap Min',
                                value: powerCap.min,
                                unit: 'W',
                                priority: GpuSensorPriority.NONE,
                            });
                        }

                        if(powerCap.max != null) {
                            addSensor({
                                category: 'Power',
                                name: 'Power Cap Max',
                                value: powerCap.max,
                                unit: 'W',
                                priority: GpuSensorPriority.NONE,
                            });
                        }
                    }
                }

                // Sensors Sorting
                for(const category of gpu.sensors.categories) {
                    category.sensors.sort((a, b) => {
                        if(a.priority === b.priority) return 0;
                        return a.priority > b.priority ? -1 : 1;
                    });
                }
                gpu.sensors.list?.sort((a, b) => {
                    if(a.priority === b.priority) return 0;
                    return a.priority > b.priority ? -1 : 1;
                });
                gpu.sensors.categories.sort((a, b) => {
                    const maxPriorityA = a.sensors.length ? a.sensors[0].priority : 0;
                    const maxPriorityB = b.sensors.length ? b.sensors[0].priority : 0;
                    if(maxPriorityA === maxPriorityB) return 0;
                    return maxPriorityA > maxPriorityB ? -1 : 1;
                });

                gpus.set(id, gpu);
            }

            this.pushUsageHistory('gpu', gpus);
            this.notify('gpuUpdate', gpus);
        } catch(e: any) {
            Utils.error(`updateAmdGpu: ${e.message}`);
        }
    }

    updateNvidiaGpu(data: ContinuosTaskManagerData) {
        if(data.exit || !data.result) return;

        try {
            const xml = Utils.xmlParse(data.result);

            if(!xml.nvidia_smi_log) return;

            let gpuInfoList: NvidiaInfoRaw[] = xml.nvidia_smi_log.gpu;
            if(!gpuInfoList || gpuInfoList.length === 0) return;

            if(!Array.isArray(gpuInfoList)) gpuInfoList = [gpuInfoList];

            const gpus = new Map<string, any>();

            for(const gpuInfo of gpuInfoList) {
                if(!gpuInfo['@id']) continue;

                let id = gpuInfo['@id'];
                if(id.startsWith('00000000:')) id = id.slice(4);

                const gpu: NvidiaInfo = {
                    id,
                    family: 'NVIDIA',
                    info: { pipes: [] },
                    vram: { pipes: [] },
                    activity: { pipes: [] },
                    topProcesses: [],
                    sensors: { categories: [], list: [] },
                    raw: gpuInfo,
                };

                //Info
                // Use cache if it's been update in the last 10 minutes
                if(
                    this.infoPipesCache &&
                    GLib.get_monotonic_time() - this.infoPipesCacheTime < 600000
                ) {
                    gpu.info.pipes = this.infoPipesCache;
                } else {
                    const productName = GpuMonitor.nvidiaToGenericField(gpuInfo.product_name, true);
                    if(productName && productName.text)
                        gpu.info.pipes.push({
                            name: 'Product Name',
                            data: productName.text,
                        });

                    const productBrand = GpuMonitor.nvidiaToGenericField(
                        gpuInfo.product_brand,
                        true
                    );
                    if(productBrand && productBrand.text)
                        gpu.info.pipes.push({
                            name: 'Product Brand',
                            data: productBrand.text,
                        });

                    const productArchitecture = GpuMonitor.nvidiaToGenericField(
                        gpuInfo.product_architecture,
                        true
                    );
                    if(productArchitecture && productArchitecture.text)
                        gpu.info.pipes.push({
                            name: 'Product Architecture',
                            data: productArchitecture.text,
                        });

                    const displayMode = GpuMonitor.nvidiaToGenericField(gpuInfo.display_mode, true);
                    if(displayMode && displayMode.text)
                        gpu.info.pipes.push({
                            name: 'Display Mode',
                            data: displayMode.text,
                        });

                    const displayActive = GpuMonitor.nvidiaToGenericField(
                        gpuInfo.display_active,
                        true
                    );
                    if(displayActive && displayActive.text)
                        gpu.info.pipes.push({
                            name: 'Display Active',
                            data: displayActive.text,
                        });

                    const persistenceMode = GpuMonitor.nvidiaToGenericField(
                        gpuInfo.persistence_mode,
                        true
                    );
                    if(persistenceMode && persistenceMode.text)
                        gpu.info.pipes.push({
                            name: 'Persistence Mode',
                            data: persistenceMode.text,
                        });

                    const addressingMode = GpuMonitor.nvidiaToGenericField(
                        gpuInfo.addressing_mode,
                        true
                    );
                    if(addressingMode && addressingMode.text)
                        gpu.info.pipes.push({
                            name: 'Addressing Mode',
                            data: addressingMode.text,
                        });

                    const migDevices = GpuMonitor.nvidiaToGenericField(gpuInfo.mig_devices, true);
                    if(migDevices && migDevices.text)
                        gpu.info.pipes.push({
                            name: 'Mig Devices',
                            data: migDevices.text,
                        });

                    const accountingMode = GpuMonitor.nvidiaToGenericField(
                        gpuInfo.accounting_mode,
                        true
                    );
                    if(accountingMode && accountingMode.text)
                        gpu.info.pipes.push({
                            name: 'Accounting Mode',
                            data: accountingMode.text,
                        });

                    const accountingModeBufferSize = GpuMonitor.nvidiaToGenericField(
                        gpuInfo.accounting_mode_buffer_size,
                        true
                    );
                    if(accountingModeBufferSize && accountingModeBufferSize.text)
                        gpu.info.pipes.push({
                            name: 'Accounting Mode Buffer Size',
                            data: accountingModeBufferSize.text,
                        });

                    const serial = GpuMonitor.nvidiaToGenericField(gpuInfo.serial, true);
                    if(serial && serial.text)
                        gpu.info.pipes.push({ name: 'Serial', data: serial.text });

                    const uuid = GpuMonitor.nvidiaToGenericField(gpuInfo.uuid, true);
                    if(uuid && uuid.text) gpu.info.pipes.push({ name: 'UUID', data: uuid.text });

                    const minorNumber = GpuMonitor.nvidiaToGenericField(gpuInfo.minor_number, true);
                    if(minorNumber && minorNumber.text)
                        gpu.info.pipes.push({
                            name: 'Minor Number',
                            data: minorNumber.text,
                        });

                    const vbiosVersion = GpuMonitor.nvidiaToGenericField(
                        gpuInfo.vbios_version,
                        true
                    );
                    if(vbiosVersion && vbiosVersion.text)
                        gpu.info.pipes.push({
                            name: 'VBIOS Version',
                            data: vbiosVersion.text,
                        });

                    const multigpuBoard = GpuMonitor.nvidiaToGenericField(
                        gpuInfo.multigpu_board,
                        true
                    );
                    if(multigpuBoard && multigpuBoard.text)
                        gpu.info.pipes.push({
                            name: 'Multigpu Board',
                            data: multigpuBoard.text,
                        });

                    const boardId = GpuMonitor.nvidiaToGenericField(gpuInfo.board_id, true);
                    if(boardId && boardId.text)
                        gpu.info.pipes.push({ name: 'Board ID', data: boardId.text });

                    const boardPartNumber = GpuMonitor.nvidiaToGenericField(
                        gpuInfo.board_part_number,
                        true
                    );
                    if(boardPartNumber && boardPartNumber.text)
                        gpu.info.pipes.push({
                            name: 'Board Part Number',
                            data: boardPartNumber.text,
                        });

                    const gpuPartNumber = GpuMonitor.nvidiaToGenericField(
                        gpuInfo.gpu_part_number,
                        true
                    );
                    if(gpuPartNumber && gpuPartNumber.text)
                        gpu.info.pipes.push({
                            name: 'GPU Part Number',
                            data: gpuPartNumber.text,
                        });

                    const gpuFruPartNumber = GpuMonitor.nvidiaToGenericField(
                        gpuInfo.gpu_fru_part_number,
                        true
                    );
                    if(gpuFruPartNumber && gpuFruPartNumber.text)
                        gpu.info.pipes.push({
                            name: 'GPU FRU Part Number',
                            data: gpuFruPartNumber.text,
                        });

                    const gpuModuleId = GpuMonitor.nvidiaToGenericField(
                        gpuInfo.gpu_module_id,
                        true
                    );
                    if(gpuModuleId && gpuModuleId.text)
                        gpu.info.pipes.push({
                            name: 'GPU Module ID',
                            data: gpuModuleId.text,
                        });

                    if(gpuInfo.inforom_version) {
                        const imgVersion = GpuMonitor.nvidiaToGenericField(
                            gpuInfo.inforom_version.img_version,
                            true
                        );
                        const oemObject = GpuMonitor.nvidiaToGenericField(
                            gpuInfo.inforom_version.oem_object,
                            true
                        );
                        const eccObject = GpuMonitor.nvidiaToGenericField(
                            gpuInfo.inforom_version.ecc_object,
                            true
                        );
                        const pwrObject = GpuMonitor.nvidiaToGenericField(
                            gpuInfo.inforom_version.pwr_object,
                            true
                        );

                        if(imgVersion || oemObject || eccObject || pwrObject) {
                            const name = 'Inforom Version';
                            const romData = [];
                            if(imgVersion && imgVersion.text)
                                romData.push(`Img: ${imgVersion.text}`);
                            if(oemObject && oemObject.text) romData.push(`OEM: ${oemObject.text}`);
                            if(eccObject && eccObject.text) romData.push(`ECC: ${eccObject.text}`);
                            if(pwrObject && pwrObject.text) romData.push(`PWR: ${pwrObject.text}`);
                            gpu.info.pipes.push({ name, data: romData.join('\n') });
                        }

                        const gspFirmwareVersion = GpuMonitor.nvidiaToGenericField(
                            gpuInfo.gsp_firmware_version,
                            true
                        );
                        if(gspFirmwareVersion && gspFirmwareVersion.text)
                            gpu.info.pipes.push({
                                name: 'GSP Firmware Version',
                                data: gspFirmwareVersion.text,
                            });

                        if(gpuInfo.gpu_virtualization_mode) {
                            const virtualizationMode = GpuMonitor.nvidiaToGenericField(
                                gpuInfo.gpu_virtualization_mode.virtualization_mode,
                                true
                            );
                            const hostVgpuMode = GpuMonitor.nvidiaToGenericField(
                                gpuInfo.gpu_virtualization_mode.host_vgpu_mode,
                                true
                            );

                            if(virtualizationMode && virtualizationMode.text)
                                gpu.info.pipes.push({
                                    name: 'Virtualization Mode',
                                    data: virtualizationMode.text,
                                });
                            if(hostVgpuMode && hostVgpuMode.text)
                                gpu.info.pipes.push({
                                    name: 'Host VGPU Mode',
                                    data: hostVgpuMode.text,
                                });
                        }

                        const computeMode = GpuMonitor.nvidiaToGenericField(
                            gpuInfo.compute_mode,
                            true
                        );
                        if(computeMode && computeMode.text)
                            gpu.info.pipes.push({
                                name: 'Compute Mode',
                                data: computeMode.text,
                            });
                    }
                }

                // Vram
                if(gpuInfo.fb_memory_usage) {
                    const toalData = GpuMonitor.nvidiaToGenericField(gpuInfo.fb_memory_usage.total);
                    if(toalData && toalData.value && toalData.unit)
                        gpu.vram.total = Utils.convertToBytes(toalData.value, toalData.unit);

                    const usedData = GpuMonitor.nvidiaToGenericField(gpuInfo.fb_memory_usage.used);
                    if(usedData && usedData.value != null && usedData.unit)
                        gpu.vram.used = Utils.convertToBytes(usedData.value, usedData.unit);

                    if(gpu.vram.total !== undefined && gpu.vram.used !== undefined) {
                        gpu.vram.percent = (gpu.vram.used / gpu.vram.total) * 100;
                        gpu.vram.pipes.push({
                            name: 'FB Memory Usage',
                            percent: gpu.vram.percent,
                            used: gpu.vram.used,
                            total: gpu.vram.total,
                        });
                    }
                }

                if(gpuInfo.bar1_memory_usage) {
                    let total: number | undefined;
                    let used: number | undefined;

                    const toalData = GpuMonitor.nvidiaToGenericField(
                        gpuInfo.bar1_memory_usage.total
                    );
                    if(toalData && toalData.value && toalData.unit)
                        total = Utils.convertToBytes(toalData.value, toalData.unit);

                    const usedData = GpuMonitor.nvidiaToGenericField(
                        gpuInfo.bar1_memory_usage.used
                    );
                    if(usedData && usedData.value != null && usedData.unit)
                        used = Utils.convertToBytes(usedData.value, usedData.unit);

                    if(total && used != null)
                        gpu.vram.pipes.push({
                            name: 'Bar1 Memory Usage',
                            percent: (used / total) * 100,
                            used,
                            total,
                        });
                }

                if(gpuInfo.cc_protected_memory_usage) {
                    let total: number | undefined;
                    let used: number | undefined;

                    const toalData = GpuMonitor.nvidiaToGenericField(
                        gpuInfo.cc_protected_memory_usage.total
                    );
                    if(toalData && toalData.value && toalData.unit)
                        total = Utils.convertToBytes(toalData.value, toalData.unit);

                    const usedData = GpuMonitor.nvidiaToGenericField(
                        gpuInfo.cc_protected_memory_usage.used
                    );
                    if(usedData && usedData.value != null && usedData.unit)
                        used = Utils.convertToBytes(usedData.value, usedData.unit);

                    if(total && used != null)
                        gpu.vram.pipes.push({
                            name: 'CC Protected Memory Usage',
                            percent: (used / total) * 100,
                            used,
                            total,
                        });
                }

                //Activity
                if(gpuInfo.utilization) {
                    for(const key in gpuInfo.utilization) {
                        const field = GpuMonitor.nvidiaToGenericField(gpuInfo.utilization[key]);
                        if(field && field.value != null && field.unit === '%') {
                            if(key === 'gpu_util') gpu.activity.GFX = field.value;
                            const name = Utils.capitalize(key.replace('_util', ''));
                            const percent = field.value;
                            gpu.activity.pipes.push({ name, percent });
                        }
                    }
                }

                //Top Processes
                if(gpuInfo.processes && gpuInfo.processes.process_info) {
                    for(const process of gpuInfo.processes.process_info) {
                        const usedMemory = GpuMonitor.nvidiaToGenericField(process.used_memory);
                        if(!usedMemory || usedMemory.value == null || !usedMemory.unit) continue;

                        const processName = GpuMonitor.nvidiaToGenericField(
                            process.process_name,
                            true
                        );
                        if(!processName || !processName.text) continue;

                        const pid = GpuMonitor.nvidiaToGenericField(process.pid);
                        if(!pid || pid.value == null) continue;

                        const topProcess = {
                            name: Utils.extractCommandName(processName.text),
                            pid: pid.value,
                            pipes: [
                                {
                                    name: 'Used Memory',
                                    value: Utils.convertToBytes(usedMemory.value, usedMemory.unit),
                                    unit: 'B',
                                },
                            ],
                        };

                        gpu.topProcesses.push(topProcess);
                    }

                    // Order by points giving for every % usage these points:
                    // Used Memory: 1

                    const totalMemory = gpu.vram.total;

                    gpu.topProcesses.sort((a, b) => {
                        let aPoints = 0;
                        let bPoints = 0;

                        const calculatePoints = (pipe: any) => {
                            if(
                                pipe.name === 'Used Memory' &&
                                pipe.unit !== '%' &&
                                pipe.value &&
                                totalMemory
                            )
                                return pipe.value / totalMemory;
                            return 0;
                        };

                        for(const pipe of a.pipes) {
                            aPoints = calculatePoints(pipe);
                        }

                        for(const pipe of b.pipes) {
                            bPoints = calculatePoints(pipe);
                        }

                        return bPoints - aPoints;
                    });
                }

                // Sensors
                const getOrAddCategory = (name: string) => {
                    let category = gpu.sensors.categories.find(c => c.name === name);
                    if(category) return category;

                    category = { name, sensors: [] };
                    gpu.sensors.categories.push(category);
                    return category;
                };
                const addSensor = ({
                    category,
                    name,
                    value,
                    unit,
                    priority,
                }: { category: string } & GpuSensor) => {
                    const sensor = { name, value, unit, priority };
                    getOrAddCategory(category).sensors.push(sensor);
                    gpu.sensors.list?.push(sensor);
                };

                if(gpuInfo.pci) {
                    if(gpuInfo.pci.pci_gpu_link_info && gpuInfo.pci.link_widths) {
                        const maxLinkGen = GpuMonitor.nvidiaToGenericField(
                            gpuInfo.pci.pci_gpu_link_info.max_link_gen
                        );
                        const maxLinkWidth = GpuMonitor.nvidiaToGenericField(
                            gpuInfo.pci.link_widths.max_link_width
                        );
                        if(maxLinkGen && maxLinkWidth && maxLinkGen.value && maxLinkWidth.value) {
                            addSensor({
                                category: 'PCIe Link',
                                name: 'PCIe Max Link',
                                value: `Gen${maxLinkGen.value}x${maxLinkWidth.value}`,
                                unit: '',
                                priority: GpuSensorPriority.NONE,
                            });
                        }

                        const currentLinkGen = GpuMonitor.nvidiaToGenericField(
                            gpuInfo.pci.pci_gpu_link_info.current_link_gen
                        );
                        const currentLinkWidth = GpuMonitor.nvidiaToGenericField(
                            gpuInfo.pci.link_widths.current_link_width
                        );

                        if(
                            currentLinkGen &&
                            currentLinkWidth &&
                            currentLinkGen.value &&
                            currentLinkWidth.value
                        ) {
                            addSensor({
                                category: 'PCIe Link',
                                name: 'PCIe Current Link',
                                value: `Gen${currentLinkGen.value}x${currentLinkWidth.value}`,
                                unit: '',
                                priority: GpuSensorPriority.NONE,
                            });
                        }

                        const deviceCurrentLinkGen = GpuMonitor.nvidiaToGenericField(
                            gpuInfo.pci.pci_gpu_link_info.device_current_link_gen
                        );
                        if(deviceCurrentLinkGen && deviceCurrentLinkGen.value) {
                            addSensor({
                                category: 'PCIe Link',
                                name: 'Device Current Link Gen',
                                value: `Gen${deviceCurrentLinkGen.value}`,
                                unit: '',
                                priority: GpuSensorPriority.NONE,
                            });
                        }

                        const deviceCurrentLinkWidth = GpuMonitor.nvidiaToGenericField(
                            gpuInfo.pci.link_widths.current_link_width
                        );
                        if(deviceCurrentLinkWidth && deviceCurrentLinkWidth.value) {
                            addSensor({
                                category: 'PCIe Link',
                                name: 'Device Current Link Width',
                                value: `x${deviceCurrentLinkWidth.value}`,
                                unit: '',
                                priority: GpuSensorPriority.NONE,
                            });
                        }
                    }

                    const txUtil = GpuMonitor.nvidiaToGenericField(gpuInfo.pci.tx_util);
                    if(txUtil && txUtil.value && txUtil.unit) {
                        addSensor({
                            category: 'PCIe Link',
                            name: 'TX Util',
                            value: txUtil.value,
                            unit: txUtil.unit,
                            priority: GpuSensorPriority.NONE,
                        });
                    }

                    const rxUtil = GpuMonitor.nvidiaToGenericField(gpuInfo.pci.rx_util);
                    if(rxUtil && rxUtil.value && rxUtil.unit) {
                        addSensor({
                            category: 'PCIe Link',
                            name: 'RX Util',
                            value: rxUtil.value,
                            unit: rxUtil.unit,
                            priority: GpuSensorPriority.NONE,
                        });
                    }
                }

                const fanSpeed = GpuMonitor.nvidiaToGenericField(gpuInfo.fan_speed);
                if(fanSpeed && fanSpeed.value != null && fanSpeed.unit) {
                    addSensor({
                        category: 'Fan Speed',
                        name: 'Fan',
                        value: fanSpeed.value,
                        unit: fanSpeed.unit,
                        priority: GpuSensorPriority.MEDIUM,
                    });
                }

                if(gpuInfo.temperature) {
                    const gpuTemp = GpuMonitor.nvidiaToGenericField(gpuInfo.temperature.gpu_temp);
                    if(gpuTemp && gpuTemp.value != null && gpuTemp.unit) {
                        addSensor({
                            category: 'Temperature',
                            name: 'GPU Temp',
                            value: gpuTemp.value,
                            unit: gpuTemp.unit,
                            priority: GpuSensorPriority.NONE,
                        });
                    }

                    const gpuTempMax = GpuMonitor.nvidiaToGenericField(
                        gpuInfo.temperature.gpu_temp_max_threshold
                    );
                    if(gpuTempMax && gpuTempMax.value != null && gpuTempMax.unit) {
                        addSensor({
                            category: 'Temperature',
                            name: 'GPU Temp Max',
                            value: gpuTempMax.value,
                            unit: gpuTempMax.unit,
                            priority: GpuSensorPriority.NONE,
                        });
                    }

                    const gpuTempSlow = GpuMonitor.nvidiaToGenericField(
                        gpuInfo.temperature.gpu_temp_slow_threshold
                    );
                    if(gpuTempSlow && gpuTempSlow.value != null && gpuTempSlow.unit) {
                        addSensor({
                            category: 'Temperature',
                            name: 'GPU Temp Throttle',
                            value: gpuTempSlow.value,
                            unit: gpuTempSlow.unit,
                            priority: GpuSensorPriority.NONE,
                        });
                    }

                    const gpuTargetTemp = GpuMonitor.nvidiaToGenericField(
                        gpuInfo.temperature.gpu_target_temperature
                    );
                    if(gpuTargetTemp && gpuTargetTemp.value != null && gpuTargetTemp.unit) {
                        addSensor({
                            category: 'Temperature',
                            name: 'GPU Target Temp',
                            value: gpuTargetTemp.value,
                            unit: gpuTargetTemp.unit,
                            priority: GpuSensorPriority.NONE,
                        });
                    }

                    const memoryTemp = GpuMonitor.nvidiaToGenericField(
                        gpuInfo.temperature.memory_temp
                    );
                    if(memoryTemp && memoryTemp.value != null && memoryTemp.unit) {
                        addSensor({
                            category: 'Temperature',
                            name: 'Memory Temp',
                            value: memoryTemp.value,
                            unit: memoryTemp.unit,
                            priority: GpuSensorPriority.NONE,
                        });
                    }

                    const gpuTempMaxMem = GpuMonitor.nvidiaToGenericField(
                        gpuInfo.temperature.gpu_temp_max_mem_threshold
                    );
                    if(gpuTempMaxMem && gpuTempMaxMem.value != null && gpuTempMaxMem.unit) {
                        addSensor({
                            category: 'Temperature',
                            name: 'Memory Temp Max',
                            value: gpuTempMaxMem.value,
                            unit: gpuTempMaxMem.unit,
                            priority: GpuSensorPriority.NONE,
                        });
                    }
                }

                if(gpuInfo.gpu_power_readings) {
                    const powerState = GpuMonitor.nvidiaToGenericField(
                        gpuInfo.gpu_power_readings.power_state,
                        true
                    );
                    if(powerState && powerState.text) {
                        addSensor({
                            category: 'Power',
                            name: 'Power State',
                            value: powerState.text,
                            unit: '',
                            priority: GpuSensorPriority.NONE,
                        });
                    }

                    const powerDraw = GpuMonitor.nvidiaToGenericField(
                        gpuInfo.gpu_power_readings.power_draw
                    );
                    if(powerDraw && powerDraw.value != null && powerDraw.unit) {
                        addSensor({
                            category: 'Power',
                            name: 'Power Draw',
                            value: powerDraw.value,
                            unit: powerDraw.unit,
                            priority: GpuSensorPriority.HIGH,
                        });
                    }

                    const currentPowerLimit = GpuMonitor.nvidiaToGenericField(
                        gpuInfo.gpu_power_readings.current_power_limit
                    );
                    if(
                        currentPowerLimit &&
                        currentPowerLimit.value != null &&
                        currentPowerLimit.unit
                    ) {
                        addSensor({
                            category: 'Power',
                            name: 'Current Power Limit',
                            value: currentPowerLimit.value,
                            unit: currentPowerLimit.unit,
                            priority: GpuSensorPriority.NONE,
                        });
                    }

                    const requestedPowerLimit = GpuMonitor.nvidiaToGenericField(
                        gpuInfo.gpu_power_readings.requested_power_limit
                    );
                    if(
                        requestedPowerLimit &&
                        requestedPowerLimit.value != null &&
                        requestedPowerLimit.unit
                    ) {
                        addSensor({
                            category: 'Power',
                            name: 'Requested Power Limit',
                            value: requestedPowerLimit.value,
                            unit: requestedPowerLimit.unit,
                            priority: GpuSensorPriority.NONE,
                        });
                    }

                    const defaultPowerLimit = GpuMonitor.nvidiaToGenericField(
                        gpuInfo.gpu_power_readings.default_power_limit
                    );
                    if(
                        defaultPowerLimit &&
                        defaultPowerLimit.value != null &&
                        defaultPowerLimit.unit
                    ) {
                        addSensor({
                            category: 'Power',
                            name: 'Default Power Limit',
                            value: defaultPowerLimit.value,
                            unit: defaultPowerLimit.unit,
                            priority: GpuSensorPriority.NONE,
                        });
                    }

                    const minPowerLimit = GpuMonitor.nvidiaToGenericField(
                        gpuInfo.gpu_power_readings.min_power_limit
                    );
                    if(minPowerLimit && minPowerLimit.value != null && minPowerLimit.unit) {
                        addSensor({
                            category: 'Power',
                            name: 'Min Power Limit',
                            value: minPowerLimit.value,
                            unit: minPowerLimit.unit,
                            priority: GpuSensorPriority.NONE,
                        });
                    }

                    const maxPowerLimit = GpuMonitor.nvidiaToGenericField(
                        gpuInfo.gpu_power_readings.max_power_limit
                    );
                    if(maxPowerLimit && maxPowerLimit.value != null && maxPowerLimit.unit) {
                        addSensor({
                            category: 'Power',
                            name: 'Max Power Limit',
                            value: maxPowerLimit.value,
                            unit: maxPowerLimit.unit,
                            priority: GpuSensorPriority.NONE,
                        });
                    }
                }

                if(gpuInfo.clocks) {
                    const gpuClock = GpuMonitor.nvidiaToGenericField(gpuInfo.clocks.graphics_clock);
                    if(gpuClock && gpuClock.value != null && gpuClock.unit) {
                        addSensor({
                            category: 'Clocks',
                            name: 'GPU Clock',
                            value: gpuClock.value,
                            unit: gpuClock.unit,
                            priority: GpuSensorPriority.MAX,
                        });
                    }

                    const gpuMaxClock = GpuMonitor.nvidiaToGenericField(
                        gpuInfo.max_clocks?.graphics_clock
                    );
                    if(gpuMaxClock && gpuMaxClock.value != null && gpuMaxClock.unit) {
                        addSensor({
                            category: 'Clocks',
                            name: 'GPU Max Clock',
                            value: gpuMaxClock.value,
                            unit: gpuMaxClock.unit,
                            priority: GpuSensorPriority.NONE,
                        });
                    }

                    const smClock = GpuMonitor.nvidiaToGenericField(gpuInfo.clocks.sm_clock);
                    if(smClock && smClock.value != null && smClock.unit) {
                        addSensor({
                            category: 'Clocks',
                            name: 'SM Clock',
                            value: smClock.value,
                            unit: smClock.unit,
                            priority: GpuSensorPriority.NONE,
                        });
                    }

                    const smMaxClock = GpuMonitor.nvidiaToGenericField(
                        gpuInfo.max_clocks?.sm_clock
                    );
                    if(smMaxClock && smMaxClock.value != null && smMaxClock.unit) {
                        addSensor({
                            category: 'Clocks',
                            name: 'SM Max Clock',
                            value: smMaxClock.value,
                            unit: smMaxClock.unit,
                            priority: GpuSensorPriority.NONE,
                        });
                    }

                    const memoryClock = GpuMonitor.nvidiaToGenericField(gpuInfo.clocks.mem_clock);
                    if(memoryClock && memoryClock.value != null && memoryClock.unit) {
                        addSensor({
                            category: 'Clocks',
                            name: 'Memory Clock',
                            value: memoryClock.value,
                            unit: memoryClock.unit,
                            priority: GpuSensorPriority.NONE,
                        });
                    }

                    const memoryMaxClock = GpuMonitor.nvidiaToGenericField(
                        gpuInfo.max_clocks?.mem_clock
                    );
                    if(memoryMaxClock && memoryMaxClock.value != null && memoryMaxClock.unit) {
                        addSensor({
                            category: 'Clocks',
                            name: 'Memory Max Clock',
                            value: memoryMaxClock.value,
                            unit: memoryMaxClock.unit,
                            priority: GpuSensorPriority.NONE,
                        });
                    }

                    const videoClock = GpuMonitor.nvidiaToGenericField(gpuInfo.clocks.video_clock);
                    if(videoClock && videoClock.value != null && videoClock.unit) {
                        addSensor({
                            category: 'Clocks',
                            name: 'Video Clock',
                            value: videoClock.value,
                            unit: videoClock.unit,
                            priority: GpuSensorPriority.NONE,
                        });
                    }

                    const videoMaxClock = GpuMonitor.nvidiaToGenericField(
                        gpuInfo.max_clocks?.video_clock
                    );
                    if(videoMaxClock && videoMaxClock.value != null && videoMaxClock.unit) {
                        addSensor({
                            category: 'Clocks',
                            name: 'Video Max Clock',
                            value: videoMaxClock.value,
                            unit: videoMaxClock.unit,
                            priority: GpuSensorPriority.NONE,
                        });
                    }
                }

                // Sensors Sorting
                for(const category of gpu.sensors.categories) {
                    category.sensors.sort((a, b) => {
                        if(a.priority === b.priority) return 0;
                        return a.priority > b.priority ? -1 : 1;
                    });
                }
                gpu.sensors.list?.sort((a, b) => {
                    if(a.priority === b.priority) return 0;
                    return a.priority > b.priority ? -1 : 1;
                });
                gpu.sensors.categories.sort((a, b) => {
                    const maxPriorityA = a.sensors.length ? a.sensors[0].priority : 0;
                    const maxPriorityB = b.sensors.length ? b.sensors[0].priority : 0;
                    if(maxPriorityA === maxPriorityB) return 0;
                    return maxPriorityA > maxPriorityB ? -1 : 1;
                });

                gpus.set(id, gpu);
            }

            this.pushUsageHistory('gpu', gpus);
            this.notify('gpuUpdate', gpus);
        } catch(e: any) {
            Utils.error(`updateNvidiaGpu: ${e.message}`);
        }
    }

    destroy() {
        Config.clear(this);
        super.destroy();
    }
}
