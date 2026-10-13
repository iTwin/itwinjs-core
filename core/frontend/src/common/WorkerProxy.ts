/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module Utils
 */
import { assert, MaybePromise } from "@itwin/core-bentley";

/** Holds callbacks for a Promise produced for a particular call to postMessage. */
interface Task {
  resolve: (result: any) => void;
  reject: (error: Error) => void;
  /** Terminates the worker if the call takes longer than [[WorkerProxyOptions.callTimeout]]. */
  timeout?: ReturnType<typeof setTimeout>;
}

/** The successful result of a worker operation, correlated with the id of the caller to resolve with the result. */
interface WorkerResult {
  msgId: number;
  result: any;
  error?: never;
}

/** An error resulting from a worker operation, correlated with the id of the caller to reject with the error. */
interface WorkerError {
  msgId: number;
  error: Error;
  result?: never;
}

/** Response to `postMessage` produced by a worker operation. */
type WorkerResponse = WorkerResult | WorkerError;

/** Given an interface T that defines the operations provided by a worker, produce an interface that can be used to asynchronously invoke those operations
 * from the main thread, optionally passing an array of values to be transferred from the main thread to the worker.
 *  - Every return type is converted to a `Promise` (i.e., every function becomes `async`)>.
 *  - `zeroArgFunc(): R` becomes `async zeroArgFunc(): Promise<R>`.
 *  - `oneArgFunc(arg: U): R` becomes `async oneArgFunc(arg: U, transfer?: Transferable[]): Promise<R>`.
 *  - `multiArgFunc(arg1: U, arg2: V): R` becomes `async multiArgFunc(args: [U, V], transfer?: Transferable[]): Promise<R>`.
 * @note All parameters of all methods of `T` must support [structured cloning](https://developer.mozilla.org/en-US/docs/Web/API/Web_Workers_API/Structured_clone_algorithm) -
 * attempts to pass functions, instances of classes, DOM nodes, WebGL resources, and other non-cloneable types will compile but fail at run-time.
 * @beta
 */
export type WorkerInterface<T> = {
  [P in keyof T]: T[P] extends () => any ? () => Promise<ReturnType<T[P]>> :
    (T[P] extends (arg: any) => any ? (arg: Parameters<T[P]>[0], transfer?: Transferable[]) => Promise<ReturnType<T[P]>> :
      (T[P] extends (...args: any) => any ? (args: Parameters<T[P]>, transfer?: Transferable[]) => Promise<ReturnType<T[P]>> : never)
    )
};

/** Augments each method of `T` with the ability to specify values to be transferred from the worker thread to the main thread.
 * Each return type `R` is replaced with `R | { result: R; transfer: Transferable[]; }`, or a promise that resolves to such a type.
 * @see [[WorkerImplementation]].
 * @beta
 */
export type WorkerReturnType<T extends (...args: any) => any> = MaybePromise<ReturnType<T> | { result: Awaited<ReturnType<T>>, transfer: Transferable[] }>;

/** Given an interface T that defines the operations provided by a worker, produce an interface to which the implementation of those operations must conform.
 * The return type of each function is enhanced to permit supplying a list of values to be transferred from the worker to the main thread.
 * Multi-argument functions are converted to functions accepting a single tuple of arguments.
 *  - Every return type `R` is converted to `WorkerReturnType<R>`.
 *  - `zeroArgFunc(): R` becomes `zeroArgFunc(): R | { result: R; transfer: Transferable[]; }`.
 *  - `oneArgFunc(arg: U): R` becomes `oneArgFunc(arg: U): R | { result: R; transfer: Transferable[]; }`.
 *  - `multiArgFunc(arg1: U, arg2: V): R` becomes `multiArgFunc([U, V]): R | { result: R; transfer: Transferable[]; }`.
 * @note All parameters of all methods of `T` must support [structured cloning](https://developer.mozilla.org/en-US/docs/Web/API/Web_Workers_API/Structured_clone_algorithm) -
 * attempts to pass functions, instances of classes, DOM nodes, WebGL resources, and other non-cloneable types will compile but fail at run-time.
 * @beta
 */
export type WorkerImplementation<T> = {
  [P in keyof T]: T[P] extends () => any ? () => WorkerReturnType<T[P]> :
    (T[P] extends (arg: any) => any ? (arg: Parameters<T[P]>[0]) => WorkerReturnType<T[P]> :
      (T[P] extends (...args: any) => any ? (args: Parameters<T[P]>) => WorkerReturnType<T[P]> : never)
    )
};

