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
