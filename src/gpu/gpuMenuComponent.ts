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

import St from 'gi://St';
import Clutter from 'gi://Clutter';
import { gettext as _ } from 'resource:///org/gnome/shell/extensions/extension.js';

import MenuBase from '../menu.js';
import Utils, { GpuInfo } from '../utils/utils.js';
import Grid from '../grid.js';
import Config from '../config.js';

import { GenericGpuInfo } from '../gpu/gpuMonitor.js';
import GpuActivityBars from '../gpu/gpuActivityBars.js';
import GpuMemoryBars from '../gpu/gpuMemoryBars.js';

export type GpuComponentProps = {
    parent: InstanceType<typeof MenuBase>;
    title?: St.Label;
    compact?: boolean;
};

type InfoPopup = MenuBase & {
    updateData: (data: GenericGpuInfo) => void;
};

type ActivityPopup = MenuBase & {
    pipes: {
        grid: InstanceType<typeof Grid>;
        title: St.Label;
        bar: InstanceType<typeof GpuActivityBars>;
        barLabel: St.Label;
    }[];
    updateData: (data: GenericGpuInfo) => void;
};

type VramPopup = MenuBase & {
    pipes: {
        grid: InstanceType<typeof Grid>;
        title: St.Label;
        bar: InstanceType<typeof GpuActivityBars>;
        barLabel: St.Label;
        usedValue: St.Label;
        totalValue: St.Label;
    }[];
    updateData: (data: GenericGpuInfo) => void;
};

type TopProcess = {
    label: St.Label;
    value1: St.Label;
    value2: St.Label;
};

type TopProcessesPopup = MenuBase & {
    headers: St.Label[];
    processes: {
        values: St.Label[];
    }[];
    updateData: (data: GenericGpuInfo) => void;
};

type Sensor = {
    label: St.Label;
    value: St.Label;
};

type SensorsPopup = MenuBase & {
    categories: {
        name: St.Label;
        sensors: {
            icon: St.Icon;
            label: St.Label;
            value: St.Label;
        }[];
    }[];
    updateData: (data: GenericGpuInfo) => void;
};

type Section = {
    info: GpuInfo;
    infoPopup?: InfoPopup;
    activityPopup?: ActivityPopup;
    vramPopup?: VramPopup;
    topProcessesPopup?: TopProcessesPopup;
    sensorsPopup?: SensorsPopup;
    vram: {
        bar?: InstanceType<typeof GpuMemoryBars>;
        barLabel?: St.Label;
        usedLabel?: St.Label;
        totalLabel?: St.Label;
    };
    activity: {
        gfxBar?: InstanceType<typeof GpuActivityBars>;
        gfxBarLabel?: St.Label;
    };
};

export default class GpuMenuComponent {
    private shown: boolean = false;
    private lastData: Map<string, GenericGpuInfo> | undefined;

    private parent: InstanceType<typeof MenuBase>;
    private title: St.Label | undefined;
    private compact: boolean = false;

    public container!: InstanceType<typeof Grid>;
    private noGPULabel: St.Label | undefined;

    private topProcesses!: TopProcess[];
    private mainSensors!: Sensor[];

    private sections: Section[] = [];

    constructor(params: GpuComponentProps) {
        this.parent = params.parent;
        if(params.compact) this.compact = params.compact;
        if(params.title) this.title = params.title;

        this.init();
    }

    private init() {
        if(this.title) {
            this.title.text = _('GPU');
            Config.connect(this.title, 'changed::gpu-main', () => {
                const gpu = Utils.gpuMonitor.getSelectedGpu();
                if(this.title) this.title.visible = !!gpu;
            });
        }

        this.container = new Grid({ numCols: 2, styleClass: 'astra-monitor-menu-subgrid' });

        const GPUsList = Utils.getGPUsList();
        if(GPUsList.length === 0) {
            // Print No GPU found
            this.noGPULabel = new St.Label({
                text: _('No GPU found'),
                style_class: 'astra-monitor-menu-label-warning',
                style: 'font-style:italic;',
            });
            Config.connect(this.noGPULabel, 'changed::gpu-main', () => {
                const gpu = Utils.gpuMonitor.getSelectedGpu();
                if(this.noGPULabel) this.noGPULabel.visible = !!gpu;
            });
            this.container.addToGrid(this.noGPULabel, 2);
            return;
        }

        if(GPUsList.length > 1 && this.title) this.title.text = _('GPUs');

        const selectedGpu = Utils.gpuMonitor.getSelectedGpu();
        for(let i = 0; i < GPUsList.length; i++) {
            const section = this.createSection(GPUsList[i], selectedGpu);
            this.sections.push(section);
        }
    }

