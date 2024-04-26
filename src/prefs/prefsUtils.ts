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
import Adw from 'gi://Adw';
import Gtk from 'gi://Gtk';
import Gdk from 'gi://Gdk';
import Gio from 'gi://Gio';

import { gettext as _ } from 'resource:///org/gnome/Shell/Extensions/js/extensions/prefs.js';

import Config, { TypeEnumStr } from '../config.js';
import Utils from '../utils/utils.js';

type RowProps = {
    title: string;
    subtitle?: string;
    iconName?: string;
    tabs?: number;
    useMarkup?: boolean;
};

type AdjustamentProps = {
    min: number;
    max: number;
    digits?: number;
    step?: number;
    page?: number;
};

type ColorCallback = (color: string) => void;

type Choice = { value: any; text: string; disabled?: boolean };

export default class PrefsUtils {
    public static expanded: Map<string, any>;

    public static addExpanderRow(
        props: RowProps,
        group: Adw.PreferencesGroup | Adw.ExpanderRow,
        groupTag: string,
        callback?: (expanded: boolean) => void
    ) {
        const tabs = props.tabs;
        delete props.tabs;

        if(props.iconName) {
            if(props.title) props.title = '  ' + props.title;
            if(props.subtitle) props.subtitle = '  ' + props.subtitle.replace('\n', '\n  ');
        }

        const data: any = {
            ...props,
            useMarkup: true,
        };

        const section = new Adw.ExpanderRow(data);
        if(tabs) section.add_prefix(new Gtk.Box({ marginStart: tabs * 20 }));

        section.connect('notify::expanded', widget => {
            if(callback) callback(widget.expanded);

            const expanderRow = PrefsUtils.expanded.get(groupTag);
            if(widget.expanded) {
                if(expanderRow && expanderRow !== widget) {
                    expanderRow.expanded = false;
                }
                PrefsUtils.expanded.set(groupTag, widget);
            } else {
                if(expanderRow === widget) {
                    PrefsUtils.expanded.delete(groupTag);
                }
            }
        });

        if((group as any).add) (group as Adw.PreferencesGroup).add(section);
        else (group as Adw.ExpanderRow).add_row(section);
        return section;
    }

    public static addLabelRow(
        props: RowProps,
        label: string,
        group: Adw.PreferencesGroup | Adw.ExpanderRow
    ) {
        const tabs = props.tabs;
        delete props.tabs;

        const row = new Adw.ActionRow(props);
        if(tabs) row.add_prefix(new Gtk.Box({ marginStart: tabs * 20 }));

        if((group as any).add) (group as Adw.PreferencesGroup).add(row);
        else (group as Adw.ExpanderRow).add_row(row);

        const labelWidget = new Gtk.Label({ label });
        row.add_suffix(labelWidget);
    }

    public static addTextInputRow(
        props: RowProps,
        setting: string,
        group: Adw.PreferencesGroup | Adw.ExpanderRow,
        reset?: string
    ) {
        const tabs = props.tabs;
        delete props.tabs;

        const row = new Adw.ActionRow(props);
        if(tabs) row.add_prefix(new Gtk.Box({ marginStart: tabs * 20 }));

        if((group as any).add) (group as Adw.PreferencesGroup).add(row);
        else (group as Adw.ExpanderRow).add_row(row);

        const entry = new Gtk.Entry({
            text: Config.get_string(setting),
            halign: Gtk.Align.END,
            valign: Gtk.Align.CENTER,
        });
        let timeoutId: GLib.Source;

        entry.connect('changed', widget => {
            clearTimeout(timeoutId);
            timeoutId = setTimeout(() => {
                Config.set(setting, widget.get_text(), 'string');
            }, 1000);
        });

        if(reset !== undefined) {
            const resetButton = new Gtk.Button({
                halign: Gtk.Align.END,
                valign: Gtk.Align.CENTER,
                hexpand: false,
                vexpand: false,
                iconName: 'edit-undo-symbolic',
                sensitive: true,
            });
            row.add_suffix(resetButton);

            resetButton.connect('clicked', () => {
                Config.set(setting, reset, 'string');
                entry.set_text(reset);
            });
            row.add_suffix(resetButton);
        }

        row.add_suffix(entry);
        row.activatableWidget = entry;
    }

