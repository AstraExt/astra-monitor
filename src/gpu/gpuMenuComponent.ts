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
import Pango from 'gi://Pango';
import { gettext as _ } from 'resource:///org/gnome/shell/extensions/extension.js';

import MenuBase from '../menu.js';
import Utils, { GpuInfo } from '../utils/utils.js';
import Grid from '../grid.js';
import Config from '../config.js';
import { DisplayData, GenericGpuInfo } from '../gpu/gpuMonitor.js';
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

type DisplaysPopup = MenuBase & {
    gpuInfo: GpuInfo;
    displayContainers: {
        container: InstanceType<typeof Grid>;
        label: St.Label;

        status: St.Label;
        productCodeLabel: St.Label;
        productCodeValue: St.Label;
        serialNumberLabel: St.Label;
        serialNumberValue: St.Label;
        manufacturerDateLabel: St.Label;
        manufacturerDateValue: St.Label;
        edidVersionLabel: St.Label;
        edidVersionValue: St.Label;
        displaySizeLabel: St.Label;
        displaySizeValue: St.Label;
        nativeResolutionLabel: St.Label;
        nativeResolutionValue: St.Label;
        refreshRateLabel: St.Label;
        refreshRateValue: St.Label;
        displayGammaLabel: St.Label;
        displayGammaValue: St.Label;
        displayTypeLabel: St.Label;
        displayTypeValue: St.Label;
        capabilitiesLabel: St.Label;
        capabilitiesValue: St.Label;
    }[];
    updateData: (data: DisplayData[]) => void;
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
    uuid: string;
    infoPopup?: InfoPopup;
    displaysTitle?: St.Label;
    displaysPopup?: DisplaysPopup;
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

    private topProcesses!: Map<string, TopProcess[]>;
    private mainSensors!: Map<string, Sensor[]>;

    private sections: Section[];

    constructor(params: GpuComponentProps) {
        this.parent = params.parent;
        if(params.compact) this.compact = params.compact;
        if(params.title) this.title = params.title;

        this.sections = [];
        this.topProcesses = new Map();
        this.mainSensors = new Map();

        this.init();
    }

    private init() {
        if(this.title) {
            this.title.text = _('GPU');

            Config.connect(this.title, 'changed::gpu-data', () => {
                const gpu = Utils.gpuMonitor.getMonitoredGPUs();
                if(this.title) this.title.visible = !!gpu;
            });
        }

        this.container = new Grid({ numCols: 2, styleClass: 'astra-monitor-menu-subgrid' });

        const GPUsList = Utils.getGPUsList();
        if(!GPUsList || GPUsList.length === 0) {
            // Print No GPU found
            this.noGPULabel = new St.Label({
                text: _('No GPU found'),
                styleClass: 'astra-monitor-menu-label-warning',
                style: 'font-style:italic;',
            });

            Config.connect(this.noGPULabel, 'changed::gpu-data', () => {
                const gpus = Utils.getGPUsList();
                if(this.noGPULabel) this.noGPULabel.visible = !gpus || gpus.length === 0;
            });
            this.container.addToGrid(this.noGPULabel, 2);
            return;
        }

        if(GPUsList.length > 1 && this.title) this.title.text = _('GPUs');

        for(let i = 0; i < GPUsList.length; i++) {
            const gpu = GPUsList[i];
            const section = this.createSection(gpu);
            this.sections.push(section);
        }
    }

    private createSection(gpuInfo: GpuInfo): Section {
        const section: Section = {
            info: gpuInfo,
            uuid: Utils.getGpuUUID(gpuInfo),
            vram: {},
            activity: {},
        };

        const defaultStyle = 'max-width: 150px;';

        const grid = new Grid({ numCols: 1, styleClass: 'astra-monitor-menu-subgrid' });

        const infoButton = new St.Button({
            reactive: true,
            trackHover: true,
            style: defaultStyle,
            xExpand: true,
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

        //DISPLAYS
        const displaysButton = new St.Button({
            reactive: true,
            trackHover: true,
            style: defaultStyle,
            xExpand: true,
        });

        const displaysGrid = new Grid({ numCols: 1 });
        displaysButton.set_child(displaysGrid);

        const displaysPopup = this.createDisplaysPopup(displaysButton, gpuInfo);
        section.displaysPopup = displaysPopup;

        displaysButton.connect('enter-event', () => {
            displaysButton.style = defaultStyle + this.parent.selectionStyle;
            if(displaysPopup) displaysPopup.open(true);
        });

        displaysButton.connect('leave-event', () => {
            displaysButton.style = defaultStyle;
            if(displaysPopup) displaysPopup.close(true);
        });
        grid.addToGrid(displaysButton);

        const displaysTitle = new St.Label({
            text: _('No Connected Display'),
            styleClass: 'astra-monitor-menu-header-small-centered',
            xExpand: true,
        });
        section.displaysTitle = displaysTitle;
        displaysGrid.addToGrid(displaysTitle);

        //ACTIVITY
        const activityButton = new St.Button({
            reactive: true,
            trackHover: true,
            style: defaultStyle,
            xExpand: true,
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
            styleClass: 'astra-monitor-menu-header-small-centered',
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
                xAlign: Clutter.ActorAlign.START,
                style: 'margin-bottom:0;margin-right:0;border:solid 1px #555;',
            });
            barGrid.addToGrid(bar);

            const barUsagePercLabel = new St.Label({
                text: '0%',
                style: 'margin-left:0.3em;margin-right:0.3em;padding-top:2px;width:2.8em;font-size:0.8em;text-align:right;',
                yAlign: Clutter.ActorAlign.END,
            });
            barGrid.addToGrid(barUsagePercLabel);

            activityGrid.addToGrid(barGrid);

            section.activity.gfxBar = bar;
            section.activity.gfxBarLabel = barUsagePercLabel;
        }

        //VRAM
        const vramButton = new St.Button({
            reactive: true,
            trackHover: true,
            style: defaultStyle,
            xExpand: true,
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
            styleClass: 'astra-monitor-menu-header-small-centered',
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
                xAlign: Clutter.ActorAlign.START,
                style: 'margin-bottom:0;margin-right:0;border:solid 1px #555;',
            });
            barGrid.addToGrid(bar);

            const barUsagePercLabel = new St.Label({
                text: '0%',
                style: 'margin-left:0.3em;margin-right:0.3em;padding-top:2px;width:2.8em;font-size:0.8em;text-align:right;',
                yAlign: Clutter.ActorAlign.END,
            });
            barGrid.addToGrid(barUsagePercLabel);

            vramGrid.addToGrid(barGrid);

            section.vram.bar = bar;
            section.vram.barLabel = barUsagePercLabel;
        }

        // VRAM Labels
        {
            const vramContainer = new St.Widget({
                layoutManager: new Clutter.GridLayout({
                    orientation: Clutter.Orientation.HORIZONTAL,
                }),
                xExpand: true,
                style: 'margin-right:0;',
            });

            const usedContainer = new St.Widget({
                layoutManager: new Clutter.GridLayout({
                    orientation: Clutter.Orientation.HORIZONTAL,
                }),
                xExpand: true,
                style: 'margin-left:0;margin-right:0;',
            });

            const usedLabel = new St.Label({
                text: _('Used:'),
                styleClass: 'astra-monitor-menu-label',
                style: 'padding-right:0.15em;',
            });
            usedContainer.add_child(usedLabel);

            const usedValueLabel = new St.Label({
                text: '-',
                xExpand: true,
                styleClass: 'astra-monitor-menu-key-mid',
            });
            usedContainer.add_child(usedValueLabel);
            usedContainer.set_width(100);

            vramContainer.add_child(usedContainer);

            const totalContainer = new St.Widget({
                layoutManager: new Clutter.GridLayout({
                    orientation: Clutter.Orientation.HORIZONTAL,
                }),
                xExpand: true,
                style: 'margin-left:0;margin-right:0;',
            });

            const totalLabel = new St.Label({
                text: _('Total:'),
                styleClass: 'astra-monitor-menu-label',
                style: 'padding-right:0.15em;',
            });
            totalContainer.add_child(totalLabel);

            const totalValueLabel = new St.Label({
                text: '-',
                xExpand: true,
                styleClass: 'astra-monitor-menu-key-mid',
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
            trackHover: true,
            style: defaultStyle,
            xExpand: true,
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
            styleClass: 'astra-monitor-menu-header-small-centered',
        });
        topProcessesGrid.addToGrid(topProcessesTitle);

        // Top Processes List
        {
            const listGrid = new Grid({
                numCols: 3,
                styleClass: 'astra-monitor-menu-subgrid',
            });

            const processes: TopProcess[] = [];

            const numProcesses = this.compact ? 3 : 5;
            for(let i = 0; i < numProcesses; i++) {
                const label = new St.Label({
                    text: '-',
                    styleClass: 'astra-monitor-menu-cmd-name',
                    xExpand: true,
                });
                listGrid.addToGrid(label);
                const value1 = new St.Label({
                    text: '-',
                    styleClass: 'astra-monitor-menu-cmd-usage',
                    xExpand: true,
                });
                listGrid.addToGrid(value1);
                const value2 = new St.Label({
                    text: '-',
                    styleClass: 'astra-monitor-menu-cmd-usage',
                    xExpand: true,
                });
                listGrid.addToGrid(value2);

                processes.push({ label, value1, value2 });
            }
            this.topProcesses.set(section.uuid, processes);
            topProcessesGrid.addToGrid(listGrid);
        }
        grid.addToGrid(topProcessesButton);

        // Sensors
        const sensorsButton = new St.Button({
            reactive: true,
            trackHover: true,
            style: defaultStyle,
            xExpand: true,
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
            styleClass: 'astra-monitor-menu-header-small-centered',
        });
        sensorsGrid.addToGrid(sensorsTitle);

        // Main Sensors List
        {
            const listGrid = new Grid({
                numCols: 2,
                styleClass: 'astra-monitor-menu-subgrid',
            });

            const sensors: Sensor[] = [];

            const numSensors = this.compact ? 1 : 3;
            for(let i = 0; i < numSensors; i++) {
                const label = new St.Label({
                    text: '-',
                    styleClass: 'astra-monitor-menu-cmd-name',
                    xExpand: true,
                });
                listGrid.addToGrid(label);
                const value = new St.Label({
                    text: '-',
                    styleClass: 'astra-monitor-menu-cmd-usage',
                    xExpand: true,
                });
                listGrid.addToGrid(value);

                sensors.push({ label, value });
            }
            this.mainSensors.set(section.uuid, sensors);
            sensorsGrid.addToGrid(listGrid);
        }
        grid.addToGrid(sensorsButton);
        this.container.addToGrid(grid, 2);

        const updateMonitoredGPUs = () => {
            const monitoredGPUs = Utils.gpuMonitor.getMonitoredGPUs();

            let monitored = false;
            if(monitoredGPUs) {
                for(const gpu of monitoredGPUs) {
                    if(Utils.isSameGpu(gpu, gpuInfo)) {
                        monitored = true;
                        break;
                    }
                }
            }

            if(monitored) {
                activityButton.visible = true;
                vramButton.visible = true;
                topProcessesButton.visible = true;
                sensorsButton.visible = true;

                infoLabel.styleClass = 'astra-monitor-menu-label';
            } else {
                activityButton.visible = false;
                vramButton.visible = false;
                topProcessesButton.visible = false;
                sensorsButton.visible = false;

                if(Utils.themeStyle === 'light')
                    infoLabel.styleClass = 'astra-monitor-menu-unmonitored-light';
                else infoLabel.styleClass = 'astra-monitor-menu-unmonitored';
            }
        };
        updateMonitoredGPUs();

        Config.connect(this, 'changed::gpu-data', updateMonitoredGPUs);
        return section;
    }

    private createInfoPopup(sourceActor: St.Widget, gpuInfo: GpuInfo): InfoPopup {
        const popup = new MenuBase(sourceActor, 0.05) as InfoPopup;
        popup.addMenuSection(_('GPU info'));

        const GPUModelName = Utils.getGPUModelName(gpuInfo);

        popup.addToMenu(
            new St.Label({
                text: GPUModelName,
                styleClass: 'astra-monitor-menu-sub-header',
            }),
            2
        );

        popup.addToMenu(
            new St.Label({
                text: _('Name'),
                styleClass: 'astra-monitor-menu-sub-key',
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
                styleClass: 'astra-monitor-menu-sub-key',
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
                        styleClass: 'astra-monitor-menu-sub-key',
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
                    styleClass: 'astra-monitor-menu-sub-key',
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
                    styleClass: 'astra-monitor-menu-sub-key',
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
                styleClass: 'astra-monitor-menu-sub-key',
            })
        );

        const domain = gpuInfo.domain.split(':');
        if(domain.length === 2) {
            const pciLabel = new St.Label({ text: '' });
            pciLabel.clutterText.useMarkup = true;
            pciLabel.clutterText.set_markup(
                // eslint-disable-next-line no-irregular-whitespace
                `<span alpha="60%">${domain[0]}</span> : <b>${domain[1]}</b> : ${gpuInfo.bus} : <span font_scale="small-caps">${gpuInfo.slot}</span>`
            );
            popup.addToMenu(pciLabel);
        }

        if(gpuInfo.drivers && Array.isArray(gpuInfo.drivers) && gpuInfo.drivers.length > 0) {
            popup.addToMenu(
                new St.Label({
                    text: _('Drivers'),
                    styleClass: 'astra-monitor-menu-sub-key',
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
                    styleClass: 'astra-monitor-menu-sub-key',
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
                styleClass: 'astra-monitor-menu-sub-key',
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

    private createDisplaysPopup(sourceActor: St.Widget, gpuInfo: GpuInfo): DisplaysPopup {
        const popup = new MenuBase(sourceActor, 0.05) as DisplaysPopup;
        popup.addMenuSection(_('Displays'));

        const noDisplaysLabel = new St.Label({
            text: _('No displays found'),
            styleClass: 'astra-monitor-menu-label',
        });
        popup.addToMenu(noDisplaysLabel, 2);

        const grid = new Grid({
            numCols: 1,
            xExpand: true,
            xAlign: Clutter.ActorAlign.START,
        });
        popup.addToMenu(grid, 2);

        popup.displayContainers = [];

        for(let i = 0; i < 8; i++) {
            const displayContainer = new Grid({
                numCols: 2,
                xExpand: true,
                xAlign: Clutter.ActorAlign.FILL,
            });
            const displayLabel = new St.Label({
                text: '',
                xAlign: Clutter.ActorAlign.CENTER,
                style: 'font-size:0.9em;max-width:250px;',
            });
            displayLabel.clutterText.useMarkup = true;
            displayContainer.addToGrid(displayLabel, 2);

            const horizontalLine = new St.Widget({
                reactive: false,
                style: 'height:1px;width:100%;margin:0 8px;background-color:#888;opacity:0.5;',
            });
            displayContainer.addToGrid(horizontalLine, 2);

            grid.addToGrid(displayContainer, 2);

            const statusLabel = new St.Label({
                text: _('Status'),
                styleClass: 'astra-monitor-menu-sub-key',
                xExpand: true,
            });
            displayContainer.addToGrid(statusLabel);

            const statusValue = new St.Label({
                text: '',
                styleClass: 'astra-monitor-menu-sub-value',
                style: 'width:250px;',
            });
            displayContainer.addToGrid(statusValue);

            const productCodeLabel = new St.Label({
                text: _('Product Code'),
                styleClass: 'astra-monitor-menu-sub-key',
                xExpand: true,
            });
            displayContainer.addToGrid(productCodeLabel);

            const productCodeValue = new St.Label({
                text: '',
                styleClass: 'astra-monitor-menu-sub-value',
                xExpand: true,
            });
            displayContainer.addToGrid(productCodeValue);

            const serialNumberLabel = new St.Label({
                text: _('Serial Number'),
                styleClass: 'astra-monitor-menu-sub-key',
                xExpand: true,
            });
            displayContainer.addToGrid(serialNumberLabel);

            const serialNumberValue = new St.Label({
                text: '',
                styleClass: 'astra-monitor-menu-sub-value',
                xExpand: true,
            });
            displayContainer.addToGrid(serialNumberValue);

            const manufacturerDateLabel = new St.Label({
                text: _('Manufacturer Date'),
                styleClass: 'astra-monitor-menu-sub-key',
                xExpand: true,
            });
            displayContainer.addToGrid(manufacturerDateLabel);

            const manufacturerDateValue = new St.Label({
                text: '',
                styleClass: 'astra-monitor-menu-sub-value',
                xExpand: true,
            });
            displayContainer.addToGrid(manufacturerDateValue);

            const edidVersionLabel = new St.Label({
                text: _('EDID Version'),
                styleClass: 'astra-monitor-menu-sub-key',
                xExpand: true,
            });
            displayContainer.addToGrid(edidVersionLabel);

            const edidVersionValue = new St.Label({
                text: '',
                styleClass: 'astra-monitor-menu-sub-value',
                xExpand: true,
            });
            displayContainer.addToGrid(edidVersionValue);

            const displaySizeLabel = new St.Label({
                text: _('Display Size'),
                styleClass: 'astra-monitor-menu-sub-key',
                xExpand: true,
            });
            displayContainer.addToGrid(displaySizeLabel);

            const displaySizeValue = new St.Label({
                text: '',
                styleClass: 'astra-monitor-menu-sub-value',
                xExpand: true,
            });
            displayContainer.addToGrid(displaySizeValue);

            const nativeResolutionLabel = new St.Label({
                text: _('Native Resolution'),
                styleClass: 'astra-monitor-menu-sub-key',
                xExpand: true,
            });
            displayContainer.addToGrid(nativeResolutionLabel);

            const nativeResolutionValue = new St.Label({
                text: '',
                styleClass: 'astra-monitor-menu-sub-value',
                xExpand: true,
            });
            displayContainer.addToGrid(nativeResolutionValue);

            const refreshRateLabel = new St.Label({
                text: _('Refresh Rate'),
                styleClass: 'astra-monitor-menu-sub-key',
                xExpand: true,
            });
            displayContainer.addToGrid(refreshRateLabel);

            const refreshRateValue = new St.Label({
                text: '',
                styleClass: 'astra-monitor-menu-sub-value',
                xExpand: true,
            });
            displayContainer.addToGrid(refreshRateValue);

            const displayGammaLabel = new St.Label({
                text: _('Display Gamma'),
                styleClass: 'astra-monitor-menu-sub-key',
                xExpand: true,
            });
            displayContainer.addToGrid(displayGammaLabel);

            const displayGammaValue = new St.Label({
                text: '',
                styleClass: 'astra-monitor-menu-sub-value',
                xExpand: true,
            });
            displayContainer.addToGrid(displayGammaValue);

            const displayTypeLabel = new St.Label({
                text: _('Display Type'),
                styleClass: 'astra-monitor-menu-sub-key',
                xExpand: true,
            });
            displayContainer.addToGrid(displayTypeLabel);

            const displayTypeValue = new St.Label({
                text: '',
                styleClass: 'astra-monitor-menu-sub-value',
                xExpand: true,
            });
            displayContainer.addToGrid(displayTypeValue);

            const capabilitiesLabel = new St.Label({
                text: _('Capabilities'),
                styleClass: 'astra-monitor-menu-sub-key',
                xExpand: true,
            });
            displayContainer.addToGrid(capabilitiesLabel);

            const capabilitiesValue = new St.Label({
                text: '',
                styleClass: 'astra-monitor-menu-sub-value',
                xExpand: true,
                style: 'max-width:250px;',
            });
            capabilitiesValue.clutterText.set_line_wrap(true);
            capabilitiesValue.clutterText.set_line_wrap_mode(Pango.WrapMode.WORD);
            displayContainer.addToGrid(capabilitiesValue);

            popup.displayContainers.push({
                container: displayContainer,
                label: displayLabel,
                status: statusValue,
                productCodeLabel: productCodeLabel,
                productCodeValue: productCodeValue,
                serialNumberLabel: serialNumberLabel,
                serialNumberValue: serialNumberValue,
                manufacturerDateLabel: manufacturerDateLabel,
                manufacturerDateValue: manufacturerDateValue,
                edidVersionLabel: edidVersionLabel,
                edidVersionValue: edidVersionValue,
                displaySizeLabel: displaySizeLabel,
                displaySizeValue: displaySizeValue,
                nativeResolutionLabel: nativeResolutionLabel,
                nativeResolutionValue: nativeResolutionValue,
                refreshRateLabel: refreshRateLabel,
                refreshRateValue: refreshRateValue,
                displayGammaLabel: displayGammaLabel,
                displayGammaValue: displayGammaValue,
                displayTypeLabel: displayTypeLabel,
                displayTypeValue: displayTypeValue,
                capabilitiesLabel: capabilitiesLabel,
                capabilitiesValue: capabilitiesValue,
            });
        }

        const uuid = Utils.getGpuUUID(gpuInfo);

        popup.updateData = (data: DisplayData[]) => {
            if(data.length > 0) noDisplaysLabel.hide();
            else noDisplaysLabel.show();

            const displaysData = data.filter(
                d =>
                    d.uuid === uuid &&
                    d.connector &&
                    !d.connector.toLowerCase().includes('writeback')
            );
            for(let i = 0; i < popup.displayContainers.length; i++) {
                const displayContainer = popup.displayContainers[i];
                const displayData = displaysData[i];

                displayContainer.container.show();

                if(!displayData) {
                    displayContainer.container.hide();
                    continue;
                }

                // LABEL
                let labelText = '';
                if(displayData.edid?.modelName) {
                    labelText = displayData.edid.modelName;
                } else if(displayData.edid?.eisaInfo && displayData.edid.eisaInfo.name) {
                    labelText = displayData.edid.eisaInfo.name;
                }

                if(displayData.connector) {
                    if(labelText) {
                        labelText += ` [<b><span color='grey'>${displayData.connector}</span></b>]`;
                    } else {
                        labelText = `[<b><span color='grey'>${displayData.connector}</span></b>]`;
                    }
                }

                if(!labelText) {
                    displayContainer.container.hide();
                    continue;
                }

                displayContainer.label.clutterText.set_markup(labelText);
                displayContainer.status.text = Utils.capitalize(displayData.status);

                if(displayData.enabled) {
                    displayContainer.status.text += ' - ' + _('Enabled');
                } else {
                    displayContainer.status.text += ' - ' + _('Disabled');
                }

                if(displayData.status === 'disconnected') {
                    displayContainer.productCodeLabel.hide();
                    displayContainer.productCodeValue.hide();
                    displayContainer.serialNumberLabel.hide();
                    displayContainer.serialNumberValue.hide();
                    displayContainer.manufacturerDateLabel.hide();
                    displayContainer.manufacturerDateValue.hide();
                    displayContainer.edidVersionLabel.hide();
                    displayContainer.edidVersionValue.hide();
                    displayContainer.displaySizeLabel.hide();
                    displayContainer.displaySizeValue.hide();
                    displayContainer.nativeResolutionLabel.hide();
                    displayContainer.nativeResolutionValue.hide();
                    displayContainer.refreshRateLabel.hide();
                    displayContainer.refreshRateValue.hide();
                    displayContainer.displayGammaLabel.hide();
                    displayContainer.displayGammaValue.hide();
                    displayContainer.displayTypeLabel.hide();
                    displayContainer.displayTypeValue.hide();
                    displayContainer.capabilitiesLabel.hide();
                    displayContainer.capabilitiesValue.hide();
                    continue;
                }

                // PRODUCT CODE
                if(displayData.edid?.productCode) {
                    displayContainer.productCodeValue.text =
                        '0x' + displayData.edid.productCode?.toString(16).toUpperCase() || '';
                    displayContainer.productCodeLabel.show();
                    displayContainer.productCodeValue.show();
                } else {
                    displayContainer.productCodeLabel.hide();
                    displayContainer.productCodeValue.hide();
                }

                // SERIAL NUMBER
                if(displayData.edid?.serialNumber) {
                    if(typeof displayData.edid.serialNumber === 'number') {
                        displayContainer.serialNumberValue.text =
                            '0x' + displayData.edid.serialNumber.toString(16).toUpperCase();
                    } else {
                        displayContainer.serialNumberValue.text =
                            displayData.edid.serialNumber?.toString() || '';
                    }
                    displayContainer.serialNumberLabel.show();
                    displayContainer.serialNumberValue.show();
                } else {
                    displayContainer.serialNumberLabel.hide();
                    displayContainer.serialNumberValue.hide();
                }

                // MANUFACTURER DATE
                if(displayData.edid?.manufactureDate) {
                    displayContainer.manufacturerDateValue.text = displayData.edid.manufactureDate;
                    displayContainer.manufacturerDateLabel.show();
                    displayContainer.manufacturerDateValue.show();
                } else {
                    displayContainer.manufacturerDateLabel.hide();
                    displayContainer.manufacturerDateValue.hide();
                }

                // EDID VERSION
                if(displayData.edid?.edidVersion) {
                    displayContainer.edidVersionValue.text = displayData.edid.edidVersion;
                    displayContainer.edidVersionLabel.show();
                    displayContainer.edidVersionValue.show();
                } else {
                    displayContainer.edidVersionLabel.hide();
                    displayContainer.edidVersionValue.hide();
                }

                // DISPLAY SIZE
                if(displayData.edid?.bdp?.maxHorImgSize && displayData.edid?.bdp?.maxVertImgSize) {
                    const width = displayData.edid.bdp.maxHorImgSize;
                    const height = displayData.edid.bdp.maxVertImgSize;
                    const inches = Math.sqrt(Math.pow(width, 2) + Math.pow(height, 2)) / 2.54;

                    displayContainer.displaySizeValue.text = `${inches.toFixed(1)}" - ${width}cm x ${height}cm`;
                    displayContainer.displaySizeLabel.show();
                    displayContainer.displaySizeValue.show();
                } else {
                    displayContainer.displaySizeLabel.hide();
                    displayContainer.displaySizeValue.hide();
                }

                if(
                    displayData.edid?.dtds &&
                    displayData.edid?.dtds.length > 0 &&
                    displayData.edid?.dtds[0].horActivePixels &&
                    displayData.edid?.dtds[0].vertActivePixels
                ) {
                    const resolutions = new Set<string>();

                    for(const dtd of displayData.edid.dtds) {
                        resolutions.add(dtd.horActivePixels + ' x ' + dtd.vertActivePixels);
                    }

                    displayContainer.nativeResolutionValue.text =
                        Array.from(resolutions).join(', ');
                    displayContainer.nativeResolutionValue.show();

                    if(resolutions.size > 1) {
                        displayContainer.nativeResolutionLabel.text = _('Native Resolutions');
                    } else {
                        displayContainer.nativeResolutionLabel.text = _('Native Resolution');
                    }
                    displayContainer.nativeResolutionLabel.show();
                } else {
                    displayContainer.nativeResolutionLabel.hide();
                    displayContainer.nativeResolutionValue.hide();
                }

                // REFRESH RATE
                if(
                    displayData.edid?.standardDisplayModes &&
                    displayData.edid?.standardDisplayModes.length > 0
                ) {
                    const refreshRates = new Set<number>();
                    for(const mode of displayData.edid.standardDisplayModes) {
                        refreshRates.add(mode.vertFreq);
                    }
                    displayContainer.refreshRateValue.text = Array.from(refreshRates).join(', ');

                    if(refreshRates.size > 1) {
                        displayContainer.refreshRateLabel.text = _('Refresh Rates');
                    } else {
                        displayContainer.refreshRateLabel.text = _('Refresh Rate');
                    }
                    displayContainer.refreshRateLabel.show();
                    displayContainer.refreshRateValue.show();
                } else {
                    displayContainer.refreshRateLabel.hide();
                    displayContainer.refreshRateValue.hide();
                }

                // DISPLAY GAMMA
                if(displayData.edid?.bdp?.displayGamma) {
                    displayContainer.displayGammaValue.text =
                        displayData.edid.bdp.displayGamma.toFixed(1);
                    displayContainer.displayGammaLabel.show();
                    displayContainer.displayGammaValue.show();
                } else {
                    displayContainer.displayGammaLabel.hide();
                    displayContainer.displayGammaValue.hide();
                }

                // DISPLAY TYPE
                if(displayData.edid?.bdp?.displayType) {
                    displayContainer.displayTypeLabel.show();
                    displayContainer.displayTypeValue.show();

                    if(displayData.edid?.bdp?.digitalInput) {
                        switch(displayData.edid?.bdp?.displayType) {
                            case 0:
                                displayContainer.displayTypeValue.text = _('RGB 4:4:4');
                                break;
                            case 1:
                                displayContainer.displayTypeValue.text =
                                    _('RGB 4:4:4 + YCrCb 4:4:4');
                                break;
                            case 2:
                                displayContainer.displayTypeValue.text =
                                    _('RGB 4:4:4 + YCrCb 4:2:2');
                                break;
                            case 3:
                                displayContainer.displayTypeValue.text = _(
                                    'RGB 4:4:4 + YCrCb 4:4:4 + YCrCb 4:2:2'
                                );
                                break;
                        }
                    } else {
                        switch(displayData.edid.bdp.displayType) {
                            case 0:
                                displayContainer.displayTypeValue.text =
                                    _('Monochrome or Grayscale');
                                break;
                            case 1:
                                displayContainer.displayTypeValue.text = _('RGB color');
                                break;
                            case 2:
                                displayContainer.displayTypeValue.text = _('Non-RGB color');
                                break;
                            case 3:
                                displayContainer.displayTypeLabel.hide();
                                displayContainer.displayTypeValue.hide();
                                break;
                        }
                    }
                } else {
                    displayContainer.displayTypeLabel.hide();
                    displayContainer.displayTypeValue.hide();
                }

                // CAPABILITIES
                const capabilities = [];

                if(displayData.edid?.bdp?.digitalInput) {
                    capabilities.push(_('Digital Input'));
                    if(displayData.edid?.bdp?.vesaDfpCompatible) {
                        capabilities.push(_('VESA DFP'));
                    }
                } else {
                    if(displayData.edid?.bdp?.whiteSyncLevels) {
                        capabilities.push(
                            _('White Sync Levels: ' + displayData.edid?.bdp?.whiteSyncLevels)
                        );
                    }

                    if(displayData.edid?.bdp?.blankToBlack) {
                        capabilities.push(_('Blank to Black'));
                    }

                    if(displayData.edid?.bdp?.separateSyncSupported) {
                        capabilities.push(_('Separate Sync'));
                    }

                    if(displayData.edid?.bdp?.compositeSyncSupported) {
                        capabilities.push(_('Composite Sync'));
                    }

                    if(displayData.edid?.bdp?.synOnGreen) {
                        capabilities.push(_('Sync on Green'));
                    }

                    if(displayData.edid?.bdp?.vsyncSerrated) {
                        capabilities.push(_('VSync Serrated'));
                    }
                }

                if(displayData.edid?.bdp?.dpmsStandby) {
                    capabilities.push(_('DPMS Standby'));
                }

                if(displayData.edid?.bdp?.dpmsSuspend) {
                    capabilities.push(_('DPMS Suspend'));
                }

                if(displayData.edid?.bdp?.dpmsActiveOff) {
                    capabilities.push(_('DPMS Active Off'));
                }

                if(displayData.edid?.bdp?.standardSRgb) {
                    capabilities.push(_('Standard sRGB'));
                }

                if(displayData.edid?.bdp?.preferredTiming) {
                    capabilities.push(_('Preferred Timing'));
                }

                if(displayData.edid?.bdp?.gtfSupported) {
                    capabilities.push(_('GTF Supported'));
                }

                if(capabilities.length > 0) {
                    displayContainer.capabilitiesLabel.show();
                    displayContainer.capabilitiesValue.show();
                    displayContainer.capabilitiesValue.text = capabilities.join(', ');
                } else {
                    displayContainer.capabilitiesLabel.hide();
                    displayContainer.capabilitiesValue.hide();
                }
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
                styleClass: 'astra-monitor-menu-header-small',
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
                xAlign: Clutter.ActorAlign.START,
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
                styleClass: 'astra-monitor-menu-header-small',
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
                xAlign: Clutter.ActorAlign.START,
                style: 'margin-left:0.3em;margin-bottom:0;margin-right:0;border:solid 1px #555;',
            });
            grid.addToGrid(bar);

            const barLabel = new St.Label({
                text: '-%',
                style: 'width:2.7em;font-size:0.8em;text-align:right;',
            });
            grid.addToGrid(barLabel);

            const footerContainer = new St.Widget({
                layoutManager: new Clutter.GridLayout({
                    orientation: Clutter.Orientation.HORIZONTAL,
                }),
                xExpand: true,
                style: 'margin-left:0.15em;margin-right:0;',
            });

            const usedContainer = new St.Widget({
                layoutManager: new Clutter.GridLayout({
                    orientation: Clutter.Orientation.HORIZONTAL,
                }),
                xExpand: true,
                style: 'margin-left:0;margin-right:0;',
            });

            const usedLabel = new St.Label({
                text: _('Used:'),
                styleClass: 'astra-monitor-menu-label',
                style: 'padding-right:0.15em;',
            });
            usedContainer.add_child(usedLabel);

            const usedValue = new St.Label({
                text: '-',
                xExpand: true,
                styleClass: 'astra-monitor-menu-key-mid',
            });
            usedContainer.add_child(usedValue);
            usedContainer.set_width(100);

            footerContainer.add_child(usedContainer);

            const totalContainer = new St.Widget({
                layoutManager: new Clutter.GridLayout({
                    orientation: Clutter.Orientation.HORIZONTAL,
                }),
                xExpand: true,
                style: 'margin-left:0;margin-right:0;',
            });

            const totalLabel = new St.Label({
                text: _('Total:'),
                styleClass: 'astra-monitor-menu-label',
                style: 'padding-right:0.15em;',
            });
            totalContainer.add_child(totalLabel);

            const totalValue = new St.Label({
                text: '-',
                xExpand: true,
                styleClass: 'astra-monitor-menu-key-mid',
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
            xExpand: true,
            xAlign: Clutter.ActorAlign.START,
            numCols: numValues,
            styleClass: 'astra-monitor-menu-subgrid',
        });

        // Headers
        for(let i = 0; i < numValues; i++) {
            const text = i === 0 ? _('Name') : '';
            const style = i === 0 ? 'min-width:10em;' : 'min-width:5.5em;';

            const header = new St.Label({
                text: text,
                styleClass: 'astra-monitor-menu-header-small-centered',
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
                    styleClass: style,
                    xExpand: true,
                    yAlign: Clutter.ActorAlign.CENTER,
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
            xExpand: true,
            xAlign: Clutter.ActorAlign.START,
            styleClass: 'astra-monitor-menu-subgrid',
        });

        for(let i = 0; i < 6; i++) {
            const categoryLabel = new St.Label({
                text: '',
                styleClass: 'astra-monitor-menu-sensors-category',
                xExpand: true,
            });
            if(i > 0) grid.newLine();
            grid.addToGrid(categoryLabel, 3);

            const values = [];
            for(let k = 0; k < 10; k++) {
                //Icon
                const icon = new St.Icon({
                    styleClass: 'astra-monitor-menu-sensors-icon',
                    contentGravity: Clutter.ContentGravity.CENTER,
                });
                grid.addToGrid(icon);

                //Name
                const label = new St.Label({
                    text: '',
                    styleClass: 'astra-monitor-menu-sensors-label',
                    xExpand: true,
                });
                grid.addToGrid(label);

                //Value
                const value = new St.Label({
                    text: '-',
                    styleClass: 'astra-monitor-menu-sensors-key',
                    xExpand: true,
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
                        sensor.icon.fallbackIconName = icon.fallbackIconName;

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

        for(const section of this.sections) {
            const gpuData: GenericGpuInfo | undefined = data.get(section.uuid);
            if(!gpuData) {
                // This update has no data for this GPU
                continue;
            }

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

            if(this.topProcesses) {
                const numProcesses = this.compact ? 3 : 5;
                for(let index = 0; index < numProcesses; index++) {
                    const topProcess = this.topProcesses.get(section.uuid)?.[index];
                    if(!topProcess) continue;

                    const topProcessData = gpuData.topProcesses[index];
                    if(!topProcessData) {
                        topProcess.label.text = '-';
                        topProcess.value1.text = '-';
                        topProcess.value2.text = '-';

                        if(gpuData.family === 'NVIDIA') {
                            topProcess.value2.hide();
                        }
                        continue;
                    }

                    topProcess.label.text = topProcessData.name;

                    const pipe0 = topProcessData.pipes[0];
                    if(!pipe0) {
                        topProcess.value1.text = '-';
                    } else {
                        if(pipe0.unit === '%')
                            topProcess.value1.text = pipe0.value.toFixed(0) + '%';
                        else topProcess.value1.text = Utils.formatBytes(pipe0.value, 'kB-KB', 3);
                    }

                    const pipe1 = topProcessData.pipes[1];
                    if(!pipe1) {
                        topProcess.value2.hide();
                    } else {
                        topProcess.value2.show();
                        if(pipe1.unit === '%')
                            topProcess.value2.text = pipe1.value.toFixed(0) + '%';
                        else topProcess.value2.text = Utils.formatBytes(pipe1.value, 'kB-KB', 3);
                    }
                }
            }

            if(this.mainSensors) {
                const numSensors = this.compact ? 1 : 3;
                for(let index = 0; index < numSensors; index++) {
                    const sensor = this.mainSensors.get(section.uuid)?.[index];
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
            }

            if(section.infoPopup) section.infoPopup.updateData(gpuData);
            if(section.activityPopup) section.activityPopup.updateData(gpuData);
            if(section.vramPopup) section.vramPopup.updateData(gpuData);
            if(section.topProcessesPopup) section.topProcessesPopup.updateData(gpuData);
            if(section.sensorsPopup) section.sensorsPopup.updateData(gpuData);
        }
    }

    public updateDisplays() {
        let displaysData = Utils.gpuMonitor.getCurrentValue('displays') as DisplayData[];
        displaysData = displaysData.filter(d => !d.connector.toLowerCase().includes('writeback'));
        if(!displaysData || displaysData.length === 0) {
            return;
        }

        for(const section of this.sections) {
            let connected = 0;
            let total = 0;

            const displays = [];

            for(const displayData of displaysData) {
                if(section.uuid === displayData.uuid) {
                    if(displayData.status === 'connected') {
                        connected++;
                    }
                    total++;
                }
                displays.push(displayData);
            }
            if(section.displaysTitle) {
                section.displaysTitle.text = _('%d/%d Displays Connected').format(connected, total);
            }

            if(section.displaysPopup) {
                section.displaysPopup.updateData(displays);
            }
        }
    }

    public onOpen() {
        this.clear();
        this.shown = true;

        Utils.gpuMonitor.requestUpdate('displays');
        Utils.gpuMonitor.listen(this, 'displays', this.updateDisplays.bind(this));

        try {
            this.update(this.lastData);
        } catch(e: any) {
            Utils.error('Error updating gpu menu', e);
        }
    }

    public onClose() {
        this.shown = false;
        Utils.gpuMonitor.unlisten(this, 'displays');
    }

    public clear() {}

    public destroy() {
        this.onClose();
        Config.clear(this);

        if(this.title) Config.clear(this.title);
        if(this.noGPULabel) Config.clear(this.noGPULabel);

        if(this.sections) {
            for(const section of this.sections) {
                section.vram.bar?.destroy();
                section.vram.bar = undefined as any;

                section.activity.gfxBar?.destroy();
                section.activity.gfxBar = undefined as any;

                if(section.activityPopup) {
                    for(const pipe of section.activityPopup.pipes) {
                        pipe.bar?.destroy();
                        pipe.bar = undefined as any;
                    }
                    section.activityPopup.destroy();
                    section.activityPopup = undefined as any;
                }

                if(section.vramPopup) {
                    for(const pipe of section.vramPopup.pipes) {
                        pipe.bar?.destroy();
                        pipe.bar = undefined as any;
                    }
                    section.vramPopup.destroy();
                    section.vramPopup = undefined as any;
                }

                section.infoPopup?.destroy();
                section.infoPopup = undefined as any;

                section.displaysPopup?.destroy();
                section.displaysPopup = undefined as any;

                section.topProcessesPopup?.destroy();
                section.topProcessesPopup = undefined as any;

                section.sensorsPopup?.destroy();
                section.sensorsPopup = undefined as any;
            }
            this.sections = undefined as any;
        }

        this.topProcesses = undefined as any;
        this.mainSensors = undefined as any;

        this.container?.remove_all_children();
        this.container?.destroy();
        this.container = undefined as any;
    }
}
