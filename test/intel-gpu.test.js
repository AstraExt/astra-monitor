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
 * Checks the Intel GPU logic that can't be exercised outside of GNOME Shell: the
 * intel_gpu_top stream framing, the sysfs values and the rc6 activity fallback. The
 * helpers come from src/gpu/intelGpuUtils.ts, the same ones the monitor uses.
 *
 * ALL THE DATA HERE WAS CAPTURED FROM ONE MACHINE, described by HARDWARE below:
 * an Intel Kaby Lake-S GT2 running the i915 driver. Other GPUs and other drivers
 * (notably xe, which lays out its sysfs attributes differently) are NOT covered.
 * To add one, capture its own data into test/fixtures/ the way this one did, put it in
 * a second describe() block and leave the existing one untouched.
 *
 * Run: npm test
 */

import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

import {
    INTEL_SAMPLE_FLUSH,
    intelActivityFromRc6,
    parseIntelGpuSample,
    parseSysfsNumber,
} from '../src/gpu/intelGpuUtils.ts';

const HARDWARE = {
    gpu: 'Intel Kaby Lake-S GT2 [HD Graphics 630] (8086:5912)',
    driver: 'i915',
    card: '/sys/class/drm/card1',
    kernel: 'Linux 7.0.0',
    intelGpuTop: 'intel-gpu-tools 2.3-1',
};

/** Captured with: intel_gpu_top -J -s 500 -d drm:/dev/dri/card1 */
const STREAM_FIXTURE = new URL('./fixtures/intel_gpu_top-i915-hd630.json', import.meta.url);

/**
 * Copies of the sysfs files the monitor reads, keeping the layout of /sys so the paths
 * below are the real ones minus the prefix. energy_uj is empty because it is root only
 * since the mitigation for CVE-2020-8694, which is exactly what the monitor reads.
 */
const SYSFS_FIXTURE = new URL('./fixtures/sysfs-i915-hd630/', import.meta.url);
const sysfs = path => readFileSync(new URL(path, SYSFS_FIXTURE), 'utf8');

/** Cuts a stream into samples the way ContinuousTaskManager's flush.match does */
function flushStream(stream) {
    const chunks = [];
    let buffer = '';
    for(const line of stream.split('\n')) {
        buffer += line + '\n';
        if(INTEL_SAMPLE_FLUSH.test(line)) {
            chunks.push(buffer);
            buffer = '';
        }
    }
    return chunks;
}