    public static addButtonRow(
        props: RowProps,
        group: Adw.PreferencesGroup | Adw.ExpanderRow,
        callback?: (...args: any[]) => void
    ) {
        const tabs = props.tabs;
        delete props.tabs;

        if(props.iconName) {
            if(props.title) props.title = '  ' + props.title;
            if(props.subtitle) props.subtitle = '  ' + props.subtitle.replace('\n', '\n  ');
        }

        const row = new Adw.ActionRow(props);
        if(tabs) row.add_prefix(new Gtk.Box({ marginStart: tabs * 20 }));

        if((group as any).add) (group as Adw.PreferencesGroup).add(row);
        else (group as Adw.ExpanderRow).add_row(row);

        row.activatable = true;
        if(callback) row.connect('activated', callback);
        return row;
    }

    public static addLinkRow(
        props: RowProps,
        url: string,
        group: Adw.PreferencesGroup | Adw.ExpanderRow
    ) {
        const tabs = props.tabs;
        delete props.tabs;

        const row = new Adw.ActionRow({
            ...props,
            useMarkup: true,
        });
        if(tabs) row.add_prefix(new Gtk.Box({ marginStart: tabs * 20 }));

        if((group as any).add) (group as Adw.PreferencesGroup).add(row);
        else (group as Adw.ExpanderRow).add_row(row);

        const linkBtn = new Gtk.LinkButton({
            label: '',
            uri: url,
            halign: Gtk.Align.END,
            widthRequest: 1,
            opacity: 0,
            cursor: null,
        });
        row.add_suffix(linkBtn);
        row.activatableWidget = linkBtn;
    }

    public static addStatusLabel(
        props: RowProps,
        iconName: string,
        group: Adw.PreferencesGroup | Adw.ExpanderRow
    ) {
        const tabs = props.tabs;
        delete props.tabs;

        const row = new Adw.ActionRow(props);
        const box = new Gtk.Box({ orientation: Gtk.Orientation.HORIZONTAL, spacing: 10 });
        const icon = new Gtk.Image({ iconName: iconName });
        icon.set_margin_end(10);
        box.append(icon);
        row.add_prefix(box);
        if(tabs) row.add_prefix(new Gtk.Box({ marginStart: tabs * 20 }));
        if((group as any).add) (group as Adw.PreferencesGroup).add(row);
        else (group as Adw.ExpanderRow).add_row(row);

        return {
            row: row,
            icon: icon,
        };
    }

    public static addSwitchRow(
        props: RowProps,
        setting: string,
        group: Adw.PreferencesGroup | Adw.ExpanderRow
    ) {
        const tabs = props.tabs;
        delete props.tabs;

        if(props.iconName) {
            if(props.title) props.title = '  ' + props.title;
            if(props.subtitle) props.subtitle = '  ' + props.subtitle.replace('\n', '\n  ');
        }

        const row = new Adw.ActionRow(props);
        if(tabs) row.add_prefix(new Gtk.Box({ marginStart: tabs * 20 }));

        if((group as any).add) (group as Adw.PreferencesGroup).add(row);
        else (group as Adw.ExpanderRow).add_row(row);

        const toggle = new Gtk.Switch({
            active: Config.get_boolean(setting),
            halign: Gtk.Align.END,
            valign: Gtk.Align.CENTER,
        });
        Config.bind(setting, toggle, 'active', Gio.SettingsBindFlags.DEFAULT);

        row.add_suffix(toggle);
        row.activatableWidget = toggle;
    }

