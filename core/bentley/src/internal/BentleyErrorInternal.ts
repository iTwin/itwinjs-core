/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module Errors
 */

/** Return codes for methods which perform repository management operations. */
export enum RepositoryStatus {
  Success = 0,
  /** The repository server did not respond to a request */
  ServerUnavailable = 0x15001,
  /** A requested lock was already held by another briefcase */
  LockAlreadyHeld = 0x15002,
  /** Failed to sync briefcase manager with server */
  SyncError = 0x15003,
  /** Response from server not understood */
  InvalidResponse = 0x15004,
  /** An operation requires local changes to be committed or abandoned */
  PendingTransactions = 0x15005,
  /** A lock cannot be relinquished because the associated object has been modified */
  LockUsed = 0x15006,
  /** An operation required creation of a ChangeSet, which failed */
  CannotCreateChangeSet = 0x15007,
  /** Request to server not understood */
  InvalidRequest = 0x15008,
  /** A change set committed to the server must be integrated into the briefcase before the operation can be completed */
  ChangeSetRequired = 0x15009,
  /** A requested DgnCode is reserved by another briefcase or in use */
  CodeUnavailable = 0x1500A,
  /** A DgnCode cannot be released because it has not been reserved by the requesting briefcase */
  CodeNotReserved = 0x1500B,
  /** A DgnCode cannot be relinquished because it has been used locally */
  CodeUsed = 0x1500C,
  /** A required lock is not held by this briefcase */
  LockNotHeld = 0x1500D,
  /** Repository is currently locked, no changes allowed */
  RepositoryIsLocked = 0x1500E,
  /** Channel write constraint violation, such as an attempt to write outside the designated channel. */
  ChannelConstraintViolation = 0x1500F,
}

/** When you want to associate an explanatory message with an error status value. */
export interface StatusCodeWithMessage<ErrorCodeType> {
  status: ErrorCodeType;
  message: string;
}

