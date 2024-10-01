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

import GLib from 'gi://GLib';
import St from 'gi://St';
import Clutter from 'gi://Clutter';

import { gettext as _, pgettext } from 'resource:///org/gnome/shell/extensions/extension.js';

import MenuBase from '../menu.js';
import Utils, { UptimeTimer } from '../utils/utils.js';
import Grid from '../grid.js';
import Config from '../config.js';

import ProcessorGraph from './processorGraph.js';
import ProcessorBars from './processorBars.js';
import ProcessorMonitor, { CpuInfo } from './processorMonitor.js';
import GpuMenuComponent from '../gpu/gpuMenuComponent.js';

type CpuInfoPopup = MenuBase & {
    hideable?: {
        key: St.Label;
        value: St.Label;
        reference?: { value: St.Label; original: any };
    }[];
};

type CpuCategoryUsagePopup = MenuBase & {
    userLabel?: St.Label;
    niceLabel?: St.Label;
    systemLabel?: St.Label;
    idleLabel?: St.Label;
    iowaitLabel?: St.Label;
    irqLabel?: St.Label;
    softirqLabel?: St.Label;
    stealLabel?: St.Label;
};

type CpuCoresUsagePopup = MenuBase & {
    cores?: Map<
        number,
        {
            bar: InstanceType<typeof ProcessorBars>;
            percentage: St.Label;
            value: St.Label;
            unit: St.Label;
            label: St.Label;
        }
    >;
};

type TopProcess = {
    label: St.Label;
    percentage: St.Label;
};

type TopProcessesPopup = MenuBase & {
    processes?: Map<
        number,
        {
            label: St.Label;
            percentage: St.Label;
            description: St.Label;
        }
    >;
};

export default class ProcessorMenu extends MenuBase {
    /*private cpuSectionLabel!: St.Label;*/
    private cpuInfoPopup!: CpuInfoPopup;

    private cpuTotalPerc!: St.Label;
    private cpuUserPerc!: St.Label;
    private cpuSystemPerc!: St.Label;
    private cpuCategoryUsagePopup!: CpuCategoryUsagePopup;

    private processorBar!: InstanceType<typeof ProcessorBars>;
    private graph!: InstanceType<typeof ProcessorGraph>;
    private cpuCoresUsagePopup!: CpuCoresUsagePopup;
    private lazyCoresPopupTimer: number | null = null;

    private topProcesses!: TopProcess[];
    private queueTopProcessesUpdate!: boolean;
    private topProcessesPopup!: TopProcessesPopup;

    private loadAverageValues!: St.Label[];

    private gpuSection!: GpuMenuComponent;

    private menuUptime!: St.Label;
    private menuUptimeTimer: UptimeTimer | null = null;

    constructor(sourceActor: St.Widget, arrowAlignment: number, arrowSide: St.Side) {
        super(sourceActor, arrowAlignment, { name: 'Processor Menu', arrowSide });

        /*this.cpuSectionLabel = */ this.addMenuSection(_('CPU'));
        this.addName();
        this.addPercentage();
        this.addHistoryGraph();
        this.addTopProcesses();
        this.addLoadAverage();
        this.addGPUs();
        this.addSystemUptime();
        this.addUtilityButtons('processors');
    }

    addName() {
        if(!Utils.processorMonitor)
            throw new Error('Critical: Utils.processorMonitor is not valid');

        // Name
        const cpuInfo = Utils.processorMonitor.getCpuInfoSync();
        const cpuName = cpuInfo['Model name'] || '';

        const defaultStyle = 'max-width: 150px;';

        const hoverButton = new St.Button({
            reactive: true,
            trackHover: true,
            styleClass: 'astra-monitor-menu-label astra-monitor-menu-section-end',
            style: defaultStyle,
        });
        const hoverLabel = new St.Label({
            text: Utils.getCPUModelShortify(cpuName),
        });
        hoverButton.set_child(hoverLabel);

        this.createCPUInfoPopup(hoverButton, cpuInfo, cpuName);

        hoverButton.connect('enter-event', () => {
            hoverButton.style = defaultStyle + this.selectionStyle;
            if(this.cpuInfoPopup) {
                this.cpuInfoPopup.open(true);

                const actorBox = this.cpuInfoPopup.box.get_allocation_box();
                const monitorSize = MenuBase.getMonitorSize(actorBox);

                const height = this.cpuInfoPopup.box.get_preferred_height(-1)[1];

                if(height > monitorSize.height * 0.9) {
                    const hideable = this.cpuInfoPopup.hideable;
                    if(hideable) {
                        let lastHidden: St.Label | null = null;

                        for(const { key, value, reference } of hideable) {
                            key.visible = false;
                            value.visible = false;

                            if(reference && reference.value && reference.original)
                                reference.value.text = reference.original + ' [...]';
                            else lastHidden = key;
                        }

                        if(lastHidden) {
                            lastHidden.visible = true;
                            lastHidden.text = '[...]';
                        }
                    }
                }
            }
        });

        hoverButton.connect('leave-event', () => {
            hoverButton.style = defaultStyle;
            if(this.cpuInfoPopup) this.cpuInfoPopup.close(true);
        });
        this.addToMenu(hoverButton, 2);
    }