    public static addColorRow(
        props: RowProps,
        setting: string | ColorCallback,
        group: Adw.PreferencesGroup | Adw.ExpanderRow,
        reset?: string
    ) {
        const tabs = props.tabs;
        delete props.tabs;

        if(props.iconName) {
            if(props.title) props.title = '  ' + props.title;
            if(props.subtitle) props.subtitle = '  ' + props.subtitle.replace('\n', '\n  ');
        }

        const isCallback = typeof setting === 'function';

        const row = new Adw.ActionRow(props);
        if(tabs) row.add_prefix(new Gtk.Box({ marginStart: tabs * 20 }));

        if((group as any).add) (group as Adw.PreferencesGroup).add(row);
        else (group as Adw.ExpanderRow).add_row(row);

        const button = new Gtk.ColorButton();
        {
            const rgba = new Gdk.RGBA();
            if(isCallback) rgba.parse('rgba(0,0,0,0)');
            else rgba.parse(Config.get_string(setting) || 'rgba(0,0,0,0)');
            button.useAlpha = true;
            button.set_rgba(rgba);
        }

        button.connect('color-set', widget => {
            if(isCallback) setting(widget.get_rgba().to_string() || '');
            else Config.set(setting, widget.get_rgba().to_string(), 'string');
        });

        if(!isCallback) {
            Config.connect(this, 'changed::' + setting, () => {
                const rgba = new Gdk.RGBA();
                rgba.parse(Config.get_string(setting) || 'rgba(0,0,0,0)');
                button.set_rgba(rgba);
            });
        }

        if(reset !== undefined) {
            const resetButton = new Gtk.Button({
                halign: Gtk.Align.END,
                valign: Gtk.Align.CENTER,
                hexpand: false,
                vexpand: false,
                iconName: 'edit-undo-symbolic',
                sensitive: true,
            });
            row.add_suffix(resetButton);

            resetButton.connect('clicked', () => {
                if(isCallback) setting(reset);
                else Config.set(setting, reset, 'string');

                const rgba = new Gdk.RGBA();
                rgba.parse(reset);
                button.set_rgba(rgba);
            });
        }

        row.add_suffix(button);
        row.activatableWidget = button;
    }

    public static addDropRow(
        props: RowProps,
        values: Choice[] | Promise<Choice[]>,
        setting: string,
        group: Adw.PreferencesGroup | Adw.ExpanderRow,
        type: TypeEnumStr = 'int',
        reset?: string
    ) {
        const tabs = props.tabs;
        delete props.tabs;

        let selected = -1;
        let savedValue: any;

        switch(type) {
            case 'boolean':
                savedValue = Config.get_boolean(setting);
                break;
            case 'string':
                savedValue = Config.get_string(setting);
                break;
            case 'int':
                savedValue = Config.get_int(setting);
                break;
            case 'number':
                savedValue = Config.get_double(setting);
                break;
            case 'json':
                savedValue = Config.get_string(setting);
                break;
            default:
                savedValue = Config.get_value(setting);
                break;
        }

        const row = new Adw.ActionRow(props);
        if(tabs) row.add_prefix(new Gtk.Box({ marginStart: tabs * 20 }));

        if((group as any).add) (group as Adw.PreferencesGroup).add(row);
        else (group as Adw.ExpanderRow).add_row(row);

        const addChoices = (choices: Choice[]) => {
            const stringList = new Gtk.StringList();

            for(const choice of choices) stringList.append(choice.text);

            choices.forEach((choice, index) => {
                let value = choice.value;
                if(type === 'json') value = JSON.stringify(value);
                if(value === savedValue) selected = index;
            });

            const select = new Gtk.DropDown({
                model: stringList,
                selected,
                halign: Gtk.Align.END,
                valign: Gtk.Align.CENTER,
                hexpand: false,
                vexpand: false,
            });

            if(reset !== undefined) {
                const resetButton = new Gtk.Button({
                    halign: Gtk.Align.END,
                    valign: Gtk.Align.CENTER,
                    hexpand: false,
                    vexpand: false,
                    iconName: 'edit-undo-symbolic',
                    sensitive: true,
                });
                resetButton.connect('clicked', () => {
                    choices.forEach((choice, index) => {
                        let value = choice.value;
                        if(type === 'json') value = JSON.stringify(value);
                        if(value === reset) selected = index;
                    });
                    select.selected = selected;
                    const selectedChoice = choices[selected];
                    if(selectedChoice !== undefined) {
                        if(type === 'json')
                            Config.set(setting, JSON.stringify(selectedChoice.value), 'string');
                        else Config.set(setting, selectedChoice.value, type);
                    }
                });
                row.add_suffix(resetButton);
            }

            row.add_suffix(select);
            row.activatableWidget = select;

            if(choices[selected] && choices[selected].text)
                select.set_tooltip_text(choices[selected].text);
            select.connect('notify::selected', widget => {
                const selectedIndex = widget.selected;
                const selectedChoice = choices[selectedIndex];
                if(selectedChoice !== undefined) {
                    row.set_tooltip_text(selectedChoice.text);

                    if(type === 'json')
                        Config.set(setting, JSON.stringify(selectedChoice.value), 'string');
                    else Config.set(setting, selectedChoice.value, type);
                }
            });
        };

        if(values instanceof Promise) {
            values.then(addChoices);
        } else {
            addChoices(values);
        }
    }

