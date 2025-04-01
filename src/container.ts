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
import Gio from 'gi://Gio';

import * as Main from 'resource:///org/gnome/shell/ui/main.js';
import * as PanelMenu from 'resource:///org/gnome/shell/ui/panelMenu.js';

import Utils from './utils/utils.js';
import Config from './config.js';
import CompactHeader from './compact.js';
import ProcessorHeader from './processor/processorHeader.js';
import GpuHeader from './gpu/gpuHeader.js';
import MemoryHeader from './memory/memoryHeader.js';
import StorageHeader from './storage/storageHeader.js';
import NetworkHeader from './network/networkHeader.js';
import SensorsHeader from './sensors/sensorsHeader.js';
import MenuBase from './menu.js';

type Widget =
    | InstanceType<typeof ProcessorHeader>
    | InstanceType<typeof GpuHeader>
    | InstanceType<typeof MemoryHeader>
    | InstanceType<typeof StorageHeader>
    | InstanceType<typeof NetworkHeader>
    | InstanceType<typeof SensorsHeader>
    | InstanceType<typeof CompactHeader>;

export default GObject.registerClass(
    class AstraMonitorContainer extends PanelMenu.Button {
        private headers: Map<string, Widget>;
        private uuid: string = '';
        private compactHeader!: InstanceType<typeof CompactHeader>;
        private box!: St.BoxLayout;

        constructor() {
            super(0, 'Astra Monitor');
            Utils.log('Initializing container');

            const panelBox = Config.get_string('panel-box');
            if(panelBox === 'left') MenuBase.openingSide = St.Side.LEFT;

            this.headers = new Map();

            this.box = new St.BoxLayout({
                vertical: false,
                xExpand: true,
                yExpand: true,
                xAlign: Clutter.ActorAlign.START,
                yAlign: Clutter.ActorAlign.FILL,
                style: this.computeStyle(),
            });

            this.add_child(this.box);

            this.remove_style_class_name('panel-button');
            this.setup();

            Config.connect(this, 'changed::panel-box', this.updatePanel.bind(this));
            Config.connect(this, 'changed::panel-box-order', this.updatePanel.bind(this));
            Config.connect(this, 'changed::monitors-order', this.reorderHeaders.bind(this));
            Config.connect(this, 'changed::headers-font-family', this.updateStyle.bind(this));
            Config.connect(this, 'changed::headers-font-size', this.updateStyle.bind(this));
            Config.connect(this, 'changed::panel-margin-left', this.updateStyle.bind(this));
            Config.connect(this, 'changed::panel-margin-right', this.updateStyle.bind(this));
        }

        computeStyle() {
            let style = '';

            const marginLeft = Config.get_int('panel-margin-left');
            if(marginLeft) style += `margin-left:${marginLeft}px;`;

            const marginRight = Config.get_int('panel-margin-right');
            if(marginRight) style += `margin-right:${marginRight}px;`;

            const fontFamily = Config.get_string('headers-font-family');
            if(fontFamily) style += `font-family:"${fontFamily}";`;

            const fontSize = Config.get_int('headers-font-size');
            if(fontSize) style += `font-size:${fontSize}pt;`;

            return style;
        }

        updateStyle() {
            const style = this.computeStyle();
            this.box.style = style;
        }

        addHeaders(key: string, header: Widget) {
            Utils.log('Adding widget: ' + key);

            this.headers.set(key, header);
            this.box.add_child(header);
        }

        reorderHeaders() {
            Utils.log('Reordering headers');
            const monitors = Utils.getMonitorsOrder();

            let position = 0;

            if(Config.get_string('panel-box') === 'left') {
                this.box.remove_child(this.compactHeader);
                this.box.insert_child_at_index(this.compactHeader, position++);
            }

            for(const monitor of monitors) {
                const header = this.headers.get(monitor);
                if(!header) continue;
                this.box.remove_child(header);
                this.box.insert_child_at_index(header, position++);
            }

            if(Config.get_string('panel-box') !== 'left') {
                this.box.remove_child(this.compactHeader);
                this.box.insert_child_at_index(this.compactHeader, position++);
            }
        }

        setup() {
            const monitors = Utils.getMonitorsOrder();

            if(Config.get_string('panel-box') === 'left') this.addCompactHeader();

            for(const monitor of monitors) {
                if(monitor === 'processor') {
                    const processorHeader = new ProcessorHeader();
                    this.addHeaders('processor', processorHeader);
                    (Main.panel as any).menuManager.addMenu(processorHeader.getMenu());
                    continue;
                }
                if(monitor === 'gpu') {
                    const gpuHeader = new GpuHeader();
                    this.addHeaders('gpu', gpuHeader);
                    (Main.panel as any).menuManager.addMenu(gpuHeader.getMenu());
                    continue;
                }
                if(monitor === 'memory') {
                    const memoryHeader = new MemoryHeader();
                    this.addHeaders('memory', memoryHeader);
                    (Main.panel as any).menuManager.addMenu(memoryHeader.getMenu());
                    continue;
                }
                if(monitor === 'storage') {
                    const storageHeader = new StorageHeader();
                    this.addHeaders('storage', storageHeader);
                    (Main.panel as any).menuManager.addMenu(storageHeader.getMenu());
                    continue;
                }
                if(monitor === 'network') {
                    const networkHeader = new NetworkHeader();
                    this.addHeaders('network', networkHeader);
                    (Main.panel as any).menuManager.addMenu(networkHeader.getMenu());
                    continue;
                }
                if(monitor === 'sensors') {
                    const sonsorHeader = new SensorsHeader();
                    this.addHeaders('sensors', sonsorHeader);
                    (Main.panel as any).menuManager.addMenu(sonsorHeader.getMenu());
                    continue;
                }
            }

            if(Config.get_string('panel-box') !== 'left') this.addCompactHeader();
        }

        addCompactHeader() {
            this.compactHeader = new CompactHeader();
            Config.bind('compact-mode', this.compactHeader, 'visible', Gio.SettingsBindFlags.GET);
            this.addHeaders('compact', this.compactHeader);
            this.compactHeader.compact(this.compact.bind(this));
        }

        compact(compacted: boolean) {
            for(const header of this.headers.values()) {
                if(header instanceof CompactHeader) continue;
                header.setCompacted(compacted);
            }
        }

        place(uuid: string) {
            this.uuid = uuid;
            const panelBox = Config.get_string('panel-box');
            const order = Config.get_int('panel-box-order');

            Utils.log(`Placing container in ${panelBox} box at position ${order}`);
            Main.panel.addToStatusArea(this.uuid, this, order, panelBox);

            this.compactHeader.refresh();
        }

        updatePanel() {
            const panelBox = Config.get_string('panel-box');

            const boxes = {
                // @ts-expect-error _leftBox not in types
                left: Main.panel._leftBox,
                // @ts-expect-error _centerBox not in types
                center: Main.panel._centerBox,
                // @ts-expect-error _rightBox not in types
                right: Main.panel._rightBox,
            };
            // @ts-expect-error _rightBox not in types
            const boxContainer = boxes[panelBox] || Main.panel._rightBox;
            const order = Config.get_int('panel-box-order');

            Utils.log(`Reordering container in ${panelBox} box at position ${order}`);
            Main.panel._addToPanelBox(this.uuid, this, order, boxContainer);
            this.reorderHeaders();
        }

        override destroy() {
            try {
                Config.clear(this);
            } catch(e: any) {
                Utils.error('Error clearing container settings', e);
            }

            try {
                for(const header of this.headers.values()) {
                    if(header instanceof CompactHeader === false) {
                        const menu = header.getMenu();
                        if(menu) {
                            (Main.panel as any).menuManager.removeMenu(menu);
                        }
                    }

                    this.box.remove_child(header);
                    header.destroy();
                }
                this.headers?.clear();
                this.headers = undefined as any;
                this.compactHeader = undefined as any;

                this.box.remove_all_children();
                this.box.destroy();
                this.remove_all_children();
                super.destroy();
            } catch(e: any) {
                Utils.error('Error destroying containerheaders', e);
            }
        }
    }
);
