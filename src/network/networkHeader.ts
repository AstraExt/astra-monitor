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
import NetworkMenu from './networkMenu.js';
import NetworkGraph from './networkGraph.js';
import NetworkBars from './networkBars.js';
import MenuBase from '../menu.js';

type TooltipMenu = PopupMenu.PopupMenu & {
    actor: St.Widget;
};

type TooltipItem = PopupMenu.PopupMenuItem & {
    label: St.Label;
};

export default GObject.registerClass(
    class NetworkHeader extends Header {
        private icon!: St.Icon;
        private bars!: InstanceType<typeof NetworkBars>;
        private graph!: InstanceType<typeof NetworkGraph>;
        private speedContainer!: St.BoxLayout;
        private speed!: St.Label;
        protected ioLayout!: string;

        protected tooltipMenu!: TooltipMenu;
        protected tooltipItem!: TooltipItem;

        protected maxWidths!: number[];

        constructor() {
            super('Network Header');

            this.buildIcon();
            this.buildGraph();
            this.buildSpeed();
            this.buildBars();

            this.addOrReorderIndicators();

            const menu = new NetworkMenu(this, 0.5, MenuBase.arrowAlignement);
            this.setMenu(menu);

            this.resetMaxWidths();

            Config.connect(
                this,
                'changed::network-indicators-order',
                this.addOrReorderIndicators.bind(this)
            );

            Config.connect(this, 'changed::visible', this.resetMaxWidths.bind(this));
            Config.connect(this, 'changed::network-header-io', this.resetMaxWidths.bind(this));
            Config.connect(this, 'changed::headers-font-family', this.resetMaxWidths.bind(this));
            Config.connect(this, 'changed::headers-font-size', this.resetMaxWidths.bind(this));

            const updateIOLayout = () => {
                this.ioLayout = Config.get_string('network-header-io-layout') || 'vertical';
                this.speed.text = '';
                this.resetMaxWidths();
            };
            Config.connect(this, 'changed::network-header-io-layout', updateIOLayout.bind(this));
            updateIOLayout();
        }

        get showConfig() {
            return 'network-header-show';
        }

        addOrReorderIndicators() {
            const indicators = Utils.getIndicatorsOrder('network');

            let position = 0;
            for(const indicator of indicators) {
                let widget;
                switch(indicator) {
                    case 'icon':
                        widget = this.icon;
                        break;
                    case 'IO bar':
                        widget = this.bars;
                        break;
                    case 'IO graph':
                        widget = this.graph;
                        break;
                    case 'IO speed':
                        widget = this.speedContainer;
                        break;
                }

                if(widget) {
                    if(widget.get_parent()) this.remove_child(widget);
                    this.insert_child_at_index(widget, position++);
                }
            }
        }

        resetMaxWidths() {
            this.maxWidths = [];

            if(!Config.get_boolean('network-header-io')) return;

            if(!this.speed.get_stage()) return;

            this.fixSpeedContainerStyle();
        }

        buildIcon() {
            const defaultStyle = 'margin-left:2px;margin-right:4px;';
            let iconSize = Config.get_int('network-header-icon-size');
            iconSize = Math.max(8, Math.min(30, iconSize));
            this.icon = new St.Icon({
                fallbackGicon: Utils.getLocalIcon('am-network-symbolic'),
                style: defaultStyle,
                iconSize: iconSize,
                yExpand: false,
                yAlign: Clutter.ActorAlign.CENTER,
                xAlign: Clutter.ActorAlign.CENTER,
            });

            const setIconName = () => {
                const iconCustom = Config.get_string('network-header-icon-custom');
                if(iconCustom) this.icon.iconName = iconCustom;
                // @ts-expect-error gicon shouldn't be null, but we do have a fallback icon
                else this.icon.gicon = Utils.getLocalIcon('am-network-symbolic');
            };
            setIconName();

            const setIconColor = () => {
                const iconColor = Config.get_string('network-header-icon-color');
                if(iconColor) this.icon.style = defaultStyle + 'color:' + iconColor + ';';
                else this.icon.style = defaultStyle;
            };
            setIconColor();

            Config.bind('network-header-icon', this.icon, 'visible', Gio.SettingsBindFlags.GET);
            Config.bind(
                'network-header-icon-size',
                this.icon,
                'icon_size',
                Gio.SettingsBindFlags.GET
            );
            Config.connect(
                this.icon,
                'changed::network-header-icon-custom',
                setIconName.bind(this)
            );
            Config.connect(
                this.icon,
                'changed::network-header-icon-color',
                setIconColor.bind(this)
            );
        }

        buildBars() {
            if(this.bars) {
                this.remove_child(this.bars);
                Config.clear(this.bars);
                Utils.networkMonitor.unlisten(this.bars);
                this.bars.destroy();
            }

            this.bars = new NetworkBars({ numBars: 2, header: true, mini: true, width: 0.5 });
            Config.bind('network-header-bars', this.bars, 'visible', Gio.SettingsBindFlags.GET);

            Utils.networkMonitor.listen(this.bars, 'networkIO', () => {
                if(!Config.get_boolean('network-header-bars')) return;

                const usage = Utils.networkMonitor.getCurrentValue('networkIO');
                const maxSpeeds = Utils.networkMonitor.detectedMaxSpeeds;
                this.bars.setMaxSpeeds(maxSpeeds);
                this.bars.setUsage(usage);
            });
        }

        buildGraph() {
            if(this.graph) {
                this.remove_child(this.graph);
                Config.clear(this.graph);
                Utils.networkMonitor.unlisten(this.graph);
                this.graph.destroy();
            }

            {
                let graphWidth = Config.get_int('network-header-graph-width');
                graphWidth = Math.max(10, Math.min(500, graphWidth));
                this.graph = new NetworkGraph({ width: graphWidth, mini: true });
            }
            Config.bind('network-header-graph', this.graph, 'visible', Gio.SettingsBindFlags.GET);

            Config.connect(this.graph, 'changed::network-header-graph-width', () => {
                let graphWidth = Config.get_int('network-header-graph-width');
                graphWidth = Math.max(10, Math.min(500, graphWidth));
                this.graph.setWidth(graphWidth);
            });

            Utils.networkMonitor.listen(this.graph, 'networkIO', this.updateGraph.bind(this));
        }

        updateGraph() {
            if(!this.visible) return;
            if(!Config.get_boolean('network-header-graph')) return;

            const usage = Utils.networkMonitor.getUsageHistory('networkIO');
            this.graph.setUsageHistory(usage);
        }

        buildSpeed() {
            this.speedContainer = new St.BoxLayout({
                xAlign: Clutter.ActorAlign.START,
                yAlign: Clutter.ActorAlign.FILL,
                yExpand: true,
                vertical: true,
                width: 1,
            });

            this.speed = new St.Label({
                text: '',
                styleClass: 'astra-monitor-header-speed-label',
                style: 'font-size: 0.65em;',
                yAlign: Clutter.ActorAlign.CENTER,
                xAlign: Clutter.ActorAlign.END,
                xExpand: true,
                yExpand: true,
            });
            this.speedContainer.add_child(this.speed);

            Config.bind(
                'network-header-io',
                this.speedContainer,
                'visible',
                Gio.SettingsBindFlags.GET
            );

            Utils.networkMonitor.listen(
                this.speedContainer,
                'networkIO',
                this.updateSpeed.bind(this)
            );
        }

        updateSpeed() {
            if(!this.visible) return;
            if(!Config.get_boolean('network-header-io')) return;

            let upload = Utils.zeroStr + ' B/s';
            let download = Utils.zeroStr + ' B/s';

            const usage = Utils.networkMonitor.getCurrentValue('networkIO');
            if(usage) {
                let bytesUploadedPerSec = usage.bytesUploadedPerSec;
                let bytesDownloadedPerSec = usage.bytesDownloadedPerSec;

                const threshold = Config.get_int('network-header-io-threshold');

                if(bytesUploadedPerSec < threshold * 1000) bytesUploadedPerSec = 0;

                if(bytesDownloadedPerSec < threshold * 100) bytesDownloadedPerSec = 0;

                const unit = Config.get_string('network-io-unit');
                let maxFigures = Config.get_int('network-header-io-figures');
                maxFigures = Math.max(1, Math.min(4, maxFigures));
                upload = Utils.formatBytesPerSec(
                    bytesUploadedPerSec,
                    unit as any,
                    maxFigures,
                    true
                );
                download = Utils.formatBytesPerSec(
                    bytesDownloadedPerSec,
                    unit as any,
                    maxFigures,
                    true
                );
            }

            if(this.ioLayout === 'horizontal') this.speed.text = `${upload} | ${download}`;
            else this.speed.text = `${upload}\n${download}`;
            this.fixSpeedContainerStyle();
        }

        fixSpeedContainerStyle() {
            if(!this.speedContainer.get_parent()) return;
            if(!this.speed.get_parent()) return;

            const calculateStyle = () => {
                let defaultStyle = 'font-size:0.65em;';
                const fontSize = Config.get_int('headers-font-size');
                if(fontSize) defaultStyle = `font-size:${fontSize}px;`;
                if(this.ioLayout === 'horizontal')
                    return fontSize ? defaultStyle : 'font-size:1em';

                const superHeight =
                    this.speedContainer.get_parent()?.get_allocation_box()?.get_height() ?? 0;
                let scaledHeight = superHeight / this.scaleFactor;
                if(scaledHeight <= 20) return defaultStyle;
                scaledHeight = Math.round(scaledHeight / 3);

                if(fontSize && fontSize < scaledHeight) return defaultStyle;
                return `font-size:${scaledHeight}px;`;
            };
            const style = calculateStyle();

            if(this.speed.style !== style) {
                this.speed.style = style;
                this.speed.queue_relayout();
                this.speedContainer.queue_relayout();
            }

            const speedWidth = this.speed.get_preferred_width(-1);
            const width = speedWidth ? speedWidth[1] : 0;

            this.maxWidths.push(width);

            if(this.maxWidths.length > Utils.networkMonitor.updateFrequency * 30)
                this.maxWidths.shift();

            let max = Math.max(...this.maxWidths);
            if(max === this.speedContainer.width) return;
            if(max <= 0) max = 1;
            this.speedContainer.set_width(max);
        }

        update() {
            this.maxWidths = [];

            this.updateGraph();
            this.updateSpeed();
        }

        redraw(): void {
            this.maxWidths = [];
            this.fixSpeedContainerStyle();
        }

        createTooltip() {
            this.tooltipMenu = new PopupMenu.PopupMenu(this, 0.5, St.Side.TOP) as TooltipMenu;

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

            Config.connect(this.tooltipMenu, 'changed::network-header-tooltip', () => {
                if(!Config.get_boolean('network-header-tooltip')) this.tooltipMenu.close(true);
            });

            Utils.networkMonitor.listen(this.tooltipMenu, 'networkIO', () => {
                if(!Config.get_boolean('network-header-tooltip')) return;

                const values: string[] = [];

                if(Config.get_boolean('network-header-tooltip-io')) {
                    const usage = Utils.networkMonitor.getCurrentValue('networkIO');

                    if(usage) {
                        const bytesUploadedPerSec = usage.bytesUploadedPerSec;
                        const bytesDownloadedPerSec = usage.bytesDownloadedPerSec;

                        const unit = Config.get_string('network-io-unit');
                        let maxFigures = Config.get_int('network-header-io-figures');
                        maxFigures = Math.max(1, Math.min(4, maxFigures));
                        values.push(
                            '↑' +
                                Utils.formatBytesPerSec(
                                    bytesUploadedPerSec,
                                    unit as any,
                                    maxFigures,
                                    true
                                )
                        );
                        values.push(
                            '↓' +
                                Utils.formatBytesPerSec(
                                    bytesDownloadedPerSec,
                                    unit as any,
                                    maxFigures,
                                    true
                                )
                        );
                    }
                }

                if(values.length === 0) values.push('-');

                this.tooltipItem.label.text = values.join(' | ');
                const width = this.tooltipItem.get_preferred_width(-1)[1] + 30;
                this.tooltipMenu.actor.set_width(width);
            });
        }

        showTooltip() {
            if(!this.tooltipMenu) return;
            if(!Config.get_boolean('network-header-tooltip')) return;

            this.tooltipMenu.open(false);
        }

        hideTooltip() {
            if(!this.tooltipMenu) return;
            if(!Config.get_boolean('network-header-tooltip')) return;
            this.tooltipMenu.close(false);
        }

        override destroy() {
            Config.clear(this);
            Utils.networkMonitor.unlisten(this);

            if(this.icon) {
                Config.clear(this.icon);
                Utils.networkMonitor.unlisten(this.icon);
                this.icon.destroy();
                this.icon = undefined as any;
            }
            if(this.bars) {
                Config.clear(this.bars);
                Utils.networkMonitor.unlisten(this.bars);
                this.bars.destroy();
                this.bars = undefined as any;
            }
            if(this.graph) {
                Config.clear(this.graph);
                Utils.networkMonitor.unlisten(this.graph);
                this.graph.destroy();
                this.graph = undefined as any;
            }
            if(this.speedContainer) {
                Config.clear(this.speedContainer);
                Utils.networkMonitor.unlisten(this.speedContainer);
                this.speedContainer = undefined as any;
            }
            if(this.speed) {
                Config.clear(this.speed);
                Utils.networkMonitor.unlisten(this.speed);
                this.speed = undefined as any;
            }
            if(this.tooltipItem) {
                Config.clear(this.tooltipItem);
                Utils.networkMonitor.unlisten(this.tooltipItem);
                this.tooltipItem.destroy();
                this.tooltipItem = undefined as any;
            }
            if(this.tooltipMenu) {
                Config.clear(this.tooltipMenu);
                Utils.networkMonitor.unlisten(this.tooltipMenu);
                this.tooltipMenu.close(false);
                Main.uiGroup.remove_child(this.tooltipMenu.actor);
                this.tooltipMenu.destroy();
                this.tooltipMenu = undefined as any;
            }

            super.destroy();
        }
    }
);
