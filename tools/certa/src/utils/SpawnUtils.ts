/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import { ChildProcess, spawn, StdioOptions } from "child_process";
import * as inspector from "inspector";

/**
 * Helper function for spawning a child process with the same cwd, env, stdout, and stderr as the current process.
 * Processes spawned by this function will also have an IPC channel, so the may communicate with their parent via `process.send()`.
 * @param command The command to run.
 * @param args List of string arguments.
 * @param env Environment vars to override in the child process.
 * @param useIpc Whether to enable an IPC channel when spawning.
 */
export function spawnChildProcess(command: string, args: ReadonlyArray<string>, env?: NodeJS.ProcessEnv, useIpc = false): ChildProcess {
  const childEnv = { ...process.env, ...(env || {}) };

  // FIXME: We should be able to remove the useIpc param and just always enable it,
  // but it's not safe to spawn electron with IPC enabled until https://github.com/electron/electron/issues/17044 is fixed.
  const stdio: StdioOptions = (useIpc) ? ["ipc", "pipe", "pipe"] : "pipe";
  const childProcess = spawn(command, args, { stdio, cwd: process.cwd(), env: childEnv });
  // For some reason, spawning using `stdio: "inherit"` results in some garbled output (for example, "✓" is printed as "ΓêÜ").
  // Using `stdio: "pipe"` and manually redirecting the output here seems to work though.
  childProcess.stdout!.on("data", (data: any) => process.stdout.write(data));
  childProcess.stderr!.on("data", (data: any) => process.stderr.write(data));
  return childProcess;
}

/** Returns a Promise that will be resolved with the given child process's exit code upon termination. */
export async function onExit(child: ChildProcess): Promise<number> {
  return new Promise((resolve) => {
    child.on("exit", (status) => resolve(status || 0));
  });
}

/** Returns a Promise that will be resolved with the given child process's exit code upon termination. */
async function onExitElectronApp(child: ChildProcess): Promise<number> {
  let messageExitCode = 1; // Default to error
  child.on("message", (message: any) => {
    messageExitCode = message.exitCode;
  });

  return new Promise((resolve) => {
    child.on("exit", (_exitCode) => {
      // Note: Upgrading to electron 10 seems to cause the electron child process to always exit with 3221225477 = 0xC0000005(Access Violation).
      // This causes the exitCode we pass to app.exit(_exitCode) to be lost. To work around this issue, we instead pass a message from the
      // child process (see ElectronTestRunner), right before we call app.exit(). This message includes the exitCode based on the status of the
      // test runs. See ElectronTestRunner.runTests, and the above listener to the "message" event.
      resolve(messageExitCode);
    });
  });
}

/**
 * Helper function for relaunching (as a child process) the current process in electron instead of node.
 * Returns a promise that will be resolved with the exit code of the child process, once it terminates.
 */
export async function relaunchInElectron(): Promise<number> {
  const child = spawnChildProcess(require("electron/index.js"), process.argv.slice(1), undefined, true);
  return onExitElectronApp(child);
}

/**
 * Activates the v8 inspector and starts listening on the given port, then breaks as soon as a debugger has connected.
 * This is essentially what node does when run with `--inspect-brk={port}`, but doing this manually gives us more control
 * over precisely _which_ child process connects to the debugger.
 *
 * For example, when using the chrome test runner, we want debug the original certa process ("node certa ...args") as the
 * test "backend", but with the electron test runner, we want to debug a child process ("electron certa ...args").
 * @param port Port to listen on for inspector connections.
 */
export function startDebugger(port: number) {
  // Don't try to activate if there's already an active inspector.
  if (inspector.url())
    return;

  inspector.open(port, undefined, true);
}