    createCPUInfoPopup(sourceActor: St.Widget, cpuInfo: CpuInfo, cpuName: string) {
        this.cpuInfoPopup = new MenuBase(sourceActor, 0.05);
        this.cpuInfoPopup.addMenuSection(_('CPU info'));

        this.cpuInfoPopup.hideable = [];

        this.cpuInfoPopup.addToMenu(
            new St.Label({
                text: cpuName,
                styleClass: 'astra-monitor-menu-sub-header',
            }),
            2
        );

        let reference: { value: St.Label; original: any } | null = null;

        const numKeys = Object.keys(cpuInfo).length;

        let keyIndex = 0;
        for(const key in cpuInfo) {
            keyIndex++;

            if(key === 'Model name') continue;

            let value = cpuInfo[key];
            if(Array.isArray(value)) value = value.join(', ');

            const limit = 50;
            const linesLimit = 5;
            let i = 0;
            do {
                let current = value;

                if(current.length > limit) {
                    const index = value.lastIndexOf(' ', limit);
                    if(index < 0) {
                        current = value.substring(0, limit);
                        value = value.substring(limit);
                    } else {
                        current = value.substring(0, index);
                        value = value.substring(index + 1);
                    }
                } else {
                    value = '';
                }

                let keyLabel;
                if(i === 0) {
                    keyLabel = new St.Label({
                        text: key,
                        styleClass: 'astra-monitor-menu-sub-key',
                    });
                } else {
                    keyLabel = new St.Label({
                        text: '',
                    });
                }
                this.cpuInfoPopup.addToMenu(keyLabel);

                if(i >= linesLimit - 1 && value.length > 0) {
                    if(current.length > limit - 5)
                        current = current.substring(0, limit - 5) + '[...]';
                    else current += '[...]';
                    value = '';
                }
                const valueLabel = new St.Label({ text: current });

                if(i > 0 && reference) {
                    this.cpuInfoPopup.hideable.push({
                        key: keyLabel,
                        value: valueLabel,
                        reference,
                    });
                } else {
                    reference = { value: valueLabel, original: current };

                    if(keyIndex > numKeys - 10) {
                        this.cpuInfoPopup.hideable.push({
                            key: keyLabel,
                            value: valueLabel,
                        });
                    }
                }

                this.cpuInfoPopup.addToMenu(valueLabel);

                i++;
            } while(value.length);
        }
    }

    addPercentage() {
        const defaultStyle = 'max-width:150px;';

        const grid = new Grid({ styleClass: 'astra-monitor-menu-subgrid' });

        // Total CPU usage percentage
        let label = new St.Label({ text: _('Total:'), styleClass: 'astra-monitor-menu-label' });
        grid.addToGrid(label);
        this.cpuTotalPerc = new St.Label({
            text: '0%',
            styleClass: 'astra-monitor-menu-value',
            xExpand: true,
        });
        grid.addToGrid(this.cpuTotalPerc);

        // User CPU usage percentage
        label = new St.Label({ text: _('User:'), styleClass: 'astra-monitor-menu-label' });
        grid.addToGrid(label);
        this.cpuUserPerc = new St.Label({
            text: '0%',
            styleClass: 'astra-monitor-menu-value',
            xExpand: true,
        });
        grid.addToGrid(this.cpuUserPerc);

        // System CPU usage percentage
        label = new St.Label({ text: _('System:'), styleClass: 'astra-monitor-menu-label' });
        grid.addToGrid(label);
        this.cpuSystemPerc = new St.Label({
            text: '0%',
            styleClass: 'astra-monitor-menu-value',
            xExpand: true,
        });
        grid.addToGrid(this.cpuSystemPerc);

        const hoverButton = new St.Button({
            reactive: true,
            trackHover: true,
            style: defaultStyle,
        });
        hoverButton.set_child(grid);

        this.createPercentagePopup(hoverButton);

        hoverButton.connect('enter-event', () => {
            hoverButton.style = defaultStyle + this.selectionStyle;
            if(this.cpuCategoryUsagePopup) this.cpuCategoryUsagePopup.open(true);
        });

        hoverButton.connect('leave-event', () => {
            hoverButton.style = defaultStyle;
            if(this.cpuCategoryUsagePopup) this.cpuCategoryUsagePopup.close(true);
        });

        this.addToMenu(hoverButton, 2);
    }

