/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/

import { assert } from "@itwin/core-bentley";
import type { WorkerImplementation } from "../common";

type WorkerRequest = {
  operation: string;
  msgId: number;
  payload?: any;
}

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
    } catch (e: unknown) {
      const error = e instanceof Error ? e : new Error("Unknown worker error");
      postMessage({ error, msgId });
    }
  }
}
