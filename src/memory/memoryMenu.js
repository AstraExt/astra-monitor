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

import St from 'gi://St';
import Clutter from 'gi://Clutter';

import {gettext as _} from 'resource:///org/gnome/shell/extensions/extension.js';

import {MenuBase} from '../menu.js';
import {Grid} from '../grid.js';
import Utils from '../utils/utils.js';
import {MemoryGraph} from './memoryGraph.js';
import {MemoryMonitor} from './memoryMonitor.js';
import { MemoryBars } from './memoryBars.js';
import { SwapBars } from './swapBars.js';

export class MemoryMenu extends MenuBase {
    constructor(sourceActor, arrowAlignment, arrowSide) {
        super(sourceActor, arrowAlignment, arrowSide);
        
        this.memorySectionLabel = this.addMenuSection(_('Memory'), 'centered');
        this.addUsage();
        this.addTopProcesses();
        this.addSwap();
        this.addUtilityButtons();
    }
    
    addUsage() {
        const defaultStyle = '';
        
        let hoverButton = new St.Button({
            reactive: true,
            track_hover: true,
            style: defaultStyle
        });
        
        const grid = new Grid({ styleClass: 'astra-monitor-menu-subgrid' });
        hoverButton.add_actor(grid);
        
        // Total Memory
        let label = new St.Label({text: _('Total:'), style_class: 'astra-monitor-menu-label', x_expand: true});
        grid.addToGrid(label);
        this.memoryTotalQty = new St.Label({text: '', style_class: 'astra-monitor-menu-value', style: 'width:4em;'});
        grid.addToGrid(this.memoryTotalQty);
        
        // Used Memory
        label = new St.Label({text: _('Used:'), style_class: 'astra-monitor-menu-label', x_expand: true});
        grid.addToGrid(label);
        this.memoryUsedQty = new St.Label({text: '', style_class: 'astra-monitor-menu-value', style: 'width:4em;'});
        grid.addToGrid(this.memoryUsedQty);
        
        // Active Memory
        label = new St.Label({text: _('Active:'), style_class: 'astra-monitor-menu-label', x_expand: true});
        grid.addToGrid(label);
        this.memoryActiveQty = new St.Label({text: '', style_class: 'astra-monitor-menu-value', style: 'width:4em;'});
        grid.addToGrid(this.memoryActiveQty);
        // Free Memory
        label = new St.Label({text: _('Free:'), style_class: 'astra-monitor-menu-label', x_expand: true});
        grid.addToGrid(label);
        this.memoryFreeQty = new St.Label({text: '', style_class: 'astra-monitor-menu-value', style: 'width:4em;'});
        grid.addToGrid(this.memoryFreeQty);
        
        // Bar
        {
            const barGrid = new St.Widget({
                layout_manager: new Clutter.GridLayout({orientation: Clutter.Orientation.VERTICAL}),
                style: 'margin-left:0;'
            });
            
            //TODO: make width customizable!?
            this.memoryBar = new MemoryBars({
                numBars: 1,
                width: 200-2,
                height: 0.8,
                mini:false,
                layout: 'horizontal',
                x_align: Clutter.ActorAlign.START,
                style: 'margin-left:0.5em;margin-bottom:0;margin-right:0;border:solid 1px #555;'
            });
            barGrid.layout_manager.attach(this.memoryBar, 0, 0, 1, 1);
            
            this.memoryUsagePercLabel = new St.Label({text: '0%', style: 'width:2.7em;font-size:0.8em;text-align:right;'});
            barGrid.layout_manager.attach(this.memoryUsagePercLabel, 1, 0, 1, 1);
            
            grid.addToGrid(barGrid, 2);
        }
        
        //TODO: make width customizable!?
        this.graph = new MemoryGraph({
            width: 200,
            mini: false,
            breakdownConfig: 'memory-menu-graph-breakdown',
        });
        grid.addToGrid(this.graph, 2);
        
        this.createUsagePopup(hoverButton);
        
        hoverButton.connect('enter-event', () => {
            hoverButton.style = defaultStyle + this.selectionStyle;
            if(this.memoryUsagePopup)
                this.memoryUsagePopup.open(true);
        });
        
        hoverButton.connect('leave-event', () => {
            hoverButton.style = defaultStyle;
            if(this.memoryUsagePopup)
                this.memoryUsagePopup.close(true);
        });
        
        this.addToMenu(hoverButton, 2);
    }
    
