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
 * intel_gpu_top stream framing and the rc6 activity fallback, both imported from
 * src/gpu/intelGpuUtils.ts, which the monitor itself uses.
 *
 * Run: npm test
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';

import {
    INTEL_SAMPLE_FLUSH,
    intelActivityFromRc6,
    parseIntelGpuSample,
} from '../src/gpu/intelGpuUtils.ts';

// A real (trimmed) capture of: intel_gpu_top -J -s 500
const STREAM = `[
{
	"period": {"duration": 500.0,"unit": "ms"},
	"frequency": {"requested": 350.0,"actual": 350.0,"unit": "MHz"},
	"rc6": {"value": 95.0,"unit": "%"},
	"power": {"GPU": 0.12,"Package": 4.56,"unit": "W"},
	"engines": {
		"Render/3D": {"busy": 12.34,"sema": 0.0,"wait": 0.0,"unit": "%"},
		"Video": {"busy": 0.0,"sema": 0.0,"wait": 0.0,"unit": "%"}
	}
},
{
	"period": {"duration": 500.0,"unit": "ms"},
	"frequency": {"requested": 1100.0,"actual": 1050.0,"unit": "MHz"},
	"rc6": {"value": 5.0,"unit": "%"},
	"power": {"GPU": 2.5,"Package": 12.0,"unit": "W"},
	"engines": {"Render/3D": {"busy": 88.5,"sema": 0.0,"wait": 0.0,"unit": "%"}},
	"clients": {
		"1": {
			"name": "gnome-shell","pid": "1234",
			"engine-classes": {"Render/3D": {"busy": "42.5","unit": "%"}}
		}
	}
},
`;

/** Cuts a stream into samples the way ContinuousTaskManager's flush.match does */
const flushStream = stream => {
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
};

test('every top level object of the stream is parsed', () => {
    const samples = flushStream(STREAM).map(chunk => parseIntelGpuSample(chunk));

    assert.equal(samples.length, 2);
    assert.equal(samples[0].engines['Render/3D'].busy, 12.34);
    assert.equal(samples[0].frequency.actual, 350);
    assert.equal(samples[1].power.GPU, 2.5);
    assert.equal(samples[1].clients['1'].pid, '1234');
});

test('only a closing brace at the start of a line flushes a sample', () => {
    // Nested objects are always indented, so they must not cut a sample in half
    assert.ok(!INTEL_SAMPLE_FLUSH.test('\t\t"engines": {'));
    assert.ok(!INTEL_SAMPLE_FLUSH.test('\t},'));
    assert.ok(!INTEL_SAMPLE_FLUSH.test('\t\t"Video": {"busy": 0.0}'));

    assert.ok(INTEL_SAMPLE_FLUSH.test('},'));
    assert.ok(INTEL_SAMPLE_FLUSH.test('}'));
});

test('a chunk that is not a sample is ignored', () => {
    assert.equal(parseIntelGpuSample(''), undefined);
    assert.equal(parseIntelGpuSample('['), undefined);
    assert.equal(parseIntelGpuSample('\n'), undefined);
    // Truncated output must be reported, not silently taken as an empty sample
    assert.throws(() => parseIntelGpuSample('{"rc6": {"value":'), SyntaxError);
});

test('activity falls back to the time not spent in rc6', () => {
    assert.equal(intelActivityFromRc6(1000, 1950, 1), 5); // asleep 95% of the interval
    assert.equal(intelActivityFromRc6(1000, 1000, 1), 100); // never asleep
    assert.equal(intelActivityFromRc6(1000, 1500, 0.5), 0); // asleep the whole interval
    assert.equal(intelActivityFromRc6(1000, 3000, 1), 0); // clamped: the counter jumped
    assert.equal(intelActivityFromRc6(2000, 1000, 1), undefined); // the counter wrapped
});