    public static addComboRow(
        props: RowProps,
        values: Choice[] | Promise<Choice[]>,
        setting: string,
        group: Adw.PreferencesGroup | Adw.ExpanderRow,
        type: TypeEnumStr = 'int',
        reset?: string
    ) {
        const tabs = props.tabs;
        delete props.tabs;

        let selected = -1;
        let savedValue: any;

        switch(type) {
            case 'boolean':
                savedValue = Config.get_boolean(setting);
                break;
            case 'string':
                savedValue = Config.get_string(setting);
                break;
            case 'int':
                savedValue = Config.get_int(setting);
                break;
            case 'number':
                savedValue = Config.get_double(setting);
                break;
            case 'json':
                savedValue = Config.get_string(setting);
                break;
            default:
                savedValue = Config.get_value(setting);
                break;
        }

        const row = new Adw.ActionRow(props);
        if(tabs) row.add_prefix(new Gtk.Box({ marginStart: tabs * 20 }));

        if((group as any).add) (group as Adw.PreferencesGroup).add(row);
        else (group as Adw.ExpanderRow).add_row(row);

        const addChoices = (choices: Choice[]) => {
            const store = new Gtk.ListStore();
            store.set_column_types([GObject.TYPE_STRING, GObject.TYPE_BOOLEAN]);

            for(const choice of choices) {
                const iter = store.append();
                store.set(iter, [0, 1], [choice.text, choice.disabled !== true]);
            }
            choices.forEach((choice, index) => {
                let value = choice.value;
                if(type === 'json') value = JSON.stringify(value);
                if(value === savedValue) selected = index;
            });

            const select = new Gtk.ComboBox({
                model: store,
                halign: Gtk.Align.END,
                valign: Gtk.Align.CENTER,
                hexpand: false,
                vexpand: false,
            });
            select.set_active(selected);

            const renderer = new Gtk.CellRendererText();
            select.pack_start(renderer, true);
            select.add_attribute(renderer, 'text', 0);
            select.add_attribute(renderer, 'sensitive', 1);

            if(reset !== undefined) {
                const resetButton = new Gtk.Button({
                    halign: Gtk.Align.END,
                    valign: Gtk.Align.CENTER,
                    hexpand: false,
                    vexpand: false,
                    iconName: 'edit-undo-symbolic',
                    sensitive: true,
                });
                resetButton.connect('clicked', () => {
                    for(let index = 0; index < choices.length; index++) {
                        const choice = choices[index];
                        let value = choice.value;
                        if(type === 'json') value = JSON.stringify(value);

                        if(value === reset) {
                            selected = index;
                            break;
                        }
                    }
                    select.set_active(selected);
                    const selectedChoice = choices[selected];
                    if(selectedChoice !== undefined) {
                        if(type === 'json')
                            Config.set(setting, JSON.stringify(selectedChoice.value), 'string');
                        else Config.set(setting, selectedChoice.value, type);
                    }
                });
                row.add_suffix(resetButton);
            }

            row.add_suffix(select);
            row.activatableWidget = select;

            if(choices[selected] && choices[selected].text)
                select.set_tooltip_text(choices[selected].text);
            select.connect('notify::active', () => {
                const selectedIndex = select.get_active();
                const selectedChoice = choices[selectedIndex];
                if(selectedChoice !== undefined) {
                    row.set_tooltip_text(selectedChoice.text);

                    if(type === 'json')
                        Config.set(setting, JSON.stringify(selectedChoice.value), 'string');
                    else Config.set(setting, selectedChoice.value, type);
                }
            });
        };

        if(values instanceof Promise) {
            values.then(addChoices);
        } else {
            addChoices(values);
        }
    }