    createPercentagePopup(sourceActor: St.Widget) {
        this.cpuCategoryUsagePopup = new MenuBase(sourceActor, 0.05);
        this.cpuCategoryUsagePopup.addMenuSection(_('CPU Category Usage Raw Info'));

        this.cpuCategoryUsagePopup.addToMenu(
            new St.Label({
                text: _('User'),
                styleClass: 'astra-monitor-menu-sub-key',
            })
        );
        const userLabel = new St.Label({ text: '-' });
        this.cpuCategoryUsagePopup.addToMenu(userLabel);
        this.cpuCategoryUsagePopup.userLabel = userLabel;

        this.cpuCategoryUsagePopup.addToMenu(
            new St.Label({
                text: _('Nice'),
                styleClass: 'astra-monitor-menu-sub-key',
            })
        );
        const niceLabel = new St.Label({ text: '-' });
        this.cpuCategoryUsagePopup.addToMenu(niceLabel);
        this.cpuCategoryUsagePopup.niceLabel = niceLabel;

        this.cpuCategoryUsagePopup.addToMenu(
            new St.Label({
                text: _('System'),
                styleClass: 'astra-monitor-menu-sub-key',
            })
        );
        const systemLabel = new St.Label({ text: '-' });
        this.cpuCategoryUsagePopup.addToMenu(systemLabel);
        this.cpuCategoryUsagePopup.systemLabel = systemLabel;

        this.cpuCategoryUsagePopup.addToMenu(
            new St.Label({
                text: _('Idle'),
                styleClass: 'astra-monitor-menu-sub-key',
            })
        );
        const idleLabel = new St.Label({ text: '-' });
        this.cpuCategoryUsagePopup.addToMenu(idleLabel);
        this.cpuCategoryUsagePopup.idleLabel = idleLabel;

        this.cpuCategoryUsagePopup.addToMenu(
            new St.Label({
                text: _('I/O wait'),
                styleClass: 'astra-monitor-menu-sub-key',
            })
        );
        const iowaitLabel = new St.Label({ text: '-' });
        this.cpuCategoryUsagePopup.addToMenu(iowaitLabel);
        this.cpuCategoryUsagePopup.iowaitLabel = iowaitLabel;

        this.cpuCategoryUsagePopup.addToMenu(
            new St.Label({
                text: _('IRQ'),
                styleClass: 'astra-monitor-menu-sub-key',
            })
        );
        const irqLabel = new St.Label({ text: '-' });
        this.cpuCategoryUsagePopup.addToMenu(irqLabel);
        this.cpuCategoryUsagePopup.irqLabel = irqLabel;

        this.cpuCategoryUsagePopup.addToMenu(
            new St.Label({
                text: _('Soft IRQ'),
                styleClass: 'astra-monitor-menu-sub-key',
            })
        );
        const softirqLabel = new St.Label({ text: '-' });
        this.cpuCategoryUsagePopup.addToMenu(softirqLabel);
        this.cpuCategoryUsagePopup.softirqLabel = softirqLabel;

        this.cpuCategoryUsagePopup.addToMenu(
            new St.Label({
                text: _('Steal'),
                styleClass: 'astra-monitor-menu-sub-key',
            })
        );
        const stealLabel = new St.Label({ text: '-' });
        this.cpuCategoryUsagePopup.addToMenu(stealLabel);
        this.cpuCategoryUsagePopup.stealLabel = stealLabel;
    }

    addHistoryGraph() {
        const defaultStyle = '';

        const hoverButton = new St.Button({
            reactive: true,
            trackHover: true,
            style: defaultStyle,
        });

        const grid = new Grid({ styleClass: 'astra-monitor-menu-subgrid' });
        hoverButton.set_child(grid);

        //TODO: make width customizable!?
        this.processorBar = new ProcessorBars({
            numBars: 1,
            width: 200 - 2,
            height: 0.8,
            mini: false,
            layout: 'horizontal',
            xAlign: Clutter.ActorAlign.START,
            style: 'margin-left:0.5em;margin-bottom:0;margin-right:0;border:solid 1px #555;',
            breakdownConfig: 'processor-menu-bars-breakdown',
        });
        grid.addGrid(this.processorBar, 0, 0, 2, 1);

        //TODO: make width customizable!?
        this.graph = new ProcessorGraph({
            width: 200,
            mini: false,
            breakdownConfig: 'processor-menu-graph-breakdown',
        });
        grid.addGrid(this.graph, 0, 1, 2, 1);

        this.createCoresUsagePopup(hoverButton);

        hoverButton.connect('enter-event', () => {
            hoverButton.style = defaultStyle + this.selectionStyle;

            if(this.cpuCoresUsagePopup) {
                this.cpuCoresUsagePopup.open(false);

                Utils.processorMonitor.listen(
                    hoverButton,
                    'cpuCoresUsage',
                    this.update.bind(this, 'cpuCoresUsage', false)
                );

                if(this.lazyCoresPopupTimer == null) {
                    this.lazyCoresPopupTimer = GLib.idle_add(GLib.PRIORITY_DEFAULT_IDLE + 1, () => {
                        this.update('cpuCoresUsage', false);
                        this.lazyCoresPopupTimer = null;
                        return GLib.SOURCE_REMOVE;
                    });
                }

                Utils.processorMonitor.listen(
                    hoverButton,
                    'cpuCoresFrequency',
                    this.update.bind(this, 'cpuCoresFrequency', false)
                );
                Utils.processorMonitor.requestUpdate('cpuCoresFrequency');
            }
        });

        hoverButton.connect('leave-event', () => {
            hoverButton.style = defaultStyle;
            if(this.cpuCoresUsagePopup) {
                this.cpuCoresUsagePopup.close(true);
                Utils.processorMonitor.unlisten(hoverButton, 'cpuCoresUsage');
                Utils.processorMonitor.unlisten(hoverButton, 'cpuCoresFrequency');
            }
        });

        this.addToMenu(hoverButton, 2);
    }

