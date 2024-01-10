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

export class PromiseValueHolder {
    constructor(promise) {
        this.promise = promise;
        this.isResolved = false;
        this.resolvedValue = null;
        
        this.promise.then(value => {
            this.resolvedValue = value;
            this.isResolved = true;
        }).catch(error => {
            this.isResolved = true;
            throw error;
        });
    }
    
    getValue() {
        if (this.isResolved) {
            return Promise.resolve(this.resolvedValue);
        } else {
            return this.promise;
        }
    }
}