    createUsagePopup(sourceActor) {
        this.memoryUsagePopup = new MenuBase(sourceActor, 0.05, St.Side.RIGHT, { numCols: 3});
        this.memoryUsagePopup.addMenuSection(_('Memory Usage Raw Info'), 'centered');
        
        //Total Memory
        this.memoryUsagePopup.addToMenu(new St.Label({
            text: _('Total'),
            style_class: 'astra-monitor-menu-sub-key'
        }));
        
        const totalQtyLabel = new St.Label({text: '', style: 'width:4.5em;text-align:right;'});
        this.memoryUsagePopup.addToMenu(totalQtyLabel);
        this.memoryUsagePopup['totalQtyLabel'] = totalQtyLabel;
        
        const totalPercLabel = new St.Label({text: '', style: 'width:4em;text-align:right;'});
        this.memoryUsagePopup.addToMenu(totalPercLabel);
        this.memoryUsagePopup['totalPercLabel'] = totalPercLabel;
        
        //Used Memory
        this.memoryUsagePopup.addToMenu(new St.Label({
            text: _('Used'),
            style_class: 'astra-monitor-menu-sub-key'
        }));
        
        const usedQtyLabel = new St.Label({text: '', style: 'width:4.5em;text-align:right;'});
        this.memoryUsagePopup.addToMenu(usedQtyLabel);
        this.memoryUsagePopup['usedQtyLabel'] = usedQtyLabel;
        
        const usedPercLabel = new St.Label({text: '', style: 'width:4em;text-align:right;'});
        this.memoryUsagePopup.addToMenu(usedPercLabel);
        this.memoryUsagePopup['usedPercLabel'] = usedPercLabel;
        
        //Free Memory
        this.memoryUsagePopup.addToMenu(new St.Label({
            text: _('Free'),
            style_class: 'astra-monitor-menu-sub-key'
        }));
        
        const freeQtyLabel = new St.Label({text: '', style: 'width:4.5em;text-align:right;'});
        this.memoryUsagePopup.addToMenu(freeQtyLabel);
        this.memoryUsagePopup['freeQtyLabel'] = freeQtyLabel;
        
        const freePercLabel = new St.Label({text: '', style: 'width:4em;text-align:right;'});
        this.memoryUsagePopup.addToMenu(freePercLabel);
        this.memoryUsagePopup['freePercLabel'] = freePercLabel;
        
        //Available Memory
        this.memoryUsagePopup.addToMenu(new St.Label({
            text: _('Available'),
            style_class: 'astra-monitor-menu-sub-key'
        }));
        
        const availableQtyLabel = new St.Label({text: '', style: 'width:4.5em;text-align:right;'});
        this.memoryUsagePopup.addToMenu(availableQtyLabel);
        this.memoryUsagePopup['availableLabel'] = availableQtyLabel;
        
        const availablePercLabel = new St.Label({text: '', style: 'width:4em;text-align:right;'});
        this.memoryUsagePopup.addToMenu(availablePercLabel);
        this.memoryUsagePopup['availablePercLabel'] = availablePercLabel;
        
        //Allocatable Memory
        this.memoryUsagePopup.addToMenu(new St.Label({
            text: _('Allocatable'),
            style_class: 'astra-monitor-menu-sub-key'
        }));
        
        const allocatableQtyLabel = new St.Label({text: '', style: 'width:4.5em;text-align:right;'});
        this.memoryUsagePopup.addToMenu(allocatableQtyLabel);
        this.memoryUsagePopup['allocatableLabel'] = allocatableQtyLabel;
        
        const allocatablePercLabel = new St.Label({text: '', style: 'width:4em;text-align:right;'});
        this.memoryUsagePopup.addToMenu(allocatablePercLabel);
        this.memoryUsagePopup['allocatablePercLabel'] = allocatablePercLabel;
        
        //Active Memory
        this.memoryUsagePopup.addToMenu(new St.Label({
            text: _('Active'),
            style_class: 'astra-monitor-menu-sub-key'
        }));
        
        const activeQtyLabel = new St.Label({text: '', style: 'width:4.5em;text-align:right;'});
        this.memoryUsagePopup.addToMenu(activeQtyLabel);
        this.memoryUsagePopup['activeQtyLabel'] = activeQtyLabel;
        
        const activePercLabel = new St.Label({text: '', style: 'width:4em;text-align:right;'});
        this.memoryUsagePopup.addToMenu(activePercLabel);
        this.memoryUsagePopup['activePercLabel'] = activePercLabel;
        
        //Buffers Memory
        this.memoryUsagePopup.addToMenu(new St.Label({
            text: _('Buffers'),
            style_class: 'astra-monitor-menu-sub-key'
        }));
        
        const buffersQtyLabel = new St.Label({text: '', style: 'width:4.5em;text-align:right;'});
        this.memoryUsagePopup.addToMenu(buffersQtyLabel);
        this.memoryUsagePopup['buffersQtyLabel'] = buffersQtyLabel;
        
        const buffersPercLabel = new St.Label({text: '', style: 'width:4em;text-align:right;'});
        this.memoryUsagePopup.addToMenu(buffersPercLabel);
        this.memoryUsagePopup['buffersPercLabel'] = buffersPercLabel;
        
        //Cached Memory
        this.memoryUsagePopup.addToMenu(new St.Label({
            text: _('Cached'),
            style_class: 'astra-monitor-menu-sub-key'
        }));
        
        const cachedQtyLabel = new St.Label({text: '', style: 'width:4.5em;text-align:right;'});
        this.memoryUsagePopup.addToMenu(cachedQtyLabel);
        this.memoryUsagePopup['cachedQtyLabel'] = cachedQtyLabel;
        
        const cachedPercLabel = new St.Label({text: '', style: 'width:4em;text-align:right;'});
        this.memoryUsagePopup.addToMenu(cachedPercLabel);
        this.memoryUsagePopup['cachedPercLabel'] = cachedPercLabel;
    }
    