    createCoresUsagePopup(sourceActor: St.Widget) {
        //TODO: for processors with 150+ cores the popup might be too big to fit on the screen
        //      - add option for a more compact view

        this.cpuCoresUsagePopup = new MenuBase(sourceActor, 0.05);
        this.cpuCoresUsagePopup.addMenuSection(_('CPU Cores Usage Info'));
        this.cpuCoresUsagePopup.cores = new Map();

        const numCores = Utils.processorMonitor.getNumberOfCores();
        let numRows = 1;
        if(numCores > 16) numRows = Math.ceil(numCores / 32) * 2;
        const numCols = Math.ceil(numCores / numRows);
        const grid = new Grid({ numCols, styleClass: 'astra-monitor-menu-subgrid' });

        let defaultStyle = 'width: 2.8em;';
        if(numCores >= 10) defaultStyle = 'width: 3.2em;';
        if(numCores >= 100) defaultStyle = 'width: 3.6em;';

        for(let i = 0; i < numCores; i++) {
            const col = i % numCols;
            const row = Math.floor(i / numCols) * 5;

            const label = new St.Label({
                text: 'Core' + (i + 1),
                styleClass: 'astra-monitor-menu-sub-core',
                style: row ? defaultStyle + 'margin-top: 1em;' : defaultStyle,
            });
            grid.addGrid(label, col, row, 1, 1);

            const bar = new ProcessorBars({
                numBars: 1,
                mini: true,
                hideEmpty: true,
                width: 1,
                height: 3,
                breakdownConfig: 'processor-menu-core-bars-breakdown',
            });
            grid.addGrid(bar, col, row + 1, 1, 1);

            const percentage = new St.Label({
                text: '-',
                styleClass: 'astra-monitor-menu-sub-percentage',
            });
            grid.addGrid(percentage, col, row + 2, 1, 1);

            const value = new St.Label({
                text: '-',
                styleClass: 'astra-monitor-menu-sub-frequency-value',
            });
            grid.addGrid(value, col, row + 3, 1, 1);

            const unit = new St.Label({
                text: _('GHz'),
                styleClass: 'astra-monitor-menu-sub-frequency-unit',
            });
            grid.addGrid(unit, col, row + 4, 1, 1);

            this.cpuCoresUsagePopup.cores.set(i, {
                bar,
                percentage,
                value,
                unit,
                label,
            });
        }
        this.cpuCoresUsagePopup.addToMenu(grid);
    }

    addTopProcesses() {
        this.addMenuSection(_('Top processes'));

        const defaultStyle = '';

        const hoverButton = new St.Button({
            reactive: true,
            trackHover: true,
            style: defaultStyle,
        });

        const grid = new Grid({ styleClass: 'astra-monitor-menu-subgrid' });

        this.topProcesses = [];
        this.queueTopProcessesUpdate = false;

        //TODO: allow to customize number of processes to show in the menu
        const numProcesses = 5;
        for(let i = 0; i < numProcesses; i++) {
            const label = new St.Label({
                text: '',
                styleClass: 'astra-monitor-menu-cmd-name',
                xExpand: true,
            });
            grid.addToGrid(label);
            const percentage = new St.Label({
                text: '',
                styleClass: 'astra-monitor-menu-cmd-usage',
                xExpand: true,
            });
            grid.addToGrid(percentage);

            this.topProcesses.push({ label, percentage });
        }

        hoverButton.set_child(grid);

        this.createTopProcessesPopup(hoverButton);

        hoverButton.connect('enter-event', () => {
            hoverButton.style = defaultStyle + this.selectionStyle;
            if(this.topProcessesPopup) this.topProcessesPopup.open(true);
        });

        hoverButton.connect('leave-event', () => {
            hoverButton.style = defaultStyle;
            if(this.topProcessesPopup) this.topProcessesPopup.close(true);
        });
        this.addToMenu(hoverButton, 2);
    }

