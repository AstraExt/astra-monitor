import GLib from 'gi://GLib';
import Gio from 'gi://Gio';

import CancellableTaskManager from './cancellableTaskManager.js';

export default class CommandHelper {
    static runCommand(
        command: string,
        cancellableTaskManager?: CancellableTaskManager<boolean>
    ): Promise<string> {
        return new Promise((resolve, reject) => {
            let proc: Gio.Subprocess | null = null;

            try {
                const [ok, argv] = GLib.shell_parse_argv(command);
                if(!ok || !argv || argv.length === 0) {
                    reject(new Error(`Failed to parse command: "${command}"`));
                    return;
                }

                const flags = Gio.SubprocessFlags.STDOUT_PIPE | Gio.SubprocessFlags.STDERR_PIPE;

                proc = new Gio.Subprocess({ argv, flags });
                try {
                    const init = proc.init(cancellableTaskManager?.cancellable || null);
                    if(!init) {
                        reject(new Error('Failed to initialize subprocess'));
                        return;
                    }
                } catch(e: any) {
                    reject(new Error(`Failed to initialize subprocess: ${e.message}`));
                    return;
                }

                cancellableTaskManager?.setSubprocess(proc);

                proc.wait_async(
                    cancellableTaskManager?.cancellable || null,
                    (_source, res, _data) => {
                        let stdoutPipe: Gio.InputStream | null = null;
                        let stderrPipe: Gio.InputStream | null = null;

                        try {
                            const result = proc?.wait_finish(res);
                            const exitStatus = proc?.get_exit_status();

                            if(!result || exitStatus !== 0) {
                                stderrPipe = proc?.get_stderr_pipe() ?? null;
                                const stderrContent = CommandHelper.readAll(
                                    stderrPipe,
                                    cancellableTaskManager
                                ).trim();

                                reject(
                                    new Error(
                                        `Command failed with exit status ${exitStatus}: ${stderrContent}`
                                    )
                                );
                                return;
                            }

                            stdoutPipe = proc?.get_stdout_pipe() ?? null;
                            const stdoutContent = CommandHelper.readAll(
                                stdoutPipe,
                                cancellableTaskManager
                            ).trim();
                            if(!stdoutContent) throw new Error('No output');
                            resolve(stdoutContent.trim());
                        } catch(e: any) {
                            reject(new Error(`Failed to read command output: ${e.message}`));
                        } finally {
                            stdoutPipe?.close(cancellableTaskManager?.cancellable || null);
                            stderrPipe?.close(cancellableTaskManager?.cancellable || null);
                        }
                    }
                );
            } catch(e: any) {
                reject(new Error(`Failed to run command: ${e.message}`));
                proc?.force_exit();
            }
        });
    }

    static readAll(
        stream: Gio.InputStream | null,
        cancellableTaskManager?: CancellableTaskManager<boolean>
    ): string {
        if(!stream) return '';
        let output = '';
        let bytes: GLib.Bytes;
        const decoder = new TextDecoder('utf-8');

        while(
            (bytes = stream.read_bytes(8192, cancellableTaskManager?.cancellable || null)) &&
            bytes.get_size() > 0
        ) {
            output += decoder.decode(bytes.toArray()).trim();
        }
        return output;
    }
}