    private createSection(gpuInfo: GpuInfo, selectedGpu?: GpuInfo): Section {
        const section: Section = {
            info: gpuInfo,
            vram: {},
            activity: {},
        };

        const defaultStyle = 'max-width: 150px;';

        const grid = new Grid({ numCols: 1, styleClass: 'astra-monitor-menu-subgrid' });

        const infoButton = new St.Button({
            reactive: true,
            track_hover: true,
            style: defaultStyle,
            x_expand: true,
        });
        const infoLabel = new St.Label({ text: Utils.getGPUModelName(gpuInfo) });
        infoButton.set_child(infoLabel);

        const infoPopup = this.createInfoPopup(infoButton, gpuInfo);
        section.infoPopup = infoPopup;

        infoButton.connect('enter-event', () => {
            infoButton.style = defaultStyle + this.parent.selectionStyle;
            if(infoPopup) infoPopup.open(true);
        });

        infoButton.connect('leave-event', () => {
            infoButton.style = defaultStyle;
            if(infoPopup) infoPopup.close(true);
        });
        grid.addToGrid(infoButton);

        const selected =
            selectedGpu?.domain === gpuInfo.domain &&
            selectedGpu?.bus === gpuInfo.bus &&
            selectedGpu?.slot === gpuInfo.slot;
        const amd = Utils.isAmdGpu(gpuInfo) && Utils.hasAmdGpuTop();
        const nvidia = Utils.isNvidiaGpu(gpuInfo) && Utils.hasNvidiaSmi();

        if(selected && (amd || nvidia)) {
            //ACTIVITY
            const activityButton = new St.Button({
                reactive: true,
                track_hover: true,
                style: defaultStyle,
                x_expand: true,
            });

            const activityGrid = new Grid({ numCols: 1 });
            activityButton.set_child(activityGrid);

            const activityPopup = this.createActivityPopup(activityButton, gpuInfo);
            section.activityPopup = activityPopup;

            activityButton.connect('enter-event', () => {
                activityButton.style = defaultStyle + this.parent.selectionStyle;
                if(activityPopup) activityPopup.open(true);
            });

            activityButton.connect('leave-event', () => {
                activityButton.style = defaultStyle;
                if(activityPopup) activityPopup.close(true);
            });
            grid.addToGrid(activityButton);

            const activityTitle = new St.Label({
                text: _('Activity'),
                style_class: 'astra-monitor-menu-header-small-centered',
            });
            activityGrid.addToGrid(activityTitle);

            // GFX Activity Bar
            {
                const barGrid = new Grid({
                    styleClass: 'astra-monitor-menu-subgrid',
                });

                const bar = new GpuActivityBars({
                    numBars: 1,
                    width: 200 - 2,
                    height: 0.8,
                    mini: false,
                    layout: 'horizontal',
                    x_align: Clutter.ActorAlign.START,
                    style: 'margin-bottom:0;margin-right:0;border:solid 1px #555;',
                });
                barGrid.addToGrid(bar);

                const barUsagePercLabel = new St.Label({
                    text: '0%',
                    style: 'margin-left:0.3em;margin-right:0.3em;padding-top:2px;width:2.8em;font-size:0.8em;text-align:right;',
                });
                barGrid.addToGrid(barUsagePercLabel);

                activityGrid.addToGrid(barGrid);

                section.activity.gfxBar = bar;
                section.activity.gfxBarLabel = barUsagePercLabel;
            }

            //VRAM
            const vramButton = new St.Button({
                reactive: true,
                track_hover: true,
                style: defaultStyle,
                x_expand: true,
            });

            const vramGrid = new Grid({ numCols: 1 });
            vramButton.set_child(vramGrid);

            const vramPopup = this.createVramPopup(vramButton, gpuInfo);
            section.vramPopup = vramPopup;

            vramButton.connect('enter-event', () => {
                vramButton.style = defaultStyle + this.parent.selectionStyle;
                if(vramPopup) vramPopup.open(true);
            });

            vramButton.connect('leave-event', () => {
                vramButton.style = defaultStyle;
                if(vramPopup) vramPopup.close(true);
            });
            grid.addToGrid(vramButton);

            const vramTitle = new St.Label({
                text: _('VRAM'),
                style_class: 'astra-monitor-menu-header-small-centered',
            });
            vramGrid.addToGrid(vramTitle);

            // Bar
            {
                const barGrid = new Grid({
                    styleClass: 'astra-monitor-menu-subgrid',
                });

                const bar = new GpuMemoryBars({
                    numBars: 1,
                    width: 200 - 2,
                    height: 0.8,
                    mini: false,
                    layout: 'horizontal',
                    x_align: Clutter.ActorAlign.START,
                    style: 'margin-bottom:0;margin-right:0;border:solid 1px #555;',
                });
                barGrid.addToGrid(bar);

                const barUsagePercLabel = new St.Label({
                    text: '0%',
                    style: 'margin-left:0.3em;margin-right:0.3em;padding-top:2px;width:2.8em;font-size:0.8em;text-align:right;',
                });
                barGrid.addToGrid(barUsagePercLabel);

                vramGrid.addToGrid(barGrid);

                section.vram.bar = bar;
                section.vram.barLabel = barUsagePercLabel;
            }

            // VRAM Labels
            {
                const vramContainer = new St.Widget({
                    layout_manager: new Clutter.GridLayout({
                        orientation: Clutter.Orientation.HORIZONTAL,
                    }),
                    x_expand: true,
                    style: 'margin-right:0;',
                });

                const usedContainer = new St.Widget({
                    layout_manager: new Clutter.GridLayout({
                        orientation: Clutter.Orientation.HORIZONTAL,
                    }),
                    x_expand: true,
                    style: 'margin-left:0;margin-right:0;',
                });

                const usedLabel = new St.Label({
                    text: _('Used:'),
                    style_class: 'astra-monitor-menu-label',
                    style: 'padding-right:0.15em;',
                });
                usedContainer.add_child(usedLabel);

                const usedValueLabel = new St.Label({
                    text: '-',
                    x_expand: true,
                    style_class: 'astra-monitor-menu-key-mid',
                });
                usedContainer.add_child(usedValueLabel);
                usedContainer.set_width(100);

                vramContainer.add_child(usedContainer);

                const totalContainer = new St.Widget({
                    layout_manager: new Clutter.GridLayout({
                        orientation: Clutter.Orientation.HORIZONTAL,
                    }),
                    x_expand: true,
                    style: 'margin-left:0;margin-right:0;',
                });

                const totalLabel = new St.Label({
                    text: _('Total:'),
                    style_class: 'astra-monitor-menu-label',
                    style: 'padding-right:0.15em;',
                });
                totalContainer.add_child(totalLabel);

                const totalValueLabel = new St.Label({
                    text: '-',
                    x_expand: true,
                    style_class: 'astra-monitor-menu-key-mid',
                });
                totalContainer.add_child(totalValueLabel);
                totalContainer.set_width(100);

                vramContainer.add_child(totalContainer);

                vramGrid.addToGrid(vramContainer);

                section.vram.usedLabel = usedValueLabel;
                section.vram.totalLabel = totalValueLabel;
            }

            // Top Processes
            const topProcessesButton = new St.Button({
                reactive: true,
                track_hover: true,
                style: defaultStyle,
                x_expand: true,
            });

            const topProcessesGrid = new Grid({ numCols: 1 });
            topProcessesButton.set_child(topProcessesGrid);

            const topProcessesPopup = this.createTopProcessesPopup(topProcessesButton, gpuInfo);
            section.topProcessesPopup = topProcessesPopup;

            topProcessesButton.connect('enter-event', () => {
                topProcessesButton.style = defaultStyle + this.parent.selectionStyle;
                if(topProcessesPopup) topProcessesPopup.open(true);
            });

            topProcessesButton.connect('leave-event', () => {
                topProcessesButton.style = defaultStyle;
                if(topProcessesPopup) topProcessesPopup.close(true);
            });

            const topProcessesTitle = new St.Label({
                text: _('Top Processes'),
                style_class: 'astra-monitor-menu-header-small-centered',
            });
            topProcessesGrid.addToGrid(topProcessesTitle);

            // Top Processes List
            {
                const listGrid = new Grid({
                    numCols: 3,
                    styleClass: 'astra-monitor-menu-subgrid',
                });

                this.topProcesses = [];

                const numProcesses = this.compact ? 3 : 5;
                for(let i = 0; i < numProcesses; i++) {
                    const label = new St.Label({
                        text: '-',
                        style_class: 'astra-monitor-menu-cmd-name',
                        x_expand: true,
                    });
                    listGrid.addToGrid(label);
                    const value1 = new St.Label({
                        text: '-',
                        style_class: 'astra-monitor-menu-cmd-usage',
                        x_expand: true,
                    });
                    listGrid.addToGrid(value1);
                    const value2 = new St.Label({
                        text: '-',
                        style_class: 'astra-monitor-menu-cmd-usage',
                        x_expand: true,
                    });
                    listGrid.addToGrid(value2);

                    this.topProcesses.push({ label, value1, value2 });
                }
                topProcessesGrid.addToGrid(listGrid);
            }
            grid.addToGrid(topProcessesButton);

            // Sensors
            const sensorsButton = new St.Button({
                reactive: true,
                track_hover: true,
                style: defaultStyle,
                x_expand: true,
            });

            const sensorsPopup = this.createSensorsPopup(sensorsButton, gpuInfo);
            section.sensorsPopup = sensorsPopup;

            sensorsButton.connect('enter-event', () => {
                sensorsButton.style = defaultStyle + this.parent.selectionStyle;
                if(sensorsPopup) sensorsPopup.open(true);
            });

            sensorsButton.connect('leave-event', () => {
                sensorsButton.style = defaultStyle;
                if(sensorsPopup) sensorsPopup.close(true);
            });

            const sensorsGrid = new Grid({ numCols: 1 });
            sensorsButton.set_child(sensorsGrid);

            const sensorsTitle = new St.Label({
                text: _('Sensors'),
                style_class: 'astra-monitor-menu-header-small-centered',
            });
            sensorsGrid.addToGrid(sensorsTitle);

            // Main Sensors List
            {
                const listGrid = new Grid({
                    numCols: 2,
                    styleClass: 'astra-monitor-menu-subgrid',
                });

                this.mainSensors = [];

                const numSensors = this.compact ? 1 : 3;
                for(let i = 0; i < numSensors; i++) {
                    const label = new St.Label({
                        text: '-',
                        style_class: 'astra-monitor-menu-cmd-name',
                        x_expand: true,
                    });
                    listGrid.addToGrid(label);
                    const value = new St.Label({
                        text: '-',
                        style_class: 'astra-monitor-menu-cmd-usage',
                        x_expand: true,
                    });
                    listGrid.addToGrid(value);

                    this.mainSensors.push({ label, value });
                }
                sensorsGrid.addToGrid(listGrid);
            }
            grid.addToGrid(sensorsButton);
        }

        this.container.addToGrid(grid, 2);

        const updateSelectedGPU = () => {
            if(gpuInfo === Utils.gpuMonitor.getSelectedGpu()) {
                infoLabel.style_class = 'astra-monitor-menu-label';
            } else {
                if(Utils.themeStyle === 'light')
                    infoLabel.style_class = 'astra-monitor-menu-unmonitored-light';
                else infoLabel.style_class = 'astra-monitor-menu-unmonitored';
            }
        };
        updateSelectedGPU();

        Config.connect(this, 'changed::gpu-main', updateSelectedGPU);
        return section;
    }

