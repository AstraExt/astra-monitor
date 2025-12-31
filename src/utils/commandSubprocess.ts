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
        const [ok, argv] = GLib.shell_parse_argv(command);
        if(!ok || !argv || argv.length === 0) {
            throw new Error(`Failed to parse command: "${command}"`);
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
                throw new Error(`Failed to initialize CommandSubprocess: '${command}'`);
            }
        } catch(e: any) {
            this.destroy();
            throw new Error(`Failed to initialize CommandSubprocess: '${command}' - ${e.message}`);
        }

        this.stdoutStream = this.subprocess.get_stdout_pipe();
        this.stderrStream = this.subprocess.get_stderr_pipe();

        try {
            const stdoutPromise = CommandSubprocess.readAll(
                this.stdoutStream,
                cancellableTaskManager
            );
            const stderrPromise = CommandSubprocess.readAll(
                this.stderrStream,
                cancellableTaskManager
            );

            const waitPromise = new Promise<number>((resolve, reject) => {
                this.subprocess!.wait_async(
                    cancellableTaskManager?.cancellable || null,
                    (_source, res) => {
                        try {
                            if(!this.subprocess!.wait_finish(res)) {
                                reject(new Error('Wait failed'));
                            } else {
                                resolve(this.subprocess!.get_exit_status());
                            }
                        } catch(e) {
                            reject(e);
                        }
                    }
                );
            });

            const [exitStatus, stdoutContent, stderrContent] = await Promise.all([
                waitPromise,
                stdoutPromise,
                stderrPromise,
            ]);

            if(exitStatus !== 0) {
                throw new Error(
                    `CommandSubprocess failed with exit status ${exitStatus}: ${stderrContent}`
                );
            }

            if(!stdoutContent) {
                throw new Error('No output');
            }

            return stdoutContent;
        } catch(e: any) {
            throw new Error(`Failed to run CommandSubprocess: ${e.message}`);
        } finally {
            this.destroy();
        }
    }

    private static async readAll(
        stream: Gio.InputStream | null,
        cancellableTaskManager?: CancellableTaskManager<boolean>
    ): Promise<string> {
        if(!stream) return '';

        const chunks: Uint8Array[] = [];
        let totalLength = 0;
        const bufferSize = 8192;

        let bytes: GLib.Bytes | null = null;

        do {
            // eslint-disable-next-line no-await-in-loop
            bytes = await new Promise<GLib.Bytes | null>((resolve, reject) => {
                stream.read_bytes_async(
                    bufferSize,
                    GLib.PRIORITY_LOW,
                    cancellableTaskManager?.cancellable || null,
                    (_stream, asyncResult) => {
                        try {
                            const result = stream.read_bytes_finish(asyncResult);
                            resolve(result);
                        } catch(e) {
                            reject(e);
                        }
                    }
                );
            });

            if(bytes && bytes.get_size() > 0) {
                const chunk = bytes.toArray();
                chunks.push(chunk);
                totalLength += chunk.length;
            }
        } while(bytes && bytes.get_size() > 0);

        if(totalLength === 0) return '';

        const fullBuffer = new Uint8Array(totalLength);
        let offset = 0;
        for(const chunk of chunks) {
            fullBuffer.set(chunk, offset);
            offset += chunk.length;
        }

        const decoder = new TextDecoder('utf-8');
        return decoder.decode(fullBuffer);
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
