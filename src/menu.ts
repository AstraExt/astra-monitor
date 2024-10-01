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
import Shell from 'gi://Shell';
import Mtk from 'gi://Mtk';

import { gettext as _ } from 'resource:///org/gnome/shell/extensions/extension.js';
import * as PopupMenu from 'resource:///org/gnome/shell/ui/popupMenu.js';
import * as Main from 'resource:///org/gnome/shell/ui/main.js';

import Utils from './utils/utils.js';
import Grid from './grid.js';
import Config from './config.js';

type MenuProps = {
    name?: string;
    scrollable?: boolean;
    numCols?: number;
    arrowSide?: St.Side;
};

type Size = {
    width: number;
    height: number;
};

export default class MenuBase extends PopupMenu.PopupMenu {
    public static openingSide: St.Side = St.Side.RIGHT;

    private statusMenu: PopupMenu.PopupMenuSection;
    private grid: InstanceType<typeof Grid>;
    private utilityBox?: St.BoxLayout;

    private lastForcedUpdate: Map<string, number> = new Map();

    constructor(sourceActor: St.Widget, arrowAlignment: number, params: MenuProps = {}) {
        super(sourceActor, arrowAlignment, params.arrowSide ?? MenuBase.openingSide);

        if(params.name) Utils.verbose(`Creating ${params.name}`);

        if(params.scrollable) {
            // SCROLLABLE
            const scrollView = new St.ScrollView({
                xExpand: true,
                yExpand: true,
                yAlign: Clutter.ActorAlign.START,
            });
            scrollView.set_policy(St.PolicyType.NEVER, St.PolicyType.AUTOMATIC);

            const boxLayout = new St.BoxLayout({
                vertical: true,
            });
            scrollView.add_child(boxLayout);

            this.statusMenu = new PopupMenu.PopupMenuSection();
            this.addMenuItem(this.statusMenu);

            const scrollActor = new St.Bin({ child: scrollView });

            this.statusMenu.actor.add_child(scrollActor);

            this.grid = new Grid({ numCols: params.numCols || 2 });
            boxLayout.add_child(this.grid);

            this.actor.add_style_class_name('panel-menu');

            Main.uiGroup.add_child(this.actor);
            this.actor.hide();
        } else {
            // NON-SCROLLABLE
            this.statusMenu = new PopupMenu.PopupMenuSection();
            this.grid = new Grid({ numCols: params.numCols || 2 });

            this.statusMenu.box.add_child(this.grid);
            this.addMenuItem(this.statusMenu);

            this.actor.add_style_class_name('panel-menu');

            Main.uiGroup.add_child(this.actor);

            this.actor.hide();
        }
    }

    static get arrowAlignement() {
        const shellBarPosition = Config.get_string('shell-bar-position');

        if(shellBarPosition === 'top') return St.Side.TOP;
        if(shellBarPosition === 'bottom') return St.Side.BOTTOM;
        if(shellBarPosition === 'left') return St.Side.LEFT;
        return St.Side.RIGHT;
    }

    static getMonitorSize(actorBox: Clutter.ActorBox): Size {
        const display = global.display;
        const rect = new Mtk.Rectangle({
            x: actorBox.x1,
            y: actorBox.y1,
            width: actorBox.x2 - actorBox.x1,
            height: actorBox.y2 - actorBox.y1,
        });
        let monitorIndex = display.get_monitor_index_for_rect(rect);
        if(monitorIndex === -1) monitorIndex = display.get_primary_monitor();
        const geometry = display.get_monitor_geometry(monitorIndex);
        return { width: geometry.width, height: geometry.height };
    }

    addMenuSection(text: string, add: boolean = true, newLine: boolean = false): St.Label {
        const label = new St.Label({ text, styleClass: 'astra-monitor-menu-header-centered' });
        if(add) {
            if(newLine) this.grid.newLine();
            this.addToMenu(label, this.grid.getNumCols());
        }
        return label;
    }

    addMenuSeparator(
        text: string,
        add: boolean = true,
        newLine: boolean = false
    ): PopupMenu.PopupSeparatorMenuItem {
        const separator = new PopupMenu.PopupSeparatorMenuItem(text);
        if(add) {
            if(newLine) this.grid.newLine();
            this.addToMenu(separator, this.grid.getNumCols());
        }
        return separator;
    }

    addToMenu(widget: any, colSpan: number = 1) {
        this.grid.addToGrid(widget, colSpan);
    }

    get selectionStyle(): string {
        if(Utils.themeStyle === 'light')
            return 'background-color:rgba(0,0,0,0.1);box-shadow: 0 0 2px rgba(255,255,255,0.2);border-radius:0.3em;';
        return 'background-color:rgba(255,255,255,0.1);box-shadow: 0 0 2px rgba(0,0,0,0.2);border-radius:0.3em;';
    }

    addUtilityButtons(category?: string, addButtons?: (box: St.BoxLayout) => void) {
        this.utilityBox = new St.BoxLayout({
            styleClass: 'astra-monitor-menu-button-box',
            xAlign: Clutter.ActorAlign.CENTER,
            reactive: true,
            xExpand: true,
        });

        if(addButtons) addButtons(this.utilityBox);

        // System Monitor
        const appSys = Shell.AppSystem.get_default();
        let app = appSys.lookup_app('org.gnome.SystemMonitor.desktop');
        if(app) {
            const button = new St.Button({ styleClass: 'button' });
            button.child = new St.Icon({
                gicon: Utils.getLocalIcon('am-system-monitor-symbolic'),
                fallbackIconName: 'org.gnome.SystemMonitor-symbolic',
            });

            button.connect('clicked', () => {
                this.close(true);
                app.activate();
            });
            this.utilityBox.add_child(button);
        } else {
            // GNOME <=45
            app = appSys.lookup_app('gnome-system-monitor.desktop');
            if(app) {
                const button = new St.Button({ styleClass: 'button' });
                button.child = new St.Icon({
                    gicon: Utils.getLocalIcon('am-system-monitor-symbolic'),
                    fallbackIconName: 'org.gnome.SystemMonitor-symbolic',
                });

                button.connect('clicked', () => {
                    this.close(true);
                    app.activate();
                });
                this.utilityBox.add_child(button);
            }
        }

        // Astra Monitor preferences
        const button = new St.Button({ styleClass: 'button' });
        button.child = new St.Icon({
            gicon: Utils.getLocalIcon('am-settings-symbolic'),
            fallbackIconName: 'preferences-system-symbolic',
        });
        button.connect('clicked', () => {
            this.close(true);
            try {
                if(category) Config.set('queued-pref-category', category, 'string');
                if(!Utils.extension) throw new Error('Extension not found');
                Utils.extension.openPreferences();
            } catch(err) {
                Utils.log(`Error opening settings: ${err}`);
            }
        });
        this.utilityBox.add_child(button);

        this.addToMenu(this.utilityBox, this.grid.getNumCols());
    }

    async onOpen() {}

    async onClose() {}

    protected needsUpdate(code: string, forced: boolean = false) {
        if(forced) {
            const lastUpdate = this.lastForcedUpdate.get(code);

            if(lastUpdate && Date.now() - lastUpdate < 1000) {
                return false;
            }
            this.lastForcedUpdate.set(code, Date.now());
        }
        return true;
    }

    update(_code: string, _forced: boolean = false) {
        Utils.error('update() needs to be overridden');
    }

    destroy(): void {
        Config.clear(this);
        super.destroy();
    }
}
