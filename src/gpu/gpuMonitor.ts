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
import Utils, { GpuInfo } from '../utils/utils.js';
import Monitor from '../monitor.js';

import ContinuosTaskManager, { ContinuosTaskManagerData } from '../utils/continuosTaskManager.js';

enum GpuSensorPriority {
    NONE,
    LOW,
    MEDIUM,
    HIGH,
    MAX
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
        PCI?: string;
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
    value: number | string;
    unit?: string;
};

type NvidiaInfoRaw = {
    '@id'?: string;
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
        process_name: string;
        pid: number;
        used_memory: string;
    }[];
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
    }

    get updateFrequency() {
        return Config.get_double('gpu-update');
    }

    getSelectedGpu() {
        return this.selectedGpu;
    }

    updateMonitorStatus() {
        const show = Config.get_boolean('gpu-header-show');
        if(show || this.isListeningFor('gpuUpdate')) this.start();
        else this.stop();
    }

    reset() {}

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
        if(key === 'gpuUpdate') {
            setTimeout(() => {
                this.updateMonitorStatus();
            });
        }
    }

    stopListeningFor(key: string) {
        if(key === 'gpuUpdate') {
            this.updateMonitorStatus();
        }
    }

    private startGpuTask() {
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

    static nvidiaToGenericField(nvidia: NvidiaField | undefined): GenericField | undefined {
        if(!nvidia || !nvidia['#text'] || nvidia['#text'] === 'N/A') return undefined;

        const tokens = nvidia['#text'].split(' ');
        if(tokens.length < 1) {
            if(Utils.isNumeric(tokens[0])) return { value: parseFloat(tokens[0]) };
            else return { value: tokens[0] };
        } else if(tokens.length > 1) {
            return { value: nvidia['#text'] };
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
            '%'
        ];
        if(units.includes(tokens[1])) return { value: tokens[0], unit: tokens[1] };

        return { value: nvidia['#text'] };
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
                    vram: { pipes: [] },
                    activity: { pipes: [] },
                    topProcesses: [],
                    sensors: { categories: [], list: [] },
                    raw: gpuInfo
                };

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
                }

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

                if(gpuInfo.VRAM) {
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
                                    total
                                });
                        }
                    }
                }

                if(gpuInfo.fdinfo) {
                    for(const pid in gpuInfo.fdinfo) {
                        const process = gpuInfo.fdinfo[pid];
                        if(process?.name) {
                            const topProcess = {
                                name: process.name,
                                pid: parseInt(pid),
                                pipes: [] as any[]
                            };

                            for(const name in process.usage) {
                                const pipe = process.usage[name];
                                if(pipe.value != null && pipe.unit) {
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
                                'CPU'
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
                    priority
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
                                priority: GpuSensorPriority.NONE
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
                                priority: GpuSensorPriority.NONE
                            });
                        }
                        if(gpuClock.max != null) {
                            addSensor({
                                category: 'Clocks',
                                name: 'GPU Clock Max',
                                value: gpuClock.max,
                                unit: 'MHz',
                                priority: GpuSensorPriority.NONE
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
                                priority: GpuSensorPriority.NONE
                            });
                        }
                        if(memoryClock.max != null) {
                            addSensor({
                                category: 'Clocks',
                                name: 'Memory Clock Max',
                                value: memoryClock.max,
                                unit: 'MHz',
                                priority: GpuSensorPriority.NONE
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
                                priority: GpuSensorPriority.NONE
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
                                priority: GpuSensorPriority.NONE
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
                                priority: GpuSensorPriority.NONE
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
                                priority: GpuSensorPriority.NONE
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
                                priority: GpuSensorPriority.NONE
                            });
                        }

                        if(powerCap.min != null) {
                            addSensor({
                                category: 'Power',
                                name: 'Power Cap Min',
                                value: powerCap.min,
                                unit: 'W',
                                priority: GpuSensorPriority.NONE
                            });
                        }

                        if(powerCap.max != null) {
                            addSensor({
                                category: 'Power',
                                name: 'Power Cap Max',
                                value: powerCap.max,
                                unit: 'W',
                                priority: GpuSensorPriority.NONE
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
                    vram: { pipes: [] },
                    activity: { pipes: [] },
                    topProcesses: [],
                    sensors: { categories: [], list: [] },
                    raw: gpuInfo
                };

                if(gpuInfo.fb_memory_usage) {
                    const toalData = gpuInfo.fb_memory_usage.total;
                    if(toalData && toalData['#text']) {
                        const [value, unit] = toalData['#text'].split(' ');

                        const total = Utils.convertToBytes(value, unit);
                        if(total >= 0) gpu.vram.total = total;
                    }

                    const usedData = gpuInfo.fb_memory_usage.used;
                    if(usedData && usedData['#text']) {
                        const [value, unit] = usedData['#text'].split(' ');

                        const used = Utils.convertToBytes(value, unit);
                        if(used >= 0) gpu.vram.used = used;
                    }

                    if(gpu.vram.total !== undefined && gpu.vram.used !== undefined) {
                        gpu.vram.percent = (gpu.vram.used / gpu.vram.total) * 100;
                        gpu.vram.pipes.push({
                            name: 'fb_memory_usage',
                            percent: gpu.vram.percent,
                            used: gpu.vram.used,
                            total: gpu.vram.total
                        });
                    }
                }

                if(gpuInfo.bar1_memory_usage) {
                    let total: number | undefined;
                    let used: number | undefined;

                    const toalData = gpuInfo.bar1_memory_usage.total;
                    if(toalData && toalData['#text']) {
                        const [value, unit] = toalData['#text'].split(' ');
                        total = Utils.convertToBytes(value, unit);
                    }

                    const usedData = gpuInfo.bar1_memory_usage.used;
                    if(usedData && usedData['#text']) {
                        const [value, unit] = usedData['#text'].split(' ');
                        used = Utils.convertToBytes(value, unit);
                    }

                    if(total && used != null)
                        gpu.vram.pipes.push({
                            name: 'bar1_memory_usage',
                            percent: (used / total) * 100,
                            used,
                            total
                        });
                }

                if(gpuInfo.cc_protected_memory_usage) {
                    let total: number | undefined;
                    let used: number | undefined;

                    const toalData = gpuInfo.cc_protected_memory_usage.total;
                    if(toalData && toalData['#text']) {
                        const [value, unit] = toalData['#text'].split(' ');
                        total = Utils.convertToBytes(value, unit);
                    }

                    const usedData = gpuInfo.cc_protected_memory_usage.used;
                    if(usedData && usedData['#text']) {
                        const [value, unit] = usedData['#text'].split(' ');
                        used = Utils.convertToBytes(value, unit);
                    }

                    if(total && used != null)
                        gpu.vram.pipes.push({
                            name: 'cc_protected_memory_usage',
                            percent: (used / total) * 100,
                            used,
                            total
                        });
                }

                if(gpuInfo.utilization) {
                    for(const key in gpuInfo.utilization) {
                        const value = gpuInfo.utilization[key];
                        if(gpuInfo.utilization.key != null && value?.['#text']) {
                            const [valueStr, unit] = value['#text'].split(' ');
                            if(unit === '%') {
                                if(key === 'gpu_util') gpu.activity.GFX = parseFloat(valueStr);
                                const name = Utils.capitalize(key.replace('_util', ''));
                                const percent = parseFloat(valueStr);
                                gpu.activity.pipes.push({ name, percent });
                            }
                        }
                    }
                }

                if(gpuInfo.processes) {
                    for(const process of gpuInfo.processes) {
                        if(!process.used_memory) continue;
                        const [valueStr, unit] = process.used_memory.split(' ');
                        const value = parseInt(valueStr);
                        if(!value || isNaN(value) || !unit) continue;

                        const topProcess = {
                            name: Utils.extractCommandName(process.process_name),
                            pid: process.pid,
                            pipes: [
                                {
                                    name: 'Used Memory',
                                    value: Utils.convertToBytes(value, unit),
                                    unit: 'B'
                                }
                            ]
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
                    priority
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
                                priority: GpuSensorPriority.NONE
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
                                priority: GpuSensorPriority.NONE
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
                                priority: GpuSensorPriority.NONE
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
                                priority: GpuSensorPriority.NONE
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
                            priority: GpuSensorPriority.NONE
                        });
                    }

                    const rxUtil = GpuMonitor.nvidiaToGenericField(gpuInfo.pci.rx_util);
                    if(rxUtil && rxUtil.value && rxUtil.unit) {
                        addSensor({
                            category: 'PCIe Link',
                            name: 'RX Util',
                            value: rxUtil.value,
                            unit: rxUtil.unit,
                            priority: GpuSensorPriority.NONE
                        });
                    }
                }

                const fanSpeed = GpuMonitor.nvidiaToGenericField(gpuInfo.fan_speed);
                if(fanSpeed && fanSpeed.value && fanSpeed.unit) {
                    addSensor({
                        category: 'Fan Speed',
                        name: 'Fan',
                        value: fanSpeed.value,
                        unit: fanSpeed.unit,
                        priority: GpuSensorPriority.MEDIUM
                    });
                }

                if(gpuInfo.temperature) {
                    const gpuTemp = GpuMonitor.nvidiaToGenericField(gpuInfo.temperature.gpu_temp);
                    if(gpuTemp && gpuTemp.value && gpuTemp.unit) {
                        addSensor({
                            category: 'Temperature',
                            name: 'GPU Temp',
                            value: gpuTemp.value,
                            unit: gpuTemp.unit,
                            priority: GpuSensorPriority.NONE
                        });
                    }

                    const gpuTempMax = GpuMonitor.nvidiaToGenericField(
                        gpuInfo.temperature.gpu_temp_max_threshold
                    );
                    if(gpuTempMax && gpuTempMax.value && gpuTempMax.unit) {
                        addSensor({
                            category: 'Temperature',
                            name: 'GPU Temp Max',
                            value: gpuTempMax.value,
                            unit: gpuTempMax.unit,
                            priority: GpuSensorPriority.NONE
                        });
                    }

                    const gpuTempSlow = GpuMonitor.nvidiaToGenericField(
                        gpuInfo.temperature.gpu_temp_slow_threshold
                    );
                    if(gpuTempSlow && gpuTempSlow.value && gpuTempSlow.unit) {
                        addSensor({
                            category: 'Temperature',
                            name: 'GPU Temp Throttle',
                            value: gpuTempSlow.value,
                            unit: gpuTempSlow.unit,
                            priority: GpuSensorPriority.NONE
                        });
                    }

                    const gpuTargetTemp = GpuMonitor.nvidiaToGenericField(
                        gpuInfo.temperature.gpu_target_temperature
                    );
                    if(gpuTargetTemp && gpuTargetTemp.value && gpuTargetTemp.unit) {
                        addSensor({
                            category: 'Temperature',
                            name: 'GPU Target Temp',
                            value: gpuTargetTemp.value,
                            unit: gpuTargetTemp.unit,
                            priority: GpuSensorPriority.NONE
                        });
                    }

                    const memoryTemp = GpuMonitor.nvidiaToGenericField(
                        gpuInfo.temperature.memory_temp
                    );
                    if(memoryTemp && memoryTemp.value && memoryTemp.unit) {
                        addSensor({
                            category: 'Temperature',
                            name: 'Memory Temp',
                            value: memoryTemp.value,
                            unit: memoryTemp.unit,
                            priority: GpuSensorPriority.NONE
                        });
                    }

                    const gpuTempMaxMem = GpuMonitor.nvidiaToGenericField(
                        gpuInfo.temperature.gpu_temp_max_mem_threshold
                    );
                    if(gpuTempMaxMem && gpuTempMaxMem.value && gpuTempMaxMem.unit) {
                        addSensor({
                            category: 'Temperature',
                            name: 'Memory Temp Max',
                            value: gpuTempMaxMem.value,
                            unit: gpuTempMaxMem.unit,
                            priority: GpuSensorPriority.NONE
                        });
                    }
                }

                if(gpuInfo.gpu_power_readings) {
                    const powerState = GpuMonitor.nvidiaToGenericField(
                        gpuInfo.gpu_power_readings.power_state
                    );
                    if(powerState && powerState.value) {
                        addSensor({
                            category: 'Power',
                            name: 'Power State',
                            value: powerState.value,
                            unit: '',
                            priority: GpuSensorPriority.NONE
                        });
                    }

                    const powerDraw = GpuMonitor.nvidiaToGenericField(
                        gpuInfo.gpu_power_readings.power_draw
                    );
                    if(powerDraw && powerDraw.value && powerDraw.unit) {
                        addSensor({
                            category: 'Power',
                            name: 'Power Draw',
                            value: powerDraw.value,
                            unit: powerDraw.unit,
                            priority: GpuSensorPriority.HIGH
                        });
                    }

                    const currentPowerLimit = GpuMonitor.nvidiaToGenericField(
                        gpuInfo.gpu_power_readings.current_power_limit
                    );
                    if(currentPowerLimit && currentPowerLimit.value && currentPowerLimit.unit) {
                        addSensor({
                            category: 'Power',
                            name: 'Current Power Limit',
                            value: currentPowerLimit.value,
                            unit: currentPowerLimit.unit,
                            priority: GpuSensorPriority.NONE
                        });
                    }

                    const requestedPowerLimit = GpuMonitor.nvidiaToGenericField(
                        gpuInfo.gpu_power_readings.requested_power_limit
                    );
                    if(
                        requestedPowerLimit &&
                        requestedPowerLimit.value &&
                        requestedPowerLimit.unit
                    ) {
                        addSensor({
                            category: 'Power',
                            name: 'Requested Power Limit',
                            value: requestedPowerLimit.value,
                            unit: requestedPowerLimit.unit,
                            priority: GpuSensorPriority.NONE
                        });
                    }

                    const defaultPowerLimit = GpuMonitor.nvidiaToGenericField(
                        gpuInfo.gpu_power_readings.default_power_limit
                    );
                    if(defaultPowerLimit && defaultPowerLimit.value && defaultPowerLimit.unit) {
                        addSensor({
                            category: 'Power',
                            name: 'Default Power Limit',
                            value: defaultPowerLimit.value,
                            unit: defaultPowerLimit.unit,
                            priority: GpuSensorPriority.NONE
                        });
                    }

                    const minPowerLimit = GpuMonitor.nvidiaToGenericField(
                        gpuInfo.gpu_power_readings.min_power_limit
                    );
                    if(minPowerLimit && minPowerLimit.value && minPowerLimit.unit) {
                        addSensor({
                            category: 'Power',
                            name: 'Min Power Limit',
                            value: minPowerLimit.value,
                            unit: minPowerLimit.unit,
                            priority: GpuSensorPriority.NONE
                        });
                    }

                    const maxPowerLimit = GpuMonitor.nvidiaToGenericField(
                        gpuInfo.gpu_power_readings.max_power_limit
                    );
                    if(maxPowerLimit && maxPowerLimit.value && maxPowerLimit.unit) {
                        addSensor({
                            category: 'Power',
                            name: 'Max Power Limit',
                            value: maxPowerLimit.value,
                            unit: maxPowerLimit.unit,
                            priority: GpuSensorPriority.NONE
                        });
                    }
                }

                if(gpuInfo.clocks) {
                    const gpuClock = GpuMonitor.nvidiaToGenericField(gpuInfo.clocks.graphics_clock);
                    if(gpuClock && gpuClock.value && gpuClock.unit) {
                        addSensor({
                            category: 'Clocks',
                            name: 'GPU Clock',
                            value: gpuClock.value,
                            unit: gpuClock.unit,
                            priority: GpuSensorPriority.MAX
                        });
                    }

                    const gpuMaxClock = GpuMonitor.nvidiaToGenericField(
                        gpuInfo.max_clocks?.graphics_clock
                    );
                    if(gpuMaxClock && gpuMaxClock.value && gpuMaxClock.unit) {
                        addSensor({
                            category: 'Clocks',
                            name: 'GPU Max Clock',
                            value: gpuMaxClock.value,
                            unit: gpuMaxClock.unit,
                            priority: GpuSensorPriority.NONE
                        });
                    }

                    const smClock = GpuMonitor.nvidiaToGenericField(gpuInfo.clocks.sm_clock);
                    if(smClock && smClock.value && smClock.unit) {
                        addSensor({
                            category: 'Clocks',
                            name: 'SM Clock',
                            value: smClock.value,
                            unit: smClock.unit,
                            priority: GpuSensorPriority.NONE
                        });
                    }

                    const smMaxClock = GpuMonitor.nvidiaToGenericField(
                        gpuInfo.max_clocks?.sm_clock
                    );
                    if(smMaxClock && smMaxClock.value && smMaxClock.unit) {
                        addSensor({
                            category: 'Clocks',
                            name: 'SM Max Clock',
                            value: smMaxClock.value,
                            unit: smMaxClock.unit,
                            priority: GpuSensorPriority.NONE
                        });
                    }

                    const memoryClock = GpuMonitor.nvidiaToGenericField(gpuInfo.clocks.mem_clock);
                    if(memoryClock && memoryClock.value && memoryClock.unit) {
                        addSensor({
                            category: 'Clocks',
                            name: 'Memory Clock',
                            value: memoryClock.value,
                            unit: memoryClock.unit,
                            priority: GpuSensorPriority.NONE
                        });
                    }

                    const memoryMaxClock = GpuMonitor.nvidiaToGenericField(
                        gpuInfo.max_clocks?.mem_clock
                    );
                    if(memoryMaxClock && memoryMaxClock.value && memoryMaxClock.unit) {
                        addSensor({
                            category: 'Clocks',
                            name: 'Memory Max Clock',
                            value: memoryMaxClock.value,
                            unit: memoryMaxClock.unit,
                            priority: GpuSensorPriority.NONE
                        });
                    }

                    const videoClock = GpuMonitor.nvidiaToGenericField(gpuInfo.clocks.video_clock);
                    if(videoClock && videoClock.value && videoClock.unit) {
                        addSensor({
                            category: 'Clocks',
                            name: 'Video Clock',
                            value: videoClock.value,
                            unit: videoClock.unit,
                            priority: GpuSensorPriority.NONE
                        });
                    }

                    const videoMaxClock = GpuMonitor.nvidiaToGenericField(
                        gpuInfo.max_clocks?.video_clock
                    );
                    if(videoMaxClock && videoMaxClock.value && videoMaxClock.unit) {
                        addSensor({
                            category: 'Clocks',
                            name: 'Video Max Clock',
                            value: videoMaxClock.value,
                            unit: videoMaxClock.unit,
                            priority: GpuSensorPriority.NONE
                        });
                    }
                }

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
