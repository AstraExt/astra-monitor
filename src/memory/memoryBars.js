/*
 * Copyright (C) 2023 Lju
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

import { BarsBase } from '../bars.js';
import Config from '../config.js';

export const MemoryBars = GObject.registerClass({
    
}, class MemoryBarsBase extends BarsBase {
    constructor(params) {
        //default params
        if(params.layers === undefined)
            params.layers = 2;
        
        //TODO: Make these configurable
        params.colors = [
            'rgb(29,172,214)',
            'rgb(214,29,29)'
        ];
        
        super(params);
    }
    
    setUsage(usage) {
        if(!usage || !Array.isArray(usage) || usage.length == 0) {
            this.updateBars([]);
            return;
        }
        
        const values = [];
        for (let i = 0; i < usage.length; i++) {
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