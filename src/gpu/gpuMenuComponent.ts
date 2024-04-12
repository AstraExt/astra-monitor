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
    addToMenu: (actor: St.Widget, priority?: number) => void;
    updateData: (data: GenericGpuInfo) => void;
};

type ActivityPopup = MenuBase & {
    addToMenu: (actor: St.Widget, priority?: number) => void;
    pipes: {
        grid: InstanceType<typeof Grid>;
        title: St.Label;
        bar: InstanceType<typeof GpuActivityBars>;
        barLabel: St.Label;
    }[];
    updateData: (data: GenericGpuInfo) => void;
};

type VramPopup = MenuBase & {
    addToMenu: (actor: St.Widget, priority?: number) => void;
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

type Section = {
    info: GpuInfo;
    infoPopup?: InfoPopup;
    activityPopup?: ActivityPopup;
    vramPopup?: VramPopup;
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
    private parent: InstanceType<typeof MenuBase>;
    private title: St.Label | undefined;
    private compact: boolean = false;

    public container!: InstanceType<typeof Grid>;
    private infoPopups: InfoPopup[] = [];
    private activityPopups: ActivityPopup[] = [];
    private vramPopups: VramPopup[] = [];
    private noGPULabel: St.Label | undefined;

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
                style: 'font-style:italic;'
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

        if(this.compact) {
            Utils.log('GPU compact mode');
        }
    }

    private createSection(gpuInfo: GpuInfo, selectedGpu?: GpuInfo): Section {
        const section: Section = {
            info: gpuInfo,
            vram: {},
            activity: {}
        };

        const defaultStyle = 'max-width: 150px;';

        const grid = new Grid({ numCols: 1, styleClass: 'astra-monitor-menu-subgrid' });

        const infoButton = new St.Button({
            reactive: true,
            track_hover: true,
            style: defaultStyle,
            x_expand: true
        });
        const label = new St.Label({ text: Utils.getGPUModelName(gpuInfo) });
        infoButton.set_child(label);

        const infoPopup = this.createInfoPopup(infoButton, gpuInfo);
        section.infoPopup = infoPopup;
        this.infoPopups.push(infoPopup);

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
                x_expand: true
            });

            const activityGrid = new Grid({ numCols: 1 });
            activityButton.set_child(activityGrid);

            const activityPopup = this.createActivityPopup(activityButton, gpuInfo);
            section.activityPopup = activityPopup;
            this.activityPopups.push(activityPopup);

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
                style_class: 'astra-monitor-menu-header-small',
                style: 'padding-left:1em;'
            });
            activityGrid.addToGrid(activityTitle);

            // GFX Activity Bar
            {
                const barGrid = new Grid({
                    styleClass: 'astra-monitor-menu-subgrid',
                    style: 'margin-left:0.3em;'
                });

                const bar = new GpuActivityBars({
                    numBars: 1,
                    width: 200 - 2,
                    height: 0.8,
                    mini: false,
                    layout: 'horizontal',
                    x_align: Clutter.ActorAlign.START,
                    style: 'margin-left:0.3em;margin-bottom:0;margin-right:0;border:solid 1px #555;'
                });
                barGrid.addToGrid(bar);

                const barUsagePercLabel = new St.Label({
                    text: '0%',
                    style: 'width:2.8em;font-size:0.8em;text-align:right;'
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
                x_expand: true
            });

            const vramGrid = new Grid({ numCols: 1 });
            vramButton.set_child(vramGrid);

            const vramPopup = this.createVramPopup(vramButton, gpuInfo);
            section.vramPopup = vramPopup;
            this.vramPopups.push(vramPopup);

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
                style_class: 'astra-monitor-menu-header-small',
                style: 'padding-left:1em;'
            });
            vramGrid.addToGrid(vramTitle);

            // Bar
            {
                const barGrid = new Grid({
                    styleClass: 'astra-monitor-menu-subgrid',
                    style: 'margin-left:0.5em;'
                });

                const bar = new GpuMemoryBars({
                    numBars: 1,
                    width: 200 - 2,
                    height: 0.8,
                    mini: false,
                    layout: 'horizontal',
                    x_align: Clutter.ActorAlign.START,
                    style: 'margin-left:0.3em;margin-bottom:0;margin-right:0;border:solid 1px #555;'
                });
                barGrid.addToGrid(bar);

                const barUsagePercLabel = new St.Label({
                    text: '0%',
                    style: 'width:2.7em;font-size:0.8em;text-align:right;'
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
                        orientation: Clutter.Orientation.HORIZONTAL
                    }),
                    x_expand: true,
                    style: 'margin-left:0.5em;margin-right:0;'
                });

                const usedContainer = new St.Widget({
                    layout_manager: new Clutter.GridLayout({
                        orientation: Clutter.Orientation.HORIZONTAL
                    }),
                    x_expand: true,
                    style: 'margin-left:0;margin-right:0;'
                });

                const usedLabel = new St.Label({
                    text: _('Used:'),
                    style_class: 'astra-monitor-menu-label',
                    style: 'padding-right:0.15em;'
                });
                usedContainer.add_child(usedLabel);

                const usedValueLabel = new St.Label({
                    text: '-',
                    x_expand: true,
                    style_class: 'astra-monitor-menu-key-mid'
                });
                usedContainer.add_child(usedValueLabel);
                usedContainer.set_width(100);

                vramContainer.add_child(usedContainer);

                const totalContainer = new St.Widget({
                    layout_manager: new Clutter.GridLayout({
                        orientation: Clutter.Orientation.HORIZONTAL
                    }),
                    x_expand: true,
                    style: 'margin-left:0;margin-right:0;'
                });

                const totalLabel = new St.Label({
                    text: _('Total:'),
                    style_class: 'astra-monitor-menu-label',
                    style: 'padding-right:0.15em;'
                });
                totalContainer.add_child(totalLabel);

                const totalValueLabel = new St.Label({
                    text: '-',
                    x_expand: true,
                    style_class: 'astra-monitor-menu-key-mid'
                });
                totalContainer.add_child(totalValueLabel);
                totalContainer.set_width(100);

                vramContainer.add_child(totalContainer);

                vramGrid.addToGrid(vramContainer);

                section.vram.usedLabel = usedValueLabel;
                section.vram.totalLabel = totalValueLabel;
            }
        }

        this.container.addToGrid(grid, 2);

        const updateSelectedGPU = () => {
            const selectedGpu = Utils.gpuMonitor.getSelectedGpu();

            if(gpuInfo === selectedGpu) {
                label.style_class = 'astra-monitor-menu-label';
            } else {
                if(Utils.themeStyle === 'light')
                    label.style_class = 'astra-monitor-menu-unmonitored-light';
                else label.style_class = 'astra-monitor-menu-unmonitored';
            }
        };
        updateSelectedGPU();

        Config.connect(this, 'changed::gpu-main', updateSelectedGPU);
        return section;
    }

    private createInfoPopup(sourceActor: St.Widget, gpuInfo: GpuInfo): InfoPopup {
        const popup = new MenuBase(sourceActor, 0.05) as InfoPopup;
        popup.addMenuSection(_('GPU info'));

        popup.addToMenu(
            new St.Label({
                text: Utils.getGPUModelName(gpuInfo),
                style_class: 'astra-monitor-menu-sub-header'
            }),
            2
        );

        popup.addToMenu(
            new St.Label({
                text: _('Name'),
                style_class: 'astra-monitor-menu-sub-key'
            })
        );
        popup.addToMenu(
            new St.Label({
                text: gpuInfo.vendor
            })
        );

        popup.addToMenu(
            new St.Label({
                text: _('Subsystem'),
                style_class: 'astra-monitor-menu-sub-key'
            })
        );
        popup.addToMenu(
            new St.Label({
                text: gpuInfo.model
            })
        );

        if(gpuInfo.vendorId) {
            const vendorNames = Utils.getVendorName('0x' + gpuInfo.vendorId);
            if(vendorNames[0] !== 'Unknown') {
                popup.addToMenu(
                    new St.Label({
                        text: _('Vendor'),
                        style_class: 'astra-monitor-menu-sub-key'
                    })
                );
                popup.addToMenu(
                    new St.Label({
                        text: vendorNames.join(' / ')
                    })
                );
            }

            popup.addToMenu(
                new St.Label({
                    text: _('Vendor ID'),
                    style_class: 'astra-monitor-menu-sub-key'
                })
            );
            popup.addToMenu(
                new St.Label({
                    text: gpuInfo.vendorId
                })
            );
        }

        if(gpuInfo.productId) {
            popup.addToMenu(
                new St.Label({
                    text: _('Product ID'),
                    style_class: 'astra-monitor-menu-sub-key'
                })
            );
            popup.addToMenu(
                new St.Label({
                    text: gpuInfo.productId
                })
            );
        }

        let domain = gpuInfo.domain;
        if(domain.startsWith('0000:')) domain = domain.substring(5);

        popup.addToMenu(
            new St.Label({
                text: _('Domain'),
                style_class: 'astra-monitor-menu-sub-key'
            })
        );
        popup.addToMenu(
            new St.Label({
                text: domain
            })
        );

        popup.addToMenu(
            new St.Label({
                text: _('Bus'),
                style_class: 'astra-monitor-menu-sub-key'
            })
        );
        popup.addToMenu(
            new St.Label({
                text: gpuInfo.bus
            })
        );

        popup.addToMenu(
            new St.Label({
                text: _('Slot'),
                style_class: 'astra-monitor-menu-sub-key'
            })
        );
        popup.addToMenu(
            new St.Label({
                text: gpuInfo.slot
            })
        );

        if(gpuInfo.drivers && Array.isArray(gpuInfo.drivers) && gpuInfo.drivers.length > 0) {
            popup.addToMenu(
                new St.Label({
                    text: _('Drivers'),
                    style_class: 'astra-monitor-menu-sub-key'
                })
            );
            popup.addToMenu(
                new St.Label({
                    text: gpuInfo.drivers.join(', ')
                })
            );
        }

        if(gpuInfo.modules && Array.isArray(gpuInfo.modules) && gpuInfo.modules.length > 0) {
            popup.addToMenu(
                new St.Label({
                    text: _('Modules'),
                    style_class: 'astra-monitor-menu-sub-key'
                })
            );
            popup.addToMenu(
                new St.Label({
                    text: gpuInfo.modules.join(', ')
                })
            );
        }

        popup.updateData = (_data: GenericGpuInfo) => {};
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
                style: 'padding-left:0.5em;'
            });
            popup.addToMenu(title, 2);

            const grid = new Grid({
                styleClass: 'astra-monitor-menu-subgrid'
            });

            const bar = new GpuActivityBars({
                numBars: 1,
                width: 200 - 2,
                height: 0.8,
                mini: false,
                layout: 'horizontal',
                x_align: Clutter.ActorAlign.START,
                style: 'margin-left:0.3em;margin-bottom:0;margin-right:0;border:solid 1px #555;'
            });
            grid.addToGrid(bar);

            const barLabel = new St.Label({
                text: '-%',
                style: 'width:2.7em;font-size:0.8em;text-align:right;'
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
                style: 'padding-left:0.5em;'
            });
            popup.addToMenu(title, 2);

            const grid = new Grid({
                styleClass: 'astra-monitor-menu-subgrid'
            });

            const bar = new GpuActivityBars({
                numBars: 1,
                width: 200 - 2,
                height: 0.8,
                mini: false,
                layout: 'horizontal',
                x_align: Clutter.ActorAlign.START,
                style: 'margin-left:0.3em;margin-bottom:0;margin-right:0;border:solid 1px #555;'
            });
            grid.addToGrid(bar);

            const barLabel = new St.Label({
                text: '-%',
                style: 'width:2.7em;font-size:0.8em;text-align:right;'
            });
            grid.addToGrid(barLabel);

            const footerContainer = new St.Widget({
                layout_manager: new Clutter.GridLayout({
                    orientation: Clutter.Orientation.HORIZONTAL
                }),
                x_expand: true,
                style: 'margin-left:0.5em;margin-right:0;'
            });

            const usedContainer = new St.Widget({
                layout_manager: new Clutter.GridLayout({
                    orientation: Clutter.Orientation.HORIZONTAL
                }),
                x_expand: true,
                style: 'margin-left:0;margin-right:0;'
            });

            const usedLabel = new St.Label({
                text: _('Used:'),
                style_class: 'astra-monitor-menu-label',
                style: 'padding-right:0.15em;'
            });
            usedContainer.add_child(usedLabel);

            const usedValue = new St.Label({
                text: '-',
                x_expand: true,
                style_class: 'astra-monitor-menu-key-mid'
            });
            usedContainer.add_child(usedValue);
            usedContainer.set_width(100);

            footerContainer.add_child(usedContainer);

            const totalContainer = new St.Widget({
                layout_manager: new Clutter.GridLayout({
                    orientation: Clutter.Orientation.HORIZONTAL
                }),
                x_expand: true,
                style: 'margin-left:0;margin-right:0;'
            });

            const totalLabel = new St.Label({
                text: _('Total:'),
                style_class: 'astra-monitor-menu-label',
                style: 'padding-right:0.15em;'
            });
            totalContainer.add_child(totalLabel);

            const totalValue = new St.Label({
                text: '-',
                x_expand: true,
                style_class: 'astra-monitor-menu-key-mid'
            });
            totalContainer.add_child(totalValue);
            totalContainer.set_width(100);

            footerContainer.add_child(totalContainer);

            grid.addToGrid(footerContainer);

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

    public update(data?: Map<string, GenericGpuInfo>) {
        if(!data) return;

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

        if(section.infoPopup) section.infoPopup.updateData(gpuData);
        if(section.activityPopup) section.activityPopup.updateData(gpuData);
        if(section.vramPopup) section.vramPopup.updateData(gpuData);
    }

    public clear() {}

    public destroy() {
        Config.clear(this);

        if(this.title) Config.clear(this.title);
        if(this.noGPULabel) Config.clear(this.noGPULabel);
    }
}
