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
import GLib from 'gi://GLib';

import { gettext as _ } from 'resource:///org/gnome/shell/extensions/extension.js';
import * as PopupMenu from 'resource:///org/gnome/shell/ui/popupMenu.js';
import * as Main from 'resource:///org/gnome/shell/ui/main.js';

import Signal from './signal.js';
import Utils from './utils/utils.js';
import Grid from './grid.js';
import Config from './config.js';
import Monitor from './monitor.js';

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

type OpenUpdateResponseHandler = {
    requestUpdate: () => void;
    requestStarted: boolean;
    waitingForFirstResponse: boolean;
    waitingForSecondResponse: boolean;
    followUp: boolean;
};

const LOADING_ICON_STYLE =
    'icon-size:1em;min-width:1.2em;margin-right:0.25em;';

export default class MenuBase extends PopupMenu.PopupMenu {
    public static openingSide: St.Side = St.Side.RIGHT;
    private static spinningLoadingIcons: Set<St.Icon> = new Set();
    private static loadingIconDestroySignals: Map<St.Icon, number> = new Map();
    private static loadingSpinTimer: number = 0;
    private static loadingSpinAngle: number = 0;
    private static loadingLabels: WeakMap<
        St.Label,
        {
            icon: St.Icon;
        }
    > = new WeakMap();

    public name: string;
    private statusMenu: PopupMenu.PopupMenuSection;
    private grid: InstanceType<typeof Grid>;
    private utilityBox?: St.BoxLayout;

    private systemMonitorButton?: St.Button;
    private preferencesButton?: St.Button;

    private lastForcedUpdate: Map<string, number> = new Map();
    private openUpdateTimers: Map<string, number> = new Map();
    private openUpdateResponseHandlers: Map<string, OpenUpdateResponseHandler> = new Map();