    public static addSpinRow(
        props: RowProps,
        setting: string,
        group: Adw.PreferencesGroup | Adw.ExpanderRow,
        adj: AdjustamentProps,
        numeric: boolean = true,
        reset?: number
    ) {
        const tabs = props.tabs;
        delete props.tabs;

        if(props.iconName) {
            if(props.title) props.title = '  ' + props.title;
            if(props.subtitle) props.subtitle = '  ' + props.subtitle.replace('\n', '\n  ');
        }

        const adjustment = new Gtk.Adjustment({
            lower: adj.min,
            upper: adj.max,
            stepIncrement: adj.step ?? 1,
            pageIncrement: adj.page ?? 10,
            value: (adj.digits || 0) === 0 ? Config.get_int(setting) : Config.get_double(setting),
        });

        const row = new Adw.ActionRow(props);
        if(tabs) row.add_prefix(new Gtk.Box({ marginStart: tabs * 20 }));

        const spinButton = new Gtk.SpinButton({
            halign: Gtk.Align.END,
            valign: Gtk.Align.CENTER,
            hexpand: false,
            vexpand: false,
            xalign: 0.5,
            adjustment,
            digits: adj.digits || 0,
            numeric,
        });

        if(reset !== undefined) {
            const resetButton = new Gtk.Button({
                halign: Gtk.Align.END,
                valign: Gtk.Align.CENTER,
                hexpand: false,
                vexpand: false,
                iconName: 'edit-undo-symbolic',
                sensitive: true,
            });
            row.add_suffix(resetButton);

            resetButton.connect('clicked', () => {
                Config.set(setting, reset, (adj.digits || 0) === 0 ? 'int' : 'number');
                spinButton.value = reset;
            });
        }

        spinButton.connect('notify::value', widget => {
            Config.set(setting, widget.value, (adj.digits || 0) === 0 ? 'int' : 'number');
        });
        row.add_suffix(spinButton);
        row.activatableWidget = spinButton;

        if((group as any).add) (group as Adw.PreferencesGroup).add(row);
        else (group as Adw.ExpanderRow).add_row(row);
    }

