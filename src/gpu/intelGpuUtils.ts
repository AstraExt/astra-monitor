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

/**
 * Pure helpers of the Intel GPU monitor, kept free of any GNOME import so they can
 * be checked outside of the shell: see test/intel-gpu.test.js.
 */

export type IntelEngine = {
    busy?: number;
    sema?: number;
    wait?: number;
    unit?: string;
};

export type IntelInfoRaw = {
    period?: { duration?: number; unit?: string };
    frequency?: { requested?: number; actual?: number; unit?: string };
    interrupts?: { count?: number; unit?: string };
    rc6?: { value?: number; unit?: string };
    power?: { GPU?: number; Package?: number; unit?: string };
    'imc-bandwidth'?: { reads?: number; writes?: number; unit?: string };
    engines?: { [key: string]: IntelEngine };
    clients?: {
        [key: string]: {
            name?: string;
            pid?: string;
            memory?: { [region: string]: { [field: string]: string } };
            'engine-classes'?: { [key: string]: { busy?: string; unit?: string } };
        };
    };
};

/**
 * intel_gpu_top -J streams an endless JSON array: every sample is a top-level object,
 * so its closing brace is the only one at the beginning of a line. Flushing on it cuts
 * the stream into samples without breaking on the nested objects.
 */
export const INTEL_SAMPLE_FLUSH = /^\},?\s*$/;

/**
 * Turns one flushed chunk of the stream into a sample, stripping the array framing:
 * the opening '[' and the ',' separating the samples.
 * Returns undefined when the chunk isn't an object, throws when it isn't valid JSON.
 */
export function parseIntelGpuSample(data: string): IntelInfoRaw | undefined {
    let result = data.trim();
    if(result.startsWith('[')) result = result.substring(1).trim();
    if(result.startsWith(',')) result = result.substring(1).trim();
    if(result.endsWith(',')) result = result.substring(0, result.length - 1).trim();
    if(!result.startsWith('{')) return undefined;

    return JSON.parse(result) as IntelInfoRaw;
}

/**
 * Reads one of the single value files of the i915 sysfs interface: they hold a plain
 * integer followed by a newline. Returns undefined when the file is empty or not a
 * number, which happens when the driver doesn't expose that attribute.
 */
export function parseSysfsNumber(content: string): number | undefined {
    const value = parseFloat(content.trim());
    if(isNaN(value) || !isFinite(value)) return undefined;
    return value;
}

/**
 * Activity of a GPU without intel_gpu_top: the time it didn't spend in the rc6 sleep
 * state is a good enough approximation. Takes the residency counter in milliseconds
 * and the elapsed time in seconds, returns undefined when the counter wrapped around.
 */
export function intelActivityFromRc6(
    previousResidency: number,
    currentResidency: number,
    elapsed: number
): number | undefined {
    const rc6Percent = ((currentResidency - previousResidency) / (elapsed * 1000)) * 100;
    if(rc6Percent < 0) return undefined;
    return Math.min(100, Math.max(0, 100 - rc6Percent));
}

export type IntelActivity = { GFX?: number; pipes: { name: string; percent: number }[] };

/**
 * Activity of the GPU: the per engine numbers when intel_gpu_top is running, the rc6
 * residency delta when it is absent or its sample carries no engine at all. Takes the
 * residency counter in milliseconds and the elapsed time in seconds, and reports no
 * activity at all rather than a wrong one when neither source is usable.
 */
export function intelActivity(
    sample: IntelInfoRaw | undefined,
    previousResidency: number | undefined,
    currentResidency: number | undefined,
    elapsed: number
): IntelActivity {
    const pipes: { name: string; percent: number }[] = [];
    const engines = sample?.engines ?? {};
    for(const name in engines) {
        const busy = engines[name]?.busy;
        if(busy == null || isNaN(busy)) continue;
        pipes.push({ name, percent: busy });
    }

    if(pipes.length > 0) {
        const render = pipes.find(pipe => pipe.name.startsWith('Render/3D'));
        return {
            GFX: render ? render.percent : Math.max(...pipes.map(pipe => pipe.percent)),
            pipes,
        };
    }

    if(previousResidency == null || currentResidency == null || elapsed <= 0) return { pipes };

    const GFX = intelActivityFromRc6(previousResidency, currentResidency, elapsed);
    return GFX == null ? { pipes } : { GFX, pipes };
}

/**
 * Power drawn by the GPU: the number of a sample when intel_gpu_top is running, the
 * delta of the RAPL energy counter when it is absent or doesn't report power. Takes the
 * counter in microjoules and the elapsed time in seconds, and returns undefined when the
 * counter wrapped around, since a negative delta is not a usable sample.
 */
export function intelPower(
    sample: IntelInfoRaw | undefined,
    previousEnergy: number | undefined,
    currentEnergy: number | undefined,
    elapsed: number
): { value: number; unit: string } | undefined {
    const power = sample?.power?.GPU;
    if(power != null && !isNaN(power))
        return { value: parseFloat(power.toFixed(2)), unit: sample?.power?.unit ?? 'W' };

    if(previousEnergy == null || currentEnergy == null || elapsed <= 0) return undefined;

    const delta = currentEnergy - previousEnergy;
    if(delta < 0) return undefined;
    return { value: parseFloat((delta / 1000000 / elapsed).toFixed(2)), unit: 'W' };
}

/**
 * Current frequency in MHz, rounded for display: the number of a sample when
 * intel_gpu_top is running, the contents of gt_cur_freq_mhz when it is absent.
 */
export function intelFrequency(
    sample: IntelInfoRaw | undefined,
    curFreq: string
): number | undefined {
    const frequency = sample?.frequency?.actual ?? parseSysfsNumber(curFreq);
    if(frequency == null || isNaN(frequency)) return undefined;
    return Math.round(frequency);
}

export type IntelVram = { used: number; regions: { name: string; used: number }[] };

/**
 * Memory of an integrated GPU: the resident bytes every client of a sample holds, per
 * memory region ('system' on an iGPU). Buffers shared between clients are resident for
 * each of them, so the sum is an upper bound rather than an exact figure; the JSON of
 * intel_gpu_top carries no buffer id to deduplicate them with.
 * Returns undefined when the sample carries no client memory at all.
 */
export function intelVram(sample: IntelInfoRaw | undefined): IntelVram | undefined {
    const regions = new Map<string, number>();

    for(const id in sample?.clients) {
        const memory = sample?.clients?.[id]?.memory;
        for(const region in memory) {
            const resident = parseFloat(memory[region]?.resident ?? '');
            if(isNaN(resident)) continue;
            regions.set(region, (regions.get(region) ?? 0) + resident);
        }
    }
    if(regions.size === 0) return undefined;

    let used = 0;
    const list = [];
    for(const [name, value] of regions) {
        used += value;
        list.push({ name, used: value });
    }
    return { used, regions: list };
}

/**
 * Total system memory in bytes, from the first line of /proc/meminfo, which holds it in
 * kibibytes. An integrated GPU has no memory of its own: it is the only total its usage
 * can be a percentage of. Returns undefined when the line is missing or not a number.
 */
export function parseMemTotal(content: string): number | undefined {
    const match = /^MemTotal:\s+(\d+)\s*kB/m.exec(content);
    if(!match) return undefined;
    const value = parseInt(match[1], 10);
    if(isNaN(value)) return undefined;
    return value * 1024;
}
