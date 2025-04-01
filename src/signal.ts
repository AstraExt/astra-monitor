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

export default class Signal {
    static connectMap = new Map();
    static connectAfterMap = new Map();

    static connect(subject: any, signal: string, callback: (...args: any[]) => any) {
        if(!Signal.connectMap) Signal.connectMap = new Map();

        const id = subject.connect(signal, callback);
        if(!Signal.connectMap.has(subject)) {
            Signal.connectMap.set(subject, []);
        }
        Signal.connectMap.get(subject).push({ id, signal });

        subject.connect('destroy', () => {
            Signal.disconnect(subject);
        });
        return id;
    }

    static connectAfter(subject: any, signal: string, callback: (...args: any[]) => any) {
        if(!Signal.connectAfterMap) Signal.connectAfterMap = new Map();

        const id = subject.connect_after(signal, callback);
        if(!Signal.connectAfterMap.has(subject)) Signal.connectAfterMap.set(subject, []);
        Signal.connectAfterMap.get(subject).push({ id, signal });

        subject.connect('destroy', () => {
            Signal.disconnectAfter(subject);
        });
        return id;
    }

    static disconnect(subject: any, signal: string | null = null) {
        if(!Signal.connectMap) return;
        if(!Signal.connectMap.has(subject)) return;

        const connections = Signal.connectMap.get(subject);
        const remainingConnections = [];

        for(const connection of connections) {
            if(signal && connection.signal !== signal) {
                remainingConnections.push(connection);
                continue;
            }
            subject.disconnect(connection.id);
        }

        if(remainingConnections.length === 0) {
            Signal.connectMap.delete(subject);
        } else if(signal) {
            Signal.connectMap.set(subject, remainingConnections);
        }
    }

    static disconnectAfter(subject: any, signal: string | null = null) {
        if(!Signal.connectAfterMap) return;
        if(!Signal.connectAfterMap.has(subject)) return;

        const connections = Signal.connectAfterMap.get(subject);
        const remainingConnections = [];

        for(const connection of connections) {
            if(signal && connection.signal !== signal) {
                remainingConnections.push(connection);
                continue;
            }
            subject.disconnect(connection.id);
        }

        if(remainingConnections.length === 0) {
            Signal.connectAfterMap.delete(subject);
        } else if(signal) {
            Signal.connectAfterMap.set(subject, remainingConnections);
        }
    }

    static disconnectAll(subject: any) {
        Signal.disconnect(subject);
        Signal.disconnectAfter(subject);
    }

    static clear(subject: any) {
        Signal.disconnect(subject);
        Signal.disconnectAfter(subject);
    }

    static clearAll() {
        for(const subject of Signal.connectMap.keys()) Signal.clear(subject);
        for(const subject of Signal.connectAfterMap.keys()) Signal.clear(subject);
    }
}
