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
import { MemoryUsage } from './memoryMonitor.js';

type MemoryBarsParams = BarProps & {
    layers?: number
};

export default GObject.registerClass(
class MemoryBars extends BarsBase {
    constructor(params: MemoryBarsParams) {
        //default params
        if(params.layers === undefined)
            params.layers = 2;
        
        super(params);
        
        Config.connect(this, 'changed::memory-header-bars-color1', this.setStyle.bind(this));
        Config.connect(this, 'changed::memory-header-bars-color2', this.setStyle.bind(this));
    }
    
    setStyle() {
        super.setStyle();
        
        this.colors = [
            Config.get_string('memory-header-bars-color1') ?? 'rgba(29,172,214,1.0)',
            Config.get_string('memory-header-bars-color2') ?? 'rgba(29,172,214,0.3)'
        ];
    }
    
    setUsage(usage: MemoryUsage[]) {
        if(!usage || !Array.isArray(usage) || usage.length == 0) {
            this.updateBars([]);
            return;
        }
        
        const values = [];
        for(let i = 0; i < usage.length; i++) {
            if(!this.breakdownConfig || Config.get_boolean(this.breakdownConfig)) {
                const total = usage[i].total;
                const used = usage[i].used / total;
                const allocated = (usage[i].allocated - usage[i].used) / total;
                
                values.push([
                    { color: 0, value: used },
                    { color: 1, value: allocated },
                ]);
            }
            else {
                values.push([{ color: 0, value: usage[i].used / usage[i].total }]);
            }
        }
        this.updateBars(values);
    }
});