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
 * The integrated GPU always sits at 0000:00:02.0, while a discrete one is a PCIe endpoint
 * behind a root port: igt-gpu-tools tells them apart the very same way
 * (INTEGRATED_I915_GPU_PCI_ID). Only the integrated GPU shares the CPU package, its memory
 * controller and the system memory, so only for it are those readings its own.
 */
const INTEL_INTEGRATED_GPU_PCI_ID = '0000:00:02.0';

export function isIntegratedIntelGpu(pciAddress: string): boolean {
    return pciAddress.toLowerCase() === INTEL_INTEGRATED_GPU_PCI_ID;
}

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
 * and the elapsed time in seconds, returns undefined when the counter wrapped around,
 * when there is nothing to compare against yet, or when no time has passed.
 */
export function intelActivityFromRc6(
    previousResidency: number | undefined,
    currentResidency: number | undefined,
    elapsed: number
): number | undefined {
    if(previousResidency == null || currentResidency == null || elapsed <= 0) return undefined;
    const rc6Percent = ((currentResidency - previousResidency) / (elapsed * 1000)) * 100;
    if(rc6Percent < 0) return undefined;
    return Math.min(100, Math.max(0, 100 - rc6Percent));
}

/**
 * The rate at which the sleep counter of every GT advanced, 1 meaning it slept for the
 * whole of the elapsed time. A GT with nothing to compare against, or whose counter
 * went backwards, is left out.
 */
export function intelResidencyRates(
    previous: { [gt: string]: number } | undefined,
    current: { [gt: string]: number },
    elapsed: number
): { [gt: string]: number } {
    const rates: { [gt: string]: number } = {};
    if(elapsed <= 0) return rates;

    for(const gt in current) {
        const before = previous?.[gt];
        if(before == null) continue;
        // A rate above 1 is a mis-measured interval, not a full one: CLOCK_MONOTONIC
        // stops while suspended and the counter of a power gated GT does not
        const rate = (current[gt] - before) / (elapsed * 1000);
        if(rate >= 0 && rate <= 1) rates[gt] = rate;
    }
    return rates;
}

/**
 * Slowest rate a sleep counter can advance at for its GT to count as asleep: idle GTs
 * measured 0.70 to 0.95 of the clock on Panther Lake, saturated ones 0 to 0.08.
 */
const RESIDENCY_ASLEEP_RATE = 0.25;

/**
 * The fastest rate every GT's sleep counter has been seen to advance at: its rate while
 * asleep. A busy rate would measure the GT against itself and one above 1 is not a rate,
 * so neither is learned, since a mark never comes back down.
 */
export function intelMaxRates(
    previous: { [gt: string]: number } | undefined,
    rates: { [gt: string]: number }
): { [gt: string]: number } {
    const maxRates = { ...previous };
    for(const gt in rates) {
        if(rates[gt] < RESIDENCY_ASLEEP_RATE || rates[gt] > 1) continue;
        maxRates[gt] = Math.max(maxRates[gt] ?? 0, rates[gt]);
    }
    return maxRates;
}

/**
 * Activity of the busiest GT, each rate measured against that GT's asleep mark rather
 * than the clock, since the counters don't advance at the rate of the clock. A GT with
 * no mark yet is measured against the clock.
 */
export function intelActivityFromRates(
    rates: { [gt: string]: number },
    maxRates: { [gt: string]: number } | undefined
): number | undefined {
    let busiest: number | undefined;
    for(const gt in rates) {
        // A mark below RESIDENCY_ASLEEP_RATE is not an asleep rate
        const mark = maxRates?.[gt] ?? 0;
        const asleep = Math.max(rates[gt], mark >= RESIDENCY_ASLEEP_RATE ? mark : 1);
        const busy = Math.min(100, Math.max(0, 100 * (1 - rates[gt] / asleep)));
        busiest = busiest == null ? busy : Math.max(busiest, busy);
    }
    return busiest;
}

export type IntelActivity = { GFX?: number; pipes: { name: string; percent: number }[] };

/**
 * Activity of the GPU: the per engine numbers of a sample, the sleep residency of the
 * GT when there is no sample or it carries no engine at all, and no activity at all
 * rather than a wrong one when neither source is usable.
 */
