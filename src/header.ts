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
import Gio from 'gi://Gio';
import St from 'gi://St';
import Atk from 'gi://Atk';
import Clutter from 'gi://Clutter';

import Signal from './signal.js';
import Utils from './utils/utils.js';
import Config from './config.js';
import MenuBase from './menu.js';
import ProfilesMenu from './profiles/profilesMenu.js';

declare const global: any;

export default GObject.registerClass(
    class Header extends St.Widget {
        private menu?: MenuBase;
        private box: St.BoxLayout;

        private cachedHeight = { fill: -1, override: -1 };
        private waitForAllocation = false;
        private firstAllocation = true;

        constructor(name: string) {
            super({
                reactive: true,
                canFocus: true,
                trackHover: true,
                styleClass: 'panel-button astra-monitor-header',
                accessibleName: name,
                accessibleRole: Atk.Role.MENU,
                layoutManager: new Clutter.BinLayout(),
                xExpand: true,
                yExpand: true,
                xAlign: Clutter.ActorAlign.START,
                yAlign: Clutter.ActorAlign.FILL,
            });
            this.name = name;

            Utils.verbose(`Creating ${this.name}`);

            this.box = new St.BoxLayout({
                xExpand: true,
                yExpand: false,
                xAlign: Clutter.ActorAlign.START,
                yAlign: Clutter.ActorAlign.CENTER,
                styleClass: 'astra-monitor-header-box',
            });
            this.add_child(this.box);

            this.createTooltip();

            Signal.connect(this, 'button-press-event', (_widget, event) => {
                if(event.get_button() === 1) {
                    this.click();
                } else {
                    this.clickAlt();
                }
                return Clutter.EVENT_PROPAGATE;
            });

            Signal.connect(this, 'touch-event', (_widget, _event) => {
                this.click();
                return Clutter.EVENT_PROPAGATE;
            });

            Signal.connect(this, 'hide', () => {
                if(this.menu) this.menu.close(true);
            });

            Signal.connect(this, 'enter-event', () => {
                this.showTooltip();
            });

            Signal.connect(this, 'leave-event', () => {
                this.hideTooltip();
            });

            Config.connect(this, 'changed::headers-height-override', this.setStyle.bind(this));
            Signal.connect(this.box, 'notify::allocation', () => {
                Utils.lowPriorityTask(this.setStyle.bind(this));
            });

            if(this.showConfig)
                Config.bind(this.showConfig, this, 'visible', Gio.SettingsBindFlags.GET);

            Signal.connectAfter(this, 'notify::allocation', () => {
                if(this.waitForAllocation) {
                    this.waitForAllocation = false;
                    if(this.firstAllocation) this.firstAllocation = false;
                    Utils.lowPriorityTask(() => {
                        this.update();
                    });
                }
            });
        }

        public getMenu() {
            return this.menu;
        }

        setStyle() {
            if(!this.box.get_parent()) return;
            if(!this.box.has_allocation()) return;

            let fillHeight = this.box.get_parent()!.height ?? 0;
            const override = Config.get_int('headers-height-override');

            if(this.cachedHeight.fill === fillHeight && this.cachedHeight.override === override) {
                return;
            }
            this.cachedHeight = { fill: fillHeight, override };

            fillHeight -= 4; // 2px padding top and bottom

            const scaledFillHeight = Math.min(32, fillHeight) * this.scaleFactor;
            let style = `height:${scaledFillHeight}px;`;

            if(override > 15 && override < 80) style = `height:${override}px;`;

            this.box.set_style(style);
        }

        insert_child_above(child: any, sibling: any) {
            if(this.box) this.box.insert_child_above(child, sibling);
            else super.insert_child_above(child, sibling);
        }

        insert_child_at_index(child: any, index: number) {
            if(this.box) this.box.insert_child_at_index(child, index);
            else super.insert_child_at_index(child, index);
        }

        insert_child_below(child: any, sibling: any) {
            if(this.box) this.box.insert_child_below(child, sibling);
            else super.insert_child_below(child, sibling);
        }

        remove_child(child: any) {
            if(this.box) this.box.remove_child(child);
            else super.remove_child(child);
        }

        get showConfig() {
            return '';
        }

        click() {
            if(this.menu) this.menu.toggle();
        }

        clickAlt() {
            const profilesMenu = new ProfilesMenu(this, 0.5);
            profilesMenu.open(true);
        }

        setCompacted(compacted: boolean) {
            if(compacted) {
                this.visible = false;
            } else {
                const show = this.showConfig;
                this.visible = show === '' ? false : Config.get_boolean(show);
                if(this.visible) {
                    this.waitForAllocation = true;
                    if(this.firstAllocation) return;

                    /**! Fallback update after 2 frames at 60fps */
                    Utils.timeoutTask(() => {
                        this.update();
                    }, 33);
                }
            }
        }

        update() {
            // Implement this method in subclasses
            Utils.error('update() needs to be overridden');
        }

        setMenu(menu: MenuBase) {
            this.menu = menu;
            Signal.connect(this.menu, 'open-state-changed', this.onOpenMenu.bind(this));
        }

        onOpenMenu(_menu: any, open: boolean) {
            if(open) {
                this.add_style_pseudo_class('active');
                Utils.lowPriorityTask(() => {
                    this.menu?.onOpen();
                });
            } else {
                this.remove_style_pseudo_class('active');
                Utils.lowPriorityTask(() => {
                    this.menu?.onClose();
                });
            }

            return;

            /*
             * FUNCTION FROM TOPHAT: https://github.com/fflewddur/tophat
             * Not really working on my end, it needs a deeper look
             * Right now it's not a priority, menus are very short
             * Keep it here for future reference
            
            // Setting the max-height won't do any good if the minimum height of the
            // menu is higher then the screen; it's useful if part of the menu is
            // scrollable so the minimum height is smaller than the natural height
            const workArea = Main.layoutManager.getWorkAreaForMonitor(
                Main.layoutManager.primaryIndex
            );
            const scaleFactor = St.ThemeContext.get_for_stage(global.stage).scaleFactor;
            const verticalMargins = this.menu.actor.margin_top + this.menu.actor.margin_bottom;

            // The workarea and margin dimensions are in physical pixels, but CSS
            // measures are in logical pixels, so make sure to consider the scale
            // factor when computing max-height
            const maxHeight = Math.round((workArea.height - verticalMargins) / scaleFactor);
            this.menu.actor.style = `max-height: ${maxHeight}px;`;
            */
        }

        createTooltip() {}

        showTooltip() {}

        hideTooltip() {}

        get scaleFactor() {
            const themeContext = St.ThemeContext.get_for_stage(global.get_stage());
            if(themeContext.get_scale_factor) {
                return themeContext.get_scale_factor();
            }
            return 1;
        }

        override destroy() {
            Config.clear(this);
            Signal.clear(this);
            Signal.clear(this.menu);
            Signal.clear(this.box);

            this.menu?.destroy();
            this.menu = undefined as any;

            this.box.remove_all_children();
            this.box.destroy();
            this.remove_all_children();
            super.destroy();
        }
    }
);