    private createInfoPopup(sourceActor: St.Widget, gpuInfo: GpuInfo): InfoPopup {
        const popup = new MenuBase(sourceActor, 0.05) as InfoPopup;
        popup.addMenuSection(_('GPU info'));

        const GPUModelName = Utils.getGPUModelName(gpuInfo);

        popup.addToMenu(
            new St.Label({
                text: GPUModelName,
                style_class: 'astra-monitor-menu-sub-header',
            }),
            2
        );

        popup.addToMenu(
            new St.Label({
                text: _('Name'),
                style_class: 'astra-monitor-menu-sub-key',
            })
        );

        let vendor = gpuInfo.vendor;
        if(vendor.length > 50) {
            const splitCharacters = [
                ' ',
                '-',
                '_',
                '(',
                ')',
                '[',
                ']',
                '{',
                '}',
                ':',
                ';',
                ',',
                '.',
                '?',
                '!',
                ' ',
            ];
            const lines = Utils.splitStringByLength(vendor, 50, splitCharacters, 15);
            vendor = lines.join('\n');
        }
        popup.addToMenu(
            new St.Label({
                text: vendor,
            })
        );

        popup.addToMenu(
            new St.Label({
                text: _('Subsystem'),
                style_class: 'astra-monitor-menu-sub-key',
            })
        );

        let model = gpuInfo.model;
        if(model.length > 50) {
            const splitCharacters = [
                ' ',
                '-',
                '_',
                '(',
                ')',
                '[',
                ']',
                '{',
                '}',
                ':',
                ';',
                ',',
                '.',
                '?',
                '!',
                ' ',
            ];
            const lines = Utils.splitStringByLength(model, 50, splitCharacters, 15);
            model = lines.join('\n');
        }
        popup.addToMenu(
            new St.Label({
                text: model,
            })
        );

        if(gpuInfo.vendorId) {
            const vendorNames = Utils.getVendorName('0x' + gpuInfo.vendorId);
            if(vendorNames[0] !== 'Unknown') {
                popup.addToMenu(
                    new St.Label({
                        text: _('Vendor'),
                        style_class: 'astra-monitor-menu-sub-key',
                    })
                );
                popup.addToMenu(
                    new St.Label({
                        text: vendorNames.join(' / '),
                    })
                );
            }

            popup.addToMenu(
                new St.Label({
                    text: _('Vendor ID'),
                    style_class: 'astra-monitor-menu-sub-key',
                })
            );
            popup.addToMenu(
                new St.Label({
                    text: gpuInfo.vendorId,
                })
            );
        }

        if(gpuInfo.productId) {
            popup.addToMenu(
                new St.Label({
                    text: _('Product ID'),
                    style_class: 'astra-monitor-menu-sub-key',
                })
            );
            popup.addToMenu(
                new St.Label({
                    text: gpuInfo.productId,
                })
            );
        }

        popup.addToMenu(
            new St.Label({
                text: _('PCI'),
                style_class: 'astra-monitor-menu-sub-key',
            })
        );

        const domain = gpuInfo.domain.split(':');
        if(domain.length === 2) {
            const pciLabel = new St.Label({ text: '' });
            pciLabel.clutter_text.useMarkup = true;
            pciLabel.clutter_text.set_markup(
                // eslint-disable-next-line no-irregular-whitespace
                `<span alpha="60%">${domain[0]}</span> : <b>${domain[1]}</b> : ${gpuInfo.bus} : <span font_scale="small-caps">${gpuInfo.slot}</span>`
            );
            popup.addToMenu(pciLabel);
        }

        if(gpuInfo.drivers && Array.isArray(gpuInfo.drivers) && gpuInfo.drivers.length > 0) {
            popup.addToMenu(
                new St.Label({
                    text: _('Drivers'),
                    style_class: 'astra-monitor-menu-sub-key',
                })
            );
            popup.addToMenu(
                new St.Label({
                    text: gpuInfo.drivers.join(', '),
                })
            );
        }

        if(gpuInfo.modules && Array.isArray(gpuInfo.modules) && gpuInfo.modules.length > 0) {
            popup.addToMenu(
                new St.Label({
                    text: _('Modules'),
                    style_class: 'astra-monitor-menu-sub-key',
                })
            );
            popup.addToMenu(
                new St.Label({
                    text: gpuInfo.modules.join(', '),
                })
            );
        }

        // Add spare labels for all other info
        const keyLables: St.Label[] = [];
        const valueLabels: St.Label[] = [];
        for(let i = 0; i < 25; i++) {
            const keyLabel = new St.Label({
                text: '',
                style_class: 'astra-monitor-menu-sub-key',
                visible: false,
            });

            keyLables.push(keyLabel);
            popup.addToMenu(keyLabel);

            const valueLabel = new St.Label({
                text: '',
                visible: false,
            });
            valueLabels.push(valueLabel);
            popup.addToMenu(valueLabel);
        }

        let otherInfoHash: unknown = null;
        const splitCharacters = [' ', '-', '(', ')', '[', ']', '{', '}', ';'];

        popup.updateData = (data: GenericGpuInfo) => {
            // check if it's cached data
            if(otherInfoHash === data.info.pipes) return;
            // check if it's the very same data
            if(Utils.deepEqual(otherInfoHash, data.info.pipes)) return;

            otherInfoHash = data.info.pipes;

            for(let i = 0; i < 25; i++) {
                const keyLabel = keyLables[i];
                const valueLabel = valueLabels[i];
                const pipe = data.info.pipes[i];

                if(!pipe) {
                    keyLabel.hide();
                    valueLabel.hide();
                    continue;
                }

                keyLabel.text = pipe?.name || '';
                keyLabel.show();

                let textData;
                if(pipe.data.length > 50 && !pipe.data.includes('\n')) {
                    const lines = Utils.splitStringByLength(pipe.data, 50, splitCharacters, 20);
                    textData = lines.join('\n');
                } else {
                    if(keyLabel.text.match(/^G*L[0-9]\sCache\b/)) {
                        textData = Utils.formatBytes(parseInt(pipe.data), 'kB-kiB', 4);
                    } else {
                        textData = pipe.data;
                    }
                }
                valueLabel.text = textData;
                valueLabel.show();
            }
        };
        return popup;
    }

