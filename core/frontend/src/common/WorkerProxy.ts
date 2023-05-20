/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/

import { assert } from "@itwin/core-bentley";

interface Task {
  reject: (result: any) => void;
  resolve: (error: Error) => void;
}

export type WorkerResult = {
  msgId: number;
  result: any;
  error?: never;
}

export type WorkerError = {
  msgId: number;
  error: Error;
  result?: never;
}

export type WorkerResponse = WorkerResult | WorkerError;

export class WorkerProxy {
  private readonly _worker: Worker;
  private _tasks = new Map<number, Task>();
  private _curMsgId = 0;
  private _terminated = false;

  public constructor(workerJsPath: string) {
    this._worker = new Worker(workerJsPath);
    this._worker.onmessage = (e: MessageEvent) => {
      const response = e.data as WorkerResponse;
      assert(typeof response === "object");
      assert("result" in response || "error" in response);

      const task = this._tasks.get(response.msgId);
      if (task) {
        this._tasks.delete(response.msgId);
        if (response.error)
          task.reject(response.error);
        else
          task.resolve(response.result);
      }
    };
  }

  // eslint-disable-next-line @typescript-eslint/no-floating-promises
  public post(operation: string, payload: any, transfer?: Transferable[]): void {
    this.execute(operation, payload, transfer);
  }

  public async execute(operation: string, payload: any, transfer?: Transferable[]): Promise<any> {
    return new Promise((resolve, reject) => {
      const msgId = ++this._curMsgId;
      this._tasks.set(msgId, { resolve, reject });
      this._worker.postMessage({ operation, payload, msgId }, transfer ?? []);
    });
  }

  public terminate(): void {
    assert(!this._terminated);
    this._worker.terminate();
    this._terminated = true;
  }
}

/** Given an interface T that defines the operations provided by a worker, produce an interface that can be used to asynchronously invoke those operations
 * from the main thread, optionally passing an array of values to be transferred from the main thread to the worker.
 *  - Every return type is converted to a `Promise` (i.e., every function becomes `async`)>.
 *  - `zeroArgFunc(): R` becomes `async zeroArgFunc(transfer?: Transferable[]): Promise<R>`.
 *  - `oneArgFunc(arg: U): R` becomes `async oneArgFunc(arg: U, transfer?: Transferable[]): Promise<R>`.
 *  - `multiArgFunc(arg1: U, arg2: V): R` becomes `async multiArgFunc(args: [U, V], transfer?: Transferable[]): Promise<R>`.
 */
export type Workerify<T> = {
  [P in keyof T]: T[P] extends () => any ? (transfer?: Transferable[]) => Promise<ReturnType<T[P]>> :
    (T[P] extends (arg: any) => any ? (arg: Parameters<T[P]>[0], transfer?: Transferable[]) => Promise<ReturnType<T[P]>> :
      (T[P] extends (...args: any) => any ? (args: Parameters<T[P]>, transfer?: Transferable[]) => Promise<ReturnType<T[P]>> : never)
    )
};

/** Given an interface T that defines the operations provided by a worker, produce an interface to which the implementation of those operations must conform.
 * The return type of each function in `T` is changed to an object holding the function result and an optional list of values to be transferred from the worker
 * to the main thread.
 * e.g., `doSomething(arg1: string, arg2: number): boolean` becomes `doSomething(arg1: string, arg2: number): { result: boolean; transfer?: Transferable[] }`.
 */
export type WorkerImpl<T> = {
  [P in keyof T]: T[P] extends (...args: any) => any ? (...args: Parameters<T[P]>) => { result: ReturnType<T[P]>; transfer?: Transferable[]; } : never;
};
