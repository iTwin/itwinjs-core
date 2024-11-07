/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module iModels
 */

import {
  BentleyError, BentleyStatus, BriefcaseStatus, ChangeSetStatus, DbResult, IModelHubStatus, IModelStatus, LoggingMetaData,
} from "@itwin/core-bentley";

export {
  BentleyStatus, BentleyError, IModelStatus, BriefcaseStatus, DbResult, ChangeSetStatus,
} from "@itwin/core-bentley";

export type { GetMetaDataFunction, LogFunction, LoggingMetaData } from "@itwin/core-bentley";

/** Numeric values for common errors produced by iTwin.js APIs, typically provided by [[IModelError]].
 * The values within each of these `enum`s are guaranteed not to conflict with one another.
 * @public
 */
export type IModelErrorNumber = IModelStatus | DbResult | BentleyStatus | BriefcaseStatus | ChangeSetStatus;

/** The error type thrown by this module.
 * Creating subclasses of IModelError should be avoided. Instead use [[ITwinError]].
 * @see [[ITwinError]]
 * @see [[IModelErrorNumber]] for commonly-used error codes.
 * @public
 */
export class IModelError extends BentleyError {
  public constructor(errorNumber: IModelErrorNumber | number, message: string, getMetaData?: LoggingMetaData) {
    super(errorNumber, message, getMetaData);
  }
}

/** The state of a lock. See [Acquiring locks on elements.]($docs/learning/backend/ConcurrencyControl.md#acquiring-locks-on-elements).
 * @public
 */
export enum LockState {
  /** The element is not locked */
  None = 0,
  /** Holding a shared lock on an element blocks other users from acquiring the Exclusive lock it. More than one user may acquire the shared lock. */
  Shared = 1,
  /** A Lock that permits modifications to an element and blocks other users from making modifications to it.
   * Holding an exclusive lock on an "owner" (a model or a parent element), implicitly exclusively locks all its members.
   */
  Exclusive = 2,
}

/** Detailed information about a particular object Lock that is causing the Lock update conflict.
 * An example of a lock update conflict would be attempting to use [LockControl.acquireLocks]($backend) on an object that is already locked by another Briefcase.
 * @public @deprecated in 4.10 Use [InUseLock]($common) instead.
*/
export interface ConflictingLock {
  /** Id of the object that is causing conflict. */
  objectId: string;
  /**
     * The level of conflicting lock. Possible values are {@link LockState.Shared}, {@link LockState.Exclusive}.
     * See {@link LockState}.
     */
  state: LockState;
  /** An array of Briefcase ids that hold this lock. */
  briefcaseIds: number[];
}

/**
 * An error raised when there is a lock conflict detected.
 * Typically this error would be thrown by [LockControl.acquireLocks]($backend) when you are requesting a lock on an element that is already held by another briefcase.
 * @public @deprecated in 4.10 Use [InUseLocksError]($common) instead.
*/
export class ConflictingLocksError extends IModelError {
  // eslint-disable-next-line @typescript-eslint/no-deprecated
  public conflictingLocks?: ConflictingLock[];
  // eslint-disable-next-line @typescript-eslint/no-deprecated
  constructor(message: string, getMetaData?: LoggingMetaData, conflictingLocks?: ConflictingLock[]) {
    super(IModelHubStatus.LockOwnedByAnotherBriefcase, message, getMetaData);
    this.conflictingLocks = conflictingLocks;
  }

}

/** @public */
export class ServerError extends IModelError {
  public constructor(errorNumber: number, message: string) {
    super(errorNumber, message);
    this.name = `Server error (${errorNumber})`;
  }
}

/** @public */
export class ServerTimeoutError extends ServerError {
  public constructor(message: string) {
    super(IModelStatus.ServerTimeout, message);
    this.name = "Server timeout error";
  }
}

/** @public */
export class BackendError extends IModelError {
  public constructor(errorNumber: number, name: string, message: string, getMetaData?: LoggingMetaData) {
    super(errorNumber, message, getMetaData);
    this.name = name;
  }
}

/** Intended for API "no content" semantics where the error case should not trigger application failure monitoring systems.
 * @public
 */
export class NoContentError extends IModelError {
  public constructor() {
    super(IModelStatus.NoContent, "No Content");
  }
}
