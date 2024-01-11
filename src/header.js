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
import Atk from 'gi://Atk';
import Clutter from 'gi://Clutter';

import * as Main from 'resource:///org/gnome/shell/ui/main.js';

import Utils from './utils/utils.js';

/* global global */

export const Header = GObject.registerClass({
    
}, class HeaderBase extends St.Widget {
    constructor(name) {
        super({
            reactive: true,
            can_focus: true,
            track_hover: true,
            style_class: 'astra-monitor-header panel-button',
            accessible_name: name,
            accessible_role: Atk.Role.MENU,
            x_expand: true
        });
        this.name = name;
        
        let hbox = new St.BoxLayout();
        hbox.style_class = 'astra-monitor-header-box';
        this.add_child(hbox);
        this.box = hbox;
        
        //TODO: add settings for theme padding!?
        //this.connect('style-changed', this._onStyleChanged.bind(this));
        this._minHPadding = this._natHPadding = 0.0;
    }
    
    setMenu(menu) {
        this.menu = menu;
        
        this.menu.connect('open-state-changed', this._onOpenStateChanged.bind(this));
        this.menu.actor.connect('key-press-event', this._onMenuKeyPress.bind(this));
    }
    
    add_child(child) {
        if (this.box) {
            this.box.add_child(child);
        } else {
            super.add_child(child);
        }
    }
    
    insert_child_above(child, sibling) {
        if (this.box) {
            this.box.insert_child_above(child, sibling);
        } else {
            super.insert_child_above(child, sibling);
        }
    }
    
    insert_child_at_index(child, index) {
        if (this.box) {
            this.box.insert_child_at_index(child, index);
        } else {
            super.insert_child_at_index(child, index);
        }
    }
    
    insert_child_below(child, sibling) {
        if (this.box) {
            this.box.insert_child_below(child, sibling);
        } else {
            super.insert_child_below(child, sibling);
        }
    }
    
    remove_child(child) {
        if (this.box) {
            this.box.remove_child(child);
        } else {
            super.remove_child(child);
        }
    }
    
    update() {
        // Implement this method in subclasses
        Utils.error('update() needs to be overridden');
    }
    
    /**
     * SET OF FUNCTION FROM TOPHAT: https://github.com/fflewddur/tophat
     * Some of them are modified to fit the needs of this extension
     */
    
    vfunc_event(event) {
        if (this.menu &&
            (event.type() === Clutter.EventType.TOUCH_BEGIN ||
             event.type() === Clutter.EventType.BUTTON_PRESS)) {
            this.menu.toggle();
        }
        return Clutter.EVENT_PROPAGATE;
    }
    
    vfunc_hide() {
        super.vfunc_hide();
        if (this.menu) {
            this.menu.close();
        }
    }
    
    _onMenuKeyPress(actor, event) {
        if (global.focus_manager.navigate_from_event(event)) {
            return Clutter.EVENT_STOP;
        }
        
        let symbol = event.get_key_symbol();
        if (symbol === Clutter.KEY_Left || symbol === Clutter.KEY_Right) {
            let group = global.focus_manager.get_group(this);
            if (group) {
                let direction = symbol === Clutter.KEY_Left ? St.DirectionType.LEFT : St.DirectionType.RIGHT;
                group.navigate_focus(this, direction, false);
                return Clutter.EVENT_STOP;
            }
        }
        return Clutter.EVENT_PROPAGATE;
    }
    
    _onOpenStateChanged(menu, open) {
        if (open) {
            this.add_style_pseudo_class('active');
            
            if(this.menu)
                this.menu.onOpen();
            
        } else {
            this.remove_style_pseudo_class('active');
            
            if(this.menu)
                this.menu.onClose();
        }
        
        // Setting the max-height won't do any good if the minimum height of the
        // menu is higher then the screen; it's useful if part of the menu is
        // scrollable so the minimum height is smaller than the natural height
        let workArea = Main.layoutManager.getWorkAreaForMonitor(Main.layoutManager.primaryIndex);
        let scaleFactor = St.ThemeContext.get_for_stage(global.stage).scale_factor;
        let verticalMargins = this.menu.actor.margin_top + this.menu.actor.margin_bottom;
        
        // The workarea and margin dimensions are in physical pixels, but CSS
        // measures are in logical pixels, so make sure to consider the scale
        // factor when computing max-height
        let maxHeight = Math.round((workArea.height - verticalMargins) / scaleFactor);
        this.menu.actor.style = `max-height: ${maxHeight}px;`;
    }
    
    /*_onStyleChanged(actor) {
        let themeNode = actor.get_theme_node();
        
        this._minHPadding = themeNode.get_length('-minimum-hpadding');
        this._natHPadding = themeNode.get_length('-natural-hpadding');
    }*/
    
    vfunc_get_preferred_width(_forHeight) {
        let child = this.get_first_child();
        let minimumSize, naturalSize;
        
        if (child) {
            [minimumSize, naturalSize] = child.get_preferred_width(-1);
        } else {
            minimumSize = naturalSize = 0;
        }
        
        minimumSize += 2 * this._minHPadding;
        naturalSize += 2 * this._natHPadding;
        
        return [minimumSize, naturalSize];
    }
    
    vfunc_get_preferred_height(_forWidth) {
        let child = this.get_first_child();
        if (child) {
            return child.get_preferred_height(-1);
        }
        return [0, 0];
    }
    
    vfunc_allocate(box) {
        this.set_allocation(box);
        
        let child = this.get_first_child();
        if (!child) {
            return;
        }
        
        let [, natWidth] = child.get_preferred_width(-1);
        
        let availWidth = box.x2 - box.x1;
        let availHeight = box.y2 - box.y1;
        
        let childBox = new Clutter.ActorBox();
        if (natWidth + 2 * this._natHPadding <= availWidth) {
            childBox.x1 = this._natHPadding;
            childBox.x2 = availWidth - this._natHPadding;
        } else {
            childBox.x1 = this._minHPadding;
            childBox.x2 = availWidth - this._minHPadding;
        }
        
        childBox.y1 = 0;
        childBox.y2 = availHeight;
        
        child.allocate(childBox);
    }
    
    destroy() {
        if(this.menu) {
            this.menu.onClose();
            this.menu.destroy();
        }
        
        super.destroy();
    }
});