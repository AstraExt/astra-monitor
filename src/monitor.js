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

import Utils from './utils/utils.js';

export class Monitor {
    
    constructor() {
        this.timerID = null;
        
        this.listeners = {};
        this.usageHistory = {};
        this.enqueuedUpdates = [];
        
        //TODO: make this configurable (and move it into a function)
        this.usageHistoryLength = 200; // 200 * 1.5 seconds = 5 minutes
    }
    
    get updateFrequency() {
        Utils.log('UPDATE FREQUENCY MUST BE OVERWRITTEN');
        return -1;
    }
    
    start() {
        const updateFrequency = this.updateFrequency;
        if(this.timerID === null) {
            if(updateFrequency >= 0.1) {
                this.timerID = GLib.timeout_add(
                    GLib.PRIORITY_DEFAULT,
                    updateFrequency * 1000,
                    () => this.update()
                );
            }
        }
    }
    
    stop() {
        if(this.timerID) {
            GLib.source_remove(this.timerID);
            this.timerID = null;
        }
        this.resetData();
    }
    
    resetData() {
        this.usageHistory = {};
        this.enqueuedUpdates = [];
    }
    
    restart() {
        this.stop();
        this.start();
    }
    
    startListeningFor(key) {
        
    }
    
    stopListeningFor(key) {
        
    }
    
    update() {
        Utils.log('UPDATE MUST BE OVERWRITTEN');
        return true;
    }
    
    pushUsageHistory(key, value) {
        if(!this.usageHistory[key])
            this.usageHistory[key] = [];
        
        if(this.enqueuedUpdates.includes(key) && this.usageHistory[key].length > 0) {
            this.usageHistory[key][0] = value;
            this.enqueuedUpdates = this.enqueuedUpdates.filter(k => k !== key);
        }
        else {
            this.usageHistory[key].unshift(value);
            if(this.usageHistory[key].length > this.usageHistoryLength)
                this.usageHistory[key].pop();
        }
    }
    
    setUsageValue(key, value) {
        this.usageHistory[key] = [value];
    }
    
    getUsageHistory(key) {
        if(!this.usageHistory[key])
            return [];
        return this.usageHistory[key];
    }
    
    getCurrentValue(key) {
        if(!this.usageHistory[key])
            return null;
        return this.usageHistory[key][0];
    }
    
    getValues(key) {
        if(!this.usageHistory[key])
            return [];
        return this.usageHistory[key];
    }
    
    /**
     * Temporarily enqueuing the key to be overwritten by the next update to avoid falsing graphs
     * WARNING: When overriden, super.requestUpdate(key) must be called at the end of the function
     * @param {string} key 
     */
    requestUpdate(key) {
        if(!this.enqueuedUpdates.includes(key))
            this.enqueuedUpdates.push(key);
    }
    
    isListeningFor(key) {
        return this.listeners[key] !== undefined && this.listeners[key].length > 0;
    }
    
    listen(subject, key, callback) {
        if(!this.listeners[key])
            this.listeners[key] = [];
        
        //check if the subject is already listening to this key
        for(const listener of this.listeners[key]) {
            if(listener.subject === subject) {
                //if so, update the callback
                listener.callback = callback;
                return;
            }
        }
        this.listeners[key].push({ callback, subject });
        this.startListeningFor(key);
    }
    
    notify(key, value) {
        if(this.listeners[key]) {
            for(const listener of this.listeners[key]) {
                listener.callback(value);
            }
        }
    }
    
    unlisten(subject, key = null) {
        if(!key) {
            for(const key in this.listeners) {
                this.listeners[key] = this.listeners[key].filter(listener => listener.subject !== subject);
                this.stopListeningFor(key);
            }
            return;
        }
        if(this.listeners[key])
            this.listeners[key] = this.listeners[key].filter(listener => listener.subject !== subject);
            this.stopListeningFor(key);
    }
    
    destroy() {
        this.stop();
        this.listeners = {};
    }
}