    addTopProcesses() {
        this.addMenuSection(_('Top processes'), 'centered');
        
        const defaultStyle = '';
        
        let hoverButton = new St.Button({
            reactive: true,
            track_hover: true,
            style: defaultStyle
        });
        
        const grid = new Grid({ numCols: 3, styleClass: 'astra-monitor-menu-subgrid' });
        
        this.topProcesses = [];
        
        //TODO: allow to customize number of processes to show in the menu
        const numProcesses = 5;
        for(let i = 0; i < numProcesses; i++) {
            let label = new St.Label({
                text: '',
                style_class: 'astra-monitor-menu-cmd-name',
                x_expand: true
            });
            grid.addToGrid(label);
            let usage = new St.Label({
                text: '',
                style_class: 'astra-monitor-menu-cmd-usage',
                style: 'width:4.5em;',
            });
            grid.addToGrid(usage);
            let percentage = new St.Label({
                text: '',
                style_class: 'astra-monitor-menu-cmd-usage',
                style: 'width:4em;',
            });
            grid.addToGrid(percentage);
            this.topProcesses.push({ label, usage, percentage });
        }
        
        hoverButton.add_actor(grid);
        
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
    
    createTopProcessesPopup(sourceActor) {
        this.topProcessesPopup = new MenuBase(sourceActor, 0.05, St.Side.RIGHT);
        this.topProcessesPopup.addMenuSection(_('Top processes'), 'centered');
        
        const grid = new Grid({ numCols: 3, styleClass: 'astra-monitor-menu-subgrid' });
        
        for(let i = 0; i < MemoryMonitor.TOP_PROCESSES_LIMIT; i++) {
            const usage = new St.Label({
                text: '',
                style_class: 'astra-monitor-menu-cmd-usage',
                style: 'width:4em;',
                y_expand: true,
                y_align: Clutter.ActorAlign.CENTER
            });
            grid.addGrid(usage, 0, i*2, 1, 2);
            const percentage = new St.Label({
                text: '',
                style_class: 'astra-monitor-menu-cmd-usage',
                style: 'width:3.5em;',
                y_expand: true,
                y_align: Clutter.ActorAlign.CENTER
            });
            grid.addGrid(percentage, 1, i*2, 1, 2);
            const label = new St.Label({
                text: '',
                style_class: 'astra-monitor-menu-cmd-name-full'
            });
            grid.addGrid(label, 2, i*2, 1, 1);
            const description = new St.Label({
                text: '',
                style_class: 'astra-monitor-menu-cmd-description'
            });
            grid.addGrid(description, 2, i*2+1, 1, 1);
            this.topProcessesPopup['process' + i] = { label, usage, percentage, description };
        }
        
        this.topProcessesPopup.addToMenu(grid, 2);
    }
    
    addSwap() {
        this.swapSectionLabel = this.addMenuSection(_('Swap'), 'centered');
        
        const defaultStyle = '';
        
        let hoverButton = new St.Button({
            reactive: true,
            track_hover: true,
            style: defaultStyle
        });
        
        const grid = new Grid({ numCols: 2, styleClass: 'astra-monitor-menu-subgrid' });
        
        //{
            const swapGrid = new St.Widget({
                layout_manager: new Clutter.GridLayout({orientation: Clutter.Orientation.VERTICAL}),
            });
            
            this.swapBar = new SwapBars({
                numBars: 1,
                width: 200-2-2,
                height: 0.8,
                mini:false,
                layout: 'horizontal',
                x_align: Clutter.ActorAlign.START,
                style: 'margin-left:0.5em;margin-bottom:0;margin-right:0;border:solid 1px #555;'
            });
            swapGrid.layout_manager.attach(this.swapBar, 0, 0, 1, 1);
            
            this.swapPercLabel = new St.Label({text: '0%', style: 'width:2.7em;font-size:0.8em;text-align:right;'});
            swapGrid.layout_manager.attach(this.swapPercLabel, 1, 0, 1, 1);
            
            grid.addToGrid(swapGrid, 2);
        //}
        
        const swapUsedLabel = new St.Label({text: _('Used:'), style_class: 'astra-monitor-menu-label', x_expand: true});
        grid.addToGrid(swapUsedLabel);
        
        this.swapUsedQty = new St.Label({text: '', style_class: 'astra-monitor-menu-value', style: 'width:4em;'});
        grid.addToGrid(this.swapUsedQty);
        
        const swapTotalLabel = new St.Label({text: _('Total:'), style_class: 'astra-monitor-menu-label', x_expand: true});
        grid.addToGrid(swapTotalLabel);
        
        this.swapTotalQty = new St.Label({text: '', style_class: 'astra-monitor-menu-value', style: 'width:4em;'});
        grid.addToGrid(this.swapTotalQty);
        
        hoverButton.add_actor(grid);
        
        this.createSwapPopup(hoverButton);
        
        hoverButton.connect('enter-event', () => {
            hoverButton.style = defaultStyle + this.selectionStyle;
            if(this.memorySwapPopup)
                this.memorySwapPopup.open(true);
        });
        
        hoverButton.connect('leave-event', () => {
            hoverButton.style = defaultStyle;
            if(this.memorySwapPopup)
                this.memorySwapPopup.close(true);
        });
        this.addToMenu(hoverButton, 2);
    }
    
    createSwapPopup(sourceActor) {
        this.memorySwapPopup = new MenuBase(sourceActor, 0.05, St.Side.RIGHT, { numCols: 3 });
        this.memorySwapPopup.addMenuSection(_('Swap Info'), 'centered');
        
        //Total Swap
        this.memorySwapPopup.addToMenu(new St.Label({
            text: _('Total'),
            style_class: 'astra-monitor-menu-sub-key'
        }));
        
        const totalQtyLabel = new St.Label({text: '', style: 'width:4.5em;text-align:right;'});
        this.memorySwapPopup.addToMenu(totalQtyLabel);
        this.memorySwapPopup['totalQtyLabel'] = totalQtyLabel;
        
        const totalPercLabel = new St.Label({text: '', style: 'width:4em;text-align:right;'});
        this.memorySwapPopup.addToMenu(totalPercLabel);
        this.memorySwapPopup['totalPercLabel'] = totalPercLabel;
        
        //Used Swap
        this.memorySwapPopup.addToMenu(new St.Label({
            text: _('Used'),
            style_class: 'astra-monitor-menu-sub-key'
        }));
        
        const usedQtyLabel = new St.Label({text: '', style: 'width:4.5em;text-align:right;'});
        this.memorySwapPopup.addToMenu(usedQtyLabel);
        this.memorySwapPopup['usedQtyLabel'] = usedQtyLabel;
        
        const usedPercLabel = new St.Label({text: '', style: 'width:4em;text-align:right;'});
        this.memorySwapPopup.addToMenu(usedPercLabel);
        this.memorySwapPopup['usedPercLabel'] = usedPercLabel;
        
        //Free Swap
        this.memorySwapPopup.addToMenu(new St.Label({
            text: _('Free'),
            style_class: 'astra-monitor-menu-sub-key'
        }));
        
        const freeQtyLabel = new St.Label({text: '', style: 'width:4.5em;text-align:right;'});
        this.memorySwapPopup.addToMenu(freeQtyLabel);
        this.memorySwapPopup['freeQtyLabel'] = freeQtyLabel;
        
        const freePercLabel = new St.Label({text: '', style: 'width:4em;text-align:right;'});
        this.memorySwapPopup.addToMenu(freePercLabel);
        this.memorySwapPopup['freePercLabel'] = freePercLabel;
        
        //Cached Swap
        this.memorySwapPopup.addToMenu(new St.Label({
            text: _('Cached'),
            style_class: 'astra-monitor-menu-sub-key'
        }));
        
        const cachedQtyLabel = new St.Label({text: '', style: 'width:4.5em;text-align:right;'});
        this.memorySwapPopup.addToMenu(cachedQtyLabel);
        this.memorySwapPopup['cachedQtyLabel'] = cachedQtyLabel;
        
        const cachedPercLabel = new St.Label({text: '', style: 'width:4em;text-align:right;'});
        this.memorySwapPopup.addToMenu(cachedPercLabel);
        this.memorySwapPopup['cachedPercLabel'] = cachedPercLabel;
        
        //Zswap Swap
        this.memorySwapPopup.addToMenu(new St.Label({
            text: _('Zswap'),
            style_class: 'astra-monitor-menu-sub-key'
        }));
        
        const zswapQtyLabel = new St.Label({text: '', style: 'width:4.5em;text-align:right;'});
        this.memorySwapPopup.addToMenu(zswapQtyLabel);
        this.memorySwapPopup['zswapQtyLabel'] = zswapQtyLabel;
        
        const zswapPercLabel = new St.Label({text: '', style: 'width:4em;text-align:right;'});
        this.memorySwapPopup.addToMenu(zswapPercLabel);
        this.memorySwapPopup['zswapPercLabel'] = zswapPercLabel;
        
        //Zswapped Swap
        this.memorySwapPopup.addToMenu(new St.Label({
            text: _('Zswapped'),
            style_class: 'astra-monitor-menu-sub-key'
        }));
        
        const zswappedQtyLabel = new St.Label({text: '', style: 'width:4.5em;text-align:right;'});
        this.memorySwapPopup.addToMenu(zswappedQtyLabel);
        this.memorySwapPopup['zswappedQtyLabel'] = zswappedQtyLabel;
        
        const zswappedPercLabel = new St.Label({text: '', style: 'width:4em;text-align:right;'});
        this.memorySwapPopup.addToMenu(zswappedPercLabel);
        this.memorySwapPopup['zswappedPercLabel'] = zswappedPercLabel;
        
        //Swap Devices
        const devicesTitle = this.memorySwapPopup.addMenuSection(_('Swap Devices'), 'centered');
        this.memorySwapPopup['devicesTitle'] = devicesTitle;
        
        const devicesGrid = new Grid({
            numCols: 1,
            styleClass: 'astra-monitor-menu-subgrid',
            x_expand: true
        });
        this.memorySwapPopup['devicesGrid'] = devicesGrid;
        this.memorySwapPopup['devices'] = '';
        
        this.memorySwapPopup.addToMenu(devicesGrid, 3);
    }
    
    onOpen() {
        this.clear();
        
        //Update cpu usage percentage label
        this.update('memoryUsage');
        Utils.memoryMonitor.listen(this, 'memoryUsage', this.update.bind(this, 'memoryUsage'));
        
        //Update graph history
        this.update('graph');
        Utils.memoryMonitor.listen(this.graph, 'memoryUsage', this.update.bind(this, 'graph'));
        
        Utils.memoryMonitor.listen(this, 'topProcesses', this.update.bind(this, 'topProcesses'));
        Utils.memoryMonitor.requestUpdate('topProcesses');
        
        Utils.memoryMonitor.listen(this, 'swapUsage', this.update.bind(this, 'swapUsage'));
        Utils.memoryMonitor.requestUpdate('swapUsage');
    }
    
    onClose() {
        Utils.memoryMonitor.unlisten(this, 'memoryUsage');
        Utils.memoryMonitor.unlisten(this.graph, 'memoryUsage');
        Utils.memoryMonitor.unlisten(this, 'topProcesses');
        Utils.memoryMonitor.unlisten(this, 'swapUsage');
    }
    
    clear() {
        //Clear elements before updating them (in case of a lagging update)
        
        this.memoryTotalQty.text = '';
        this.memoryUsedQty.text = '';
        this.memoryActiveQty.text = '';
        this.memoryFreeQty.text = '';
        
        for(let i = 0; i < this.topProcesses.length; i++) {
            this.topProcesses[i].label.text = '';
            this.topProcesses[i].percentage.text = '';
        }
    }
    
    update(code) {
        if(code === 'memoryUsage') {
            const memoryUsage = Utils.memoryMonitor.getCurrentValue('memoryUsage');
            
            if(memoryUsage && memoryUsage.total && !isNaN(memoryUsage.total)) {
                this.memoryBar.setUsage([memoryUsage]);
                this.memoryTotalQty.text = Utils.formatBytes(memoryUsage.total, 3);
                this.memoryUsagePercLabel.text = Math.round(memoryUsage.used / memoryUsage.total * 100.0) + '%';
                
                if(memoryUsage.used && !isNaN(memoryUsage.used)) {
                    this.memoryUsedQty.text = Utils.formatBytes(memoryUsage.used, 3);
                }
                
                if(memoryUsage.active && !isNaN(memoryUsage.active)) {
                    this.memoryActiveQty.text = Utils.formatBytes(memoryUsage.active, 3);
                }
                
                if(memoryUsage.free && !isNaN(memoryUsage.free)) {
                    this.memoryFreeQty.text = Utils.formatBytes(memoryUsage.free, 3);
                }
                
                if(this.memoryUsagePopup) {
                    this.memoryUsagePopup['totalQtyLabel'].text = Utils.formatBytes(memoryUsage.total, 3);
                    
                    if(memoryUsage.used && !isNaN(memoryUsage.used)) {
                        this.memoryUsagePopup['usedQtyLabel'].text = Utils.formatBytes(memoryUsage.used, 3);
                        this.memoryUsagePopup['usedPercLabel'].text = (memoryUsage.used / memoryUsage.total * 100).toFixed(1) + '%';
                    }
                    if(memoryUsage.free && !isNaN(memoryUsage.free)) {
                        this.memoryUsagePopup['freeQtyLabel'].text = Utils.formatBytes(memoryUsage.free, 3);
                        this.memoryUsagePopup['freePercLabel'].text = (memoryUsage.free / memoryUsage.total * 100).toFixed(1) + '%';
                    }
                    if(memoryUsage.available && !isNaN(memoryUsage.available)) {
                        this.memoryUsagePopup['availableLabel'].text = Utils.formatBytes(memoryUsage.available, 3);
                        this.memoryUsagePopup['availablePercLabel'].text = (memoryUsage.available / memoryUsage.total * 100).toFixed(1) + '%';
                    }
                    if(memoryUsage.allocatable && !isNaN(memoryUsage.allocatable)) {
                        this.memoryUsagePopup['allocatableLabel'].text = Utils.formatBytes(memoryUsage.allocatable, 3);
                        this.memoryUsagePopup['allocatablePercLabel'].text = (memoryUsage.allocatable / memoryUsage.total * 100).toFixed(1) + '%';
                    }
                    if(memoryUsage.active && !isNaN(memoryUsage.active)) {
                        this.memoryUsagePopup['activeQtyLabel'].text = Utils.formatBytes(memoryUsage.active, 3);
                        this.memoryUsagePopup['activePercLabel'].text = (memoryUsage.active / memoryUsage.total * 100).toFixed(1) + '%';
                    }
                    if(memoryUsage.buffers && !isNaN(memoryUsage.buffers)) {
                        this.memoryUsagePopup['buffersQtyLabel'].text = Utils.formatBytes(memoryUsage.buffers, 3);
                        this.memoryUsagePopup['buffersPercLabel'].text = (memoryUsage.buffers / memoryUsage.total * 100).toFixed(1) + '%';
                    }
                    if(memoryUsage.cached && !isNaN(memoryUsage.cached)) {
                        this.memoryUsagePopup['cachedQtyLabel'].text = Utils.formatBytes(memoryUsage.cached, 3);
                        this.memoryUsagePopup['cachedPercLabel'].text = (memoryUsage.cached / memoryUsage.total * 100).toFixed(1) + '%';
                    }
                }
            }
            else {
                this.memoryBar.setUsage([]);
                
                this.memoryTotalQty.text = '';
                this.memoryUsedQty.text = '';
                this.memoryActiveQty.text = '';
            }
            return;
        }
        if(code === 'graph') {
            let usage = Utils.memoryMonitor.getUsageHistory('memoryUsage');
            this.graph.setUsageHistory(usage);
            return;
        }
        if(code === 'topProcesses') {
            const topProcesses = Utils.memoryMonitor.getCurrentValue('topProcesses');
            if(!topProcesses || !Array.isArray(topProcesses)) {
                for(let i = 0; i < topProcesses.length; i++) {
                    const topProcess = topProcesses[i];
                    
                    if(this.topProcesses[i]) {
                        this.topProcesses[i].label.text = '';
                        this.topProcesses[i].usage.text = '';
                        this.topProcesses[i].percentage.text = '';
                    }
                    if(this.topProcessesPopup && this.topProcessesPopup['process' + i]) {
                        this.topProcessesPopup['process' + i].label.text = '';
                        this.topProcessesPopup['process' + i].description.text = '';
                        this.topProcessesPopup['process' + i].percentage.text = '';
                        this.topProcessesPopup['process' + i].usage.text = '';
                    }
                }
            }
            else {
                for(let i = 0; i < topProcesses.length; i++) {
                    const topProcess = topProcesses[i];
                    const process = topProcess.process;
                    const usage = topProcess.usage;
                    const percentage = topProcess.percentage;
                    
                    if(this.topProcesses[i]) {
                        this.topProcesses[i].label.text = process.exec;
                        this.topProcesses[i].usage.text = Utils.formatBytes(usage, 3);
                        this.topProcesses[i].percentage.text = percentage.toFixed(1) + '%';
                    }
                    if(this.topProcessesPopup && this.topProcessesPopup['process' + i]) {
                        const topProcess = this.topProcessesPopup['process' + i];
                        topProcess.label.text = process.exec;
                        topProcess.description.text = process.cmd;
                        topProcess.usage.text = Utils.formatBytes(usage, 3);
                        topProcess.percentage.text = percentage.toFixed(1) + '%';
                    }
                }
            }
            return;
        }
        if(code === 'swapUsage') {
            const swapUsage = Utils.memoryMonitor.getCurrentValue('swapUsage');
            
            if(swapUsage && swapUsage.total && !isNaN(swapUsage.total)) {
                this.swapBar.setUsage(swapUsage);
                
                const perc = 100; //swapUsage.used / swapUsage.total * 100.0;
                if(!isNaN(perc))
                    this.swapPercLabel.text = Math.round(perc) + '%';
                else
                    this.swapPercLabel.text = '0%';
                
                this.swapTotalQty.text = Utils.formatBytes(swapUsage.total, 3);
                this.swapUsedQty.text = Utils.formatBytes(swapUsage.used, 3);
                
                if(this.memorySwapPopup) {
                    this.memorySwapPopup['totalQtyLabel'].text = Utils.formatBytes(swapUsage.total, 3);
                    
                    if(swapUsage.used && !isNaN(swapUsage.used)) {
                        this.memorySwapPopup['usedQtyLabel'].text = Utils.formatBytes(swapUsage.used, 3);
                        this.memorySwapPopup['usedPercLabel'].text = (swapUsage.used / swapUsage.total * 100).toFixed(1) + '%';
                    }
                    else {
                        this.memorySwapPopup['usedQtyLabel'].text = '-';
                        this.memorySwapPopup['usedPercLabel'].text = '';
                    }
                    
                    if(swapUsage.free && !isNaN(swapUsage.free)) {
                        this.memorySwapPopup['freeQtyLabel'].text = Utils.formatBytes(swapUsage.free, 3);
                        this.memorySwapPopup['freePercLabel'].text = (swapUsage.free / swapUsage.total * 100).toFixed(1) + '%';
                    }
                    else {
                        this.memorySwapPopup['freeQtyLabel'].text = '-';
                        this.memorySwapPopup['freePercLabel'].text = '';
                    }
                    
                    if(swapUsage.cached && !isNaN(swapUsage.cached)) {
                        this.memorySwapPopup['cachedQtyLabel'].text = Utils.formatBytes(swapUsage.cached, 3);
                        this.memorySwapPopup['cachedPercLabel'].text = (swapUsage.cached / swapUsage.total * 100).toFixed(1) + '%';
                    }
                    else {
                        this.memorySwapPopup['cachedQtyLabel'].text = '-';
                        this.memorySwapPopup['cachedPercLabel'].text = '';
                    }
                    
                    if(swapUsage.zswap && !isNaN(swapUsage.zswap))
                        this.memorySwapPopup['zswapQtyLabel'].text = Utils.formatBytes(swapUsage.zswap, 3);
                    else
                        this.memorySwapPopup['zswapQtyLabel'].text = '-';
                    
                    if(swapUsage.zswapped && !isNaN(swapUsage.zswapped))
                        this.memorySwapPopup['zswappedQtyLabel'].text = Utils.formatBytes(swapUsage.zswapped, 3);
                    else
                        this.memorySwapPopup['zswappedQtyLabel'].text = '-';
                    
                    if(swapUsage.devices && Array.isArray(swapUsage.devices)) {
                        const hash = JSON.stringify(swapUsage.devices);
                        if(this.memorySwapPopup['devices'] !== hash) {
                            const devicesGrid = this.memorySwapPopup['devicesGrid'];
                            devicesGrid.remove_all_children();
                            
                            for(let i = 0; i < swapUsage.devices.length; i++) {
                                const device = swapUsage.devices[i];
                                
                                const deviceGrid = new Grid({
                                    numCols: 2,
                                    styleClass: 'astra-monitor-menu-subgrid',
                                    x_expand: true
                                });
                                
                                deviceGrid.addToGrid(new St.Label({
                                    text: device.device,
                                    style_class: 'astra-monitor-menu-label',
                                    x_expand: true
                                }), 2);
                                
                                deviceGrid.addToGrid(new St.Label({
                                    text: Utils.capitalize(device.type),
                                    style_class: 'astra-monitor-menu-unmonitored',
                                    x_expand: true
                                }));
                                
                                deviceGrid.addToGrid(new St.Label({
                                    text: Utils.formatBytes(device.used, 3) + ' / ' + Utils.formatBytes(device.size, 3),
                                    style_class: 'astra-monitor-menu-value',
                                    x_expand: true
                                }));
                                
                                devicesGrid.addToGrid(deviceGrid);
                            }
                            
                        }
                    }
                    else {
                        this.memorySwapPopup['devicesTitle'].hide();
                        this.memorySwapPopup['devicesGrid'].hide();
                        this.memorySwapPopup['devices'] = '';
                    }
                }
            }
            else {
                this.swapBar.setUsage([]);
                
                this.swapTotalQty.text = '';
                this.swapUsedQty.text = '';
                
                if(this.memorySwapPopup) {
                    this.memorySwapPopup['totalQtyLabel'].text = '';
                    this.memorySwapPopup['usedQtyLabel'].text = '';
                    this.memorySwapPopup['usedPercLabel'].text = '';
                    this.memorySwapPopup['freeQtyLabel'].text = '';
                    this.memorySwapPopup['freePercLabel'].text = '';
                    this.memorySwapPopup['cachedQtyLabel'].text = '';
                    this.memorySwapPopup['cachedPercLabel'].text = '';
                    this.memorySwapPopup['zswapQtyLabel'].text = '';
                    this.memorySwapPopup['zswappedQtyLabel'].text = '';
                }
            }
            return;
        }
    }
    
    destroy() {
        this.close(true);
        this.removeAll();
        
        if(this.memoryUsagePopup) {
            this.memoryUsagePopup.destroy();
            this.memoryUsagePopup = null;
        }
        if(this.topProcessesPopup) {
            this.topProcessesPopup.destroy();
            this.topProcessesPopup = null;
        }
        
        super.destroy();
    }
};
