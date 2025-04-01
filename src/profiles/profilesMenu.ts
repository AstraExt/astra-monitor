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
import * as PopupMenu from 'resource:///org/gnome/shell/ui/popupMenu.js';
import * as Main from 'resource:///org/gnome/shell/ui/main.js';

import Config from '../config.js';
import Utils from '../utils/utils.js';

export default class ProfilesMenu extends PopupMenu.PopupMenu {
    private capturedEventId?: number;
    private freed = false;

    constructor(sourceActor: St.Widget, arrowAlignment: number) {
        const shellBarPosition = Config.get_string('shell-bar-position');
        const openingSide = shellBarPosition === 'top' ? St.Side.TOP : St.Side.BOTTOM;

        super(sourceActor, arrowAlignment, openingSide);
        this.actor.yExpand = true;

        Main.uiGroup.add_child(this.actor);

        this.createHeader();
        this.createProfiles();

        this.capturedEventId = global.stage.connect('captured-event', (_actor, event) => {
            if(event.type() === Clutter.EventType.BUTTON_PRESS) {
                const [x, y] = event.get_coords();
                const [menuX, menuY] = this.actor.get_transformed_position();
                const [menuWidth, menuHeight] = this.actor.get_transformed_size();

                // Check if the click is outside the bounds of the menu
                if(x < menuX || x > menuX + menuWidth || y < menuY || y > menuY + menuHeight) {
                    this.close(true);
                    return Clutter.EVENT_STOP;
                }
            }
            return Clutter.EVENT_PROPAGATE;
        });
    }

    private createHeader() {
        const header = new PopupMenu.PopupMenuItem(_('Profiles'), {
            reactive: true,
            can_focus: false,
        });
        header.actor.xAlign = Clutter.ActorAlign.CENTER;
        header.sensitive = true;
        header.label.style = 'font-weight:bold;font-style:italic;';
        this.addMenuItem(header);

        header.connect('activate', () => {
            try {
                Config.set('queued-pref-category', 'profiles', 'string');
                Utils.extension?.openPreferences();
            } catch(e) {
                /* EMPTY */
            }

            this.close(true);
        });
    }

    private createProfiles() {
        const currentProfile = Config.get_string('current-profile');
        const profiles = Config.get_json('profiles');
        for(const profile in profiles) {
            const pre = profile === currentProfile ? '→ ' : '';

            const item = new PopupMenu.PopupMenuItem(pre + profile, {
                reactive: profile !== currentProfile,
                can_focus: false,
            });
            item.actor.xAlign = Clutter.ActorAlign.CENTER;
            (item.label.style = profile === currentProfile ? 'font-weight: bold;' : ''),
                (item.sensitive = profile !== currentProfile),
                this.addMenuItem(item);

            item.connect('activate', () => {
                Config.set('current-profile', profile, 'string');
                Utils.lowPriorityTask(Config.syncCurrentProfile);
                this.close(true);
            });
        }
    }

    public override close(animate: boolean): void {
        super.close(animate);

        if(this.capturedEventId) {
            global.stage.disconnect(this.capturedEventId);
            this.capturedEventId = undefined;
        }

        if(this.freed) return;
        this.freed = true;

        this.removeAll();
        Main.uiGroup.remove_child(this.actor);
        this.destroy();
    }
}