    private createActivityPopup(sourceActor: St.Widget, _gpuInfo: GpuInfo): ActivityPopup {
        const popup = new MenuBase(sourceActor, 0.05) as ActivityPopup;
        popup.addMenuSection(_('Activity'));
        popup.pipes = [];

        for(let i = 0; i < 20; i++) {
            const title = new St.Label({
                text: 'Test',
                style_class: 'astra-monitor-menu-header-small',
            });
            popup.addToMenu(title, 2);

            const grid = new Grid({
                styleClass: 'astra-monitor-menu-subgrid',
            });

            const bar = new GpuActivityBars({
                numBars: 1,
                width: 200 - 2,
                height: 0.8,
                mini: false,
                layout: 'horizontal',
                x_align: Clutter.ActorAlign.START,
                style: 'margin-left:0.3em;margin-bottom:0;margin-right:0;border:solid 1px #555;',
            });
            grid.addToGrid(bar);

            const barLabel = new St.Label({
                text: '-%',
                style: 'width:2.7em;font-size:0.8em;text-align:right;',
            });
            grid.addToGrid(barLabel);
            popup.addToMenu(grid, 2);

            popup.pipes.push({ grid, title, bar, barLabel });
        }

        popup.updateData = (data: GenericGpuInfo) => {
            const pipeCount = data.activity.pipes?.length || 0;
            for(let i = 0; i < 20; i++) {
                const pipe = popup.pipes[i];
                if(i < pipeCount) {
                    const pipeData = data.activity.pipes![i];
                    pipe.title.text = pipeData.name;
                    pipe.bar.setUsage([{ percent: pipeData.percent }]);
                    pipe.barLabel.text = pipeData.percent.toFixed(0) + '%';
                } else {
                    pipe.title.hide();
                    pipe.grid.hide();
                }
            }
        };

        return popup;
    }

