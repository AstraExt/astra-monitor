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
    raw: any;
};

type AmdValue = {
    unit?: string;
    value?: number;
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
    };
    Sensors?: {
        [key: string]: AmdValue;
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
            this.updateAmdGpuTask.start(`${path}amdgpu_top -J -u ${timer} -s ${timer} -n 0`);
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
                                if(
                                    pipe.name === 'GTT' &&
                                    pipe.unit !== '%' &&
                                    pipe.value &&
                                    totalGtt
                                )
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
                }
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
