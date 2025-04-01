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
import Utils from './utils/utils.js';

export type TypeEnumStr = 'any' | 'int' | 'string' | 'boolean' | 'number' | 'json';

export default class Config {
    static settingsTransaction: boolean = false;
    static settings?: Gio.Settings;

    static bindMap = new Map();
    static connectMap = new Map();
    static connectAfterMap = new Map();
    static syncMap = new Map();

    static readonly globalSettingsKeys = [
        'debug-mode',
        'queued-pref-category',
        'current-profile',
        'profiles',

        //Deprecated keys
        'processor-menu-gpu',
        'processor-menu-gpu-color',
        'headers-height',
        'gpu-main',

        //Experimental features
        'experimental-features',
    ];

    static readonly experimentalFeatures = ['ps_subprocess'];

    static set(key: string, value: any, type: TypeEnumStr = 'any') {
        if(!Config.settings) throw new Error('Critical: Config.settings is not valid');

        if(type === 'boolean') {
            if(Config.get_boolean(key) !== value) {
                Config.settings.set_boolean(key, value);
            }
        } else if(type === 'string') {
            if(Config.get_string(key) !== value) {
                Config.settings.set_string(key, value);
            }
        } else if(type === 'int') {
            if(Config.get_int(key) !== value) {
                Config.settings.set_int(key, value);
            }
        } else if(type === 'number') {
            if(Config.get_double(key) !== value) {
                Config.settings.set_double(key, value);
            }
        } else if(type === 'json') {
            if(Config.get_string(key) !== JSON.stringify(value)) {
                Config.settings.set_string(key, JSON.stringify(value));
            }
        } else Config.settings.set_value(key, value);
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

    static reset(key: string) {
        const settings = Config.settings;
        if(!settings) return;

        const schema = settings.settingsSchema.get_key(key);
        const type = schema.get_value_type();

        // not using settings.reset(key) because it's clearing all bindings

        if(type.equal(new GLib.VariantType('s'))) {
            if(Config.get_string(key) !== schema.get_default_value().get_string()[0]) {
                Config.settings?.set_string(key, schema.get_default_value().get_string()[0]);
                //Config.settings?.reset(key);
            }
        } else if(type.equal(new GLib.VariantType('b'))) {
            if(Config.get_boolean(key) !== schema.get_default_value().get_boolean()) {
                Config.settings?.set_boolean(key, schema.get_default_value().get_boolean());
                //Config.settings?.reset(key);
            }
        } else if(type.equal(new GLib.VariantType('i'))) {
            if(Config.get_int(key) !== schema.get_default_value().get_int32()) {
                Config.settings?.set_int(key, schema.get_default_value().get_int32());
                //Config.settings?.reset(key);
            }
        } else if(type.equal(new GLib.VariantType('d'))) {
            if(Config.get_double(key) !== schema.get_default_value().get_double()) {
                Config.settings?.set_double(key, schema.get_default_value().get_double());
                //Config.settings?.reset(key);
            }
        } else Utils.log('Unsupported type: ' + type);
    }

    static delay() {
        Config.settings?.delay();
    }

    static apply() {
        Config.settings?.apply();
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

    static connectAfter(object: any, signal: string, callback: any) {
        if(!Config.settings) throw new Error('Critical: Config.settings is not valid');
        const id = Config.settings.connect_after(signal, callback);
        if(!Config.connectAfterMap.has(object)) Config.connectAfterMap.set(object, []);
        Config.connectAfterMap.get(object).push({ id, signal });
        return id;
    }

    static disconnect(object: any, signal: string | null = null) {
        if(!Config.settings) return;
        if(!Config.connectMap.has(object)) return;
        const connections = Config.connectMap.get(object);
        for(const connection of connections) {
            if(signal && connection.signal !== signal) continue;
            Config.settings.disconnect(connection.id);

            const index = connections.indexOf(connection);
            if(index !== -1) connections.splice(index, 1);
        }
    }

    static disconnectAfter(object: any, signal: string | null = null) {
        if(!Config.settings) return;

        if(!Config.connectAfterMap.has(object)) return;
        const connections = Config.connectAfterMap.get(object);
        for(const connection of connections) {
            if(signal && connection.signal !== signal) continue;
            Config.settings.disconnect(connection.id);

            const index = connections.indexOf(connection);
            if(index !== -1) connections.splice(index, 1);
        }
    }

    static disconnectAll(object: any) {
        this.disconnect(object);
        this.disconnectAfter(object);
    }

    static clear(widget: any) {
        if(!Config.settings) return;

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
        if(Config.connectAfterMap.has(widget)) {
            const widgetConnections = Config.connectAfterMap.get(widget);
            for(const connection of widgetConnections) Config.settings.disconnect(connection.id);
            Config.connectAfterMap.delete(widget);
        }
        if(Config.syncMap.has(widget)) Config.syncMap.delete(widget);
    }

    static clearAll() {
        for(const widget of Config.bindMap.keys()) Config.clear(widget);
        for(const object of Config.connectMap.keys()) Config.clear(object);
        for(const object of Config.connectAfterMap.keys()) Config.clear(object);
        for(const object of Config.syncMap.keys()) Config.clear(object);
    }

    /** UTILS */
    static getCurrentSettingsData(skips: string[] = []): { [key: string]: any } {
        const settings = Config.settings;
        const exported: any = {};
        if(!settings) return exported;

        const keys = settings.list_keys();

        for(const key of keys) {
            if(skips.includes(key)) continue;

            const value = settings.get_value(key);
            const schema = settings.settingsSchema.get_key(key);
            const type = schema.get_value_type();

            if(type.equal(new GLib.VariantType('s'))) exported[key] = value.get_string()[0];
            else if(type.equal(new GLib.VariantType('b'))) exported[key] = value.get_boolean();
            else if(type.equal(new GLib.VariantType('i'))) exported[key] = value.get_int32();
            else if(type.equal(new GLib.VariantType('d')))
                exported[key] = Utils.roundFloatingPointNumber(value.get_double());
            else Utils.log('Unsupported type: ' + type);
        }
        return exported;
    }

    static exportSettings() {
        const exported = Config.getCurrentSettingsData();

        //order keys alphabetically
        const ordered: any = {};
        Object.keys(exported)
            .sort()
            .forEach(key => {
                ordered[key] = exported[key];
            });
        return JSON.stringify(ordered);
    }

    static importSettings(data: string) {
        if(!data) return;

        const imported = JSON.parse(data);
        if(!imported) return;

        const settings = Config.settings;
        if(!settings) return;

        Config.settingsTransaction = true;
        Config.delay();

        const keys = Object.keys(imported);
        for(const key of keys) {
            Config.reset(key);

            const value = imported[key];

            try {
                const schema = settings.settingsSchema.get_key(key);
                const type = schema.get_value_type();

                if(type.equal(new GLib.VariantType('s'))) Config.set(key, value, 'string');
                else if(type.equal(new GLib.VariantType('b'))) Config.set(key, value, 'boolean');
                else if(type.equal(new GLib.VariantType('i'))) Config.set(key, value, 'int');
                else if(type.equal(new GLib.VariantType('d'))) Config.set(key, value, 'number');
                else Utils.log('Unsupported type: ' + type);
            } catch(e: any) {
                Utils.error('Error importing settings', e);
            }
        }
        Config.apply();

        // Apply eventual fixes
        Utils.configUpdateFixes();
        Config.settingsTransaction = false;

        Config.syncCurrentProfile();
    }

    static resetSettings() {
        const settings = Config.settings;
        if(!settings) return;

        Config.settingsTransaction = true;
        Config.delay();

        const keys = settings.list_keys();
        for(const key of keys) {
            if(key === 'debug-mode') continue;
            Config.reset(key);
        }

        Config.apply();
        Config.settingsTransaction = false;

        Config.syncCurrentProfile();
    }

    static resetProfile() {
        const settings = Config.settings;
        if(!settings) return;

        Config.settingsTransaction = true;
        Config.delay();

        try {
            const keys = settings.list_keys();
            for(const key of keys) {
                if(Config.globalSettingsKeys.includes(key)) continue;

                Config.reset(key);
                Config.updatedProfilesConfig(key, true);
            }
        } catch(e) {
            Utils.log('Error resetting profile: ' + e);
        }

        Config.apply();
        Config.settingsTransaction = false;

        Config.syncCurrentProfile();
    }

    static updatedProfilesConfig(key: string, forced: boolean = false) {
        if(Config.settingsTransaction && !forced) return;

        const currentProfile = Config.get_string('current-profile') ?? 'default';
        const profilesData = Config.get_json('profiles');

        if(!profilesData) return;
        if(!profilesData[currentProfile]) return;

        const profile = profilesData[currentProfile];
        const value = Config.get_value(key);

        switch(value.get_type_string()) {
            case 's':
                profile[key] = Config.get_string(key);
                break;
            case 'i':
                profile[key] = Config.get_int(key);
                break;
            case 'd':
                profile[key] = Config.get_double(key);
                break;
            case 'b':
                profile[key] = Config.get_boolean(key);
                break;
            default:
                Utils.log('Unsupported type: ' + value.get_type_string());
                return;
        }
        Config.set('profiles', profilesData, 'json');
    }

    static addSyncListener(object: any, callback: () => void) {
        if(!Config.syncMap.has(object)) Config.syncMap.set(object, []);
        Config.syncMap.get(object).push(callback);
    }

    // Sync the current profile with the profiles data
    static syncCurrentProfile() {
        Config.settingsTransaction = true;
        Config.delay();

        const currentProfile = Config.get_string('current-profile');
        if(currentProfile) {
            const profiles = Config.get_json('profiles');
            if(profiles && Object.prototype.hasOwnProperty.call(profiles, currentProfile)) {
                for(const key of Object.keys(profiles[currentProfile])) {
                    if(Config.globalSettingsKeys.includes(key)) {
                        continue;
                    }

                    const value = profiles[currentProfile][key];
                    try {
                        const schema = Config.settings?.settingsSchema.get_key(key);
                        if(!schema) continue;

                        const type = schema.get_value_type();
                        if(type.equal(new GLib.VariantType('s'))) {
                            if(Config.get_string(key) !== value) {
                                Config.set(key, value, 'string');
                            }
                        } else if(type.equal(new GLib.VariantType('b'))) {
                            if(Config.get_boolean(key) !== value) {
                                Config.set(key, value, 'boolean');
                            }
                        } else if(type.equal(new GLib.VariantType('i'))) {
                            if(Config.get_int(key) !== value) {
                                Config.set(key, value, 'int');
                            }
                        } else if(type.equal(new GLib.VariantType('d'))) {
                            if(Config.get_double(key) !== value) {
                                Config.set(key, value, 'number');
                            }
                        } else Utils.log('Unsupported type: ' + type);
                    } catch(e: any) {
                        Utils.error('Error syncing profile', e);
                    }
                }
            }
        }

        Config.apply();
        Config.settingsTransaction = false;

        for(const callback of Config.syncMap.values()) {
            for(const cb of callback) cb();
        }
    }
}
