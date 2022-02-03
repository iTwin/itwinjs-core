/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module RpcInterface
 */

// cspell:ignore calltrace

import * as multiparty from "multiparty";
import * as FormData from "form-data";
import type { HttpServerRequest, RpcActivity} from "@itwin/core-common";
import { BentleyStatus, IModelError, RpcInvocation, RpcMultipart, RpcSerializedValue } from "@itwin/core-common";
import { AsyncLocalStorage } from "async_hooks";
import { assert, Logger } from "@itwin/core-bentley";

/**
 * Utility for tracing Rpc activity processing. When multiple Rpc requests are being processed asynchronously, this
 * class can be used to correlate the current calltrace with the originating RpcActivity. This is used for automatic appending
 * of RpcActivity to log messages emitted during Rpc processing. It may also be used to retrieve the user accessToken
 * from the RpcActivity.
 * @public
 */
export class RpcTrace {
  private static _storage = new AsyncLocalStorage();

  /** Get the [RpcActivity]($common) for the currently executing async, or `undefined` if there is no
   * RpcActivity in the current call stack.
   * */
  public static get currentActivity(): RpcActivity | undefined {
    return RpcTrace._storage.getStore() as RpcActivity | undefined;
  }

  /** Get the [RpcActivity]($common) for the currently executing async. Asserts that the RpcActivity
   * exists in the current call stack.
   * */
  public static get expectCurrentActivity(): RpcActivity {
    assert(undefined !== RpcTrace.currentActivity);
    return RpcTrace.currentActivity;
  }

  /** Start the processing of an RpcActivity. */
  public static async run<T>(activity: RpcActivity, fn: () => Promise<T>): Promise<T> {
    return RpcTrace._storage.run(activity, fn);
  }
}

let initialized = false;
/** @internal */
export function initializeRpcBackend() {
  if (initialized)
    return;

  initialized = true;

  RpcInvocation.runActivity = RpcTrace.run; // redirect the invocation processing to the tracer

  // set up static logger metadata to include current RpcActivity information for logs during rpc processing
  Logger.staticMetaData.set("rpc", () => RpcInvocation.sanitizeForLog(RpcTrace.currentActivity));

  RpcMultipart.createStream = (value: RpcSerializedValue) => {
    const form = new FormData();
    RpcMultipart.writeValueToForm(form, value);
    return form;
  };

  RpcMultipart.parseRequest = async (req: HttpServerRequest) => {
    return new Promise<RpcSerializedValue>((resolve, reject) => {
      const form = new multiparty.Form({ maxFieldsSize: Infinity });
      form.on("error", (err) => {
        reject(err);
      });

      const value = RpcSerializedValue.create();
      const data: { [index: string]: { size: number, chunks: Buffer[] } } = {};

      form.on("part", (part: multiparty.Part) => {
        part.on("data", (chunk: string | Buffer) => {
          if (part.name === "objects") {
            value.objects += chunk.toString();
          } else if (Buffer.isBuffer(chunk)) {
            if (!data[part.name]) {
              data[part.name] = { size: 0, chunks: [] };
            }

            data[part.name].size += chunk.byteLength;
            data[part.name].chunks.push(chunk);
          } else {
            throw new IModelError(BentleyStatus.ERROR, "Unknown input.");
          }
        });
      });

      form.on("close", () => {
        let i = 0;
        for (; ;) {
          const part = data[`data-${i}`];
          if (!part) {
            break;
          }

          value.data.push(Buffer.concat(part.chunks, part.size));
          ++i;
        }

        resolve(value);
      });

      form.parse(req);
    });
  };
}

