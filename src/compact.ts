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
import GLib from 'gi://GLib';
import St from 'gi://St';
import Clutter from 'gi://Clutter';

import Header from './header.js';
import Config from './config.js';
import Utils from './utils/utils.js';

export default GObject.registerClass(
    class CompactHeader extends Header {
        protected icon!: St.Icon;
        protected iconNames = ['am-arrow-left-symbolic', 'am-arrow-right-symbolic'];

        protected panel = 'right';
        protected activation = 'both';
        protected compacted = false;
        protected hovering = false;
        protected compactCallback?: (extended: boolean) => void;

        constructor() {
            super('Compact Header');
            this.panel = Config.get_string('panel-box') ?? 'right';
            this.activation = Config.get_string('compact-mode-activation') ?? 'both';
            this.compacted = Config.get_boolean('compact-mode');

            this.buildIcon();

            Config.connect(this, 'changed::compact-mode', () => {
                this.compacted = Config.get_boolean('compact-mode');
                if(Config.get_boolean('compact-mode-start-expanded')) this.compacted = false;

                this.refreshIcon();
                Utils.lowPriorityTask(() => {
                    this.compactCallback?.(this.compacted);
                }, GLib.PRIORITY_DEFAULT_IDLE);
            });

            this.connect('button-press-event', (_widget, _event) => {
                this.click();
                return Clutter.EVENT_PROPAGATE;
            });

            this.connect('touch-event', (_widget, _event) => {
                this.click();
                return Clutter.EVENT_PROPAGATE;
            });

            this.connect('enter-event', this.start_hover.bind(this));
            this.connect('leave-event', this.end_hover.bind(this));

            Config.connect(this, 'changed::compact-mode-activation', () => {
                this.compacted = Config.get_boolean('compact-mode');
                if(Config.get_boolean('compact-mode-start-expanded')) this.compacted = false;

                this.activation = Config.get_string('compact-mode-activation') ?? 'both';
            });

            Config.connect(this, 'changed::panel-box', () => {
                this.panel = Config.get_string('panel-box') ?? 'right';
            });

            Config.connect(
                this,
                'changed::compact-mode-compact-icon-custom',
                this.refreshIcon.bind(this)
            );
            Config.connect(
                this,
                'changed::compact-mode-expanded-icon-custom',
                this.refreshIcon.bind(this)
            );
        }

        click() {
            if(this.activation === 'hover') return;

            this.compacted = !this.compacted;
            this.refreshIcon();
            Utils.lowPriorityTask(() => {
                this.compactCallback?.(this.compacted);
            }, GLib.PRIORITY_DEFAULT_IDLE);
        }

        start_hover() {
            if(this.activation === 'click') return;
            if(this.panel === 'center') return;

            this.hovering = true;
            Utils.lowPriorityTask(() => {
                this.compactCallback?.(false);
            }, GLib.PRIORITY_DEFAULT_IDLE);
        }

        end_hover() {
            if(this.activation === 'click') return;
            if(this.panel === 'center') return;

            this.hovering = false;
            if(this.compacted) {
                Utils.lowPriorityTask(() => {
                    this.compactCallback?.(this.compacted);
                }, GLib.PRIORITY_DEFAULT_IDLE);
            }
        }

        startup() {
            if(Config.get_boolean('compact-mode-start-expanded')) {
                this.compacted = false;
                this.refreshIcon();

                Utils.lowPriorityTask(() => {
                    this.compactCallback?.(this.compacted);
                }, GLib.PRIORITY_DEFAULT_IDLE);
            }
        }

        buildIcon() {
            this.icon = new St.Icon({
                icon_size: 28,
                y_expand: true,
                x_expand: false,
                y_align: Clutter.ActorAlign.CENTER,
                x_align: Clutter.ActorAlign.CENTER,
                style: 'margin-left:0;margin-right:0;',
            });
            this.add_child(this.icon);

            this.refreshIcon();
            Config.connect(this, 'changed::panel-box', this.refreshIcon.bind(this));
        }

        refreshIcon() {
            let iconIndex = 0;
            const panelBox = Config.get_string('panel-box');
            if(panelBox === 'left') iconIndex = this.compacted ? 1 : 0;
            else iconIndex = this.compacted ? 0 : 1;
            const iconName = this.iconNames[iconIndex];
            const gicon = Utils.getLocalIcon(iconName);
            if(gicon) {
                this.icon.icon_name = '';
                this.icon.gicon = gicon;
            }

            if(this.compacted) {
                const compactIcon = Config.get_string('compact-mode-compact-icon-custom');
                if(compactIcon) {
                    this.icon.icon_name = compactIcon;
                }
            } else if(!this.compacted) {
                const expandedIcon = Config.get_string('compact-mode-expanded-icon-custom');
                if(expandedIcon) {
                    this.icon.icon_name = expandedIcon;
                }
            }
        }

        update() {}

        compact(callback: (extended: boolean) => void) {
            this.compactCallback = callback;

            Utils.lowPriorityTask(() => {
                this.compactCallback?.(this.compacted);
            }, GLib.PRIORITY_DEFAULT_IDLE);
        }

        destroy() {
            Config.clear(this);

            super.destroy();
        }
    }
);
