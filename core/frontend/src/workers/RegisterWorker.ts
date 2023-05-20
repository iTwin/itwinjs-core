/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/

import { assert } from "@itwin/core-bentley";
import type { WorkerResponse } from "../common";

export type WorkerRequest = {
  operation: string;
  payload?: any;
}

export function registerWorker<T extends WorkerRequest>(func: (request: T) => any): void {
  onmessage = (e: MessageEvent) => {
    const req = e.data as T & { msgId: number };
    const msgId = req.msgId;
    let response: WorkerResponse;
    try {
      assert(typeof req === "object" && "operation" in req && "payload" in req && "msgId" in req);
      response = {
        result: func(req),
        msgId,
      };
    } catch (e: unknown) {
      const error = e instanceof Error ? e : new Error("Unknown worker error");
      response = {
        error,
        msgId,
      };
    }

    postMessage(response);
  };
}