    createTopProcessesPopup(sourceActor: St.Widget) {
        this.topProcessesPopup = new MenuBase(sourceActor, 0.05);
        const section = this.topProcessesPopup.addMenuSection(_('Top processes'));
        section.style = 'min-width:500px;';
        this.topProcessesPopup.processes = new Map();

        const grid = new Grid({
            xExpand: true,
            xAlign: Clutter.ActorAlign.START,
            numCols: 2,
            styleClass: 'astra-monitor-menu-subgrid',
        });

        for(let i = 0; i < ProcessorMonitor.TOP_PROCESSES_LIMIT; i++) {
            const percentage = new St.Label({
                text: '',
                styleClass: 'astra-monitor-menu-cmd-usage',
                xExpand: true,
                yExpand: true,
                yAlign: Clutter.ActorAlign.CENTER,
            });
            grid.addGrid(percentage, 0, i * 2, 1, 2);
            const label = new St.Label({
                text: '',
                styleClass: 'astra-monitor-menu-cmd-name-full',
            });
            grid.addGrid(label, 1, i * 2, 1, 1);
            const description = new St.Label({
                text: '',
                styleClass: 'astra-monitor-menu-cmd-description',
            });
            grid.addGrid(description, 1, i * 2 + 1, 1, 1);
            this.topProcessesPopup.processes.set(i, { label, percentage, description });
        }

        this.topProcessesPopup.addToMenu(grid, 2);
    }

    addLoadAverage() {
        this.addMenuSection(_('Load average'));

        const defaultStyle = 'max-width:150px;';

        const hoverButton = new St.Button({
            reactive: true,
            trackHover: true,
            style: defaultStyle,
        });

        const grid = new Grid({ styleClass: 'astra-monitor-menu-subgrid' });

        this.loadAverageValues = [];

        // Load Container
        //{
        const loadsContainer = new St.Widget({
            layoutManager: new Clutter.GridLayout({ orientation: Clutter.Orientation.HORIZONTAL }),
            xExpand: true,
            style: 'margin-left:0;margin-right:0;',
        });

        // One minute
        //{
        const oneMinuteContainer = new St.Widget({
            layoutManager: new Clutter.GridLayout({ orientation: Clutter.Orientation.HORIZONTAL }),
            xExpand: true,
            style: 'margin-left:0;margin-right:0;',
        });

        const oneMinuteLabel = new St.Label({
            text: pgettext('short for 1 minute', '1m'),
            styleClass: 'astra-monitor-menu-label',
            style: 'padding-right:0.15em;',
        });
        oneMinuteContainer.add_child(oneMinuteLabel);

        const oneMinuteValueLabel = new St.Label({
            text: '-',
            xExpand: true,
            styleClass: 'astra-monitor-menu-key-mid',
        });
        oneMinuteContainer.add_child(oneMinuteValueLabel);
        oneMinuteContainer.set_width(50);

        this.loadAverageValues.push(oneMinuteValueLabel);

        loadsContainer.add_child(oneMinuteContainer);
        //}

        // Five minutes
        //{
        const fiveMinutesContainer = new St.Widget({
            layoutManager: new Clutter.GridLayout({ orientation: Clutter.Orientation.HORIZONTAL }),
            xExpand: true,
            style: 'margin-left:0;margin-right:0;',
        });

        const fiveMinutesLabel = new St.Label({
            text: pgettext('short for 5 minutes', '5m'),
            styleClass: 'astra-monitor-menu-label',
            style: 'padding-right:0.15em;',
        });
        fiveMinutesContainer.add_child(fiveMinutesLabel);

        const fiveMinutesValueLabel = new St.Label({
            text: '-',
            xExpand: true,
            styleClass: 'astra-monitor-menu-key-mid',
        });
        fiveMinutesContainer.add_child(fiveMinutesValueLabel);
        fiveMinutesContainer.set_width(50);

        this.loadAverageValues.push(fiveMinutesValueLabel);

        loadsContainer.add_child(fiveMinutesContainer);
        //}

        // Fifteen minutes
        //{
        const fifteenMinutesContainer = new St.Widget({
            layoutManager: new Clutter.GridLayout({ orientation: Clutter.Orientation.HORIZONTAL }),
            xExpand: true,
            style: 'margin-left:0;margin-right:0;',
        });

        const fifteenMinutesLabel = new St.Label({
            text: pgettext('short for 15 minutes', '15m'),
            styleClass: 'astra-monitor-menu-label',
            style: 'padding-right:0.15em;',
        });
        fifteenMinutesContainer.add_child(fifteenMinutesLabel);

        const fifteenMinutesValueLabel = new St.Label({
            text: '-',
            xExpand: true,
            styleClass: 'astra-monitor-menu-key-mid',
        });
        fifteenMinutesContainer.add_child(fifteenMinutesValueLabel);
        fifteenMinutesContainer.set_width(50);

        this.loadAverageValues.push(fifteenMinutesValueLabel);

        loadsContainer.add_child(fifteenMinutesContainer);
        //}

        grid.addToGrid(loadsContainer, 2);
        //}

        hoverButton.set_child(grid);

        //this.createLoadAveragePopup(hoverButton);

        hoverButton.connect('enter-event', () => {
            hoverButton.style = defaultStyle + this.selectionStyle;

            //if(this.cpuLoadAveragePopup) {
            //    this.cpuLoadAveragePopup.open(true);
        });

        hoverButton.connect('leave-event', () => {
            hoverButton.style = defaultStyle;

            //if(this.cpuLoadAveragePopup)
            //    this.cpuLoadAveragePopup.close(true);
        });
        this.addToMenu(hoverButton, 2);
    }

