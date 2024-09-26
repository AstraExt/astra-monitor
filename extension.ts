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

import { Extension } from 'resource:///org/gnome/shell/extensions/extension.js';

import AstraMonitorContainer from './src/container.js';
import Utils from './src/utils/utils.js';

import ProcessorMonitor from './src/processor/processorMonitor.js';
import GpuMonitor from './src/gpu/gpuMonitor.js';
import MemoryMonitor from './src/memory/memoryMonitor.js';
import StorageMonitor from './src/storage/storageMonitor.js';
import NetworkMonitor from './src/network/networkMonitor.js';
import SensorsMonitor from './src/sensors/sensorsMonitor.js';

export default class AstraMonitorExtension extends Extension {
    private container?: InstanceType<typeof AstraMonitorContainer>;
    private timeout: number = 0;

    enable() {
        Utils.init({
            service: 'astra-monitor',
            extension: this,
            metadata: this.metadata,
            settings: this.getSettings(),

            ProcessorMonitor,
            GpuMonitor,
            MemoryMonitor,
            StorageMonitor,
            NetworkMonitor,
            SensorsMonitor,
        });
        Utils.log('AstraMonitor enabled');

        this.container = new AstraMonitorContainer();

        // Startup delay to allow the initialization of the monitors
        // avoiding graphical glitches / empty widgets
        this.timeout = GLib.timeout_add(GLib.PRIORITY_DEFAULT, Utils.startupDelay * 1000, () => {
            if(this.container) this.container.place(this.uuid);
            this.timeout = 0;
            Utils.ready = true;
            return false;
        });
    }

    disable() {
        Utils.log('AstraMonitor disabled');
        Utils.ready = false;

        if(this.timeout !== 0) {
            GLib.source_remove(this.timeout);
            this.timeout = 0;
        }

        try {
            this.container?.destroy();
        } catch(e: any) {
            Utils.error('Error destroying container', e);
        }
        this.container = undefined;

        Utils.clear();
    }
}
