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

export class PromiseValueHolderStore<T> {
    private creator: () => PromiseValueHolder<T>;
    private valueHolder: PromiseValueHolder<T> | undefined;

    constructor(creator: () => PromiseValueHolder<T>) {
        this.creator = creator;
    }

    getValue(): Promise<T> {
        if (this.valueHolder === undefined) this.valueHolder = this.creator();
        return this.valueHolder.getValue();
    }
}

export default class PromiseValueHolder<T> {
    private promise: Promise<T>;
    private isResolved: boolean = false;
    private resolvedValue!: T;

    constructor(promise: Promise<T>) {
        this.promise = promise;

        this.promise
            .then((value: T) => {
                this.resolvedValue = value;
                this.isResolved = true;
            })
            .catch((error) => {
                this.isResolved = true;
                throw error;
            });
    }

    getValue(): Promise<T> {
        if (this.isResolved) {
            return Promise.resolve(this.resolvedValue);
        } else {
            return this.promise;
        }
    }
}
