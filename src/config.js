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

import GLib from 'gi://GLib';
import Gio from 'gi://Gio';

export default class Config {
    /**
     * @type {import('gi://Gio').default.Settings}
     * @description Settings for this extension.
     */
    static settings;
    
    static bindMap = new Map();
    static connectMap = new Map();

    /**
     * 
     * @param {string} key 
     * @param {*} value 
     * @param {'any'|'boolean'|'string'|'int'|'number'} type 
     */
    static set(key, value, type = 'any') {
        if(type === 'boolean')
            Config.settings.set_boolean(key, value);
        else if(type === 'string')
            Config.settings.set_string(key, value);
        else if(type === 'int')
            Config.settings.set_int(key, value);
        else if(type === 'number')
            Config.settings.set_double(key, value);
        else
            Config.settings.set_value(key, value);
    }

    /**
     * 
     * @param {string} key
     * @returns {GLib.Variant}
     */
    static get_value(key) {
        return Config.settings.get_value(key);
    }

    /**
     * 
     * @param {string} key 
     * @returns {boolean}
     */
    static get_boolean(key) {
        return Config.settings.get_boolean(key);
    }

    /**
     * 
     * @param {string} key 
     * @returns {string}
     */
    static get_string(key) {
        return Config.settings.get_string(key);
    }
    
    /**
     * 
     * @param {string} key 
     * @returns {any}
     */
    static get_json(key) {
        try {
            return JSON.parse(Config.settings.get_string(key));
        }
        catch(e) {
            return null;
        }
    }

    /**
     * 
     * @param {string} key
     * @returns {number}
     */
    static get_int(key) {
        return Config.settings.get_int(key);
    }

    /**
     *  
     * @param {string} key
     * @returns {number}
     */
    static get_double(key) {
        return Config.settings.get_double(key);
    }

    static bind(key, widget, property, flags) {
        Config.settings.bind(key, widget, property, flags);

        if(!Config.bindMap.has(widget))
            Config.bindMap.set(widget, {});
        Config.bindMap.get(widget)[property] = key;
    }

    static unbind(widget, property) {
        Gio.Settings.unbind(widget, property);
        if(Config.bindMap.has(widget))
            delete Config.bindMap.get(widget)[property];
    }

    static connect(object, signal, callback) {
        const id = Config.settings.connect(signal, callback);
        if(!Config.connectMap.has(object))
            Config.connectMap.set(object, []);
        Config.connectMap.get(object).push({ id, signal });
        return id;
    }
    
    static disconnect(id) {
        Config.settings.disconnect(id);
    }
    
    static disconnectAll(object, signal = null) {
        if(!Config.connectMap.has(object))
            return;
        const connections = Config.connectMap.get(object);
        for(const connection of connections) {
            if(signal && connection.signal !== signal)
                continue;
            Config.settings.disconnect(connection.id);
        }
    }
    
    static clear(widget) {
        if(Config.bindMap.has(widget)) {
            const widgetBindings = Config.bindMap.get(widget);
            for(const property in widgetBindings)
                Gio.Settings.unbind(widget, property);
            Config.bindMap.delete(widget);
        }
        if(Config.connectMap.has(widget)) {
            const widgetConnections = Config.connectMap.get(widget);
            for(const connection of widgetConnections)
                Config.settings.disconnect(connection.id);
            Config.connectMap.delete(widget);
        }
    }
    
    static clearAll() {
        for(const widget of Config.bindMap.keys()) {
            Config.clear(widget);
        }
        for(const object of Config.connectMap.keys()) {
            Config.clear(object);
        }
    }
};