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

import {gettext as _} from 'resource:///org/gnome/shell/extensions/extension.js';

import MenuBase from '../menu.js';
import Utils, { GpuInfo, UptimeTimer } from '../utils/utils.js';
import Grid from '../grid.js';

import ProcessorGraph from './processorGraph.js';
import ProcessorBars from './processorBars.js';
import ProcessorMonitor, { CpuInfo } from './processorMonitor.js';
import Config from '../config.js';

type CpuInfoPopup = MenuBase & {
    hideable?: {
        key: St.Label,
        value: St.Label,
        reference: { value: St.Label, original: any }
    }[]
};

type CpuCategoryUsagePopup = MenuBase & {
    userLabel?: St.Label,
    niceLabel?: St.Label,
    systemLabel?: St.Label,
    idleLabel?: St.Label,
    iowaitLabel?: St.Label,
    irqLabel?: St.Label,
    softirqLabel?: St.Label,
    stealLabel?: St.Label
};

type CpuCoresUsagePopup = MenuBase & {
    cores?: Map<number, {
        bar: InstanceType<typeof ProcessorBars>,
        percentage: St.Label,
        value: St.Label,
        unit: St.Label,
        label: St.Label
    }>;
};

type TopProcess = {
    label: St.Label,
    percentage: St.Label
};

type TopProcessesPopup = MenuBase & {
    processes?: Map<number, {
        label: St.Label,
        percentage: St.Label,
        description: St.Label
    }>;
};

