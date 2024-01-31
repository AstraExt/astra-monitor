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
import { StorageIO } from './storageMonitor.js';

type StorageIOBarsParams = BarProps & {
    colors?: string[]
};

export default GObject.registerClass(
class StorageIOBars extends BarsBase {
    constructor(params: StorageIOBarsParams) {
        //TODO: Make these configurable
        if(params.colors === undefined)
            params.colors = ['rgb(29,172,214)', 'rgb(214,29,29)'];
        
        super(params);
    }
    
    setUsage(usage: StorageIO[]|null) {
        if(!usage || !Array.isArray(usage) || usage.length === 0) {
            this.updateBars([]);
            return;
        }
        
        const readSpeed = usage[0].bytesReadPerSec || 0;
        const writeSpeed = usage[0].bytesWrittenPerSec || 0;
        const maxReadSpeed = usage.reduce((max, cur) => Math.max(max, cur.bytesReadPerSec), 0);
        const maxWriteSpeed = usage.reduce((max, cur) => Math.max(max, cur.bytesWrittenPerSec), 0);
        
        this.updateBars([
            [{ color: 0, value: readSpeed / maxReadSpeed }],
            [{ color: 1, value: writeSpeed / maxWriteSpeed }],
        ]);
    }
});