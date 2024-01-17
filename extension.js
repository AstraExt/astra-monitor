/*
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

import { Container } from './src/container.js';
import Utils from './src/utils/utils.js';
import Config from './src/config.js';

import { ProcessorMonitor } from './src/processor/processorMonitor.js';
import { MemoryMonitor } from './src/memory/memoryMonitor.js';
import { StorageMonitor } from './src/storage/storageMonitor.js';
import { NetworkMonitor } from './src/network/networkMonitor.js';
import { SensorsMonitor } from './src/sensors/sensorsMonitor.js';

export default class AstraMonitorExtension extends Extension {
    enable() {
        Utils.extension = this;
        Utils.metadata = this.metadata;
        Config.settings = this.getSettings();
        Utils.init();
        
        Utils.log('AstraMonitor enabled');
        
        Utils.processorMonitor = new ProcessorMonitor();
        Utils.memoryMonitor = new MemoryMonitor();
        Utils.storageMonitor = new StorageMonitor();
        Utils.networkMonitor = new NetworkMonitor();
        Utils.sensorsMonitor = new SensorsMonitor();
        
        this.container = new Container();
        this.container.place(this.uuid);
        this.container.visible = false;
        
        // 3 seconds delay to allow the initialization of all monitors
        // avoiding graphical glitches / empty widgets
        const time = Utils.debug ? 0 : 3000;
        this.timeout = GLib.timeout_add(
            GLib.PRIORITY_DEFAULT,
            time,
            () => {
                if(this.container)
                    this.container.visible = true;
                this.timeout = 0;
                return false;
            }
        );
    }
    
    disable() {
        Utils.log('AstraMonitor disabled');
        
        try {
            Config.clearAll();
        }
        catch(e) {
            Utils.error(e);
        }
        
        if(this.timeout) {
            GLib.source_remove(this.timeout);
            this.timeout = null;
        }
        
        try {
            Utils.processorMonitor?.stop();
            Utils.processorMonitor?.destroy();
            
            Utils.memoryMonitor?.stop();
            Utils.memoryMonitor?.destroy();
            
            Utils.storageMonitor?.stop();
            Utils.storageMonitor?.destroy();
            
            Utils.networkMonitor?.stop();
            Utils.networkMonitor?.destroy();
            
            Utils.sensorsMonitor?.stop();
            Utils.sensorsMonitor?.destroy();
        }
        catch(e) {
            Utils.error(e);
        }
        
        try {
            this.container?.destroy();
            this.container = null;
        }
        catch(e) {
            Utils.error(e);
        }
        
        Utils.processorMonitor = null;
        Utils.memoryMonitor = null;
        Utils.storageMonitor = null;
        Utils.networkMonitor = null;
        Utils.sensorsMonitor = null;
        
        Utils.extension = null;
        Utils.metadata = null;
        Config.settings = null;
    }
}