describe(`Intel GPU, ${HARDWARE.driver} driver`, { concurrency: false }, () => {
    test(`captured on: ${HARDWARE.gpu}, ${HARDWARE.kernel}, ${HARDWARE.intelGpuTop}`, () => {
        // Placeholder holding the provenance of the data, so a failing run says which
        // hardware and which driver the expectations below were written for
        assert.equal(HARDWARE.driver, 'i915');
    });

    test('the real intel_gpu_top stream is cut into whole samples', () => {
        const stream = readFileSync(STREAM_FIXTURE, 'utf8');
        const samples = flushStream(stream).map(chunk => parseIntelGpuSample(chunk));

        assert.equal(samples.length, 2);

        // The capture is pretty printed and starts with '[' on a line of its own,
        // followed by a blank line: the framing must not end up in the first sample
        assert.equal(samples[0].period.unit, 'ms');
        assert.equal(samples[0].rc6.value, 14.652034);
        assert.equal(samples[0].power.GPU, 1.366085);
        assert.equal(samples[0].power.unit, 'W');
        assert.equal(samples[0].engines['Render/3D'].busy, 54.033823);
        assert.equal(samples[0].engines.VideoEnhance.busy, 0);
        assert.equal(samples[0].interrupts.count, 1277.79029);
        assert.equal(samples[0]['imc-bandwidth'].reads, 8146.448967);

        // Every number of the stream is fractional, the header rounds them for display
        assert.equal(samples[0].frequency.actual, 247.31425);
        assert.equal(samples[1].frequency.actual, 113.826756);
        assert.equal(Math.round(samples[0].engines['Render/3D'].busy), 54);

        // Clients are keyed by an opaque id and hold their numbers as strings
        assert.equal(Object.keys(samples[0].clients).length, 9);
        const client = samples[0].clients['4294952744'];
        assert.equal(client.name, 'ghostty');
        assert.equal(client.pid, '14552');
        assert.equal(client.memory.system.resident, '65150976');
        assert.equal(client['engine-classes']['Render/3D'].busy, '20.794222');
    });

    test('only a closing brace at the start of a line flushes a sample', () => {
        const stream = readFileSync(STREAM_FIXTURE, 'utf8');

        // The nested objects of a real sample are indented, so they never flush.
        // A sample is followed by a comma while the stream continues; the last one of
        // the capture has none, because intel_gpu_top was killed instead of closing the
        // array, which is also what the monitor sees when it stops the process
        const flushed = stream.split('\n').filter(line => INTEL_SAMPLE_FLUSH.test(line));
        assert.deepEqual(flushed, ['},', '}']);

        assert.ok(!INTEL_SAMPLE_FLUSH.test('\t"engines": {'));
        assert.ok(!INTEL_SAMPLE_FLUSH.test('\t\t},'));
        assert.ok(INTEL_SAMPLE_FLUSH.test('}'));
    });

    test('a chunk that is not a sample is ignored', () => {
        assert.equal(parseIntelGpuSample(''), undefined);
        assert.equal(parseIntelGpuSample('[\n\n'), undefined);
        // Truncated output must be reported, not taken as an empty sample
        assert.throws(() => parseIntelGpuSample('{\n\t"rc6": {\n'), SyntaxError);
    });

    test('the sysfs files of the card are read as numbers', () => {
        // Every value is a plain integer followed by a newline
        assert.equal(sysfs('class/drm/card1/gt_cur_freq_mhz'), '400\n');

        assert.equal(parseSysfsNumber(sysfs('class/drm/card1/gt_cur_freq_mhz')), 400);
        assert.equal(parseSysfsNumber(sysfs('class/drm/card1/gt_max_freq_mhz')), 1100);
        assert.equal(parseSysfsNumber(sysfs('class/drm/card1/gt_min_freq_mhz')), 350);
        assert.equal(parseSysfsNumber(sysfs('class/drm/card1/power/rc6_residency_ms')), 2362713);

        // The GPU has no sensor of its own: the monitor reads the CPU package instead,
        // in millidegrees, from the coretemp hwmon device
        assert.equal(sysfs('class/hwmon/hwmon1/name').trim(), 'coretemp');
        assert.equal(sysfs('class/hwmon/hwmon1/temp1_label').trim(), 'Package id 0');
        assert.equal(Math.round(parseSysfsNumber(sysfs('class/hwmon/hwmon1/temp1_input')) / 1000), 46);

        // The RAPL domain is located by its name, which is a word and not a number,
        // and its energy_uj is unreadable: neither may turn into NaN and reach the UI
        assert.equal(sysfs('class/powercap/intel-rapl:0:1/name').trim(), 'uncore');
        assert.equal(parseSysfsNumber(sysfs('class/powercap/intel-rapl:0:1/name')), undefined);
        assert.equal(parseSysfsNumber(sysfs('class/powercap/intel-rapl:0:1/energy_uj')), undefined);
    });

    test('activity falls back to the time not spent in rc6', () => {
        // Two consecutive reads of rc6_residency_ms, 1 second apart
        const previous = parseSysfsNumber(sysfs('class/drm/card1/power/rc6_residency_ms'));

        assert.equal(intelActivityFromRc6(previous, previous + 950, 1), 5);
        assert.equal(intelActivityFromRc6(previous, previous, 1), 100); // never asleep
        assert.equal(intelActivityFromRc6(previous, previous + 500, 0.5), 0); // always asleep
        assert.equal(intelActivityFromRc6(previous, previous + 2000, 1), 0); // clamped
        assert.equal(intelActivityFromRc6(previous, previous - 1000, 1), undefined); // wrapped
    });
});
