/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import { BeDuration } from "@itwin/core-bentley";

const recursiveWait = async (pred: () => boolean, repeater: () => Promise<void>) => {
  if (pred()) {
    await BeDuration.wait(0);
    await repeater();
  }
};

/**
 * @internal Used for testing only.
 */
export const waitForAllAsyncs = async (handlers: Array<{ pendingAsyncs: Set<string> }>) => {
  const pred = () => handlers.some((h) => (h.pendingAsyncs.size > 0));
  await recursiveWait(pred, async () => waitForAllAsyncs(handlers));
};

/**
 * @internal Used for testing only.
 */
export const waitForPendingAsyncs = async (handler: { pendingAsyncs: Set<string> }) => {
  const initialAsyncs = [...handler.pendingAsyncs];
  const pred = () => initialAsyncs.filter((initial) => handler.pendingAsyncs.has(initial)).length > 0;
  const recursiveWaitInternal = async (): Promise<void> => recursiveWait(pred, recursiveWaitInternal);
  await recursiveWaitInternal();
};
