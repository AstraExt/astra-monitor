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
import Config from '../config.js';

type GpuUsage = {
    percent: number;
};

type GpuActivityBarsParams = BarProps & {
    layers?: number;
};

export default GObject.registerClass(
    class GpuActivityBars extends BarsBase {
        constructor(params: GpuActivityBarsParams) {
            //default params
            if(params.layers === undefined) params.layers = 1;

            super(params);

            Config.connect(
                this,
                'changed::gpu-header-activity-bar-color1',
                this.setStyle.bind(this)
            );
        }

        setStyle() {
            super.setStyle();

            this.colors = [
                Config.get_string('gpu-header-activity-bar-color1') ?? 'rgba(29,172,214,1.0)'
            ];
        }

        setUsage(usage: GpuUsage[]) {
            if(!usage || !Array.isArray(usage) || usage.length == 0) {
                this.updateBars([]);
                return;
            }

            const values = [];
            for(let i = 0; i < usage.length; i++) {
                values.push([{ color: 0, value: usage[i].percent / 100 }]);
            }
            this.updateBars(values);
        }
    }
);