    addGPUs() {
        const label = this.addMenuSection('');

        this.gpuSection = new GpuMenuComponent({
            parent: this,
            title: label,
            compact: true,
        });
        this.addToMenu(this.gpuSection.container, 2);

        const updateGpuVisibility = () => {
            const processorShow = Config.get_boolean('processor-gpu');
            const gpuHeaderShow = Config.get_boolean('gpu-header-show');

            if(gpuHeaderShow || !processorShow) {
                label?.hide();
                this.gpuSection.container.hide();
            } else {
                label?.show();
                this.gpuSection.container.show();
            }
        };

        Config.connect(this.gpuSection, 'changed::processor-gpu', updateGpuVisibility.bind(this));
        Config.connect(this.gpuSection, 'changed::gpu-header-show', updateGpuVisibility.bind(this));
        updateGpuVisibility();
    }

    addSystemUptime() {
        this.addMenuSection(_('System uptime'));

        this.menuUptime = new St.Label({
            text: '',
            styleClass: 'astra-monitor-menu-uptime astra-monitor-menu-section-end',
        });
        this.addToMenu(this.menuUptime, 2);

        this.menuUptimeTimer = null;
    }

    async onOpen() {
        if(this.gpuSection.container.visible) {
            this.gpuSection.onOpen();
        }

        //Update cpu usage percentage label
        this.clear('cpuUsage');
        this.update('cpuUsage', true);
        Utils.processorMonitor.listen(this, 'cpuUsage', this.update.bind(this, 'cpuUsage', false));

        //Update graph history
        this.update('graph', true);
        Utils.processorMonitor.listen(
            this.graph,
            'cpuUsage',
            this.update.bind(this, 'graph', false)
        );

        this.update('topProcesses', true);
        Utils.processorMonitor.listen(
            this,
            'topProcesses',
            this.update.bind(this, 'topProcesses', false)
        );
        Utils.processorMonitor.requestUpdate('topProcesses');
        this.queueTopProcessesUpdate = true;

        this.update('loadAverage', true);
        Utils.processorMonitor.listen(
            this,
            'loadAverage',
            this.update.bind(this, 'loadAverage', false)
        );
        Utils.processorMonitor.requestUpdate('loadAverage');

        this.menuUptimeTimer = Utils.getUptime(bootTime => {
            this.menuUptime.text = Utils.formatUptime(bootTime);
        });

        this.clear('gpuUpdate');
        this.update('gpuUpdate', true);
        const processorGpuShow = Config.get_boolean('processor-gpu');
        const gpuHeaderShow = Config.get_boolean('gpu-header-show');
        if(processorGpuShow && !gpuHeaderShow) {
            Utils.gpuMonitor.listen(this, 'gpuUpdateProcessor', () => {});
            Utils.gpuMonitor.listen(this, 'gpuUpdate', this.update.bind(this, 'gpuUpdate', false));
        }
    }

    async onClose() {
        this.gpuSection.onClose();

        if(this.lazyCoresPopupTimer != null) {
            GLib.source_remove(this.lazyCoresPopupTimer);
            this.lazyCoresPopupTimer = null;
        }

        Utils.processorMonitor.unlisten(this, 'cpuUsage');
        Utils.processorMonitor.unlisten(this.graph, 'cpuUsage');
        Utils.processorMonitor.unlisten(this, 'topProcesses');
        Utils.processorMonitor.unlisten(this, 'loadAverage');

        Utils.gpuMonitor.unlisten(this, 'gpuUpdate');
        Utils.gpuMonitor.unlisten(this, 'gpuUpdateProcessor');

        this.queueTopProcessesUpdate = false;

        if(this.menuUptimeTimer) {
            this.menuUptimeTimer.stop();
            this.menuUptimeTimer = null;
        }
    }

