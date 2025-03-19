/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module iModels
 */

import { BriefcaseId } from "./BriefcaseTypes";
import { LockState } from "./IModelError";
import { isITwinError, ITwinError, throwITwinError } from "./ITwinError";

export const itwinCoreExceptions = "itwinjs-core-exception";

export function throwITwinCoreError(args: Omit<ITwinError, "namespace">): never {
  throwITwinError({ namespace: itwinCoreExceptions, ...args });
}

export function isITwinCoreError<T extends ITwinError>(error: any, errorKey: string): error is T {
  return isITwinError(error, itwinCoreExceptions, errorKey);
}

/**
 * Values for ErrorKey for exceptions thrown by itwinjs-core packages
 * @beta
 */
export const iTwinCoreErrors = {
  lockInUse: "lock-in-use",
  channelMayNotNest: "channel-may-not-nest",
  channelNotAllowed: "channel-not-allowed",
  channelRootExists: "channel-root-exists"
} as const;

/**
 * Detailed information about an element lock that is in use by someone else.
 * @beta
 */
export interface InUseLock {
  /** Id of the object that is causing conflict. */
  objectId: string;
  /**
   * The level of conflicting lock. Possible values are {@link LockState.Shared}, {@link LockState.Exclusive}.
   * See {@link LockState}.
   */
  state: LockState;

  /** Briefcase that holds this lock. */
  briefcaseId: BriefcaseId;

  otherBriefcases?: BriefcaseId[];
}


/**
 * An error raised when there is a lock conflict detected.
 * Typically this error would be thrown by [LockControl.acquireLocks]($backend) when you are requesting a lock on an element that is already held by another briefcase.
 * @beta
*/
export interface InUseLocksError extends ITwinError {
  inUseLocks: InUseLock[];
}