    constructor(sourceActor: St.Widget, arrowAlignment: number, params: MenuProps = {}) {
        super(sourceActor, arrowAlignment, params.arrowSide ?? MenuBase.openingSide);

        this.name = params.name ?? 'Unnamed Menu';
        Utils.verbose(`Creating ${this.name}`);

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

    static createLoadingValue(label: St.Label): St.Widget {
        const box = new St.Widget({
            layoutManager: new Clutter.GridLayout({ orientation: Clutter.Orientation.HORIZONTAL }),
            xExpand: true,
            yAlign: Clutter.ActorAlign.CENTER,
        });
        const icon = new St.Icon({
            gicon: Utils.getLocalIcon('am-loading-symbolic'),
            fallbackIconName: 'dialog-information-symbolic',
            style: LOADING_ICON_STYLE,
            yAlign: Clutter.ActorAlign.CENTER,
        });
        icon.set_pivot_point(0.5, 0.5);
        icon.hide();
        box.add_child(icon);
        box.add_child(label);

        MenuBase.loadingLabels.set(label, {
            icon,
        });
        return box;
    }

    static setLoading(label: St.Label, loading: boolean) {
        const loadingData = MenuBase.loadingLabels.get(label);
        if(!loadingData) {
            if(loading) label.text = '';
            return;
        }

        if(loading) {
            label.text = '';
            MenuBase.startLoadingIcon(loadingData.icon);
        } else {
            MenuBase.stopLoadingIcon(loadingData.icon);
        }
    }

    static startLoadingIcon(icon: St.Icon) {
        if(MenuBase.spinningLoadingIcons.has(icon)) return;

        MenuBase.spinningLoadingIcons.add(icon);
        if(!MenuBase.loadingIconDestroySignals.has(icon)) {
            const destroyId = icon.connect('destroy', () => {
                MenuBase.removeLoadingIcon(icon, false);
                if(MenuBase.spinningLoadingIcons.size === 0) MenuBase.stopLoadingSpinTimer();
            });
            MenuBase.loadingIconDestroySignals.set(icon, destroyId);
        }
        (icon as any).remove_all_transitions?.();
        icon.set_pivot_point(0.5, 0.5);
        icon.rotation_angle_z = MenuBase.loadingSpinAngle;
        icon.show();
        MenuBase.startLoadingSpinTimer();
    }

    static stopLoadingIcon(icon: St.Icon) {
        MenuBase.removeLoadingIcon(icon, true);
        if(MenuBase.spinningLoadingIcons.size === 0) MenuBase.stopLoadingSpinTimer();
    }

    private static removeLoadingIcon(icon: St.Icon, reset: boolean) {
        MenuBase.spinningLoadingIcons.delete(icon);

        const destroyId = MenuBase.loadingIconDestroySignals.get(icon);
        if(destroyId !== undefined) {
            try {
                icon.disconnect(destroyId);
            } catch(e) {
                /* icon is already being destroyed */
            }
            MenuBase.loadingIconDestroySignals.delete(icon);
        }

        if(!reset) return;

        try {
            (icon as any).remove_all_transitions?.();
            icon.rotation_angle_z = 0;
            icon.hide();
        } catch(e) {
            /* icon is already disposed */
        }
    }

    private static startLoadingSpinTimer() {
        if(MenuBase.loadingSpinTimer !== 0) return;

        MenuBase.loadingSpinTimer = GLib.timeout_add(GLib.PRIORITY_DEFAULT, 150, () => {
            if(MenuBase.spinningLoadingIcons.size === 0) {
                MenuBase.loadingSpinTimer = 0;
                return GLib.SOURCE_REMOVE;
            }

            MenuBase.loadingSpinAngle = (MenuBase.loadingSpinAngle + 18) % 360;
            for(const icon of MenuBase.spinningLoadingIcons) {
                try {
                    if(!icon.mapped) continue;
                    icon.rotation_angle_z = MenuBase.loadingSpinAngle;
                } catch(e) {
                    MenuBase.removeLoadingIcon(icon, false);
                }
            }
            return GLib.SOURCE_CONTINUE;
        });
    }

    private static stopLoadingSpinTimer() {
        if(MenuBase.loadingSpinTimer === 0) return;

        GLib.source_remove(MenuBase.loadingSpinTimer);
        MenuBase.loadingSpinTimer = 0;
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
            this.systemMonitorButton = new St.Button({ styleClass: 'button' });
            this.systemMonitorButton.child = new St.Icon({
                gicon: Utils.getLocalIcon('am-system-monitor-symbolic'),
                fallbackIconName: 'org.gnome.SystemMonitor-symbolic',
            });

            Signal.connect(this.systemMonitorButton, 'clicked', () => {
                this.close(true);
                app.activate();
            });
            this.utilityBox.add_child(this.systemMonitorButton);
        } else {
            // GNOME <=45
            app = appSys.lookup_app('gnome-system-monitor.desktop');
            if(app) {
                this.systemMonitorButton = new St.Button({ styleClass: 'button' });
                this.systemMonitorButton.child = new St.Icon({
                    gicon: Utils.getLocalIcon('am-system-monitor-symbolic'),
                    fallbackIconName: 'org.gnome.SystemMonitor-symbolic',
                });

                Signal.connect(this.systemMonitorButton, 'clicked', () => {
                    this.close(true);
                    app.activate();
                });
                this.utilityBox.add_child(this.systemMonitorButton);
            }
        }

        // Astra Monitor preferences
        this.preferencesButton = new St.Button({ styleClass: 'button' });
        this.preferencesButton.child = new St.Icon({
            gicon: Utils.getLocalIcon('am-settings-symbolic'),
            fallbackIconName: 'preferences-system-symbolic',
        });
        Signal.connect(this.preferencesButton, 'clicked', () => {
            this.close(true);
            try {
                if(category) Config.set('queued-pref-category', category, 'string');
                if(!Utils.extension) throw new Error('Extension not found');
                Utils.extension.openPreferences();
            } catch(err) {
                Utils.log(`Error opening settings: ${err}`);
            }
        });
        this.utilityBox.add_child(this.preferencesButton);

        this.addToMenu(this.utilityBox, this.grid.getNumCols());
    }

    async onOpen() {}

    onClose() {
        this.cancelOpenUpdates();
    }

    protected canUseCachedValue(
        monitor: Monitor,
        key: string,
        maxAgeMultiplier: number = 3
    ): boolean {
        return monitor.hasFreshValue(key, monitor.updateFrequencyMs * maxAgeMultiplier);
    }

    protected shouldRequestOpenUpdate(
        monitor: Monitor,
        openDelayMs: number = 100
    ): boolean {
        const dueIn = monitor.dueIn;
        return dueIn < 0 || dueIn - openDelayMs > monitor.updateFrequencyMs / 2;
    }