    clear(code: string = 'all') {
        //Clear elements before updating them (in case of a lagging update)

        if(code === 'all' || code === 'cpuUsage') {
            this.cpuTotalPerc.text = '-';
            this.cpuUserPerc.text = '-';
            this.cpuSystemPerc.text = '-';
        }

        if(code === 'all' || code === 'topProcesses') {
            for(let i = 0; i < this.topProcesses.length; i++) {
                this.topProcesses[i].label.text = '';
                this.topProcesses[i].percentage.text = '';
            }

            for(let i = 0; i < ProcessorMonitor.TOP_PROCESSES_LIMIT; i++) {
                const popup = this.topProcessesPopup?.processes?.get(i);
                if(!popup) continue;
                popup.percentage.text = '';
                popup.description.text = '';
            }
        }

        if(code === 'all' || code === 'loadAverage') {
            for(let i = 0; i < this.loadAverageValues.length; i++)
                this.loadAverageValues[i].text = '-';
        }

        if(code === 'all' || code === 'systemUptime') {
            this.menuUptime.text = '';
        }

        if(code === 'all' || code === 'gpuUpdate') {
            this.gpuSection.clear();
        }
    }

    protected needsUpdate(code: string, forced: boolean = false) {
        if(forced) {
            const valueTime = Utils.processorMonitor.getCurrentValueTime(code);
            return !(valueTime && Date.now() - valueTime > Utils.processorMonitor.updateFrequency);
        }
        return super.needsUpdate(code, forced);
    }

