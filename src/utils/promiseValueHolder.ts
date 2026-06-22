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

export default class PromiseValueHolder<T> {
    private promise: Promise<T>;
    private settled: boolean = false;
    private rejected: boolean = false;
    private resolvedValue!: T;
    private rejectedReason: any;

    constructor(promise: Promise<T>) {
        this.promise = promise.then(
            (value: T) => {
                this.resolvedValue = value;
                this.settled = true;
                return value;
            },
            error => {
                this.rejectedReason = error;
                this.rejected = true;
                this.settled = true;
                throw error;
            }
        );
    }

    getValue(): Promise<T> {
        if(this.settled) {
            if(this.rejected) return Promise.reject(this.rejectedReason);
            return Promise.resolve(this.resolvedValue);
        }
        return this.promise;
    }
}

export class PromiseValueHolderStore<T> {
    private creator: () => PromiseValueHolder<T>;
    private valueHolder: PromiseValueHolder<T> | undefined;

    constructor(creator: () => PromiseValueHolder<T>) {
        this.creator = creator;
    }

    getValue(): Promise<T> {
        if(this.valueHolder === undefined) this.valueHolder = this.creator();
        return this.valueHolder.getValue();
    }
}
