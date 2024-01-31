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

type StorageBarsParams = BarProps & {
    colors?: string[]
};

export default GObject.registerClass(
class StorageBars extends BarsBase {
    constructor(params: StorageBarsParams) {
        //TODO: Make these configurable
        if(params.colors === undefined)
            params.colors = ['rgb(29,172,214)'];
        
        super(params);
    }
    
    setUsage(usage: StorageUsage|null) {
        if(!usage || !Object.prototype.hasOwnProperty.call(usage, 'usePercentage')) {
            this.updateBars([]);
            return;
        }
        
        this.updateBars([
            [{ color: 0, value: usage.usePercentage / 100.0 }],
        ]);
    }
});