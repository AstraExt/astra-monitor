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
import Gio from 'gi://Gio';
import St from 'gi://St';
import Clutter from 'gi://Clutter';

import * as PopupMenu from 'resource:///org/gnome/shell/ui/popupMenu.js';
import * as Main from 'resource:///org/gnome/shell/ui/main.js';

import Header from '../header.js';
import Config from '../config.js';
import Utils from '../utils/utils.js';
import GpuMenu from './gpuMenu.js';
import GpuActivityGraph from './gpuActivityGraph.js';
import GpuMemoryGraph from './gpuMemoryGraph.js';
import GpuActivityBars from './gpuActivityBars.js';
import GpuMemoryBars from './gpuMemoryBars.js';
import MenuBase from '../menu.js';
import { GenericGpuInfo } from './gpuMonitor.js';

type TooltipMenu = PopupMenu.PopupMenu & {
    actor: St.Widget;
};

type TooltipItem = PopupMenu.PopupMenuItem & {
    label: St.Label;
};

export default GObject.registerClass(
    class GpuHeader extends Header {
        protected icon!: St.Icon;
        protected activityBar!: InstanceType<typeof GpuActivityBars>;
        protected activityGraph!: InstanceType<typeof GpuActivityGraph>;
        protected activityPercentage!: St.Label;
        protected memoryBar!: InstanceType<typeof GpuMemoryBars>;
        protected memoryGraph!: InstanceType<typeof GpuMemoryGraph>;
        protected memoryPercentage!: St.Label;
        protected memoryValue!: St.Label;

        protected tooltipMenu!: TooltipMenu;
        protected tooltipItem!: TooltipItem;

        constructor() {
            super('Processor Header');

            this.buildIcon();
            this.buildActivityBar();
            this.buildActivityGraph();
            this.buildActivityPercentage();
            this.buildMemoryBar();
            this.buildMemoryGraph();
            this.buildMemoryPercentage();
            this.buildMemoryValue();

            this.addOrReorderIndicators();

            const menu = new GpuMenu(this, 0.5, MenuBase.arrowAlignement);
            this.setMenu(menu);

            Config.connect(
                this,
                'changed::gpu-indicators-order',
                this.addOrReorderIndicators.bind(this)
            );
        }

        get showConfig() {
            return 'gpu-header-show';
        }

        addOrReorderIndicators() {
            const indicators = Utils.getIndicatorsOrder('gpu');

            let position = 0;
            for(const indicator of indicators) {
                let widget;
                switch(indicator) {
                    case 'icon':
                        widget = this.icon;
                        break;
                    case 'activity bar':
                        widget = this.activityBar;
                        break;
                    case 'activity graph':
                        widget = this.activityGraph;
                        break;
                    case 'activity percentage':
                        widget = this.activityPercentage;
                        break;
                    case 'memory bar':
                        widget = this.memoryBar;
                        break;
                    case 'memory graph':
                        widget = this.memoryGraph;
                        break;
                    case 'memory percentage':
                        widget = this.memoryPercentage;
                        break;
                    case 'memory value':
                        widget = this.memoryValue;
                        break;
                }

                if(widget) {
                    if(widget.get_parent()) this.remove_child(widget);
                    this.insert_child_at_index(widget, position++);
                }
            }
        }

        buildIcon() {
            const defaultStyle = 'margin-left:2px;margin-right:4px;';
            let iconSize = Config.get_int('gpu-header-icon-size');
            iconSize = Math.max(8, Math.min(30, iconSize));
            this.icon = new St.Icon({
                fallbackGicon: Utils.getLocalIcon('am-gpu-symbolic'),
                style: defaultStyle,
                iconSize: iconSize,
                yExpand: false,
                yAlign: Clutter.ActorAlign.CENTER,
                xAlign: Clutter.ActorAlign.CENTER,
            });

            const setIconName = () => {
                const iconCustom = Config.get_string('gpu-header-icon-custom');
                if(iconCustom) this.icon.iconName = iconCustom;
                // @ts-expect-error gicon shouldn't be null, but we do have a fallback icon
                else this.icon.gicon = Utils.getLocalIcon('am-gpu-symbolic');
            };
            setIconName();

            let baseColor = '';
            let alertColor = '';
            const alerts = new Set();

            const updateIconColor = () => {
                if(alerts.size > 0) this.icon.style = defaultStyle + 'color:' + alertColor + ';';
                else if(baseColor) this.icon.style = defaultStyle + 'color:' + baseColor + ';';
                else this.icon.style = defaultStyle;
            };

            const setIconBaseColor = () => {
                baseColor = Config.get_string('gpu-header-icon-color') || '';
                updateIconColor();
            };
            const setIconAlertColor = () => {
                alertColor = Config.get_string('gpu-header-icon-alert-color') || '';
                updateIconColor();
            };

            setIconBaseColor();
            setIconAlertColor();
            updateIconColor();

            Config.bind('gpu-header-icon', this.icon, 'visible', Gio.SettingsBindFlags.GET);
            Config.bind('gpu-header-icon-size', this.icon, 'icon_size', Gio.SettingsBindFlags.GET);
            Config.connect(this.icon, 'changed::gpu-header-icon-custom', setIconName.bind(this));
            Config.connect(
                this.icon,
                'changed::gpu-header-icon-color',
                setIconBaseColor.bind(this)
            );
            Config.connect(
                this.icon,
                'changed::gpu-header-icon-alert-color',
                setIconAlertColor.bind(this)
            );

            Utils.gpuMonitor.listen(this.icon, 'gpuUpdate', (data: Map<string, GenericGpuInfo>) => {
                if(!Config.get_boolean('gpu-header-icon')) return;

                const activityThreshold =
                    Config.get_int('gpu-header-activity-percentage-icon-alert-threshold') || 0;
                const memoryThreshold =
                    Config.get_int('gpu-header-memory-percentage-icon-alert-threshold') || 0;
                if(activityThreshold === 0 && memoryThreshold) {
                    if(alerts.size > 0) {
                        alerts.clear();
                        updateIconColor();
                    }
                    return;
                }

                const mainGpu = Utils.gpuMonitor.getMainGpu();
                if(!mainGpu) return;

                if(!data) return;

                const gpuData = data.get(Utils.getPCI(mainGpu));
                if(!gpuData || !gpuData.activity || gpuData.activity.GFX === undefined) return;

                if(activityThreshold > 0) {
                    if(gpuData.activity.GFX < activityThreshold) {
                        if(alerts.has('gpuActivity')) {
                            alerts.delete('gpuActivity');
                            updateIconColor();
                        }
                    } else {
                        if(!alerts.has('gpuActivity')) {
                            alerts.add('gpuActivity');
                            updateIconColor();
                        }
                    }
                }

                if(memoryThreshold > 0) {
                    if(gpuData.vram && gpuData.vram.percent !== undefined) {
                        if(gpuData.vram.percent < memoryThreshold) {
                            if(alerts.has('gpuMemory')) {
                                alerts.delete('gpuMemory');
                                updateIconColor();
                            }
                        } else {
                            if(!alerts.has('gpuMemory')) {
                                alerts.add('gpuMemory');
                                updateIconColor();
                            }
                        }
                    }
                }
            });
        }

        buildActivityBar() {
            if(this.activityBar) {
                this.remove_child(this.activityBar);
                Config.clear(this.activityBar);
                Utils.gpuMonitor.unlisten(this.activityBar);
                this.activityBar.destroy();
            }

            this.activityBar = new GpuActivityBars({
                numBars: 1,
                header: true,
                mini: true,
                width: 0.5,
                //breakdownConfig: 'gpu-header-activity-bar-breakdown'
            });
            Config.bind(
                'gpu-header-activity-bar',
                this.activityBar,
                'visible',
                Gio.SettingsBindFlags.GET
            );

            Utils.gpuMonitor.listen(
                this.activityBar,
                'gpuUpdate',
                this.updateActivityBar.bind(this)
            );
        }

        updateActivityBar(data: Map<string, GenericGpuInfo>) {
            if(!this.visible) return;
            if(!Config.get_boolean('gpu-header-activity-bar')) return;

            const mainGpu = Utils.gpuMonitor.getMainGpu();
            if(!mainGpu) return;

            if(!data) return;

            const mainPci = `${mainGpu.domain}:${mainGpu.bus}.${mainGpu.slot}`;
            const gpuData = data.get(mainPci);
            if(!gpuData) return;

            if(!gpuData.activity || gpuData.activity.GFX === undefined)
                this.activityBar.setUsage([]);
            else this.activityBar.setUsage([{ percent: gpuData.activity.GFX }]);
        }

        buildActivityGraph() {
            if(this.activityGraph) {
                this.remove_child(this.activityGraph);
                Config.clear(this.activityGraph);
                Utils.gpuMonitor.unlisten(this.activityGraph);
                this.activityGraph.destroy();
            }

            {
                let graphWidth = Config.get_int('gpu-header-activity-graph-width');
                graphWidth = Math.max(10, Math.min(500, graphWidth));
                this.activityGraph = new GpuActivityGraph({ width: graphWidth, mini: true });
            }
            Config.bind(
                'gpu-header-activity-graph',
                this.activityGraph,
                'visible',
                Gio.SettingsBindFlags.GET
            );

            Config.connect(this.activityGraph, 'changed::gpu-header-activity-graph-width', () => {
                let graphWidth = Config.get_int('gpu-header-activity-graph-width');
                graphWidth = Math.max(10, Math.min(500, graphWidth));
                this.activityGraph.setWidth(graphWidth);
            });

            Utils.gpuMonitor.listen(
                this.activityGraph,
                'gpuUpdate',
                this.updateActivityGraph.bind(this)
            );
        }

        updateActivityGraph() {
            if(!this.visible) return;
            if(!Config.get_boolean('gpu-header-activity-graph')) return;
            let usage: Map<string, GenericGpuInfo>[] = Utils.gpuMonitor.getUsageHistory('gpu');

            const mainGpu = Utils.gpuMonitor.getMainGpu();
            const monitoredGPUs = Utils.gpuMonitor.getMonitoredGPUs();
            if(mainGpu && monitoredGPUs && monitoredGPUs.length > 0) {
                const mainPci = Utils.getPCI(mainGpu);
                usage = usage.filter(node => node.has(mainPci));
            }

            this.activityGraph.setUsageHistory(usage);
        }

        buildActivityPercentage() {
            this.activityPercentage = new St.Label({
                text: Utils.zeroStr + '%',
                styleClass: 'astra-monitor-header-percentage3',
                yAlign: Clutter.ActorAlign.CENTER,
            });
            Config.bind(
                'gpu-header-activity-percentage',
                this.activityPercentage,
                'visible',
                Gio.SettingsBindFlags.GET
            );

            Utils.gpuMonitor.listen(
                this.activityPercentage,
                'gpuUpdate',
                this.updateActivityPercentage.bind(this)
            );
        }

        updateActivityPercentage(data: Map<string, GenericGpuInfo>) {
            if(!this.visible) return;
            if(!Config.get_boolean('gpu-header-activity-percentage')) return;

            const mainGpu = Utils.gpuMonitor.getMainGpu();
            if(!mainGpu) {
                this.activityPercentage.text = '-%';
                return;
            }

            if(!data) {
                this.activityPercentage.text = '-%';
                return;
            }

            const gpuData = data.get(Utils.getPCI(mainGpu));
            if(!gpuData) {
                this.activityPercentage.text = '-%';
                return;
            }

            if(!gpuData.activity || gpuData.activity.GFX === undefined)
                this.activityPercentage.text = Utils.zeroStr + '%';
            else this.activityPercentage.text = gpuData.activity.GFX + '%';
        }

        buildMemoryBar() {
            if(this.memoryBar) {
                this.remove_child(this.memoryBar);
                Config.clear(this.memoryBar);
                Utils.gpuMonitor.unlisten(this.memoryBar);
                this.memoryBar.destroy();
            }

            this.memoryBar = new GpuMemoryBars({
                layers: 1,
                header: true,
                mini: true,
                width: 0.5,
            });
            Config.bind(
                'gpu-header-memory-bar',
                this.memoryBar,
                'visible',
                Gio.SettingsBindFlags.GET
            );

            Utils.gpuMonitor.listen(this.memoryBar, 'gpuUpdate', this.updateMemoryBar.bind(this));
        }

        updateMemoryBar(data: Map<string, GenericGpuInfo>) {
            if(!this.visible) return;
            if(!Config.get_boolean('gpu-header-memory-bar')) return;

            const mainGpu = Utils.gpuMonitor.getMainGpu();
            if(!mainGpu) return;

            if(!data) return;

            const gpuData = data.get(Utils.getPCI(mainGpu));
            if(!gpuData) return;

            if(!gpuData.vram || gpuData.vram.percent === undefined) this.memoryBar.setUsage([]);
            else this.memoryBar.setUsage([{ percent: gpuData.vram.percent }]);
        }

        buildMemoryGraph() {
            if(this.memoryGraph) {
                this.remove_child(this.memoryGraph);
                Config.clear(this.memoryGraph);
                Utils.gpuMonitor.unlisten(this.memoryGraph);
                this.memoryGraph.destroy();
            }

            {
                let graphWidth = Config.get_int('gpu-header-memory-graph-width');
                graphWidth = Math.max(10, Math.min(500, graphWidth));
                this.memoryGraph = new GpuMemoryGraph({ width: graphWidth, mini: true });
            }
            Config.bind(
                'gpu-header-memory-graph',
                this.memoryGraph,
                'visible',
                Gio.SettingsBindFlags.GET
            );

            Config.connect(this.memoryGraph, 'changed::gpu-header-memory-graph-width', () => {
                let graphWidth = Config.get_int('gpu-header-memory-graph-width');
                graphWidth = Math.max(10, Math.min(500, graphWidth));
                this.memoryGraph.setWidth(graphWidth);
            });

            Utils.gpuMonitor.listen(
                this.memoryGraph,
                'gpuUpdate',
                this.updateMemoryGraph.bind(this)
            );
        }

        updateMemoryGraph() {
            if(!this.visible) return;
            if(!Config.get_boolean('gpu-header-memory-graph')) return;
            let usage: Map<string, GenericGpuInfo>[] = Utils.gpuMonitor.getUsageHistory('gpu');

            const mainGpu = Utils.gpuMonitor.getMainGpu();
            const monitoredGPUs = Utils.gpuMonitor.getMonitoredGPUs();
            if(mainGpu && monitoredGPUs && monitoredGPUs.length > 0) {
                const mainPci = Utils.getPCI(mainGpu);
                usage = usage.filter(node => node.has(mainPci));
            }

            this.memoryGraph.setUsageHistory(usage);
        }

        buildMemoryPercentage() {
            this.memoryPercentage = new St.Label({
                text: Utils.zeroStr + '%',
                styleClass: 'astra-monitor-header-percentage3',
                yAlign: Clutter.ActorAlign.CENTER,
            });
            Config.bind(
                'gpu-header-memory-percentage',
                this.memoryPercentage,
                'visible',
                Gio.SettingsBindFlags.GET
            );

            Utils.gpuMonitor.listen(
                this.memoryPercentage,
                'gpuUpdate',
                this.updateMemoryPercentage.bind(this)
            );
        }

        updateMemoryPercentage(data: Map<string, GenericGpuInfo>) {
            if(!this.visible) return;
            if(!Config.get_boolean('gpu-header-memory-percentage')) return;

            const mainGpu = Utils.gpuMonitor.getMainGpu();
            if(!mainGpu) {
                this.memoryPercentage.text = '-%';
                return;
            }

            if(!data) {
                this.memoryPercentage.text = '-%';
                return;
            }

            const gpuData = data.get(Utils.getPCI(mainGpu));
            if(!gpuData) {
                this.memoryPercentage.text = '-%';
                return;
            }

            if(!gpuData.vram || gpuData.vram.percent === undefined)
                this.memoryPercentage.text = Utils.zeroStr + '%';
            else this.memoryPercentage.text = Math.round(gpuData.vram.percent) + '%';
        }

        buildMemoryValue() {}

        update() {
            const data = Utils.gpuMonitor.getCurrentValue('gpu');
            this.updateActivityBar(data);
            this.updateActivityGraph();
            this.updateActivityPercentage(data);
            this.updateMemoryBar(data);
            this.updateMemoryGraph();
            this.updateMemoryPercentage(data);
        }

        createTooltip() {
            this.tooltipMenu = new PopupMenu.PopupMenu(
                this,
                0.5,
                MenuBase.arrowAlignement
            ) as TooltipMenu;

            Main.uiGroup.add_child(this.tooltipMenu.actor);
            this.tooltipMenu.actor.add_style_class_name('astra-monitor-tooltip-menu');
            this.tooltipMenu.actor.xExpand = true;
            this.tooltipMenu.actor.hide();

            this.tooltipItem = new PopupMenu.PopupMenuItem('', {
                reactive: true,
                style_class: 'astra-monitor-tooltip-item',
            }) as TooltipItem;
            this.tooltipItem.actor.xExpand = true;
            this.tooltipItem.actor.xAlign = Clutter.ActorAlign.CENTER;
            this.tooltipItem.sensitive = true;
            this.tooltipMenu.addMenuItem(this.tooltipItem);

            Config.connect(this.tooltipMenu, 'changed::gpu-header-tooltip', () => {
                if(!Config.get_boolean('gpu-header-tooltip')) this.tooltipMenu.close(true);
            });

            Utils.gpuMonitor.listen(
                this.tooltipMenu,
                'gpuUpdate',
                (data: Map<string, GenericGpuInfo>) => {
                    if(!Config.get_boolean('gpu-header-tooltip')) return;

                    const values: string[] = [];

                    const mainGpu = Utils.gpuMonitor.getMainGpu();
                    if(!mainGpu) return;

                    if(!data) return;

                    const gpuData = data.get(Utils.getPCI(mainGpu));
                    if(!gpuData) return;

                    if(
                        Config.get_boolean('gpu-header-tooltip-activity-percentage') &&
                        gpuData.activity &&
                        gpuData.activity.GFX != null
                    ) {
                        values.push('GPU: ' + Math.round(gpuData.activity.GFX) + '%');
                    }

                    let vram = 'VRAM: ';
                    if(
                        Config.get_boolean('gpu-header-tooltip-memory-percentage') &&
                        gpuData.vram &&
                        gpuData.vram.percent != null
                    ) {
                        vram += Math.round(gpuData.vram.percent) + '%';
                    }
                    if(
                        Config.get_boolean('gpu-header-tooltip-memory-value') &&
                        gpuData.vram &&
                        gpuData.vram.used != null
                    ) {
                        const value = Utils.formatBytes(gpuData.vram.used, 'kB-kiB', 3);
                        if(vram.length > 6) vram += ` (${value})`;
                        else vram += value;
                    }
                    if(vram) values.push(vram);

                    if(values.length === 0) values.push('-');

                    this.tooltipItem.label.text = values.join(' | ');
                    const width = this.tooltipItem.get_preferred_width(-1)[1] + 30;
                    this.tooltipMenu.actor.set_width(width);
                }
            );
        }

        showTooltip() {
            if(!this.tooltipMenu) return;
            if(!Config.get_boolean('gpu-header-tooltip')) return;

            this.tooltipMenu.open(false);
        }

        hideTooltip() {
            if(!this.tooltipMenu) return;
            if(!Config.get_boolean('gpu-header-tooltip')) return;
            this.tooltipMenu.close(false);
        }

        override destroy() {
            Config.clear(this);
            Utils.gpuMonitor.unlisten(this);
            Utils.gpuMonitor.unlisten(this.activityBar);
            Utils.gpuMonitor.unlisten(this.activityGraph);
            Utils.gpuMonitor.unlisten(this.activityPercentage);
            Utils.gpuMonitor.unlisten(this.memoryBar);
            Utils.gpuMonitor.unlisten(this.memoryGraph);
            Utils.gpuMonitor.unlisten(this.memoryPercentage);
            Utils.gpuMonitor.unlisten(this.tooltipMenu);

            Config.clear(this.icon);

            if(this.icon) {
                Config.clear(this.icon);
                Utils.gpuMonitor.unlisten(this.icon);
                this.icon.destroy();
                this.icon = undefined as any;
            }
            if(this.activityBar) {
                Config.clear(this.activityBar);
                Utils.gpuMonitor.unlisten(this.activityBar);
                this.activityBar.destroy();
                this.activityBar = undefined as any;
            }
            if(this.activityGraph) {
                Config.clear(this.activityGraph);
                Utils.gpuMonitor.unlisten(this.activityGraph);
                this.activityGraph.destroy();
                this.activityGraph = undefined as any;
            }
            if(this.activityPercentage) {
                Config.clear(this.activityPercentage);
                Utils.gpuMonitor.unlisten(this.activityPercentage);
                this.activityPercentage = undefined as any;
            }
            if(this.memoryBar) {
                Config.clear(this.memoryBar);
                Utils.gpuMonitor.unlisten(this.memoryBar);
                this.memoryBar.destroy();
                this.memoryBar = undefined as any;
            }
            if(this.memoryGraph) {
                Config.clear(this.memoryGraph);
                Utils.gpuMonitor.unlisten(this.memoryGraph);
                this.memoryGraph.destroy();
                this.memoryGraph = undefined as any;
            }
            if(this.memoryPercentage) {
                Config.clear(this.memoryPercentage);
                Utils.gpuMonitor.unlisten(this.memoryPercentage);
                this.memoryPercentage = undefined as any;
            }
            if(this.memoryValue) {
                Config.clear(this.memoryValue);
                Utils.gpuMonitor.unlisten(this.memoryValue);
                this.memoryValue = undefined as any;
            }

            if(this.tooltipItem) {
                Config.clear(this.tooltipItem);
                Utils.gpuMonitor.unlisten(this.tooltipMenu);
                this.tooltipItem.destroy();
                this.tooltipItem = undefined as any;
            }
            if(this.tooltipMenu) {
                Config.clear(this.tooltipMenu);
                Utils.gpuMonitor.unlisten(this.tooltipMenu);
                this.tooltipMenu.close(false);
                Main.uiGroup.remove_child(this.tooltipMenu.actor);
                this.tooltipMenu.destroy();
                this.tooltipMenu = undefined as any;
            }

            super.destroy();
        }
    }
);
