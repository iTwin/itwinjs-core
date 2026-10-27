/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module ElementAspects
 */

import { Id64String } from "@itwin/core-bentley";
import type { IModelDb } from "../IModelDb";
import { _verifyChannel } from "./Symbols";

/** The lock checks that already passed during one bulk ElementAspect operation.
 * Checks are only reused while `active`, i.e. while the default `ElementAspect.onBulkInsert/onBulkUpdate/onBulkDelete`
 * call the per-aspect pre-handlers. The lock check has no side effects, and locks can only be released asynchronously,
 * so they cannot be lost while the synchronous pre-handlers of one bulk call run.
 * Channel checks are not cached here: a pre-handler may revoke a channel, and `ChannelAdmin` already caches with invalidation.
 */
interface BulkAspectChecks {
  active: boolean;
  readonly elements: Set<Id64String>;
}

const bulkAspectChecks = new WeakMap<IModelDb, BulkAspectChecks>();

/** Run a bulk ElementAspect operation (e.g. `EditTxn.insertAspects`) so that its default pre-handlers check the
 * lock of each distinct owning element once, instead of once per aspect.
 * A nested bulk operation gets its own scope. The scope ends when `fn` returns or throws.
 * @internal
 */
export function withBulkAspectChecks<T>(iModel: IModelDb, fn: () => T): T {
  const outer = bulkAspectChecks.get(iModel);
  bulkAspectChecks.set(iModel, { active: false, elements: new Set() });
  try {
    return fn();
  } finally {
    if (undefined === outer)
      bulkAspectChecks.delete(iModel);
    else
      bulkAspectChecks.set(iModel, outer);
  }
}

/** Call `fn` (a loop over the per-aspect pre-handlers) with the checks of the enclosing bulk operation enabled.
 * Has no effect outside of [[withBulkAspectChecks]].
 * @internal
 */
export function withActiveBulkAspectChecks(iModel: IModelDb, fn: () => void): void {
  const checks = bulkAspectChecks.get(iModel);
  if (undefined === checks || checks.active)
    return fn();

  checks.active = true;
  try {
    fn();
  } finally {
    checks.active = false;
  }
}

/** Verify that the channel of `modelId` may be written.
 * @internal
 */
export function verifyAspectChannel(iModel: IModelDb, modelId: Id64String): void {
  iModel.channels[_verifyChannel](modelId);
}

/** Verify that the exclusive lock on `elementId` is held, skipping the check if it already passed in the active bulk operation.
 * @internal
 */
export function verifyAspectLock(iModel: IModelDb, elementId: Id64String, operation: string): void {
  const cache = activeChecks(iModel);
  if (cache?.elements.has(elementId))
    return;

  iModel.locks.checkExclusiveLock(elementId, "element", operation);
  cache?.elements.add(elementId);
}

function activeChecks(iModel: IModelDb): BulkAspectChecks | undefined {
  const checks = bulkAspectChecks.get(iModel);
  return checks?.active ? checks : undefined;
}