type GpuInfoPopup = MenuBase & {
    addToMenu: (actor: St.Widget, priority?: number) => void;
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
    
    private topProcesses!: TopProcess[];
    private queueTopProcessesUpdate!: boolean;
    private topProcessesPopup!: TopProcessesPopup;
    
    private gpuSection!: {
        label?: St.Label,
        noGPULabel?: St.Label
    };
    private gpuInfoPopups!: GpuInfoPopup[];
    
    private menuUptime!: St.Label;
    private menuUptimeTimer: UptimeTimer|null = null;
    
    constructor(sourceActor: St.Widget, arrowAlignment: number, arrowSide: St.Side) {
        super(sourceActor, arrowAlignment, arrowSide);
        
        /*this.cpuSectionLabel = */this.addMenuSection(_('CPU'));
        this.addName();
        this.addPercentage();
        this.addHistoryGraph();
        this.addTopProcesses();
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
            track_hover: true,
            style_class: 'astra-monitor-menu-label astra-monitor-menu-section-end',
            style: defaultStyle
        });
        const hoverLabel = new St.Label({
            text: cpuName
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
                
                if(height > monitorSize.height * 0.8) {
                    for(const { key, value, reference } of (this.cpuInfoPopup as any).hideable) {
                        key.visible = false;
                        value.visible = false;
                        
                        if(reference && reference.value && reference.original)
                            reference.value.text = reference.original + ' [...]';
                    }
                }
            }
        });
        
        hoverButton.connect('leave-event', () => {
            hoverButton.style = defaultStyle;
            if(this.cpuInfoPopup)
                this.cpuInfoPopup.close(true);
        });
        this.addToMenu(hoverButton, 2);
    }
    
    createCPUInfoPopup(sourceActor: St.Widget, cpuInfo: CpuInfo, cpuName: string) {
        this.cpuInfoPopup = new MenuBase(sourceActor, 0.05, St.Side.RIGHT);
        this.cpuInfoPopup.addMenuSection(_('CPU info'));
        
        this.cpuInfoPopup.hideable = [];
        
        this.cpuInfoPopup.addToMenu(new St.Label({
            text: cpuName,
            style_class: 'astra-monitor-menu-sub-header'
        }), 2);
        
        let reference: { value: St.Label, original: any }|null = null;
        
        for(const key in cpuInfo) {
            if(key === 'Model name')
                continue;
            
            let value = cpuInfo[key];
            if(Array.isArray(value))
                value = value.join(', ');
            
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
                    }
                    else {
                        current = value.substring(0, index);
                        value = value.substring(index + 1);
                    }
                }
                else {
                    value = '';
                }
                
                let keyLabel;
                if(i === 0) {
                    keyLabel = new St.Label({
                        text: key,
                        style_class: 'astra-monitor-menu-sub-key'
                    });
                }
                else {
                    keyLabel = new St.Label({
                        text: ''
                    });
                }
                this.cpuInfoPopup.addToMenu(keyLabel);
                
                if(i >= linesLimit - 1 && value.length > 0) {
                    if(current.length > limit - 5)
                        current = current.substring(0, limit - 5) + '[...]';
                    else
                        current += '[...]';
                    value = '';
                }
                const valueLabel = new St.Label({text: current});
                if(i > 0 && reference) {
                    this.cpuInfoPopup.hideable.push({
                        key: keyLabel,
                        value: valueLabel,
                        reference
                    });
                    reference = null;
                }
                else {
                    reference = { value: valueLabel, original: current };
                }
                this.cpuInfoPopup.addToMenu(valueLabel);
                
                i++;
            }
            while(value.length);
        }
    }
    
    addPercentage() {
        const defaultStyle = 'max-width:150px;';
        
        const grid = new Grid({ styleClass: 'astra-monitor-menu-subgrid' });
        
        // Total CPU usage percentage
        let label = new St.Label({text: _('Total:'), style_class: 'astra-monitor-menu-label'});
        grid.addToGrid(label);
        this.cpuTotalPerc = new St.Label({text: '0%', style_class: 'astra-monitor-menu-value', x_expand: true});
        grid.addToGrid(this.cpuTotalPerc);
        
        // User CPU usage percentage
        label = new St.Label({text: _('User:'), style_class: 'astra-monitor-menu-label'});
        grid.addToGrid(label);
        this.cpuUserPerc = new St.Label({text: '0%', style_class: 'astra-monitor-menu-value', x_expand: true});
        grid.addToGrid(this.cpuUserPerc);
        
        // System CPU usage percentage
        label = new St.Label({text: _('System:'), style_class: 'astra-monitor-menu-label'});
        grid.addToGrid(label);
        this.cpuSystemPerc = new St.Label({text: '0%', style_class: 'astra-monitor-menu-value', x_expand: true});
        grid.addToGrid(this.cpuSystemPerc);
        
        const hoverButton = new St.Button({
            reactive: true,
            track_hover: true,
            style: defaultStyle
        });
        hoverButton.set_child(grid);
        
        this.createPercentagePopup(hoverButton);
        
        hoverButton.connect('enter-event', () => {
            hoverButton.style = defaultStyle + this.selectionStyle;
            if(this.cpuCategoryUsagePopup)
                this.cpuCategoryUsagePopup.open(true);
        });
        
        hoverButton.connect('leave-event', () => {
            hoverButton.style = defaultStyle;
            if(this.cpuCategoryUsagePopup)
                this.cpuCategoryUsagePopup.close(true);
        });
        
        this.addToMenu(hoverButton, 2);
    }
    
    createPercentagePopup(sourceActor: St.Widget) {
        this.cpuCategoryUsagePopup = new MenuBase(sourceActor, 0.05, St.Side.RIGHT);
        this.cpuCategoryUsagePopup.addMenuSection(_('CPU Category Usage Raw Info'));
        
        this.cpuCategoryUsagePopup.addToMenu(new St.Label({
            text: _('User'),
            style_class: 'astra-monitor-menu-sub-key'
        }));
        const userLabel = new St.Label({text: '-'});
        this.cpuCategoryUsagePopup.addToMenu(userLabel);
        this.cpuCategoryUsagePopup.userLabel = userLabel;
        
        this.cpuCategoryUsagePopup.addToMenu(new St.Label({
            text: _('Nice'),
            style_class: 'astra-monitor-menu-sub-key'
        }));
        const niceLabel = new St.Label({text: '-'});
        this.cpuCategoryUsagePopup.addToMenu(niceLabel);
        this.cpuCategoryUsagePopup.niceLabel = niceLabel;
        
        this.cpuCategoryUsagePopup.addToMenu(new St.Label({
            text: _('System'),
            style_class: 'astra-monitor-menu-sub-key'
        }));
        const systemLabel = new St.Label({text: '-'});
        this.cpuCategoryUsagePopup.addToMenu(systemLabel);
        this.cpuCategoryUsagePopup.systemLabel = systemLabel;
        
        this.cpuCategoryUsagePopup.addToMenu(new St.Label({
            text: _('Idle'),
            style_class: 'astra-monitor-menu-sub-key'
        }));
        const idleLabel = new St.Label({text: '-'});
        this.cpuCategoryUsagePopup.addToMenu(idleLabel);
        this.cpuCategoryUsagePopup.idleLabel = idleLabel;
        
        this.cpuCategoryUsagePopup.addToMenu(new St.Label({
            text: _('I/O wait'),
            style_class: 'astra-monitor-menu-sub-key'
        }));
        const iowaitLabel = new St.Label({text: '-'});
        this.cpuCategoryUsagePopup.addToMenu(iowaitLabel);
        this.cpuCategoryUsagePopup.iowaitLabel = iowaitLabel;
        
        this.cpuCategoryUsagePopup.addToMenu(new St.Label({
            text: _('IRQ'),
            style_class: 'astra-monitor-menu-sub-key'
        }));
        const irqLabel = new St.Label({text: '-'});
        this.cpuCategoryUsagePopup.addToMenu(irqLabel);
        this.cpuCategoryUsagePopup.irqLabel = irqLabel;
        
        this.cpuCategoryUsagePopup.addToMenu(new St.Label({
            text: _('Soft IRQ'),
            style_class: 'astra-monitor-menu-sub-key'
        }));
        const softirqLabel = new St.Label({text: '-'});
        this.cpuCategoryUsagePopup.addToMenu(softirqLabel);
        this.cpuCategoryUsagePopup.softirqLabel = softirqLabel;
        
        this.cpuCategoryUsagePopup.addToMenu(new St.Label({
            text: _('Steal'),
            style_class: 'astra-monitor-menu-sub-key'
        }));
        const stealLabel = new St.Label({text: '-'});
        this.cpuCategoryUsagePopup.addToMenu(stealLabel);
        this.cpuCategoryUsagePopup.stealLabel = stealLabel;
    }
    
    addHistoryGraph() {
        const defaultStyle = '';
        
        const hoverButton = new St.Button({
            reactive: true,
            track_hover: true,
            style: defaultStyle
        });
        
        const grid = new Grid({ styleClass: 'astra-monitor-menu-subgrid' });
        hoverButton.set_child(grid);
        
        //TODO: make width customizable!?
        this.processorBar = new ProcessorBars({
            numBars: 1,
            width: 200-2,
            height: 0.8,
            mini:false,
            layout: 'horizontal',
            x_align: Clutter.ActorAlign.START,
            style: 'margin-left:0.5em;margin-bottom:0;margin-right:0;border:solid 1px #555;',
            breakdownConfig: 'processor-menu-bars-breakdown'
        });
        grid.addGrid(this.processorBar, 0, 0, 2, 1);
        
        //TODO: make width customizable!?
        this.graph = new ProcessorGraph({ width: 200, mini: false, breakdownConfig: 'processor-menu-graph-breakdown' });
        grid.addGrid(this.graph, 0, 1, 2, 1);
        
        this.createCoresUsagePopup(hoverButton);
        
        hoverButton.connect('enter-event', () => {
            hoverButton.style = defaultStyle + this.selectionStyle;
            
            if(this.cpuCoresUsagePopup) {
                this.cpuCoresUsagePopup.open(true);
                
                Utils.processorMonitor.listen(hoverButton, 'cpuCoresUsage', this.update.bind(this, 'cpuCoresUsage'));
                this.update('cpuCoresUsage');
                
                Utils.processorMonitor.listen(hoverButton, 'cpuCoresFrequency', this.update.bind(this, 'cpuCoresFrequency'));
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
        
        this.cpuCoresUsagePopup = new MenuBase(sourceActor, 0.05, St.Side.RIGHT);
        this.cpuCoresUsagePopup.addMenuSection(_('CPU Cores Usage Info'));
        this.cpuCoresUsagePopup.cores = new Map();
        
        const numCores = Utils.processorMonitor.getNumberOfCores();
        let numRows = 1;
        if(numCores > 16)
            numRows = Math.ceil(numCores / 32) * 2;
        const numCols = Math.ceil(numCores / numRows);
        const grid = new Grid({ numCols, styleClass: 'astra-monitor-menu-subgrid' });
        
        let defaultStyle = 'width: 2.8em;';
        if(numCores >= 10)
            defaultStyle = 'width: 3.2em;';
        if(numCores >= 100)
            defaultStyle = 'width: 3.6em;';
        
        for(let i = 0; i < numCores; i++) {
            const col = i % numCols;
            const row = Math.floor(i / numCols)*5;
            
            const label = new St.Label({
                text: 'Core' + (i+1),
                style_class: 'astra-monitor-menu-sub-core',
                style: row ? defaultStyle+'margin-top: 1em;' : defaultStyle
            });
            grid.addGrid(label, col, row, 1, 1);
            
            const bar = new ProcessorBars({ numBars: 1, mini: true, width: 1, height: 3, breakdownConfig: 'processor-menu-core-bars-breakdown' });
            grid.addGrid(bar, col, row + 1, 1, 1);
            
            const percentage = new St.Label({
                text: '-',
                style_class: 'astra-monitor-menu-sub-percentage'
            });
            grid.addGrid(percentage, col, row + 2, 1, 1);
            
            const value = new St.Label({
                text: '-',
                style_class: 'astra-monitor-menu-sub-frequency-value'
            });
            grid.addGrid(value, col, row + 3, 1, 1);
            
            const unit = new St.Label({
                text: _('GHz'),
                style_class: 'astra-monitor-menu-sub-frequency-unit'
            });
            grid.addGrid(unit, col, row + 4, 1, 1);
            
            this.cpuCoresUsagePopup.cores .set(i, {
                bar,
                percentage,
                value,
                unit,
                label
            });
        }
        this.cpuCoresUsagePopup.addToMenu(grid);
    }
    
    addTopProcesses() {
        this.addMenuSection(_('Top processes'));
        
        const defaultStyle = '';
        
        const hoverButton = new St.Button({
            reactive: true,
            track_hover: true,
            style: defaultStyle
        });
        
        const grid = new Grid({ styleClass: 'astra-monitor-menu-subgrid' });
        
        this.topProcesses = [];
        this.queueTopProcessesUpdate = false;
        
        //TODO: allow to customize number of processes to show in the menu
        const numProcesses = 5;
        for(let i = 0; i < numProcesses; i++) {
            const label = new St.Label({
                text: '',
                style_class: 'astra-monitor-menu-cmd-name',
                x_expand: true
            });
            grid.addToGrid(label);
            const percentage = new St.Label({
                text: '',
                style_class: 'astra-monitor-menu-cmd-usage',
                x_expand: true
            });
            grid.addToGrid(percentage);
            
            this.topProcesses.push({ label, percentage });
        }
        
        hoverButton.set_child(grid);
        
        this.createTopProcessesPopup(hoverButton);
        
        hoverButton.connect('enter-event', () => {
            hoverButton.style = defaultStyle + this.selectionStyle;
            if(this.topProcessesPopup)
                this.topProcessesPopup.open(true);
        });
        
        hoverButton.connect('leave-event', () => {
            hoverButton.style = defaultStyle;
            if(this.topProcessesPopup)
                this.topProcessesPopup.close(true);
        });
        this.addToMenu(hoverButton, 2);
    }
    
    createTopProcessesPopup(sourceActor: St.Widget) {
        this.topProcessesPopup = new MenuBase(sourceActor, 0.05, St.Side.RIGHT);
        this.topProcessesPopup.addMenuSection(_('Top processes'));
        this.topProcessesPopup.processes = new Map();
        
        const grid = new Grid({ numCols: 2, styleClass: 'astra-monitor-menu-subgrid' });
        
        for(let i = 0; i < ProcessorMonitor.TOP_PROCESSES_LIMIT; i++) {
            const percentage = new St.Label({
                text: '',
                style_class: 'astra-monitor-menu-cmd-usage',
                x_expand: true,
                y_expand: true,
                y_align: Clutter.ActorAlign.CENTER
            });
            grid.addGrid(percentage, 0, i*2, 1, 2);
            const label = new St.Label({
                text: '',
                style_class: 'astra-monitor-menu-cmd-name-full'
            });
            grid.addGrid(label, 1, i*2, 1, 1);
            const description = new St.Label({
                text: '',
                style_class: 'astra-monitor-menu-cmd-description'
            });
            grid.addGrid(description, 1, i*2+1, 1, 1);
            this.topProcessesPopup.processes.set(i, { label, percentage, description });
        }
        
        this.topProcessesPopup.addToMenu(grid, 2);
    }
    
    addGPUs() {
        this.gpuSection = {};
        
        this.gpuSection.label = this.addMenuSection(_('GPU'));
        Config.connect(this.gpuSection.label, 'changed::processor-menu-gpu', () => {
            const gpu = Utils.getSelectedGPU();
            if(this.gpuSection.label)
                this.gpuSection.label.visible = !!gpu;
        });
        
        const GPUsList = Utils.getGPUsList();
        
        if(GPUsList.length === 0) {
            // Print No GPU found
            this.gpuSection.noGPULabel = new St.Label({
                text: _('No GPU found'),
                style_class: 'astra-monitor-menu-label-warning',
                style: 'font-style:italic;'
            });
            Config.connect(this.gpuSection, 'changed::processor-menu-gpu', () => {
                const gpu = Utils.getSelectedGPU();
                if(this.gpuSection.noGPULabel)
                    this.gpuSection.noGPULabel.visible = !!gpu;
            });
            this.addToMenu(this.gpuSection.noGPULabel, 2);
            return;
        }
        
        if(GPUsList.length > 1)
            this.gpuSection.label.text = _('GPUs');
        
        this.gpuInfoPopups = [];
        for(let i = 0; i < GPUsList.length; i++) {
            const gpu = GPUsList[i];
            
            const defaultStyle = 'max-width: 150px;';
            const hoverButton = new St.Button({
                reactive: true,
                track_hover: true,
                style: defaultStyle
            });
            
            const grid = new Grid({ styleClass: 'astra-monitor-menu-subgrid' });
            const label = new St.Label({
                text: Utils.getGPUModelName(gpu)
            });
            grid.addToGrid(label);
            
            //TODO: Monitor GPU usage
            
            hoverButton.set_child(grid);
            
            const gpuInfoPopup = this.createGPUInfoPopup(hoverButton, gpu);
            this.gpuInfoPopups.push(gpuInfoPopup);
            
            hoverButton.connect('enter-event', () => {
                hoverButton.style = defaultStyle + this.selectionStyle;
                if(gpuInfoPopup)
                    gpuInfoPopup.open(true);
            });
            
            hoverButton.connect('leave-event', () => {
                hoverButton.style = defaultStyle;
                if(gpuInfoPopup)
                    gpuInfoPopup.close(true);
            });
            this.addToMenu(hoverButton, 2);
            
            const updateSelectedGPU = () => {
                const selectedGpu = Utils.getSelectedGPU();
                
                if(gpu === selectedGpu) {
                    label.style_class = 'astra-monitor-menu-label';
                }
                else {
                    label.style_class = 'astra-monitor-menu-unmonitored';
                }
            };
            updateSelectedGPU();
            
            Config.connect(this.gpuSection, 'changed::processor-menu-gpu', updateSelectedGPU);
        }
    }
    
    createGPUInfoPopup(sourceActor: St.Widget, gpu: GpuInfo): GpuInfoPopup {
        const popup = new MenuBase(sourceActor, 0.05, St.Side.RIGHT);
        popup.addMenuSection(_('GPU info'));
            
        popup.addToMenu(new St.Label({
            text: Utils.getGPUModelName(gpu),
            style_class: 'astra-monitor-menu-sub-header'
        }), 2);
        
        popup.addToMenu(new St.Label({
            text: _('Name'),
            style_class: 'astra-monitor-menu-sub-key'
        }));
        popup.addToMenu(new St.Label({
            text: gpu.vendor
        }));
        
        popup.addToMenu(new St.Label({
            text: _('Subsystem'),
            style_class: 'astra-monitor-menu-sub-key'
        }));
        popup.addToMenu(new St.Label({
            text: gpu.model
        }));
        
        if(gpu.vendorId) {
            const vendorNames = Utils.getVendorName('0x' + gpu.vendorId);
            if(vendorNames[0] !== 'Unknown') {
                popup.addToMenu(new St.Label({
                    text: _('Vendor'),
                    style_class: 'astra-monitor-menu-sub-key'
                }));
                popup.addToMenu(new St.Label({
                    text: vendorNames.join(' / ')
                }));
            }
            
            popup.addToMenu(new St.Label({
                text: _('Vendor ID'),
                style_class: 'astra-monitor-menu-sub-key'
            }));
            popup.addToMenu(new St.Label({
                text: gpu.vendorId
            }));
        }
        
        if(gpu.productId) {
            popup.addToMenu(new St.Label({
                text: _('Product ID'),
                style_class: 'astra-monitor-menu-sub-key'
            }));
            popup.addToMenu(new St.Label({
                text: gpu.productId
            }));
        }
        
        popup.addToMenu(new St.Label({
            text: _('Domain'),
            style_class: 'astra-monitor-menu-sub-key'
        }));
        popup.addToMenu(new St.Label({
            text: gpu.domain
        }));
        
        popup.addToMenu(new St.Label({
            text: _('Bus'),
            style_class: 'astra-monitor-menu-sub-key'
        }));
        popup.addToMenu(new St.Label({
            text: gpu.bus
        }));
        
        popup.addToMenu(new St.Label({
            text: _('Slot'),
            style_class: 'astra-monitor-menu-sub-key'
        }));
        popup.addToMenu(new St.Label({
            text: gpu.slot
        }));
        
        if(gpu.drivers && Array.isArray(gpu.drivers) && gpu.drivers.length > 0) {
            popup.addToMenu(new St.Label({
                text: _('Drivers'),
                style_class: 'astra-monitor-menu-sub-key'
            }));
            popup.addToMenu(new St.Label({
                text: gpu.drivers.join(', ')
            }));
        }
        
        if(gpu.modules && Array.isArray(gpu.modules) && gpu.modules.length > 0) {
            popup.addToMenu(new St.Label({
                text: _('Modules'),
                style_class: 'astra-monitor-menu-sub-key'
            }));
            popup.addToMenu(new St.Label({
                text: gpu.modules.join(', ')
            }));
        }
        
        return popup;
    }
    
    addSystemUptime() {
        this.addMenuSection(_('System uptime'));
        
        this.menuUptime = new St.Label({text: '', style_class: 'astra-monitor-menu-uptime astra-monitor-menu-section-end'});
        this.addToMenu(this.menuUptime, 2);
        
        this.menuUptimeTimer = null;
    }
    
    onOpen() {
        this.clear();
        
        //Update cpu usage percentage label
        this.update('cpuUsage');
        Utils.processorMonitor.listen(this, 'cpuUsage', this.update.bind(this, 'cpuUsage'));
        
        //Update graph history
        this.update('graph');
        Utils.processorMonitor.listen(this.graph, 'cpuUsage', this.update.bind(this, 'graph'));
        
        Utils.processorMonitor.listen(this, 'topProcesses', this.update.bind(this, 'topProcesses'));
        Utils.processorMonitor.requestUpdate('topProcesses');
        
        if(Utils.processorMonitor.dueIn >= 200)
            this.queueTopProcessesUpdate = true;
        
        this.menuUptimeTimer = Utils.getUptime((bootTime) => {
            this.menuUptime.text = Utils.formatUptime(bootTime);
        });
    }
    
    onClose() {
        Utils.processorMonitor.unlisten(this, 'cpuUsage');
        Utils.processorMonitor.unlisten(this.graph, 'cpuUsage');
        Utils.processorMonitor.unlisten(this, 'topProcesses');
        
        this.queueTopProcessesUpdate = false;
        
        if(this.menuUptimeTimer) {
            this.menuUptimeTimer.stop();
            this.menuUptimeTimer = null;
        }
    }
    
    clear() {
        //Clear elements before updating them (in case of a lagging update)
        
        this.cpuTotalPerc.text = '-';
        this.cpuUserPerc.text = '-';
        this.cpuSystemPerc.text = '-';
        
        for(let i = 0; i < this.topProcesses.length; i++) {
            this.topProcesses[i].label.text = '';
            this.topProcesses[i].percentage.text = '';
        }
        
        for(let i = 0; i < ProcessorMonitor.TOP_PROCESSES_LIMIT; i++) {
            const popup = this.topProcessesPopup?.processes?.get(i);
            if(!popup)
                continue;
            popup.percentage.text = '';
            popup.description.text = '';
        }
        
        this.menuUptime.text = '';
    }
    
    update(code: string) {
        if(code === 'cpuUsage') {
            const cpuUsage = Utils.processorMonitor.getCurrentValue('cpuUsage');
            
            //TODO: optionally multiply by number of cores
            if(!cpuUsage || !cpuUsage.total || isNaN(cpuUsage.total)) {
                this.cpuTotalPerc.text = '0%';
                this.processorBar.setUsage([]);
            }
            else {
                this.cpuTotalPerc.text = cpuUsage.total.toFixed(0) + '%';
                this.processorBar.setUsage([cpuUsage]);
            }
            
            if(!cpuUsage || !cpuUsage.user || isNaN(cpuUsage.user))
                this.cpuUserPerc.text = '0%';
            else
                this.cpuUserPerc.text = cpuUsage.user.toFixed(0) + '%';
            
            if(!cpuUsage || !cpuUsage.system || isNaN(cpuUsage.system))
                this.cpuSystemPerc.text = '0%';
            else
                this.cpuSystemPerc.text = cpuUsage.system.toFixed(0) + '%';
            
            if(this.cpuCategoryUsagePopup && cpuUsage && cpuUsage.raw) {
                this.cpuCategoryUsagePopup.userLabel!.text = cpuUsage.raw.user.toFixed(1) + '%';
                this.cpuCategoryUsagePopup.niceLabel!.text = cpuUsage.raw.nice.toFixed(1) + '%';
                this.cpuCategoryUsagePopup.systemLabel!.text = cpuUsage.raw.system.toFixed(1) + '%';
                this.cpuCategoryUsagePopup.idleLabel!.text = cpuUsage.raw.idle.toFixed(1) + '%';
                this.cpuCategoryUsagePopup.iowaitLabel!.text = cpuUsage.raw.iowait.toFixed(1) + '%';
                this.cpuCategoryUsagePopup.irqLabel!.text = cpuUsage.raw.irq.toFixed(1) + '%';
                this.cpuCategoryUsagePopup.softirqLabel!.text = cpuUsage.raw.softirq.toFixed(1) + '%';
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
                    if(!core)
                        continue;
                    
                    if(!usage || !Array.isArray(usage) || usage.length < numCores) {
                        core.bar.setUsage([]);
                        core.percentage.text = '-';
                    }
                    else {
                        core.bar.setUsage([usage[i]]);
                        
                        if(!usage[i] || !usage[i].total || isNaN(usage[i].total))
                            core.percentage.text = '-';
                        else if(usage[i].total === 100)
                            core.percentage.text = '100%';
                        else
                            core.percentage.text = usage[i].total.toFixed(1) + '%';
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
            }
            else {
                for(let i = 0; i < Utils.processorMonitor.getNumberOfCores(); i++) {
                    const core = this.cpuCoresUsagePopup.cores?.get(i);
                    if(!core)
                        continue;
                    if(!frequencies[i] || isNaN(frequencies[i]))
                        core.value.text = '-';
                    else
                        core.value.text = (frequencies[i]/1000).toFixed(2);
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
            const topProcesses = Utils.processorMonitor.getCurrentValue('topProcesses');
            if(!topProcesses || !Array.isArray(topProcesses)) {
                for(let i = 0; i < this.topProcesses.length; i++) {
                    const topProcess = this.topProcesses[i];
                    if(topProcess) {
                        topProcess.label.text = '';
                        topProcess.percentage.text = '';
                    }
                    if(this.topProcessesPopup) {
                        const topProcess = this.topProcessesPopup.processes?.get(i);
                        if(!topProcess)
                            continue;
                        topProcess.label.text = '';
                        topProcess.description.text = '';
                        topProcess.percentage.text = '';
                    }
                }
            }
            else {
                for(let i = 0; i < topProcesses.length; i++) {
                    const perCore = Config.get_boolean('processor-menu-top-processes-percentage-core');
                    
                    const topProcess = topProcesses[i];
                    const process = topProcess.process;
                    const cpu = topProcess.cpu;
                    
                    if(this.topProcesses[i]) {
                        this.topProcesses[i].label.text = process.exec;
                        
                        if(perCore)
                            this.topProcesses[i].percentage.text = (cpu * Utils.processorMonitor.getNumberOfCores()).toFixed(1) + '%';
                        else
                            this.topProcesses[i].percentage.text = cpu.toFixed(1) + '%';
                    }
                    if(this.topProcessesPopup) {
                        const topProcess = this.topProcessesPopup.processes?.get(i);
                        if(!topProcess)
                            continue;
                        topProcess.label.text = process.exec;
                        topProcess.description.text = process.cmd;
                        
                        if(perCore)
                            topProcess.percentage.text = (cpu * Utils.processorMonitor.getNumberOfCores()).toFixed(1) + '%';
                        else
                            topProcess.percentage.text = cpu.toFixed(1) + '%';
                        
                    }
                }
            }
            
            if(this.queueTopProcessesUpdate) {
                this.queueTopProcessesUpdate = false;
                Utils.processorMonitor.requestUpdate('topProcesses');
                return;
            }
            return;
        }
    }
    
    destroy() {
        this.close(true);
        this.removeAll();
        
        Config.clear(this.gpuSection);
        
        if(this.cpuInfoPopup) {
            this.cpuInfoPopup.destroy();
            //(this.cpuInfoPopup as any) = null;
        }
        if(this.cpuCategoryUsagePopup) {
            this.cpuCategoryUsagePopup.destroy();
            //(this.cpuCategoryUsagePopup as any) = null;
        }
        if(this.cpuCoresUsagePopup) {
            this.cpuCoresUsagePopup.destroy();
            //(this.cpuCoresUsagePopup as any) = null;
        }
        if(this.topProcessesPopup) {
            this.topProcessesPopup.destroy();
            //(this.topProcessesPopup as any) = null;
        }
        
        super.destroy();
    }
}