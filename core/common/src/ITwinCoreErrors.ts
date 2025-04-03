/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module iModels
 */

import { ITwinError } from "@itwin/core-bentley";

/**
 * An error originating from the [[SqliteDb]] api
 * @beta
 */
export interface SqliteError extends ITwinError {
  dbName: string;
}

/** @beta */
export namespace SqliteError {
  export const scope = "itwin-Sqlite";
  export type Key =
    "already-open" |
    "incompatible-version" |
    "invalid-versions-property" |
    "readonly";

  /** Determine whether an error object is a SqliteError */
  export function isError(error: unknown, key?: Key): error is SqliteError {
    return ITwinError.isError<SqliteError>(error, scope, key) && typeof error.dbName === "string";
  }

  /** Instantiate and throw a SqliteError */
  export function throwError(key: Key, message: string, dbName: string): never {
    ITwinError.throwError<SqliteError>({ iTwinErrorId: { scope, key }, message, dbName });
  }
}

/**
 * An error originating from the [[CloudSqlite]] api
 * @beta
 */
export interface CloudSqliteError extends ITwinError {
  /** The name of the database that generated the error */
  readonly dbName?: string;
  /** The version number of the error */
  readonly version?: string;
}

/** @beta */
export namespace CloudSqliteError {
  export const scope = "itwin-CloudSqlite";
  export type Key =
    "already-published" |
    "not-a-function" |
    "invalid-name" |
    "no-version-available" |
    "service-not-available" |
    /** @see WriteLockHeld for details */
    "write-lock-held" |
    /** The write lock on a container is not held but is required */
    "write-lock-not-held";

  /** thrown when an attempt to acquire the write lock for a container fails because the lock is already held by somebody else ("write-lock-held").  */
  export interface WriteLockHeld extends CloudSqliteError {
    /** @internal */
    errorNumber: number;
    /** moniker of user currently holding container's lock */
    lockedBy: string;
    /** time the lock expires */
    expires: string;
  }

  /** Determine whether an error object is a CloudSqliteError */
  export function isError<T extends CloudSqliteError>(error: unknown, key?: Key): error is T {
    return ITwinError.isError<T>(error, scope, key);
  }

  /** Instantiate and throw a CloudSqliteError */
  export function throwError<T extends CloudSqliteError>(key: Key, e: Omit<T, "name" | "iTwinErrorId">): never {
    ITwinError.throwError<CloudSqliteError>({ ...e, iTwinErrorId: { scope, key } });
  }
}

export interface ViewStoreError extends ITwinError {
  viewStoreName?: string;
}

export namespace ViewStoreError {
  export const scope = "itwin-ViewStore";
  export type Key =
    "invalid-value" |
    "invalid-member" |
    "no-owner" |
    "not-found" |
    "not-unique" |
    "group-error";

  /** Determine whether an error object is a ViewStoreError */
  export function isError<T extends ViewStoreError>(error: unknown, key?: Key): error is T {
    return ITwinError.isError<T>(error, scope, key);
  }

  /** Instantiate and throw a ViewStoreError */
  export function throwError<T extends ViewStoreError>(key: Key, e: Omit<T, "name" | "iTwinErrorId">): never {
    ITwinError.throwError<ViewStoreError>({ ...e, iTwinErrorId: { scope, key } });
  }
}

export namespace WorkspaceError {
  export const scope = "itwin-workspace-error";
  export type Key =
    "already-exists" |
    "container-exists" |
    "does-not-exist" |
    "invalid-name" |
    "no-cloud-container" |
    "load-error" |
    "load-errors" |
    "resource-exists" |
    "too-large" |
    "write-error";

  export function throwError<T extends ITwinError>(key: Key, e: Omit<T, "name" | "iTwinErrorId">): never {
    ITwinError.throwError<ITwinError>({ ...e, iTwinErrorId: { key, scope } });
  }
}


/** An error originating from the [[ChannelControl]] interface.
 * @beta
 */
export interface ChannelError extends ITwinError {
  /** The channel key that caused the error. */
  readonly channelKey: string;
}

/** @beta */
export namespace ChannelError {
  // the scope for all `ChannelError`s.
  export const scope = "itwin-ChannelControl";

  /** The set of keys identifying the different kinds of `ChannelError`s */
  export type Key =
    /** an attempt to create a channel within an existing channel */
    "may-not-nest" |
    /** an attempt to use a channel that was not "allowed" */
    "not-allowed" |
    /** the root channel already exists */
    "root-exists";

  /** Instantiate and throw a ChannelError */
  export function throwError(key: Key, message: string, channelKey: string): never {
    ITwinError.throwError<ChannelError>({ iTwinErrorId: { scope, key }, message, channelKey });
  }
  /** Determine whether an error object is a ChannelError */
  export function isError(error: unknown, key?: Key): error is ChannelError {
    return ITwinError.isError<ChannelError>(error, scope, key) && typeof error.channelKey === "string";
  }
}
