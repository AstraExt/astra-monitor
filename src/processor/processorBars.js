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

import GObject from 'gi://GObject';

import { BarsBase } from '../bars.js';
import Config from '../config.js';

export const ProcessorBars = GObject.registerClass({
    
}, class ProcessorBarsBase extends BarsBase {
    constructor(params) {
        //default params
        if(params.layers === undefined)
            params.layers = 2;
        
        //TODO: Make these configurable
        //Config.get_string('processor-header-color1');
        //Config.get_string('processor-header-color2');
        if(params.colors === undefined)
            params.colors = ['rgb(29,172,214)', 'rgb(214,29,29)'];
        
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
                values.push([
                    { color: 0, value: usage[i].user / 100.0 },
                    { color: 1, value: (usage[i].total - usage[i].user) / 100.0 },
                ]);
            }
            else {
                values.push([{ color: 0, value: usage[i].total / 100.0 }]);
            }
        }
        this.updateBars(values);
    }
});