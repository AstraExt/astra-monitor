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
import St from 'gi://St';
import Clutter from 'gi://Clutter';

type GridProps = {
    numCols?: number;
    style?: string;
    styleClass?: string;
    xExpand?: boolean;
    yExpand?: boolean;
    xAlign?: Clutter.ActorAlign;
    yAlign?: Clutter.ActorAlign;
    orientation?: Clutter.Orientation;
};
export default GObject.registerClass(
    class Grid extends St.Widget {
        private lm: Clutter.GridLayout;
        private currentRow: number;
        private currentCol: number;
        private numCols: number;

        constructor(params: GridProps = {}) {
            //defaultParams
            if(params.styleClass === undefined) params.styleClass = 'astra-monitor-menu-grid';
            if(params.numCols === undefined) params.numCols = 2;
            if(params.orientation === undefined) params.orientation = Clutter.Orientation.VERTICAL;

            const data: any = {
                styleClass: params.styleClass,
                name: 'AstraMonitorGrid',
                layoutManager: new Clutter.GridLayout({ orientation: params.orientation }),
            };
            if(params.style) data.style = params.style;
            if(params.xExpand) data.xExpand = params.xExpand;
            else data.xExpand = true;
            if(params.yExpand) data.yExpand = params.yExpand;
            else data.yExpand = true;
            if(params.xAlign) data.xAlign = params.xAlign;
            if(params.yAlign) data.yAlign = params.yAlign;
            super(data);

            // @ts-expect-error Clutter.GridLayout not updated in gjs
            this.lm = this.layoutManager;
            this.currentRow = 0;
            this.currentCol = 0;
            this.numCols = params.numCols;
        }

        newLine() {
            if(this.currentCol > 0) {
                this.currentRow++;
                this.currentCol = 0;
            }
        }

        addToGrid(widget: any, colSpan = 1) {
            this.lm.attach(widget, this.currentCol, this.currentRow, colSpan, 1);
            this.currentCol += colSpan;
            if(this.currentCol >= this.numCols) {
                this.currentRow++;
                this.currentCol = 0;
            }
        }

        addGrid(widget: any, col: number, row: number, colSpan: number, rowSpan: number) {
            this.lm.attach(widget, col, row, colSpan, rowSpan);
        }

        getNumCols() {
            return this.numCols;
        }
    }
);