    private createVramPopup(sourceActor: St.Widget, _gpuInfo: GpuInfo): VramPopup {
        const popup = new MenuBase(sourceActor, 0.05) as VramPopup;
        popup.addMenuSection(_('VRAM'));
        popup.pipes = [];

        for(let i = 0; i < 10; i++) {
            const title = new St.Label({
                text: 'Test',
                style_class: 'astra-monitor-menu-header-small',
            });
            popup.addToMenu(title, 2);

            const grid = new Grid({
                styleClass: 'astra-monitor-menu-subgrid',
            });

            const bar = new GpuActivityBars({
                numBars: 1,
                width: 200 - 2,
                height: 0.8,
                mini: false,
                layout: 'horizontal',
                x_align: Clutter.ActorAlign.START,
                style: 'margin-left:0.3em;margin-bottom:0;margin-right:0;border:solid 1px #555;',
            });
            grid.addToGrid(bar);

            const barLabel = new St.Label({
                text: '-%',
                style: 'width:2.7em;font-size:0.8em;text-align:right;',
            });
            grid.addToGrid(barLabel);

            const footerContainer = new St.Widget({
                layout_manager: new Clutter.GridLayout({
                    orientation: Clutter.Orientation.HORIZONTAL,
                }),
                x_expand: true,
                style: 'margin-left:0.15em;margin-right:0;',
            });

            const usedContainer = new St.Widget({
                layout_manager: new Clutter.GridLayout({
                    orientation: Clutter.Orientation.HORIZONTAL,
                }),
                x_expand: true,
                style: 'margin-left:0;margin-right:0;',
            });

            const usedLabel = new St.Label({
                text: _('Used:'),
                style_class: 'astra-monitor-menu-label',
                style: 'padding-right:0.15em;',
            });
            usedContainer.add_child(usedLabel);

            const usedValue = new St.Label({
                text: '-',
                x_expand: true,
                style_class: 'astra-monitor-menu-key-mid',
            });
            usedContainer.add_child(usedValue);
            usedContainer.set_width(100);

            footerContainer.add_child(usedContainer);

            const totalContainer = new St.Widget({
                layout_manager: new Clutter.GridLayout({
                    orientation: Clutter.Orientation.HORIZONTAL,
                }),
                x_expand: true,
                style: 'margin-left:0;margin-right:0;',
            });

            const totalLabel = new St.Label({
                text: _('Total:'),
                style_class: 'astra-monitor-menu-label',
                style: 'padding-right:0.15em;',
            });
            totalContainer.add_child(totalLabel);

            const totalValue = new St.Label({
                text: '-',
                x_expand: true,
                style_class: 'astra-monitor-menu-key-mid',
            });
            totalContainer.add_child(totalValue);
            totalContainer.set_width(100);

            footerContainer.add_child(totalContainer);

            grid.addToGrid(footerContainer, 2);

            popup.addToMenu(grid, 2);

            popup.pipes.push({ grid, title, bar, barLabel, usedValue, totalValue });
        }

        popup.updateData = (data: GenericGpuInfo) => {
            const pipeCount = data.vram.pipes?.length || 0;
            for(let i = 0; i < 10; i++) {
                const pipe = popup.pipes[i];
                if(i < pipeCount) {
                    const pipeData = data.vram.pipes![i];
                    pipe.title.text = pipeData.name;
                    pipe.bar.setUsage([{ percent: pipeData.percent }]);
                    pipe.barLabel.text = pipeData.percent.toFixed(0) + '%';
                    pipe.usedValue.text = Utils.formatBytes(pipeData.used, 'kB-KB', 3);
                    pipe.totalValue.text = Utils.formatBytes(pipeData.total, 'kB-KB', 3);
                } else {
                    pipe.title.hide();
                    pipe.grid.hide();
                }
            }
        };

        return popup;
    }

