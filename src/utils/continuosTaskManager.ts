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

import CancellableTaskManager from './cancellableTaskManager.js';

export type ContinuosTaskManagerData = {
    result?: string;
    exit: boolean;
};

type ContinuosTaskManagerListener = (data: ContinuosTaskManagerData) => void;

export default class ContinuosTaskManager {
    private currentTask?: CancellableTaskManager<boolean>;
    private command?: string;
    private flushTrigger?: string;
    private output: string = '';
    private listeners: Map<any, ContinuosTaskManagerListener> = new Map();

    public start(command: string, flushTrigger: string = '') {
        if(this.currentTask) this.currentTask.cancel();
        this.currentTask = new CancellableTaskManager();
        this.command = command;
        this.flushTrigger = flushTrigger;
        this.output = '';
        this.currentTask
            .run(this.task.bind(this))
            .catch(() => {})
            .finally(() => {
                this.stop();
            });
    }

    private task(): Promise<boolean> {
        return new Promise((resolve, reject) => {
            if(this.command === undefined) {
                reject('No command');
                return;
            }

            let argv;
            try {
                // Parse the command line to properly create an argument vector
                argv = GLib.shell_parse_argv(this.command);
                if(!argv[0]) throw new Error('Invalid command');
            } catch(e: any) {
                // Handle errors in command parsing
                reject(`Failed to parse command: ${e.message}`);
                return;
            }

            // Create a new subprocess
            const proc = new Gio.Subprocess({
                argv: argv[1],
                flags: Gio.SubprocessFlags.STDOUT_PIPE | Gio.SubprocessFlags.STDERR_PIPE,
            });

            // Initialize the subprocess
            try {
                proc.init(this.currentTask?.cancellable || null);
            } catch(e: any) {
                // Handle errors in subprocess initialization
                reject(`Failed to initialize subprocess: ${e.message}`);
                return;
            }

            this.currentTask?.setSubprocess(proc);

            const stdinStream = proc.get_stdin_pipe();
            const stdoutStream = new Gio.DataInputStream({
                base_stream: proc.get_stdout_pipe(),
                close_base_stream: true,
            });

            // Start the subprocess
            this.readOutput(resolve, reject, stdoutStream, stdinStream);
        });
    }

    private readOutput(
        resolve: (value: boolean | PromiseLike<boolean>) => void,
        reject: (reason?: any) => void,
        stdout: Gio.DataInputStream,
        stdin: Gio.OutputStream | null
    ) {
        stdout.read_line_async(GLib.PRIORITY_LOW, null, (stream, result) => {
            try {
                const [line] = stream.read_line_finish_utf8(result);

                if(line !== null) {
                    if(this.output.length) this.output += '\n' + line;
                    else this.output += line;

                    if(!this.flushTrigger || line.lastIndexOf(this.flushTrigger) !== -1) {
                        this.listeners.forEach((callback, _subject) => {
                            callback({ result: this.output, exit: false });
                        });
                        this.output = '';
                    }
                    this.readOutput(resolve, reject, stdout, stdin);
                } else {
                    this.listeners.forEach((callback, _subject) => {
                        callback({ exit: true });
                    });
                    resolve(true);
                }
            } catch(e: any) {
                this.listeners.forEach((callback, _subject) => {
                    callback({ exit: true });
                });
                resolve(false);
            }
        });
    }

    public listen(subject: any, callback: ContinuosTaskManagerListener) {
        this.listeners.set(subject, callback);
    }

    public unlisten(subject: any) {
        this.listeners.delete(subject);
    }

    public stop() {
        if(this.currentTask) this.currentTask.cancel();
        this.currentTask = undefined;
    }

    public get isRunning() {
        return this.currentTask?.isRunning || false;
    }
}
