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

export default class CancellableTaskManager<T> {
    private currentTask?: { promise: Promise<T>, cancel: () => void };
    
    run(boundTask: () => Promise<T>): Promise<T> {
        if(this.currentTask)
            this.currentTask.cancel();
        
        this.currentTask = this.makeCancellable(boundTask);
        return this.currentTask.promise
            .finally(() => {
                this.currentTask = undefined;
            });
    }
    
    makeCancellable(boundTask: () => Promise<T>): { promise: Promise<T>, cancel: () => void } {
        let cancel;
        const promise = new Promise<T>((resolve, reject) => {
            cancel = () => reject({ isCancelled: true });
            boundTask().then(resolve).catch(reject);
        });
        // @ts-expect-error cancel type
        return { promise, cancel };
    }
    
    cancel() {
        if(this.currentTask)
            this.currentTask.cancel();
    }
    
    get isRunning() {
        return !!this.currentTask;
    }
}