    public static addFontRow(
        props: RowProps,
        setting: string,
        group: Adw.PreferencesGroup | Adw.ExpanderRow,
        reset?: string
    ) {
        if(!Utils.metadata) throw new Error('Metadata not found');

        const tabs = props.tabs;
        delete props.tabs;

        if(props.iconName) {
            if(props.title) props.title = '  ' + props.title;
            if(props.subtitle) props.subtitle = '  ' + props.subtitle.replace('\n', '\n  ');
        }

        const row = new Adw.ActionRow(props);
        if(tabs) row.add_prefix(new Gtk.Box({ marginStart: tabs * 20 }));

        const fontButton = new Gtk.FontButton({
            modal: true,
            halign: Gtk.Align.END,
            valign: Gtk.Align.CENTER,
            hexpand: false,
            vexpand: false,
            useSize: false,
            level: Gtk.FontChooserLevel.FAMILY,
            previewText: 'Astra Monitor v' + Utils.metadata.version,
            font: Config.get_string(setting),
        });

        fontButton.connect('font-set', widget => {
            Config.set(setting, widget.fontDesc.get_family(), 'string');
        });

        if(reset !== undefined) {
            const resetButton = new Gtk.Button({
                halign: Gtk.Align.END,
                valign: Gtk.Align.CENTER,
                hexpand: false,
                vexpand: false,
                iconName: 'edit-undo-symbolic',
                sensitive: true,
            });
            resetButton.connect('clicked', () => {
                Config.set(setting, reset, 'string');
                fontButton.font = reset;
            });
            row.add_suffix(resetButton);
        }

        row.add_suffix(fontButton);
        row.activatableWidget = fontButton;

        if((group as any).add) (group as Adw.PreferencesGroup).add(row);
        else (group as Adw.ExpanderRow).add_row(row);
    }

    public static addOrderingRows(
        config: string,
        group: Adw.PreferencesGroup | Adw.ExpanderRow,
        tabs: number = 0
    ) {
        const monitors = Config.get_json(config);
        for(let index = 0; index < monitors.length; index++) {
            const item = monitors[index] || '';
            PrefsUtils.OrderingItem(item, index, monitors.length, config, group, tabs + 1);
        }
    }

    public static OrderingItem(
        item: string,
        index: number,
        count: number,
        config: string,
        group: Adw.PreferencesGroup | Adw.ExpanderRow,
        tabs: number = 0
    ) {
        const row = new Adw.ActionRow({ title: `${index + 1}. ${Utils.capitalize(item, false)}` });
        if(tabs) row.add_prefix(new Gtk.Box({ marginStart: tabs * 20 }));

        let buttonUp;
        if(index > 0) {
            buttonUp = new Gtk.Button({ tooltipText: _('Move up') });

            buttonUp.connect('clicked', () => {
                const list = Config.get_json(config);
                const removed = list[index];
                list.splice(index, 1);
                list.splice(index - 1, 0, removed);
                Config.set(config, JSON.stringify(list), 'string');
            });
        } else {
            buttonUp = new Gtk.Button({ sensitive: false });
            buttonUp.set_opacity(0.0);
        }

        const upImg = new Gtk.Image({ iconName: 'go-up-symbolic', pixelSize: 12 });
        buttonUp.set_child(upImg);
        buttonUp.set_margin_top(10);
        buttonUp.set_margin_bottom(10);

        let buttonDown;
        if(index < count - 1) {
            buttonDown = new Gtk.Button({ tooltipText: _('Move down') });
            buttonDown.connect('clicked', () => {
                const list = Config.get_json(config);
                const removed = list[index];
                list.splice(index, 1);
                list.splice(index + 1, 0, removed);
                Config.set(config, JSON.stringify(list), 'string');
            });
        } else {
            buttonDown = new Gtk.Button({ sensitive: false });
            buttonDown.set_opacity(0.0);
        }

        const downImg = new Gtk.Image({ iconName: 'go-down-symbolic', pixelSize: 12 });
        buttonDown.set_child(downImg);
        buttonDown.set_margin_start(10);
        buttonDown.set_margin_top(10);
        buttonDown.set_margin_bottom(10);

        row.add_suffix(buttonUp);
        row.add_suffix(buttonDown);

        Config.connect(this, 'changed::' + config, () => {
            const list = Config.get_json(config);
            const newItem = list[index] || '';
            row.title = `${index + 1}. ${Utils.capitalize(newItem, false)}`;
        });

        if((group as any).add) (group as Adw.PreferencesGroup).add(row);
        else (group as Adw.ExpanderRow).add_row(row);
    }
}