    private createTopProcessesPopup(sourceActor: St.Widget, _gpuInfo: GpuInfo): TopProcessesPopup {
        const popup = new MenuBase(sourceActor, 0.05) as TopProcessesPopup;
        popup.addMenuSection(_('Top Processes'));
        popup.headers = [];
        popup.processes = [];

        const numProcesses = 10;
        const numValues = 10;

        const grid = new Grid({
            x_expand: true,
            x_align: Clutter.ActorAlign.START,
            numCols: numValues,
            styleClass: 'astra-monitor-menu-subgrid',
        });

        // Headers
        for(let i = 0; i < numValues; i++) {
            const text = i === 0 ? _('Name') : '';
            const style = i === 0 ? 'min-width:10em;' : 'min-width:5.5em;';

            const header = new St.Label({
                text: text,
                style_class: 'astra-monitor-menu-header-small-centered',
                style: style,
            });
            grid.addToGrid(header);
            popup.headers.push(header);
        }

        // Processes
        for(let i = 0; i < 10; i++) {
            const values = [];
            for(let n = 0; n < numValues; n++) {
                const style =
                    n === 0
                        ? 'astra-monitor-menu-cmd-name'
                        : 'astra-monitor-menu-cmd-usage-centered';
                const lbl = new St.Label({
                    text: '-',
                    style_class: style,
                    x_expand: true,
                    y_align: Clutter.ActorAlign.CENTER,
                });
                grid.addToGrid(lbl);
                values.push(lbl);
            }
            popup.processes.push({ values });
        }
        popup.addToMenu(grid, 2);

        popup.updateData = (data: GenericGpuInfo) => {
            if(data.topProcesses.length > 0) {
                //Fill headers
                const processData = data.topProcesses[0];

                popup.headers[0].text = _('Name');

                for(let i = 1; i < numValues; i++) {
                    const pipe = processData.pipes[i - 1];
                    if(!pipe) {
                        popup.headers[i].hide();
                        continue;
                    }
                    popup.headers[i].show();
                    popup.headers[i].text = pipe.name;
                }
            }

            for(let processNum = 0; processNum < numProcesses; processNum++) {
                const processData = data.topProcesses[processNum];
                if(!processData) {
                    const process = popup.processes[processNum];
                    for(let i = 0; i < numValues; i++) {
                        process.values[i].hide();
                    }
                    continue;
                }

                const processValues = popup.processes[processNum].values;
                processValues[0].text = processData.name;

                for(let i = 1; i < numValues; i++) {
                    const pipe = processData.pipes[i - 1];
                    if(!pipe) {
                        processValues[i].text = '-';
                        processValues[i].hide();
                        continue;
                    }
                    processValues[i].show();

                    if(pipe.unit === '%') {
                        processValues[i].text = pipe.value.toFixed(0) + '%';
                    } else {
                        processValues[i].text = Utils.formatBytes(pipe.value, 'kB-KB', 4);
                    }
                }
            }
        };

        return popup;
    }