    protected scheduleOpenUpdate(
        code: string,
        monitor: Monitor,
        requestUpdate: () => void,
        openDelayMs: number = 100
    ) {
        this.cancelOpenUpdate(code);
        if(!this.shouldRequestOpenUpdate(monitor, openDelayMs)) return;

        const timerId = GLib.timeout_add(GLib.PRIORITY_DEFAULT, openDelayMs, () => {
            this.openUpdateTimers.delete(code);
            if(this.isOpen) requestUpdate();
            return GLib.SOURCE_REMOVE;
        });
        this.openUpdateTimers.set(code, timerId);
    }

    protected scheduleTwoSampleOpenUpdate(
        code: string,
        monitor: Monitor,
        requestUpdate: () => void,
        openDelayMs: number = 100
    ) {
        this.cancelOpenUpdate(code);

        const dueIn = monitor.dueIn;
        const followUp = dueIn < 0 || dueIn > 700;
        this.openUpdateResponseHandlers.set(code, {
            requestUpdate,
            requestStarted: false,
            waitingForFirstResponse: true,
            waitingForSecondResponse: false,
            followUp,
        });

        const timerId = GLib.timeout_add(GLib.PRIORITY_DEFAULT, openDelayMs, () => {
            this.openUpdateTimers.delete(code);
            if(this.isOpen) {
                const handler = this.openUpdateResponseHandlers.get(code);
                if(handler) handler.requestStarted = true;
                requestUpdate();
            } else {
                this.openUpdateResponseHandlers.delete(code);
            }
            return GLib.SOURCE_REMOVE;
        });
        this.openUpdateTimers.set(code, timerId);
    }

    protected bindOpenUpdate(
        code: string,
        callback: (...args: any[]) => void
    ): (...args: any[]) => void {
        return (...args: any[]) => {
            this.handleOpenUpdateResponse(code);
            callback(...args);
        };
    }

    private handleOpenUpdateResponse(code: string) {
        const handler = this.openUpdateResponseHandlers.get(code);
        if(!handler || !handler.requestStarted) return;

        if(handler.waitingForSecondResponse) {
            this.openUpdateResponseHandlers.delete(code);
            return;
        }

        if(!handler.waitingForFirstResponse) return;
        handler.waitingForFirstResponse = false;

        if(!handler.followUp) {
            handler.waitingForSecondResponse = true;
            return;
        }

        const followUpCode = `${code}:follow-up`;
        const timerId = GLib.timeout_add(GLib.PRIORITY_DEFAULT, 300, () => {
            this.openUpdateTimers.delete(followUpCode);
            if(this.isOpen) {
                handler.waitingForSecondResponse = true;
                handler.requestUpdate();
            } else {
                this.openUpdateResponseHandlers.delete(code);
            }
            return GLib.SOURCE_REMOVE;
        });
        this.openUpdateTimers.set(followUpCode, timerId);
    }

    protected isOpenUpdatePending(code: string): boolean {
        return this.openUpdateResponseHandlers.has(code);
    }

    protected cancelOpenUpdate(code: string) {
        const timerId = this.openUpdateTimers.get(code);
        if(timerId !== undefined) {
            GLib.source_remove(timerId);
            this.openUpdateTimers.delete(code);
        }

        const followUpCode = `${code}:follow-up`;
        const followUpTimerId = this.openUpdateTimers.get(followUpCode);
        if(followUpTimerId !== undefined) {
            GLib.source_remove(followUpTimerId);
            this.openUpdateTimers.delete(followUpCode);
        }

        this.openUpdateResponseHandlers.delete(code);
    }

    protected cancelOpenUpdates() {
        for(const timerId of this.openUpdateTimers.values()) {
            GLib.source_remove(timerId);
        }
        this.openUpdateTimers.clear();
        this.openUpdateResponseHandlers.clear();
    }

    protected updateFreshOrShowLoading(
        monitor: Monitor,
        key: string,
        code: string,
        showLoading: () => void
    ): boolean {
        if(this.canUseCachedValue(monitor, key)) {
            this.update(code, true);
            return true;
        }

        showLoading();
        return false;
    }

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

    override destroy(): void {
        this.close(false);
        Config.clear(this);
        Signal.clear(this);
        Signal.clear(this.systemMonitorButton);
        Signal.clear(this.preferencesButton);

        this.onClose();

        this.systemMonitorButton?.destroy();
        this.systemMonitorButton = undefined as any;

        this.preferencesButton?.destroy();
        this.preferencesButton = undefined as any;

        this.grid?.destroy();
        this.grid = undefined as any;

        this.statusMenu?.destroy();
        this.statusMenu = undefined as any;

        this.removeAll();
        Main.uiGroup.remove_child(this.actor);
        super.destroy();
    }
}
