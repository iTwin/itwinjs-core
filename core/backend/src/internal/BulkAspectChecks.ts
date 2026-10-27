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

/** The lock and channel checks that already passed during one bulk ElementAspect operation.
 * Checks are only reused while `active`, i.e. while the default `ElementAspect.onBulkInsert/onBulkUpdate/onBulkDelete`
 * call the per-aspect pre-handlers. Neither check has side effects, and the state they verify cannot change while the
 * pre-handlers of one bulk call run, so skipping a repeated check of the same model or element does not change the result.
 */
interface BulkAspectChecks {
  active: boolean;
  readonly models: Set<Id64String>;
  readonly elements: Set<Id64String>;
}

const bulkAspectChecks = new WeakMap<IModelDb, BulkAspectChecks>();

/** Run a bulk ElementAspect operation (e.g. `EditTxn.insertAspects`) so that its default pre-handlers check the
 * channel of each distinct model and the lock of each distinct owning element once, instead of once per aspect.
 * The scope ends when `fn` returns or throws.
 * @internal
 */
export function withBulkAspectChecks<T>(iModel: IModelDb, fn: () => T): T {
  if (bulkAspectChecks.has(iModel))
    return fn();

  bulkAspectChecks.set(iModel, { active: false, models: new Set(), elements: new Set() });
  try {
    return fn();
  } finally {
    bulkAspectChecks.delete(iModel);
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

/** Verify that the channel of `modelId` may be written, skipping the check if it already passed in the active bulk operation.
 * @internal
 */
export function verifyAspectChannel(iModel: IModelDb, modelId: Id64String): void {
  const cache = activeChecks(iModel);
  if (cache?.models.has(modelId))
    return;

  iModel.channels[_verifyChannel](modelId);
  cache?.models.add(modelId);
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
