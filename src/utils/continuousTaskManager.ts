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

export type ContinuousTaskManagerData = {
    result?: string;
    exit: boolean;
};

type ContinuousTaskManagerListener = (data: ContinuousTaskManagerData) => void;

type FlushOptions = {
    always?: boolean;
    trigger?: string;
    interval?: number;
    idle?: number;
    match?: RegExp;
};

type Options = {
    flush: FlushOptions;
    stdin?: boolean;
    script?: boolean;
};

export default class ContinuousTaskManager {
    private currentTask?: CancellableTaskManager<boolean>;
    private command?: string;
    private output: string = '';
    private listeners: Map<any, ContinuousTaskManagerListener> = new Map();

    private options?: Options;
    private timerId?: number;
    private exited: boolean = false;

    public start(command: string, options?: Options) {
        this.stop();
        const task = new CancellableTaskManager<boolean>();
        this.currentTask = task;
        this.command = command;
        this.options = options;
        this.output = '';
        this.exited = false;
        task.run(this.task.bind(this))
            .catch(() => {
                this.exit(task);
            })
            .finally(() => {
                // Guard against stale handlers of a previous generation stopping the
                // replacement task when stop()+start() run in the same synchronous stack
                if(this.currentTask === task) this.stop();
            });

        if(this.options?.flush?.interval) {
            this.startTimer();
        }
    }

    private callback(data: ContinuousTaskManagerData) {
        if(this.exited && !data.exit) return;
        this.listeners.forEach((callback, _subject) => {
            callback(data);
        });
    }

    private exit(generation: CancellableTaskManager<boolean> | undefined) {
        // A stale generation must not interfere with the task that replaced it,
        // but a plain stop() (no replacement) still notifies listeners of the exit
        if(this.currentTask !== undefined && this.currentTask !== generation) return;
        if(this.exited) return;
        this.exited = true;
        this.stopTimer();
        this.callback({ exit: true });
    }

    private task(): Promise<boolean> {
        const generation = this.currentTask;
        return new Promise((resolve, reject) => {
            if(!this.command) {
                reject('No command or script provided');
                return;
            }

            let argv;
            if(this.options?.script) {
                argv = ['bash', '-c', this.command];
            } else {
                try {
                    argv = GLib.shell_parse_argv(this.command);
                    if(!argv[0]) throw new Error('Invalid command');
                    argv = argv[1];
                } catch(e: any) {
                    reject(`Failed to parse command: ${e.message}`);
                    return;
                }
            }

            if(!argv) {
                reject('Failed to parse command');
                return;
            }

            let flags = Gio.SubprocessFlags.STDOUT_PIPE | Gio.SubprocessFlags.STDERR_PIPE;
            if(this.options?.stdin) {
                flags |= Gio.SubprocessFlags.STDIN_PIPE;
            }

            // Create a new subprocess
            const proc = new Gio.Subprocess({ argv, flags });

            if(!proc) {
                reject('Failed to create subprocess');
                return;
            }

            // Initialize the subprocess
            try {
                const init = proc.init(generation?.cancellable || null);
                if(!init) {
                    reject('Failed to initialize subprocess');
                    return;
                }
            } catch(e: any) {
                // Handle errors in subprocess initialization
                reject(`Failed to initialize subprocess: ${e.message}`);
                return;
            }

            generation?.setSubprocess(proc);

            const pipeOut = proc.get_stdout_pipe();
            if(!pipeOut) {
                reject('Failed to get stdout pipe');
                return;
            }

            const pipeErr = proc.get_stderr_pipe();
            if(pipeErr) {
                const stderrStream = new Gio.DataInputStream({
                    baseStream: pipeErr,
                    closeBaseStream: true,
                });
                this.drainStream(generation, stderrStream);
            }

            const stdoutStream = new Gio.DataInputStream({
                baseStream: pipeOut,
                closeBaseStream: true,
            });

            this.readOutput(generation, resolve, reject, stdoutStream);
        });
    }

