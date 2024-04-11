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
    };
    activity: {
        GFX?: number;
    };
    raw: any;
};

export type AmdInfo = GenericGpuInfo & {
    raw: {
        GRBM?: any;
        GRBM2?: any;
        Info?: any;
        Sensors?: any;
        VRAM?: any;
        fdinfo?: any;
        gpu_activity?: any;
        gpu_metrics?: any;
    };
};

export type NvidiaInfo = GenericGpuInfo & {
    raw: any;
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
            const json = JSON.parse(data.result);

            const gpus = new Map<string, any>();
            for(const gpuInfo of json.devices) {
                const id = gpuInfo.Info?.PCI;

                const gpu: AmdInfo = {
                    id,
                    family: 'AMD',
                    vram: {},
                    activity: {},
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

                    if(gpu.vram.total !== undefined && gpu.vram.used !== undefined)
                        gpu.vram.percent = (gpu.vram.used / gpu.vram.total) * 100;
                }

                if(
                    gpuInfo.gpu_activity &&
                    gpuInfo.gpu_activity.GFX &&
                    Object.prototype.hasOwnProperty.call(gpuInfo.gpu_activity.GFX, 'value') &&
                    gpuInfo.gpu_activity.GFX.unit === '%'
                ) {
                    const GFX = gpuInfo.gpu_activity.GFX.value;
                    if(typeof GFX === 'string') gpu.activity.GFX = parseFloat(GFX);
                    else gpu.activity.GFX = GFX;
                } else if(
                    gpuInfo.GRBM &&
                    gpuInfo.GRBM['Graphics Pipe'] &&
                    Object.prototype.hasOwnProperty.call(gpuInfo.GRBM['Graphics Pipe'], 'value') &&
                    gpuInfo.GRBM['Graphics Pipe'].unit === '%'
                ) {
                    const gfx = gpuInfo.GRBM['Graphics Pipe'].value;
                    if(typeof gfx === 'string') gpu.activity.GFX = parseFloat(gfx);
                    else gpu.activity.GFX = gfx;
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

            let gpuInfoList = xml.nvidia_smi_log.gpu;
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
                    vram: {},
                    activity: {},
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

                    if(gpu.vram.total !== undefined && gpu.vram.used !== undefined)
                        gpu.vram.percent = (gpu.vram.used / gpu.vram.total) * 100;
                }

                if(
                    gpuInfo.utilization &&
                    gpuInfo.utilization.gpu_util &&
                    Object.prototype.hasOwnProperty.call(gpuInfo.utilization.gpu_util, '#text')
                ) {
                    const [value, unit] = gpuInfo.utilization.gpu_util['#text'].split(' ');
                    if(unit === '%') gpu.activity.GFX = parseFloat(value);
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
