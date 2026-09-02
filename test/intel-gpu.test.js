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
 * EVERY describe() BLOCK HOLDS THE DATA OF ONE MACHINE, described by the constant
 * above it: an Intel Kaby Lake-S GT2 running the i915 driver, and an Arc contributed
 * by a user. Other GPUs and other drivers (notably xe, which lays out its sysfs
 * attributes differently) are NOT covered. To add one, capture its own data into
 * test/fixtures/ the way these did, put it in a new describe() block and leave the
 * existing ones untouched.
 *
 * Run: npm test
 */

import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

import {
    INTEL_SAMPLE_FLUSH,
    intelActivity,
    intelActivityFromRc6,
    intelFrequency,
    intelPower,
    intelVram,
    parseIntelGpuSample,
    parseMemTotal,
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

/** First lines of /proc/meminfo of the same machine, the total the iGPU allocates from */
const MEMINFO_FIXTURE = new URL('./fixtures/proc-meminfo-hd630', import.meta.url);

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
        assert.equal(
            Math.round(parseSysfsNumber(sysfs('class/hwmon/hwmon1/temp1_input')) / 1000),
            46
        );

        // The RAPL domain is located by its name, which is a word and not a number,
        // and its energy_uj is unreadable: neither may turn into NaN and reach the UI
        assert.equal(sysfs('class/powercap/intel-rapl:0:1/name').trim(), 'uncore');
        assert.equal(parseSysfsNumber(sysfs('class/powercap/intel-rapl:0:1/name')), undefined);
        assert.equal(parseSysfsNumber(sysfs('class/powercap/intel-rapl:0:1/energy_uj')), undefined);
    });

    test('a sample of intel_gpu_top wins over sysfs', () => {
        const sample = flushStream(readFileSync(STREAM_FIXTURE, 'utf8'))
            .map(chunk => parseIntelGpuSample(chunk))
            .shift();
        const rc6 = parseSysfsNumber(sysfs('class/drm/card1/power/rc6_residency_ms'));

        const activity = intelActivity(sample, rc6, rc6 + 950, 1);
        assert.equal(activity.GFX, 54.033823); // Render/3D of the sample, not the 5% of rc6
        assert.equal(activity.pipes.length, 4);

        assert.deepEqual(intelPower(sample, 0, 5_000_000, 1), { value: 1.37, unit: 'W' });
        assert.equal(intelFrequency(sample, sysfs('class/drm/card1/gt_cur_freq_mhz')), 247);
    });

    test('without intel_gpu_top everything comes from sysfs', () => {
        // No sample at all: the binary is missing, or was killed, or reported nothing yet
        const rc6 = parseSysfsNumber(sysfs('class/drm/card1/power/rc6_residency_ms'));

        const activity = intelActivity(undefined, rc6, rc6 + 950, 1);
        assert.equal(activity.GFX, 5);
        assert.deepEqual(activity.pipes, []);

        // 5 J over 1 s, read from the RAPL counter in microjoules
        assert.deepEqual(intelPower(undefined, 0, 5_000_000, 1), { value: 5, unit: 'W' });
        assert.equal(intelFrequency(undefined, sysfs('class/drm/card1/gt_cur_freq_mhz')), 400);
    });

    test('a sample that reports nothing falls back to sysfs as well', () => {
        // intel_gpu_top keeps running but its sample is empty or partial: without a
        // permission to read the engines it emits them empty, and without a supported
        // power meter it omits the power entirely
        const rc6 = parseSysfsNumber(sysfs('class/drm/card1/power/rc6_residency_ms'));
        const unhealthy = { engines: {}, frequency: {}, power: {} };

        assert.equal(intelActivity(unhealthy, rc6, rc6 + 950, 1).GFX, 5);
        assert.deepEqual(intelPower(unhealthy, 0, 5_000_000, 1), { value: 5, unit: 'W' });
        assert.equal(intelFrequency(unhealthy, sysfs('class/drm/card1/gt_cur_freq_mhz')), 400);

        // And when sysfs has nothing either, nothing is reported instead of a NaN
        assert.deepEqual(intelActivity(unhealthy, undefined, undefined, 1), { pipes: [] });
        assert.equal(intelPower(unhealthy, undefined, undefined, 1), undefined);
        assert.equal(intelFrequency(unhealthy, ''), undefined);

        // A RAPL counter that wrapped around is not turned into a negative power
        assert.equal(intelPower(unhealthy, 5_000_000, 0, 1), undefined);
    });

    test('vram is the resident memory of every client, out of the system memory', () => {
        const sample = flushStream(readFileSync(STREAM_FIXTURE, 'utf8'))
            .map(chunk => parseIntelGpuSample(chunk))
            .shift();

        // An iGPU has a single 'system' region: its memory is a share of the RAM
        const vram = intelVram(sample);
        assert.deepEqual(vram.regions, [{ name: 'system', used: 525291520 }]);
        assert.equal(vram.used, 525291520);

        // Every client of the sample is summed, buffers shared between them included:
        // ghostty alone holds 65150976 of the total
        assert.equal(Object.keys(sample.clients).length, 9);
        assert.ok(vram.used > parseFloat(sample.clients['4294952744'].memory.system.resident));

        const total = parseMemTotal(readFileSync(MEMINFO_FIXTURE, 'utf8'));
        assert.equal(total, 7484408 * 1024);
        assert.equal(Math.round((vram.used / total) * 100), 7);

        // Without intel_gpu_top, or before its first sample, there is nothing to sum
        assert.equal(intelVram(undefined), undefined);
        assert.equal(intelVram({ engines: {} }), undefined);
        assert.equal(intelVram({ clients: { 1: { name: 'x', memory: {} } } }), undefined);

        // A total that isn't there must not turn into a NaN denominator
        assert.equal(parseMemTotal(''), undefined);
        assert.equal(parseMemTotal('MemFree:          232516 kB\n'), undefined);
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

/**
 * A second capture, contributed by a user running an Intel Arc GPU. Only the
 * intel_gpu_top stream was captured: there is no sysfs, no /proc/meminfo and no record
 * of the driver, so the expectations below cover the stream and the fallbacks the
 * monitor takes when sysfs has nothing to offer.
 */
const ARC = {
    gpu: 'Intel Arc (exact model not recorded)',
    driver: 'not recorded',
    contributor: 'silentsudin',
};

/** Captured with intel_gpu_top -J, ~1 s apart, no sysfs alongside it */
const ARC_FIXTURE = new URL('./fixtures/intel_gpu_top-unknown-arc-silentsudin.json', import.meta.url);

describe(`Intel GPU, ${ARC.gpu}, contributed by ${ARC.contributor}`, { concurrency: false }, () => {
    const samples = flushStream(readFileSync(ARC_FIXTURE, 'utf8')).map(chunk =>
        parseIntelGpuSample(chunk)
    );

    test('a stream that never opened its array is cut into samples all the same', () => {
        // This capture holds no '[' at all: it starts on a blank line followed by the
        // first sample, and the last one has no trailing comma, so the framing the
        // hd630 capture exercises must not be a requirement
        assert.equal(samples.length, 8);
        assert.equal(samples[0].period.unit, 'ms');
        assert.equal(samples[0].period.duration, 49.738576);

        // The first sample of intel_gpu_top covers a fraction of the interval: the
        // engines had nothing to report yet, and the second one is the first real one
        assert.equal(samples[1].period.duration, 1034.131974);
        assert.equal(samples[1].engines['Render/3D/0'].busy, 0.909035);
        assert.equal(samples[1].engines['Blitter/0'].busy, 0.009005);
    });

    test('an idle sample reports no activity instead of falling back to rc6', () => {
        // Every engine of the first sample is at 0: the pipes are still there, so the
        // rc6 fallback is not taken and the GPU is reported idle rather than 39% busy
        const idle = intelActivity(samples[0], undefined, undefined, 1);
        assert.equal(idle.GFX, 0);
        assert.equal(idle.pipes.length, 6);
        assert.equal(samples[0].rc6.value, 61.276543);

        const busy = intelActivity(samples[5], undefined, undefined, 1);
        assert.equal(busy.GFX, 1.070172); // Render/3D/0, the busiest engine of the capture
    });

    test('a GPU power meter reporting zero is still a reading', () => {
        // This GPU reports no power of its own, only the package one: 0 W is a number
        // and is reported as it is, the RAPL fallback is only for a missing reading
        assert.equal(samples[1].power.GPU, 0);
        assert.equal(samples[1].power.Package, 4.579177);
        assert.deepEqual(intelPower(samples[1], 0, 5_000_000, 1), { value: 0, unit: 'W' });
    });

    test('the frequency comes from the sample even when sysfs is not readable', () => {
        // No sysfs was captured with this stream, which is also what the monitor sees
        // when the card exposes no gt_cur_freq_mhz: the sample carries the frequency
        assert.equal(intelFrequency(samples[1], ''), 14); // 13.537924 MHz, rounded
        assert.equal(intelFrequency(samples[5], ''), 17);

        // The first sample measured no actual frequency: 0 is reported, not the 784 MHz
        // the driver was asked for
        assert.equal(samples[0].frequency.requested, 784.099649);
        assert.equal(intelFrequency(samples[0], ''), 0);
    });

    test('clients without memory report no vram at all', () => {
        // intel_gpu_top only reports client memory when the driver exposes it: here it
        // does not, for any of the 10 clients, and no total may be invented from that
        assert.equal(Object.keys(samples[0].clients).length, 10);
        assert.equal(samples[0].clients['4294948298'].name, 'nautilus');
        assert.equal(samples[0].clients['4294948298'].memory, undefined);

        for(const sample of samples) assert.equal(intelVram(sample), undefined);
    });
});