    private drainStream(
        generation: CancellableTaskManager<boolean> | undefined,
        stream: Gio.DataInputStream
    ) {
        stream.read_line_async(
            GLib.PRIORITY_LOW,
            generation?.cancellable || null,
            (s, result) => {
                try {
                    if(s === null) throw new Error('Stream invalid');
                    const [line] = s.read_line_finish_utf8(result);
                    if(line !== null) {
                        // discard
                        this.drainStream(generation, stream);
                        return;
                    }
                } catch(_) {
                    /* EMPTY */
                }

                try {
                    stream.close(null);
                } catch(_) {
                    /* EMPTY */
                }
            }
        );
    }

    private readOutput(
        generation: CancellableTaskManager<boolean> | undefined,
        resolve: (value: boolean | PromiseLike<boolean>) => void,
        reject: (reason?: any) => void,
        stdout: Gio.DataInputStream
    ) {
        stdout.read_line_async(
            GLib.PRIORITY_LOW,
            generation?.cancellable || null,
            (stream, result) => {
                try {
                    if(stream === null) {
                        throw new Error('Stream invalid');
                    }

                    const [line] = stream.read_line_finish_utf8(result);

                    if(line !== null) {
                        // 5MB limit to avoid memory leaks
                        if(this.output.length + line.length > 5 * 1024 * 1024) {
                            if(this.output.length > 0) {
                                this.callback({ result: this.output, exit: false });
                            }
                            this.output = '';
                        }

                        if(this.output.length) this.output += '\n' + line;
                        else this.output += line;

                        if(this.options?.flush?.always) {
                            this.callback({ result: this.output, exit: false });
                            this.output = '';
                        } else if(
                            this.options?.flush?.match &&
                            (() => {
                                // Avoid stateful RegExp (e.g. /.../g) causing missed matches
                                // due to lastIndex advancing across calls.
                                this.options!.flush.match!.lastIndex = 0;
                                return this.options!.flush.match!.test(line);
                            })()
                        ) {
                            this.callback({ result: this.output, exit: false });
                            this.output = '';
                        } else if(this.options?.flush?.idle) {
                            this.startTimer();
                        } else if(
                            this.options?.flush?.trigger &&
                            line.includes(this.options.flush.trigger)
                        ) {
                            this.callback({ result: this.output, exit: false });
                            this.output = '';
                        }
                        this.readOutput(generation, resolve, reject, stdout);
                    } else {
                        this.exit(generation);
                        try {
                            stdout.close(null);
                        } catch(e) {
                            /* EMPTY */
                        }
                        resolve(true);
                    }
                } catch(e: any) {
                    this.exit(generation);
                    try {
                        stdout.close(null);
                    } catch(err) {
                        /* EMPTY */
                    }
                    resolve(false);
                }
            }
        );
    }

    public listen(subject: any, callback: ContinuousTaskManagerListener) {
        this.listeners.set(subject, callback);
    }

    public unlisten(subject: any) {
        if(this.listeners.has(subject)) {
            this.listeners.delete(subject);
        }
    }

    private startTimer() {
        this.stopTimer();
        if(!this.options?.flush?.interval && !this.options?.flush?.idle) return;

        const time = this.options?.flush?.idle ?? this.options?.flush?.interval ?? 1000;
        this.timerId = GLib.timeout_add(GLib.PRIORITY_DEFAULT, time, () => {
            if(this.exited) {
                this.timerId = undefined;
                return GLib.SOURCE_REMOVE;
            }
            // Flush output to listeners if there's any output
            if(this.output.length > 0) {
                this.callback({ result: this.output, exit: false });
                this.output = '';
            }

            if(this.options?.flush?.idle) {
                this.timerId = undefined;
                return GLib.SOURCE_REMOVE;
            }
            return GLib.SOURCE_CONTINUE;
        });
    }

    private stopTimer() {
        if(this.timerId !== undefined) {
            GLib.source_remove(this.timerId);
            this.timerId = undefined;
        }
    }

    public stop() {
        this.stopTimer();
        this.currentTask?.cancel();
        this.currentTask = undefined;
        this.output = '';
    }

    public get isRunning() {
        return this.currentTask?.isRunning || false;
    }

    public destroy() {
        this.stop();
        this.listeners.clear();
    }
}
