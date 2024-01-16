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

import GObject from 'gi://GObject';
import St from 'gi://St';
import Clutter from 'gi://Clutter';

import * as Main from 'resource:///org/gnome/shell/ui/main.js';
import * as PanelMenu from 'resource:///org/gnome/shell/ui/panelMenu.js';

import Utils from './utils/utils.js';
import Config from './config.js';
import { ProcessorHeader } from './processor/processorHeader.js';
import { MemoryHeader } from './memory/memoryHeader.js';
import { StorageHeader } from './storage/storageHeader.js';
import { NetworkHeader } from './network/networkHeader.js';
import { SensorsHeader } from './sensors/sensorsHeader.js';

export const Container = GObject.registerClass(
class Container extends PanelMenu.Button {
    constructor() {
        super();
        Utils.log('Initializing container');
        
        Utils.container = this;
        
        this.widgets = new Map();
        this.box = new St.BoxLayout({
            vertical: false,
            x_expand: true,
            y_expand: true,
            x_align: Clutter.ActorAlign.FILL,
            y_align: Clutter.ActorAlign.FILL,
            style: this.computeStyle(),
        });
        
        // @ts-ignore
        this.add_child(this.box);

        this.remove_style_class_name('panel-button');
        this.add_style_class_name('astra-monitor-header-container');
        this.setup();
        
        Config.connect(this, 'changed::panel-box', this.updatePanel.bind(this));
        Config.connect(this, 'changed::panel-box-order', this.updatePanel.bind(this));
        Config.connect(this, 'changed::monitors-order', this.reorderWidgets.bind(this));
        Config.connect(this, 'changed::headers-font-family', this.updateStyle.bind(this));
        Config.connect(this, 'changed::headers-font-size', this.updateStyle.bind(this));
    }
    
    computeStyle() {
        let style = '';
        
        const fontFamily = Config.get_string('headers-font-family');
        if(fontFamily)
            style += `font-family:"${fontFamily}";`;
        
        const fontSize = Config.get_int('headers-font-size');
        if(fontSize)
            style += `font-size:${fontSize}pt;`;
        
        return style;
    }
    
    updateStyle() {
        const style = this.computeStyle();
        this.box.style = style;
    }
    
    addWidget(key, widget) {
        Utils.log('Adding widget: ' + key);
                
        this.widgets.set(key, widget);
        this.box.add_child(widget);
    }
    
    reorderWidgets() {
        Utils.log('Reordering widgets');
        const monitors = Utils.getMonitorsOrder();
        
        let position = 0;
        for(const monitor of monitors) {
            const widget = this.widgets.get(monitor);
            if(!widget)
                continue;
            this.box.remove_child(widget);
            this.box.insert_child_at_index(widget, position++);
        }
    }
    
    setup() {
        const monitors = Utils.getMonitorsOrder();
        
        for(const monitor of monitors) {
            if(monitor === 'processor') {
                const processorHeader = new ProcessorHeader();
                this.addWidget('processor', processorHeader);
                Main.panel.menuManager.addMenu(processorHeader.menu);
                continue;
            }
            if(monitor === 'memory') {
                const memoryHeader = new MemoryHeader();
                this.addWidget('memory', memoryHeader);
                Main.panel.menuManager.addMenu(memoryHeader.menu);
                continue;
            }
            if(monitor === 'storage') {
                const storageHeader = new StorageHeader();
                this.addWidget('storage', storageHeader);
                Main.panel.menuManager.addMenu(storageHeader.menu);
                continue;
            }
            if(monitor === 'network') {
                const networkHeader = new NetworkHeader();
                this.addWidget('network', networkHeader);
                Main.panel.menuManager.addMenu(networkHeader.menu);
                continue;
            }
            if(monitor === 'sensors') {
                const sonsorHeader = new SensorsHeader();
                this.addWidget('sensors', sonsorHeader);
                Main.panel.menuManager.addMenu(sonsorHeader.menu);
                continue;
            }
        }
    }
    
    place(uuid) {
        this.uuid = uuid;
        const panelBox = Config.get_string('panel-box');
        const order = Config.get_int('panel-box-order');
        
        Utils.log(`Placing container in ${panelBox} box at position ${order}`);
        Main.panel.addToStatusArea(this.uuid, this, order, panelBox);
    }
    
    updatePanel() {
        const panelBox = Config.get_string('panel-box');
        
        let boxes = {
            // @ts-ignore
            left: Main.panel._leftBox,
            // @ts-ignore
            center: Main.panel._centerBox,
            // @ts-ignore
            right: Main.panel._rightBox,
        };
        // @ts-ignore
        let boxContainer = boxes[panelBox] || Main.panel._rightBox;
        const order = Config.get_int('panel-box-order');
        
        Utils.log(`Reordering container in ${panelBox} box at position ${order}`);
        Main.panel._addToPanelBox(this.uuid, this, order, boxContainer);
    }
    
    destroy() {
        Utils.log('Destroying container');
        
        try {
            Config.clear(this);
        }
        catch(e) {
            Utils.error(e);
        }
        
        try {
            for(const widget of this.widgets.values())
                widget.destroy();
        }
        catch(e) {
            Utils.error(e);
        }
        super.destroy();
    }
});