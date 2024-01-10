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
import St from 'gi://St';
import Clutter from 'gi://Clutter';

import Utils from './utils/utils.js';

export const Grid = GObject.registerClass({
    
}, class GridBase extends St.Widget {
    
    /**
     * @param {{numCols?:number, style?:string, styleClass?:string, x_expand?:boolean}} params
     */
    constructor(params) {
        //defaultParams
        if(params.styleClass === undefined)
            params.styleClass = 'astra-monitor-menu-grid';
        if(params.numCols === undefined)
            params.numCols = 2;
        
        const data = {
            style_class: params.styleClass,
            name: 'AstraMonitorGrid',
            layout_manager: new Clutter.GridLayout({orientation: Clutter.Orientation.VERTICAL}),
        };
        if(params.style)
            data.style = params.style;
        if(params.x_expand)
            data.x_expand = params.x_expand;
        super(data);
        
        this.lm = this.layout_manager;
        this.currentRow = 0;
        this.currentCol = 0;
        this.numCols = params.numCols;
    }
    
    addToGrid(widget, colSpan = 1) {
        this.lm.attach(widget, this.currentCol, this.currentRow, colSpan, 1);
        this.currentCol += colSpan;
        if (this.currentCol >= this.numCols) {
            this.currentRow++;
            this.currentCol = 0;
        }
    }
    
    addGrid(widget, col, row, colSpan, rowSpan) {
        this.lm.attach(widget, col, row, colSpan, rowSpan);
    }
    
    getNumCols() {
        return this.numCols;
    }
});