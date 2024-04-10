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

import Utils from './utils/utils.js';
import Config from './config.js';

//cairo.Context has no types and is currently empty
export type CairoContext = any;

export type GraphProps = {
    mini?: boolean;
    width?: number;
    x_align?: Clutter.ActorAlign;
    y_align?: Clutter.ActorAlign;
};

type GraphInfo = {
    ctx: CairoContext;
    points: number[][];
    baseX: number;
    baseY: number;
    height: number;
    pointSpacing: number;
};

export default GObject.registerClass(
    class GraphBase<T> extends St.BoxLayout {
        protected mini: boolean;
        protected historyLimit: number;
        protected historyChart: St.DrawingArea;
        protected grid?: St.Widget;
        protected historyGrid?: Clutter.GridLayout;
        protected history?: T[];

        constructor(params: GraphProps = {}) {
            //default params
            if (params.width === undefined) params.width = 50;
            if (params.mini === undefined) params.mini = false;
            if (params.x_align === undefined) params.x_align = Clutter.ActorAlign.CENTER;
            if (params.y_align === undefined) params.y_align = Clutter.ActorAlign.CENTER;

            if (params.mini) params.y_align = Clutter.ActorAlign.FILL;

            super({
                style_class: 'astra-monitor-graph-container',
                x_align: params.x_align,
                x_expand: true,
                y_align: params.y_align,
                y_expand: true,
            });

            this.mini = params.mini;
            this.historyLimit = params.width;

            const style_class = this.mini ? 'astra-monitor-graph-mini' : 'astra-monitor-graph';

            this.historyChart = new St.DrawingArea({
                style_class: style_class,
                style: `width:${params.width}px;`,
            });

            if (!this.mini) {
                this.grid = new St.Widget({
                    layout_manager: new Clutter.GridLayout({
                        orientation: Clutter.Orientation.VERTICAL,
                    }),
                });
                // @ts-expect-error Clutter.GridLayout not updated in gjs
                this.historyGrid = this.grid.layout_manager;
                if (this.historyGrid) this.historyGrid.attach(this.historyChart, 0, 0, 2, 3);
                this.add_child(this.grid);

                this.buildHistoryGrid();
            } else {
                this.add_child(this.historyChart);
            }

            this.setStyle();

            this.historyChart.connect('repaint', this.repaint.bind(this));
            Config.connect(this, 'changed::theme-style', this.setStyle.bind(this));
        }

        buildHistoryGrid() {
            Utils.error('buildHistoryGrid MUST BE OVERWRITTEN');
        }

        repaint() {
            Utils.error('repaint MUST BE OVERWRITTEN');
        }

        setStyle() {
            Utils.error('setStyle MUST BE OVERWRITTEN');
        }

        setWidth(width: number) {
            this.historyLimit = width;
            this.historyChart.style = `width:${width}px;`;
        }

        setupClipping(ctx: CairoContext, width: number, height: number, cornerRadius: number) {
            if (this.mini) {
                ctx.moveTo(cornerRadius, 0);
                ctx.lineTo(width - cornerRadius, 0);
                ctx.arc(
                    width - cornerRadius,
                    cornerRadius,
                    cornerRadius,
                    1.5 * Math.PI,
                    2 * Math.PI,
                );
                ctx.lineTo(width, height - cornerRadius);
                ctx.arc(
                    width - cornerRadius,
                    height - cornerRadius,
                    cornerRadius,
                    0,
                    0.5 * Math.PI,
                );
                ctx.lineTo(cornerRadius, height);
                ctx.arc(cornerRadius, height - cornerRadius, cornerRadius, 0.5 * Math.PI, Math.PI);
                ctx.lineTo(0, cornerRadius);
                ctx.arc(cornerRadius, cornerRadius, cornerRadius, Math.PI, 1.5 * Math.PI);
                ctx.clip();
            }
        }

        drawGraph(
            ctx: CairoContext,
            data: any[],
            dataFunc: (node: any) => number,
            baseX: number,
            baseY: number,
            height: number,
            pointSpacing: number,
        ) {
            let points = [];

            for (let i = 0; i < data.length; i++) {
                const currentNode = data[data.length - 1 - i];

                let usage = dataFunc(currentNode);
                if (!usage || isNaN(usage)) usage = 0;
                usage = Math.max(0, Math.min(1, usage));

                const x = Math.round(i * pointSpacing);
                const y = Math.round(usage * height);
                points.push([x, y]);
            }

            points = Utils.movingAveragePoints(points, this.mini ? 2 : 4);
            this.drawPoints({ ctx, points, baseX, baseY, height, pointSpacing });
        }

        drawPoints({ ctx, points, baseX, baseY, height, pointSpacing }: GraphInfo) {
            if (!ctx) return;
            if (points.length < 2) return;
            if (height <= 0) return;
            if (pointSpacing <= 0) return;

            let currentX = baseX + points[0][0];
            ctx.moveTo(currentX, baseY + height);

            let currentY = baseY + height - points[0][1];
            ctx.lineTo(currentX, currentY);

            for (let i = 1; i < points.length; i++) {
                currentX = baseX + points[i][0];
                currentY = baseY + height - points[i][1];
                ctx.lineTo(currentX, currentY);
            }

            ctx.lineTo(baseX + (points.length - 1) * pointSpacing, baseY + height);
            ctx.closePath();
            ctx.fill();
        }

        setUsageHistory(usageHistory: any[]) {
            this.history = usageHistory;
            this.historyChart.queue_repaint();
        }

        destroy() {
            Config.clear(this);
            super.destroy();
        }
    },
);
