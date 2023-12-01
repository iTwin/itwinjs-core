/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module Utils
 */
import { assert } from "@itwin/core-bentley";

/** Holds callbacks for a Promise produced for a particular call to postMessage. */
interface Task {
  reject: (result: any) => void;
  resolve: (error: Error) => void;
}

/** The successful result of a worker operation, correlated with the id of the caller to resolve with the result.
 * @internal
 */
export interface WorkerResult {
  msgId: number;
  result: any;
  error?: never;
}

/** An error resulting from a worker operation, correlated with the id of the caller to reject with the error.
 * @internal
 */
export interface WorkerError {
  msgId: number;
  error: Error;
  result?: never;
}

/** Response to `postMessage` produced by a worker operation.
 * @internal
 */
export type WorkerResponse = WorkerResult | WorkerError;

/** Given an interface T that defines the operations provided by a worker, produce an interface that can be used to asynchronously invoke those operations
 * from the main thread, optionally passing an array of values to be transferred from the main thread to the worker.
 *  - Every return type is converted to a `Promise` (i.e., every function becomes `async`)>.
 *  - `zeroArgFunc(): R` becomes `async zeroArgFunc(): Promise<R>`.
 *  - `oneArgFunc(arg: U): R` becomes `async oneArgFunc(arg: U, transfer?: Transferable[]): Promise<R>`.
 *  - `multiArgFunc(arg1: U, arg2: V): R` becomes `async multiArgFunc(args: [U, V], transfer?: Transferable[]): Promise<R>`.
 * @note All parameters of all methods of `T` must support [structured cloning](https://developer.mozilla.org/en-US/docs/Web/API/Web_Workers_API/Structured_clone_algorithm) -
 * attempts to pass functions, instances of classes, DOM nodes, WebGL resources, and other non-cloneable types will compile but fail at run-time.
 * @internal
 */
export type WorkerInterface<T> = {
  [P in keyof T]: T[P] extends () => any ? () => Promise<ReturnType<T[P]>> :
    (T[P] extends (arg: any) => any ? (arg: Parameters<T[P]>[0], transfer?: Transferable[]) => Promise<ReturnType<T[P]>> :
      (T[P] extends (...args: any) => any ? (args: Parameters<T[P]>, transfer?: Transferable[]) => Promise<ReturnType<T[P]>> : never)
    )
};

/** Augments each method of `T` with the ability to specify values to be transferred from the worker thread to the main thread.
 * Each return type `R` is replaced with `R | { result: R; transfer: Transferable[]; }`.
 * @see [[WorkerImplementation]].
 * @internal
 */
export type WorkerReturnType<T extends (...args: any) => any> = ReturnType<T> | { result: ReturnType<T>, transfer: Transferable[] };

/** Given an interface T that defines the operations provided by a worker, produce an interface to which the implementation of those operations must conform.
 * The return type of each function is enhanced to permit supplying a list of values to be transferred from the worker to the main thread.
 * Multi-argument functions are converted to functions accepting a single tuple of arguments.
 *  - Every return type `R` is converted to `WorkerReturnType<R>`.
 *  - `zeroArgFunc(): R` becomes `zeroArgFunc(): R | { result: R; transfer: Transferable[]; }`.
 *  - `oneArgFunc(arg: U): R` becomes `oneArgFunc(arg: U): R | { result: R; transfer: Transferable[]; }`.
 *  - `multiArgFunc(arg1: U, arg2: V): R` becomes `multiArgFunc([U, V]): R | { result: R; transfer: Transferable[]; }`.
 * @note All parameters of all methods of `T` must support [structured cloning](https://developer.mozilla.org/en-US/docs/Web/API/Web_Workers_API/Structured_clone_algorithm) -
 * attempts to pass functions, instances of classes, DOM nodes, WebGL resources, and other non-cloneable types will compile but fail at run-time.
 * @internal
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
 * @internal
 */
export type WorkerProxy<T> = WorkerInterface<T> & {
  /** Terminate the worker. */
  terminate(): void;
  /** Returns true if [[terminate]] has been called. */
  readonly isTerminated: boolean;
};

/** Create a [[WorkerProxy]] implementing the methods of `T` using the specified worker script.
 * @internal
 */
export function createWorkerProxy<T>(workerJsPath: string): WorkerProxy<T> {
  const tasks = new Map<number, Task>();
  let curMsgId = 0;
  let terminated = false;

  let worker: Worker;
  const sameOrigin = workerJsPath.substring(0, globalThis.origin.length) === globalThis.origin;
  if (sameOrigin || !workerJsPath.startsWith("http")) {
    worker = new Worker(workerJsPath);
  } else {
    const workerBlob = new Blob([`importScripts("${workerJsPath}");`]);
    const workerBlobUrl = URL.createObjectURL(workerBlob);
    worker = new Worker(workerBlobUrl);
  }

  worker.onmessage = (e: MessageEvent) => {
    const response = e.data as WorkerResponse;
    assert(typeof response === "object");
    assert("result" in response || "error" in response);

    const task = tasks.get(response.msgId);
    if (task) {
      tasks.delete(response.msgId);
      if (response.error)
        task.reject(response.error);
      else
        task.resolve(response.result);
    }
  };

  return new Proxy({} as WorkerProxy<T>, {
    get(_target, operation: string) {
      if (operation === "terminate") {
        assert(!terminated);
        terminated = true;
        return () => worker.terminate();
      } else if (operation === "isTerminated") {
        return terminated;
      } else {
        return async (...args: any[]) => new Promise((resolve, reject) => {
          const msgId = ++curMsgId;
          tasks.set(msgId, { resolve, reject });
          worker.postMessage({ operation, payload: args[0], msgId }, args[1] ?? []);
        });
      }
    },
  });
}