export function intelActivity(
    sample: IntelInfoRaw | undefined,
    residency: number | undefined
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

    return residency == null ? { pipes } : { GFX: residency, pipes };
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
 * intel_gpu_top is running, and sysfs when it is absent: act_freq on xe, or the requested
 * frequency while act_freq reads 0 and on i915, which has no other.
 */
export function intelFrequency(
    sample: IntelInfoRaw | undefined,
    curFreq: string,
    actFreq: string = ''
): number | undefined {
    const sysfs = parseSysfsNumber(actFreq) || parseSysfsNumber(curFreq);
    const frequency = sample?.frequency?.actual ?? sysfs;
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

/** A descriptor open on /dev/dri: the process holding it and its fdinfo text */
export type IntelFdinfo = { pid: number; name: string; content: string };

/** The engine classes of the kernel, under the names intel_gpu_top gives them */
const FDINFO_ENGINES: { [engine: string]: string } = {
    rcs: 'Render/3D',
    bcs: 'Blitter',
    vcs: 'Video',
    vecs: 'VideoEnhance',
    ccs: 'Compute',
};
const FDINFO_UNITS: { [unit: string]: number } = { KiB: 1024, MiB: 1024 ** 2, GiB: 1024 ** 3 };

/**
 * The drm- lines of every DRM client of this GPU, by client id. A client open on several
 * descriptors is counted once, from the first in key order.
 */
function parseFdinfo(descriptors: Map<string, IntelFdinfo>, pdev: string) {
    const clients = new Map<string, IntelFdinfo & { keys: { [key: string]: string } }>();
    const sorted = Array.from(descriptors.entries()).sort((a, b) => (a[0] < b[0] ? -1 : 1));

    for(const [, descriptor] of sorted) {
        const keys: { [key: string]: string } = {};
        for(const line of descriptor.content.split('\n')) {
            const colon = line.indexOf(':');
            if(line.startsWith('drm-') && colon > 0)
                keys[line.substring(0, colon)] = line.substring(colon + 1).trim();
        }

        const id = keys['drm-client-id'];
        if(!id || clients.has(id)) continue;
        if(keys['drm-pdev']?.toLowerCase() !== pdev.toLowerCase()) continue;
        clients.set(id, { ...descriptor, keys });
    }
    return clients;
}

/**
 * A sample in the shape of intel_gpu_top's, built from two fdinfo scans: an engine is the
 * delta of drm-cycles over drm-total-cycles and the capacity of its class, as in gputop.
 */
export function intelFdinfoSample(
    previous: Map<string, IntelFdinfo>,
    current: Map<string, IntelFdinfo>,
    pdev: string
): IntelInfoRaw {
    const before = parseFdinfo(previous, pdev);
    const engines: { [name: string]: number } = {};
    const busy: { [pid: string]: { [name: string]: number } } = {};
    const memory: { [pid: string]: { [region: string]: number } } = {};
    const names: { [pid: string]: string } = {};

    for(const [id, client] of parseFdinfo(current, pdev)) {
        const last = before.get(id);
        const pid = String(client.pid);
        names[pid] = client.name;
        busy[pid] ??= {};
        memory[pid] ??= {};

        for(const key in client.keys) {
            const value = client.keys[key];

            if(key.startsWith('drm-resident-')) {
                const [size, unit] = value.split(' ');
                const bytes = parseInt(size, 10) * (FDINFO_UNITS[unit] ?? 1);
                const region = key.substring(13);
                if(bytes > 0) memory[pid][region] = (memory[pid][region] ?? 0) + bytes;
                continue;
            }

            // A client seen for the first time has nothing to take a delta against
            if(!last || !key.startsWith('drm-cycles-')) continue;

            const engine = key.substring(11);
            const name = FDINFO_ENGINES[engine] ?? engine;
            const cycles = parseInt(value, 10) - parseInt(last.keys[key] ?? '', 10);
            const total =
                parseInt(client.keys[`drm-total-cycles-${engine}`], 10) -
                parseInt(last.keys[`drm-total-cycles-${engine}`] ?? '', 10);
            if(!(total > 0) || !(cycles >= 0)) continue;

            // The cycles add up over every instance of the class, so divide before clamping
            const capacity = parseInt(client.keys[`drm-engine-capacity-${engine}`] ?? '1', 10);
            const percent = Math.min(100, (cycles / total / capacity) * 100);
            busy[pid][name] = Math.min(100, (busy[pid][name] ?? 0) + percent);
            engines[name] = (engines[name] ?? 0) + percent;
        }
    }

    // In the order intel_gpu_top lists them, with any class it does not name after them
    const order = Object.values(FDINFO_ENGINES).filter(name => name in engines);
    for(const name in engines) if(!order.includes(name)) order.push(name);

    const sampleEngines: { [name: string]: IntelEngine } = {};
    for(const name of order)
        sampleEngines[name] = { busy: Math.min(100, engines[name]), unit: '%' };

    const sampleClients: NonNullable<IntelInfoRaw['clients']> = {};
    for(const pid in names) {
        const engineClasses: { [name: string]: { busy: string; unit: string } } = {};
        for(const name in busy[pid])
            engineClasses[name] = { busy: String(busy[pid][name]), unit: '%' };

        const regions: { [region: string]: { [field: string]: string } } = {};
        for(const region in memory[pid])
            regions[region] = { resident: String(memory[pid][region]) };

        sampleClients[pid] = {
            name: names[pid],
            pid,
            'engine-classes': engineClasses,
            memory: regions,
        };
    }
    return { engines: sampleEngines, clients: sampleClients };
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