/** A proxy for a [web worker](https://developer.mozilla.org/en-US/docs/Web/API/Worker) that provides the operations specified by
 * the methods of `T`.
 * To use a worker proxy, define a worker script that provides [[registerWorker]] with an implementation of `T`, and obtain a proxy
 * via [[createWorkerProxy]] on the main thread. The proxy can then be used to asynchronously invoke methods of `T` on the worker.
 * See [this article]($docs/learning/frontend/WorkerProxy.md) for more details and examples.
 * @beta
 */
export type WorkerProxy<T> = WorkerInterface<T> & {
  /** Terminate the worker. Calls still pending never settle, as before; every later call rejects. Terminating it again does nothing. */
  terminate(): void;
  /** Returns true once the worker has been terminated: by [[terminate]], because a call exceeded [[WorkerProxyOptions.callTimeout]],
   * or because its script failed to load.
   */
  readonly isTerminated: boolean;
};

/** Options for [[createWorkerProxy]].
 * @beta
 */
export interface WorkerProxyOptions {
  /** The milliseconds a call may remain pending. A worker runs one task at a time, so a call that takes longer is taken to mean the
   * worker is stuck and will answer no later call either: the proxy terminates it, and every pending call rejects.
   * Default: no limit.
   */
  callTimeout?: number;
}

function createWorker(workerJsPath: string): Worker {
  const sameOrigin = workerJsPath.substring(0, globalThis.origin.length) === globalThis.origin;
  if (sameOrigin || !workerJsPath.startsWith("http"))
    return new Worker(workerJsPath);

  const workerBlob = new Blob([`importScripts("${workerJsPath}");`]);
  const workerBlobUrl = URL.createObjectURL(workerBlob);
  return new Worker(workerBlobUrl);
}

/** Create a [[WorkerProxy]] implementing the methods of `T` using the specified worker script.
 * See [this article]($docs/learning/frontend/WorkerProxy.md) for more details and examples.
 * @beta
 */
export function createWorkerProxy<T>(workerJsPath: string, options?: WorkerProxyOptions): WorkerProxy<T> {
  const tasks = new Map<number, Task>();
  let curMsgId = 0;
  let terminationError: Error | undefined;

  const worker = createWorker(workerJsPath);

  /** Terminate the worker. A failure rejects the pending calls with `reason`; the caller's own termination abandons them, because
   * callers have long been free to terminate a proxy while calls they never awaited are pending.
   */
  const terminate = (reason: Error, rejectPending: boolean) => {
    if (terminationError)
      return;

    terminationError = reason;
    worker.terminate();
    for (const task of tasks.values()) {
      clearTimeout(task.timeout);
      if (rejectPending)
        task.reject(reason);
    }

    tasks.clear();
  };

  worker.onmessage = (e: MessageEvent) => {
    const response = e.data as WorkerResponse;
    assert(typeof response === "object");
    assert("result" in response || "error" in response);

    const task = tasks.get(response.msgId);
    if (task) {
      tasks.delete(response.msgId);
      clearTimeout(task.timeout);
      if (response.error)
        task.reject(response.error);
      else
        task.resolve(response.result);
    }
  };

  worker.onerror = (e: Event) => {
    // An error thrown while the worker runs is an ErrorEvent. It is left to surface as an uncaught error, and the worker keeps
    // running, as it always has: the error need not concern any pending call. Any other error event means the worker's script
    // failed to load, so no call can ever be answered.
    const scriptFailedToLoad = !(e instanceof ErrorEvent);
    if (scriptFailedToLoad)
      terminate(new Error("Worker failed: its script failed to load"), true);
  };

  const invoke = async (operation: string, payload: any, transfer: Transferable[] | undefined) => new Promise((resolve, reject) => {
    if (terminationError) {
      reject(terminationError);
      return;
    }

    const msgId = ++curMsgId;
    const callTimeout = options?.callTimeout;
    const timeout = undefined !== callTimeout ? setTimeout(() => terminate(new Error(`Worker call "${operation}" timed out`), true), callTimeout) : undefined;
    tasks.set(msgId, { resolve, reject, timeout });
    try {
      worker.postMessage({ operation, payload, msgId }, transfer ?? []);
    } catch (error) {
      // E.g., the payload cannot be cloned or a transferable is detached: only this call fails.
      tasks.delete(msgId);
      clearTimeout(timeout);
      reject(error instanceof Error ? error : new Error(String(error)));
    }
  });

  return new Proxy({} as WorkerProxy<T>, {
    get(_target, operation: string) {
      switch (operation) {
        case "terminate":
          return () => terminate(new Error("Worker terminated"), false);
        case "isTerminated":
          return undefined !== terminationError;
        default:
          return async (payload?: any, transfer?: Transferable[]) => invoke(operation, payload, transfer);
      }
    },
  });
}