    update(code: string, forced: boolean = false, ...args: any[]) {
        if(!this.needsUpdate(code, forced)) {
            return;
        }

        if(code === 'cpuUsage') {
            const cpuUsage = Utils.processorMonitor.getCurrentValue('cpuUsage');

            //TODO: optionally multiply by number of cores
            if(!cpuUsage || !cpuUsage.total || isNaN(cpuUsage.total)) {
                this.cpuTotalPerc.text = '0%';
                this.processorBar.setUsage([]);
            } else {
                this.cpuTotalPerc.text = cpuUsage.total.toFixed(0) + '%';
                this.processorBar.setUsage([cpuUsage]);
            }

            if(!cpuUsage || !cpuUsage.user || isNaN(cpuUsage.user)) this.cpuUserPerc.text = '0%';
            else this.cpuUserPerc.text = cpuUsage.user.toFixed(0) + '%';

            if(!cpuUsage || !cpuUsage.system || isNaN(cpuUsage.system))
                this.cpuSystemPerc.text = '0%';
            else this.cpuSystemPerc.text = cpuUsage.system.toFixed(0) + '%';

            if(this.cpuCategoryUsagePopup && cpuUsage && cpuUsage.raw) {
                this.cpuCategoryUsagePopup.userLabel!.text = cpuUsage.raw.user.toFixed(1) + '%';
                this.cpuCategoryUsagePopup.niceLabel!.text = cpuUsage.raw.nice.toFixed(1) + '%';
                this.cpuCategoryUsagePopup.systemLabel!.text = cpuUsage.raw.system.toFixed(1) + '%';
                this.cpuCategoryUsagePopup.idleLabel!.text = cpuUsage.raw.idle.toFixed(1) + '%';
                this.cpuCategoryUsagePopup.iowaitLabel!.text = cpuUsage.raw.iowait.toFixed(1) + '%';
                this.cpuCategoryUsagePopup.irqLabel!.text = cpuUsage.raw.irq.toFixed(1) + '%';
                this.cpuCategoryUsagePopup.softirqLabel!.text =
                    cpuUsage.raw.softirq.toFixed(1) + '%';
                this.cpuCategoryUsagePopup.stealLabel!.text = cpuUsage.raw.steal.toFixed(1) + '%';
            }
            return;
        }
        if(code === 'cpuCoresUsage') {
            if(this.cpuCoresUsagePopup.isOpen) {
                const usage = Utils.processorMonitor.getCurrentValue('cpuCoresUsage');
                const numCores = Utils.processorMonitor.getNumberOfCores();

                for(let i = 0; i < numCores; i++) {
                    const core = this.cpuCoresUsagePopup.cores?.get(i);
                    if(!core) continue;

                    if(!usage || !Array.isArray(usage) || usage.length < numCores) {
                        core.bar.setUsage([]);
                        core.percentage.text = '-';
                    } else {
                        core.bar.setUsage([usage[i]]);

                        if(!usage[i] || !usage[i].total || isNaN(usage[i].total))
                            core.percentage.text = '-';
                        else if(usage[i].total === 100) core.percentage.text = '100%';
                        else core.percentage.text = usage[i].total.toFixed(1) + '%';
                    }
                }
            }
            return;
        }
        if(code === 'cpuCoresFrequency') {
            const frequencies = Utils.processorMonitor.getCurrentValue('cpuCoresFrequency');
            if(!frequencies || !Array.isArray(frequencies) || frequencies.length === 0) {
                for(let i = 0; i < Utils.processorMonitor.getNumberOfCores(); i++) {
                    const core = this.cpuCoresUsagePopup.cores?.get(i);
                    core!.value.text = '-';
                }
            } else {
                for(let i = 0; i < Utils.processorMonitor.getNumberOfCores(); i++) {
                    const core = this.cpuCoresUsagePopup.cores?.get(i);
                    if(!core) continue;
                    if(!frequencies[i] || isNaN(frequencies[i])) core.value.text = '-';
                    else core.value.text = (frequencies[i] / 1000).toFixed(2);
                }
            }
            return;
        }
        if(code === 'graph') {
            const usage = Utils.processorMonitor.getUsageHistory('cpuUsage');
            this.graph.setUsageHistory(usage);
            return;
        }
        if(code === 'topProcesses') {
            if(this.queueTopProcessesUpdate) {
                if(Utils.processorMonitor.dueIn >= 300)
                    Utils.processorMonitor.requestUpdate('topProcesses');
                this.queueTopProcessesUpdate = false;
                return;
            }

            const topProcesses = Utils.processorMonitor.getCurrentValue('topProcesses');
            if(!topProcesses || !Array.isArray(topProcesses)) {
                for(let i = 0; i < this.topProcesses.length; i++) {
                    const topProcess = this.topProcesses[i];
                    if(topProcess) {
                        topProcess.label.text = '';
                        topProcess.percentage.text = '';
                    }
                    if(this.topProcessesPopup) {
                        const popup = this.topProcessesPopup.processes?.get(i);
                        if(!popup) continue;
                        popup.label.text = '';
                        popup.description.text = '';
                        popup.percentage.text = '';
                    }
                }
            } else {
                for(let i = 0; i < topProcesses.length; i++) {
                    const perCore = Config.get_boolean(
                        'processor-menu-top-processes-percentage-core'
                    );

                    const topProcess = topProcesses[i];
                    const process = topProcess.process;
                    const cpu = topProcess.cpu;

                    if(this.topProcesses[i]) {
                        this.topProcesses[i].label.text = process.exec;

                        if(perCore)
                            this.topProcesses[i].percentage.text =
                                (cpu * Utils.processorMonitor.getNumberOfCores()).toFixed(1) + '%';
                        else this.topProcesses[i].percentage.text = cpu.toFixed(1) + '%';
                    }
                    if(this.topProcessesPopup) {
                        const popup = this.topProcessesPopup.processes?.get(i);
                        if(!popup) continue;
                        popup.label.text = process.exec;
                        popup.description.text = process.cmd;

                        if(perCore)
                            popup.percentage.text =
                                (cpu * Utils.processorMonitor.getNumberOfCores()).toFixed(1) + '%';
                        else popup.percentage.text = cpu.toFixed(1) + '%';
                    }
                }
            }
            return;
        }
        if(code === 'loadAverage') {
            if(this.loadAverageValues.length === 0) {
                return;
            }

            const loadAverage = Utils.processorMonitor.getCurrentValue('loadAverage');
            if(!loadAverage) {
                for(let i = 0; i < this.loadAverageValues.length; i++)
                    this.loadAverageValues[i].text = '-';
            } else {
                if(!Object.hasOwnProperty.call(loadAverage, 'load1m'))
                    this.loadAverageValues[0].text = '-';
                else this.loadAverageValues[0].text = loadAverage.load1m.toFixed(2);

                if(!Object.hasOwnProperty.call(loadAverage, 'load5m'))
                    this.loadAverageValues[1].text = '-';
                else this.loadAverageValues[1].text = loadAverage.load5m.toFixed(2);

                if(!Object.hasOwnProperty.call(loadAverage, 'load15m'))
                    this.loadAverageValues[2].text = '-';
                else this.loadAverageValues[2].text = loadAverage.load15m.toFixed(2);
            }
            return;
        }
        if(code === 'gpuUpdate') {
            this.gpuSection.update(args[0]);
            return;
        }
    }

    destroy() {
        this.close(true);
        Config.clear(this);
        Config.clear(this.gpuSection);
        this.removeAll();

        if(this.cpuInfoPopup) {
            this.cpuInfoPopup.destroy();
            (this.cpuInfoPopup as any) = null;
        }
        if(this.cpuCategoryUsagePopup) {
            this.cpuCategoryUsagePopup.destroy();
            (this.cpuCategoryUsagePopup as any) = null;
        }
        if(this.cpuCoresUsagePopup) {
            this.cpuCoresUsagePopup.destroy();
            (this.cpuCoresUsagePopup as any) = null;
        }
        if(this.topProcessesPopup) {
            this.topProcessesPopup.destroy();
            (this.topProcessesPopup as any) = null;
        }

        super.destroy();
    }
}
