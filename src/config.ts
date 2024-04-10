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

import GLib from 'gi://GLib';
import Gio from 'gi://Gio';

export type TypeEnumStr = 'any' | 'int' | 'string' | 'boolean' | 'number' | 'json';

export default class Config {
    static settings?: Gio.Settings;

    static bindMap = new Map();
    static connectMap = new Map();

    static set(key: string, value: any, type: TypeEnumStr = 'any') {
        if(!Config.settings) throw new Error('Critical: Config.settings is not valid');

        if(type === 'boolean') Config.settings.set_boolean(key, value);
        else if(type === 'string') Config.settings.set_string(key, value);
        else if(type === 'int') Config.settings.set_int(key, value);
        else if(type === 'number') Config.settings.set_double(key, value);
        else if(type === 'json') Config.settings.set_string(key, JSON.stringify(value));
        else Config.settings.set_value(key, value);
    }

    static get_value(key: string): GLib.Variant {
        if(!Config.settings) throw new Error('Critical: Config.settings is not valid');
        return Config.settings.get_value(key);
    }

    static get_boolean(key: string): boolean {
        if(!Config.settings) throw new Error('Critical: Config.settings is not valid');
        return Config.settings.get_boolean(key);
    }

    static get_string(key: string): string | null {
        if(!Config.settings) throw new Error('Critical: Config.settings is not valid');
        return Config.settings.get_string(key);
    }

    static get_json(key: string): any {
        if(!Config.settings) throw new Error('Critical: Config.settings is not valid');

        try {
            const value = Config.settings.get_string(key);
            if(value !== null) return JSON.parse(value);
        } catch(e) {
            /* empty */
        }

        return null;
    }

    static get_int(key: string): number {
        if(!Config.settings) throw new Error('Critical: Config.settings is not valid');

        return Config.settings.get_int(key);
    }

    static get_double(key: string): number {
        if(!Config.settings) throw new Error('Critical: Config.settings is not valid');

        return Config.settings.get_double(key);
    }

    static bind(
        key: string,
        widget: any,
        property: string,
        flags: Gio.SettingsBindFlags = Gio.SettingsBindFlags.DEFAULT
    ) {
        if(!Config.settings) throw new Error('Critical: Config.settings is not valid');

        Config.settings.bind(key, widget, property, flags);

        if(!Config.bindMap.has(widget)) Config.bindMap.set(widget, {});
        Config.bindMap.get(widget)[property] = key;
    }

    static unbind(widget: any, property: string) {
        Gio.Settings.unbind(widget, property);
        if(Config.bindMap.has(widget)) delete Config.bindMap.get(widget)[property];
    }

    static connect(object: any, signal: string, callback: any) {
        if(!Config.settings) throw new Error('Critical: Config.settings is not valid');
        const id = Config.settings.connect(signal, callback);
        if(!Config.connectMap.has(object)) Config.connectMap.set(object, []);
        Config.connectMap.get(object).push({ id, signal });
        return id;
    }

    static disconnect(object: any, signal: string | null = null) {
        if(!Config.settings) throw new Error('Critical: Config.settings is not valid');
        if(!Config.connectMap.has(object)) return;
        const connections = Config.connectMap.get(object);
        for(const connection of connections) {
            if(signal && connection.signal !== signal) continue;
            Config.settings.disconnect(connection.id);

            const index = connections.indexOf(connection);
            if(index !== -1) connections.splice(index, 1);
        }
    }

    static disconnectAll(object: any) {
        this.disconnect(object);
    }

    static clear(widget: any) {
        if(!Config.settings) throw new Error('Critical: Config.settings is not valid');

        if(Config.bindMap.has(widget)) {
            const widgetBindings = Config.bindMap.get(widget);
            for(const property in widgetBindings) Gio.Settings.unbind(widget, property);
            Config.bindMap.delete(widget);
        }
        if(Config.connectMap.has(widget)) {
            const widgetConnections = Config.connectMap.get(widget);
            for(const connection of widgetConnections) Config.settings.disconnect(connection.id);
            Config.connectMap.delete(widget);
        }
    }

    static clearAll() {
        for(const widget of Config.bindMap.keys()) Config.clear(widget);
        for(const object of Config.connectMap.keys()) Config.clear(object);
    }
}
