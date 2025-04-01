import GLib from 'gi://GLib';
import Gio from 'gi://Gio';

import CancellableTaskManager from './cancellableTaskManager.js';

export class CommandSubprocess {
    private subprocess: Gio.Subprocess | null = null;
    private stdoutStream: Gio.InputStream | null = null;
    private stderrStream: Gio.InputStream | null = null;
    private destroyed: boolean = false;

    static async run(
        command: string,
        cancellableTaskManager?: CancellableTaskManager<boolean>
    ): Promise<string> {
        const commandSubprocess = new CommandSubprocess();
        return commandSubprocess.runCommandInstance(command, cancellableTaskManager);
    }

    private async runCommandInstance(
        command: string,
        cancellableTaskManager?: CancellableTaskManager<boolean>
    ): Promise<string> {
        return new Promise((resolve, reject) => {
            try {
                const [ok, argv] = GLib.shell_parse_argv(command);
                if(!ok || !argv || argv.length === 0) {
                    reject(new Error(`Failed to parse command: "${command}"`));
                    this.destroy();
                    return;
                }

                const flags =
                    Gio.SubprocessFlags.STDOUT_PIPE |
                    Gio.SubprocessFlags.STDERR_PIPE |
                    Gio.SubprocessFlags.INHERIT_FDS;

                this.subprocess = new Gio.Subprocess({ argv, flags });
                cancellableTaskManager?.setSubprocess(this.subprocess);

                try {
                    const init = this.subprocess.init(cancellableTaskManager?.cancellable || null);
                    if(!init) {
                        reject(new Error(`Failed to initialize CommandSubprocess: '${command}'`));
                        this.destroy();
                        return;
                    }
                } catch(e: any) {
                    reject(
                        new Error(
                            `Failed to initialize CommandSubprocess: '${command}' - ${e.message}`
                        )
                    );
                    this.destroy();
                    return;
                }

                this.stdoutStream = this.subprocess.get_stdout_pipe();
                this.stderrStream = this.subprocess.get_stderr_pipe();

                this.subprocess.wait_async(
                    cancellableTaskManager?.cancellable || null,
                    async (_source, res) => {
                        if(this.destroyed) {
                            return;
                        }

                        let stdoutContent = '';
                        let stderrContent = '';
                        let exitStatus = -1;
                        let success = false;

                        try {
                            success = this.subprocess!.wait_finish(res);
                            exitStatus = this.subprocess!.get_exit_status();

                            if(!success || exitStatus !== 0) {
                                stderrContent = await CommandSubprocess.readAll(
                                    this.stderrStream,
                                    cancellableTaskManager
                                );
                                reject(
                                    new Error(
                                        `CommandSubprocess failed with exit status ${exitStatus}: ${stderrContent}`
                                    )
                                );
                            } else {
                                stdoutContent = await CommandSubprocess.readAll(
                                    this.stdoutStream,
                                    cancellableTaskManager
                                );
                                if(!stdoutContent) {
                                    reject(new Error('No output'));
                                } else {
                                    resolve(stdoutContent);
                                }
                            }
                        } catch(e: any) {
                            reject(
                                new Error(`Failed to read CommandSubprocess output: ${e.message}`)
                            );
                        } finally {
                            this.destroy();
                        }
                    }
                );
            } catch(e: any) {
                reject(new Error(`Failed to run CommandSubprocess: ${e.message}`));
                this.destroy();
            }
        });
    }

    private static async readAll(
        stream: Gio.InputStream | null,
        cancellableTaskManager?: CancellableTaskManager<boolean>
    ): Promise<string> {
        if(!stream) return '';
        let output = '';
        const decoder = new TextDecoder('utf-8');
        const bufferSize = 8192;
        let pendingRead = false;

        return new Promise((resolve, reject) => {
            const readChunk = (): void => {
                if(pendingRead) return;
                pendingRead = true;

                stream.read_bytes_async(
                    bufferSize,
                    GLib.PRIORITY_LOW,
                    cancellableTaskManager?.cancellable || null,
                    (_stream, asyncResult) => {
                        pendingRead = false;

                        try {
                            const bytes = stream.read_bytes_finish(asyncResult);
                            if(!bytes || bytes.get_size() === 0) {
                                resolve(output);
                                return;
                            }

                            const chunk = decoder.decode(bytes.toArray());
                            output += chunk;
                            readChunk();
                        } catch(e: any) {
                            reject(e);
                        }
                    }
                );
            };

            readChunk();
        });
    }

    private destroy() {
        if(this.destroyed) {
            return;
        }
        this.destroyed = true;

        try {
            this.subprocess?.force_exit();
        } catch(e: any) {
            /* empty */
        }
        this.subprocess = null;

        try {
            this.stdoutStream?.close(null);
        } catch(e: any) {
            /* empty */
        }
        this.stdoutStream = null;

        try {
            this.stderrStream?.close(null);
        } catch(e: any) {
            /* empty */
        }
        this.stderrStream = null;
    }
}

export default CommandSubprocess;
