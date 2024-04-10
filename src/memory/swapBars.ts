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

import Config from '../config.js';
import BarsBase, { BarProps } from '../bars.js';
import { SwapUsage } from './memoryMonitor.js';

type SwapBarsParams = BarProps & {
    layers?: number;
    breakdownConfig?: string;
};

export default GObject.registerClass(
    class SwapBars extends BarsBase {
        constructor(params: SwapBarsParams) {
            //default params
            if (params.layers === undefined) params.layers = 2;

            super(params);

            Config.connect(this, 'changed::memory-menu-swap-color', this.setStyle.bind(this));
        }

        setStyle() {
            super.setStyle();

            this.colors = [Config.get_string('memory-menu-swap-color') ?? 'rgba(29,172,214,1.0)'];
        }

        setUsage(usage: SwapUsage | null) {
            if (!usage || !usage.total) {
                this.updateBars([]);
                return;
            }

            this.updateBars([[{ color: 0, value: usage.used / usage.total }]]);
        }
    },
);