    private createSensorsPopup(sourceActor: St.Widget, _gpuInfo: GpuInfo): SensorsPopup {
        const popup = new MenuBase(sourceActor, 0.05) as SensorsPopup;
        popup.addMenuSection(_('Sensors'));
        popup.categories = [];

        const grid = new Grid({
            numCols: 3,
            x_expand: true,
            x_align: Clutter.ActorAlign.START,
            styleClass: 'astra-monitor-menu-subgrid',
        });

        for(let i = 0; i < 6; i++) {
            const categoryLabel = new St.Label({
                text: '',
                style_class: 'astra-monitor-menu-sensors-category',
                x_expand: true,
            });
            if(i > 0) grid.newLine();
            grid.addToGrid(categoryLabel, 3);

            const values = [];
            for(let k = 0; k < 10; k++) {
                //Icon
                const icon = new St.Icon({
                    style_class: 'astra-monitor-menu-sensors-icon',
                    content_gravity: Clutter.ContentGravity.CENTER,
                });
                grid.addToGrid(icon);

                //Name
                const label = new St.Label({
                    text: '',
                    style_class: 'astra-monitor-menu-sensors-label',
                    x_expand: true,
                });
                grid.addToGrid(label);

                //Value
                const value = new St.Label({
                    text: '-',
                    style_class: 'astra-monitor-menu-sensors-key',
                    x_expand: true,
                });
                grid.addToGrid(value);
                values.push({ icon, label, value });
            }
            popup.categories.push({ name: categoryLabel, sensors: values });
        }
        popup.addToMenu(grid, 2);

        popup.updateData = (data: GenericGpuInfo) => {
            for(let i = 0; i < 6; i++) {
                const category = popup.categories[i];
                const categoryData = data.sensors.categories[i];

                if(!categoryData) {
                    category.name.hide();
                    for(let k = 0; k < 10; k++) {
                        const sensor = category.sensors[k];
                        sensor.icon.hide();
                        sensor.label.hide();
                        sensor.value.hide();
                    }
                    continue;
                } else {
                    category.name.text = categoryData.name;
                }

                for(let k = 0; k < 10; k++) {
                    const sensor = category.sensors[k];
                    const sensorData = categoryData.sensors[k];

                    if(sensorData) {
                        const icon = Utils.unitToIcon(sensorData.unit);
                        if(icon.gicon) sensor.icon.gicon = icon.gicon;
                        sensor.icon.fallback_icon_name = icon.fallback_icon_name;

                        sensor.label.text = sensorData.name;

                        let unit = sensorData.unit;
                        if(unit === 'C') unit = '°C';

                        let value = sensorData.value;
                        if(
                            unit === '°C' &&
                            typeof value === 'number' &&
                            Config.get_string('sensors-temperature-unit') === 'fahrenheit'
                        ) {
                            value = Utils.celsiusToFahrenheit(value as number);
                            unit = '°F';
                        }

                        unit = unit === '' ? '' : ' ' + unit;
                        sensor.value.text = value + unit;
                    } else {
                        sensor.icon.hide();
                        sensor.label.hide();
                        sensor.value.hide();
                    }
                }
            }
        };

        return popup;
    }

