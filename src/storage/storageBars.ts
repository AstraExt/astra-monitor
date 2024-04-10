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

import GObject from 'gi://GObject';

import BarsBase, { BarProps } from '../bars.js';
import { StorageUsage } from './storageMonitor.js';
import Config from '../config.js';

type StorageBarsParams = BarProps & {
    /* empty */
};

export default GObject.registerClass(
    class StorageBars extends BarsBase {
        constructor(params: StorageBarsParams) {
            super(params);

            Config.connect(this, `changed::${this.colorConfig}`, this.setStyle.bind(this));
        }

        get colorConfig() {
            if(this.header) return 'storage-header-bars-color1';
            return 'storage-menu-device-color';
        }

        setStyle() {
            super.setStyle();

            this.colors = [Config.get_string(this.colorConfig) ?? 'rgba(29,172,214,1.0)'];
        }

        setUsage(usage: StorageUsage | null) {
            if(!usage || !Object.prototype.hasOwnProperty.call(usage, 'usePercentage')) {
                this.updateBars([]);
                return;
            }

            this.updateBars([[{ color: 0, value: usage.usePercentage / 100.0 }]]);
        }
    }
);
