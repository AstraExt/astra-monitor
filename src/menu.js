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

// @ts-ignore
import St from 'gi://St';
import Clutter from 'gi://Clutter';
import Shell from 'gi://Shell';

import {Extension, gettext as _} from 'resource:///org/gnome/shell/extensions/extension.js';
import * as PopupMenu from 'resource:///org/gnome/shell/ui/popupMenu.js';
import * as Main from 'resource:///org/gnome/shell/ui/main.js';

import Utils from './utils/utils.js';
import {Grid} from './grid.js';

export class MenuBase extends PopupMenu.PopupMenu {
    constructor(sourceActor, arrowAlignment, arrowSide, params = {}) {
        super(sourceActor, arrowAlignment, arrowSide);
        
        if(params.scrollable) {
            // SCROLLABLE
            const scrollView = new St.ScrollView({
                x_expand: true,
                y_expand: true,
                y_align: Clutter.ActorAlign.START,
            });
            scrollView.set_policy(St.PolicyType.NEVER, St.PolicyType.AUTOMATIC);
            
            const boxLayout = new St.BoxLayout({
                vertical: true
            });
            scrollView.add_actor(boxLayout);
            
            this.statusMenu = new PopupMenu.PopupMenuSection();
            // @ts-ignore
            this.addMenuItem(this.statusMenu);
            
            const scrollActor = new St.Bin({ child: scrollView });
            // @ts-ignore
            this.statusMenu.actor.add_actor(scrollActor);
            
            this.grid = new Grid({ numCols: params.numCols || 2 });
            boxLayout.add_child(this.grid);
            
            // @ts-ignore
            this.actor.add_style_class_name('panel-menu');
            
            // @ts-ignore
            Main.uiGroup.add_actor(this.actor);
            // @ts-ignore
            this.actor.hide();
        }
        else {
            // NON-SCROLLABLE
            this.statusMenu = new PopupMenu.PopupMenuSection();
            this.grid = new Grid({ numCols: params.numCols || 2 });
            
            // @ts-ignore
            this.statusMenu.box.add_child(this.grid);
            // @ts-ignore
            this.addMenuItem(this.statusMenu);
            
            // @ts-ignore
            this.actor.add_style_class_name('panel-menu');
            
            // @ts-ignore
            Main.uiGroup.add_actor(this.actor);
            // @ts-ignore
            this.actor.hide();
        }
    }
    
    addMenuSection(text, style = 'default') {
        if(style === 'centered') {
            let label = new St.Label({text, style_class: 'astra-monitor-menu-header-centered'});
            this.addToMenu(label, this.grid.getNumCols());
            return label;
        }
        
        const separator = new PopupMenu.PopupSeparatorMenuItem(text);
        this.addToMenu(separator, this.grid.getNumCols());
        return separator;
    }
    
    addToMenu(widget, colSpan = 1) {
        this.grid.addToGrid(widget, colSpan);
    }
    
    get selectionStyle() {
        if(Utils.themeStyle() === 'light')
            return 'background-color:rgba(0,0,0,0.1);box-shadow: 0 0 2px rgba(255,255,255,0.2);border-radius:0.3em;';
        return 'background-color:rgba(255,255,255,0.1);box-shadow: 0 0 2px rgba(0,0,0,0.2);border-radius:0.3em;';
    }
    
    /**
     * @param {(box:St.BoxLayout) => void} addButtons 
     */
    addUtilityButtons(addButtons = null) {
        this.utilityBox = new St.BoxLayout({
            style_class: 'astra-monitor-menu-button-box',
            x_align: Clutter.ActorAlign.CENTER,
            reactive: true,
            x_expand: true,
        });
        
        if(addButtons)
            addButtons(this.utilityBox);
        
        // System Monitor
        let appSys = Shell.AppSystem.get_default();
        let app = appSys.lookup_app('gnome-system-monitor.desktop');
        if(app) {
            let button = new St.Button({style_class: 'button'});
            button.child = new St.Icon({
                gicon: Utils.getLocalIcon('am-system-monitor-symbolic'),
                fallback_icon_name: 'org.gnome.SystemMonitor-symbolic',
            });
            
            button.connect('clicked', () => {
                this.close(true);
                app.activate();
            });
            this.utilityBox.add_child(button);
        }
        
        // Astra Monitor preferences
        let button = new St.Button({style_class: 'button'});
        button.child = new St.Icon({
            gicon: Utils.getLocalIcon('am-settings-symbolic'),
            fallback_icon_name: 'preferences-system-symbolic',
        });
        button.connect('clicked', () => {
            this.close(true);
            try {
                Utils.extension.openPreferences();
            } catch (err) {
                Utils.log(`Error opening settings: ${err}`);
            }
        });
        this.utilityBox.add_child(button);
        
        this.addToMenu(this.utilityBox, this.grid.getNumCols());
    }
    
    onOpen() {
        
    }
    
    onClose() {
        
    }
    
    update(code) {
        Utils.error('update() needs to be overridden');
    }
};