    public update(data?: Map<string, GenericGpuInfo>) {
        if(!data) return;

        if(!this.shown) {
            this.lastData = data;
            return;
        }

        const selectedGpu = Utils.gpuMonitor.getSelectedGpu();
        if(!selectedGpu) return;

        const selectedPci = `${selectedGpu.domain}:${selectedGpu.bus}.${selectedGpu.slot}`;
        const gpuData: GenericGpuInfo | undefined = data.get(selectedPci);

        if(!gpuData) return;

        const compareGpu = (section: Section): boolean => {
            return (
                section.info.domain === selectedGpu.domain &&
                section.info.bus === selectedGpu.bus &&
                section.info.slot === selectedGpu.slot
            );
        };
        const section: Section | undefined = this.sections.find(compareGpu);
        if(!section) return;

        if(
            section.vram.bar &&
            gpuData.vram.percent !== undefined &&
            !Number.isNaN(gpuData.vram.percent)
        ) {
            section.vram.bar.setUsage([{ percent: gpuData.vram.percent }]);
            if(section.vram.barLabel)
                section.vram.barLabel.text = gpuData.vram.percent.toFixed(0) + '%';
        }

        if(
            section.vram.usedLabel &&
            gpuData.vram.used !== undefined &&
            !Number.isNaN(gpuData.vram.used)
        ) {
            section.vram.usedLabel.text = Utils.formatBytes(gpuData.vram.used, 'kB-KB', 3);
        }

        if(
            section.vram.totalLabel &&
            gpuData.vram.total !== undefined &&
            !Number.isNaN(gpuData.vram.total)
        ) {
            section.vram.totalLabel.text = Utils.formatBytes(gpuData.vram.total, 'kB-KB', 3);
        }

        if(
            section.activity.gfxBar &&
            gpuData.activity.GFX !== undefined &&
            !Number.isNaN(gpuData.activity.GFX)
        ) {
            section.activity.gfxBar.setUsage([{ percent: gpuData.activity.GFX }]);
            if(section.activity.gfxBarLabel)
                section.activity.gfxBarLabel.text = gpuData.activity.GFX.toFixed(0) + '%';
        }

        const numProcesses = this.compact ? 3 : 5;
        for(let index = 0; index < numProcesses; index++) {
            const topProcess = this.topProcesses[index];
            if(!topProcess) continue;

            const topProcessData = gpuData.topProcesses[index];
            if(!topProcessData) {
                topProcess.label.text = '-';
                topProcess.value1.text = '-';
                topProcess.value2.text = '-';
                continue;
            }

            topProcess.label.text = topProcessData.name;

            const pipe0 = topProcessData.pipes[0];
            if(!pipe0) {
                topProcess.value1.text = '-';
            } else {
                if(pipe0.unit === '%') topProcess.value1.text = pipe0.value.toFixed(0) + '%';
                else topProcess.value1.text = Utils.formatBytes(pipe0.value, 'kB-KB', 3);
            }

            const pipe1 = topProcessData.pipes[1];
            if(!pipe1) {
                topProcess.value2.hide();
            } else {
                topProcess.value2.show();
                if(pipe1.unit === '%') topProcess.value2.text = pipe1.value.toFixed(0) + '%';
                else topProcess.value2.text = Utils.formatBytes(pipe1.value, 'kB-KB', 3);
            }
        }

        const numSensors = this.compact ? 1 : 3;
        for(let index = 0; index < numSensors; index++) {
            const sensor = this.mainSensors[index];
            if(!sensor) continue;

            sensor.label.text = '-';
            sensor.value.text = '-';

            if(!gpuData.sensors.list) continue;

            const sensorData = gpuData.sensors.list[index];
            if(!sensorData) continue;

            sensor.label.text = sensorData.name;

            let unit = sensorData.unit;
            if(unit === 'C') unit = '°C';

            let value = sensorData.value;
            if(
                unit === '°C' &&
                typeof value === 'number' &&
                Config.get_string('sensors-temperature-unit') === 'fahrenheit'
            ) {
                value = Utils.celsiusToFahrenheit(value as number);
                unit = '°F';
            }

            unit = unit === '' ? '' : ' ' + unit;
            sensor.value.text = value + unit;
        }

        if(section.infoPopup) section.infoPopup.updateData(gpuData);
        if(section.activityPopup) section.activityPopup.updateData(gpuData);
        if(section.vramPopup) section.vramPopup.updateData(gpuData);
        if(section.topProcessesPopup) section.topProcessesPopup.updateData(gpuData);
        if(section.sensorsPopup) section.sensorsPopup.updateData(gpuData);
    }

    public onOpen() {
        this.clear();

        this.shown = true;
        this.update(this.lastData);
    }

    public onClose() {
        this.shown = false;
    }

    public clear() {}

    public destroy() {
        Config.clear(this);

        if(this.title) Config.clear(this.title);
        if(this.noGPULabel) Config.clear(this.noGPULabel);
    }
}
