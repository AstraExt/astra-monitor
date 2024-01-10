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

export default class TopProcessesCache {
    /**
     * 
     * @param {number} updateTime 
     */
    constructor(updateTime) {
        this.updateTime = updateTime;
    }
    
    /**
     * @typedef {{ pid: number, exec: string, cmd: string, notSeen: number }} Process
     */
    
    /**
     * @type {Map<number, Process>}
     */
    processesCache = new Map();
        
    /**
     * @param {number[]} pidList 
     */
    updateNotSeen(pidList) {
        for(let [pid, process] of this.processesCache) {
            
            if(!pidList.includes(pid)) {
                process.notSeen++;
                
                // Remove process from cache if it hasn't been seen in a 5 minutes
                if(process.notSeen > 300 / this.updateTime)
                    this.processesCache.delete(pid);
            }
            else {
                process.notSeen = 0;
            }
        }
    }
    
    /**
     * 
     * @param {number} pid 
     * @returns {Process}
     */
    getProcess(pid) {
        return this.processesCache.get(pid);
    }
    
    /**
     * @param {Process} process 
     */
    setProcess(process) {
        this.processesCache.set(process.pid, process);
    }
    
    reset() {
        this.processesCache.clear();
    }
}