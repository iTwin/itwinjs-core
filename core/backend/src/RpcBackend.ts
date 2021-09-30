/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module RpcInterface
 */

import * as multiparty from "multiparty";
import * as FormData from "form-data";
import { BentleyStatus, HttpServerRequest, IModelError, RpcActivity, RpcInvocation, RpcMultipart, RpcSerializedValue } from "@itwin/core-common";
import { AsyncLocalStorage } from "async_hooks";
import { Logger } from "@itwin/core-bentley";


export class RpcTracer {
  private static storage = new AsyncLocalStorage();

  /** Get the [RpcActivity]($common) for the currently executing async, or undefined if there is no RpcActivity in the call stack. */
  public static get currentActivity(): RpcActivity | undefined {
    return RpcTracer.storage.getStore() as RpcActivity | undefined;
  }

  public static async run<T>(activity: RpcActivity, fn: () => Promise<T>): Promise<T> {
    return RpcTracer.storage.run(activity, fn);
  }
}

let initialized = false;

/** @internal */
export function initializeRpcBackend() {
  if (initialized)
    return;

  initialized = true;

  RpcInvocation.runActivity = RpcTracer.run;
  Logger.staticMetaData.set("rpc", () => {
    const activity = RpcTracer.currentActivity;
    return activity ? {
      activityId: activity.activityId,
      sessionId: activity.sessionId,
      applicationId: activity.applicationId,
      applicationVersion: activity.applicationVersion,
      methodName: activity.methodName,
    } : undefined;
  });

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

