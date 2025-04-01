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

import Gio from 'gi://Gio';
import GLib from 'gi://GLib';

class CancellableTask<T> {
    private timeoutId?: number;
    private rejectFn?: (reason?: any) => void;
    private taskPromise: Promise<T>;

    constructor(private boundTask: () => Promise<T>) {
        this.taskPromise = new Promise<T>((resolve, reject) => {
            this.rejectFn = reject;

            this.timeoutId = GLib.idle_add(GLib.PRIORITY_DEFAULT_IDLE, () => {
                this.boundTask().then(resolve).catch(reject);
                this.timeoutId = undefined;
                return GLib.SOURCE_REMOVE;
            });
        });
    }

    public get promise(): Promise<T> {
        return this.taskPromise;
    }

    public cancel(): void {
        if(this.timeoutId) {
            GLib.source_remove(this.timeoutId);
            this.timeoutId = undefined;
        }

        if(this.rejectFn) {
            this.rejectFn({ isCancelled: true, message: 'Task cancelled' });
        }
        this.rejectFn = undefined;
    }
}

export default class CancellableTaskManager<T> {
    private cancelId?: number;
    private currentTask?: CancellableTask<T>;

    private taskCancellable?: Gio.Cancellable;
    public get cancellable() {
        if(!this.taskCancellable) {
            this.taskCancellable = new Gio.Cancellable();
        }
        return this.taskCancellable;
    }

    public run(boundTask: () => Promise<T>): Promise<T> {
        this.cancel();
        this.currentTask = new CancellableTask<T>(boundTask);
        return new Promise<T>((resolve, reject) => {
            this.currentTask!.promise.then(resolve)
                .catch(reject)
                .finally(() => {
                    this.cancel();
                });
        });
    }

    public setSubprocess(subprocess: Gio.Subprocess) {
        this.cancelId = this.cancellable.connect(() => {
            subprocess.force_exit();
        });
    }

    public cancel() {
        if(this.currentTask) {
            this.currentTask.cancel();
            this.currentTask = undefined;
        }

        if(this.cancelId) {
            this.taskCancellable?.cancel();
            this.taskCancellable?.disconnect(this.cancelId);
            this.cancelId = undefined;
        }
        this.taskCancellable = undefined;
    }

    public get isRunning() {
        return !!this.currentTask;
    }
}
