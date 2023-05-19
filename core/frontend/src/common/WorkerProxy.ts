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
}
