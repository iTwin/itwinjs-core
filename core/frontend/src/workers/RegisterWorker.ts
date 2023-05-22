/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module Utils
 */

import { assert } from "@itwin/core-bentley";
import type { WorkerImplementation } from "../common/WorkerProxy";

interface WorkerRequest {
  /** The name of the method in the worker's interface to invoke. */
  operation: string;
  /** Correlates the response to the caller on the main thread to resolve/reject the promise. */
  msgId: number;
  /** Arguments to `operation`. */
  payload?: any;
}

/** Configure an implementation of the operations defined by `T` to execute on a worker thread.
 * @internal
 */
export function registerWorker<T>(impl: WorkerImplementation<T>): void {
  onmessage = (e: MessageEvent) => {
    const req = e.data as WorkerRequest;
    const msgId = req.msgId;
    try {
      assert(typeof req === "object" && "operation" in req && "payload" in req && "msgId" in req);
      const func = (impl as any)[req.operation];
      assert(typeof func === "function");
      const ret = func(req.payload);
      if (typeof ret === "object" && "transfer" in ret)
        postMessage({ result: ret.result, msgId }, { transfer: ret.transfer });
      else
        postMessage({ result: ret, msgId });
    } catch (err: unknown) {
      const error = err instanceof Error ? err : new Error("Unknown worker error");
      postMessage({ error, msgId });
    }
  };
}
