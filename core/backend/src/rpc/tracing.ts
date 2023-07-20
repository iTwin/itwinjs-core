/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module RpcInterface
 */

// cspell:ignore calltrace

import { assert, Logger, SpanKind, Tracing } from "@itwin/core-bentley";
import { RpcActivity, RpcInvocation } from "@itwin/core-common";
import { AsyncLocalStorage } from "async_hooks";
import { BackendLoggerCategory } from "../BackendLoggerCategory";
import { IModelHost } from "../IModelHost";

/* eslint-disable deprecation/deprecation */

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

  /** Start the processing of an RpcActivity inside an OpenTelemetry span */
  public static async runWithSpan<T>(activity: RpcActivity, fn: () => Promise<T>): Promise<T> {
    return Tracing.withSpan(activity.rpcMethod ?? "unknown RPC method", async () => RpcTrace.run(activity, fn), {
      attributes: { ...RpcInvocation.sanitizeForLog(activity) },
      kind: SpanKind.SERVER,
    });
  }
}

/** @internal */
export function initializeTracing(enableOpenTelemetry: boolean = false) {
  RpcInvocation.runActivity = async (activity, fn) => RpcTrace.run(activity, fn); // redirect the invocation processing to the tracer

  if (enableOpenTelemetry) {
    try {
      // eslint-disable-next-line @typescript-eslint/no-var-requires
      const api = require("@opentelemetry/api");
      const tracer = api.trace.getTracer("@itwin/core-backend", IModelHost.backendVersion);
      Tracing.enableOpenTelemetry(tracer, api);
      RpcInvocation.runActivity = async (activity, fn) => RpcTrace.runWithSpan(activity, fn); // wrap invocation in an OpenTelemetry span in addition to RpcTrace
    } catch (e) {
      // eslint-disable-next-line @typescript-eslint/naming-convention
      Logger.logError(BackendLoggerCategory.IModelHost, "Failed to initialize OpenTelemetry");
      Logger.logException(BackendLoggerCategory.IModelHost, e);
    }
  }

  // set up static logger metadata to include current RpcActivity information for logs during rpc processing
  Logger.staticMetaData.set("rpc", () => RpcInvocation.sanitizeForLog(RpcTrace.currentActivity));
}
