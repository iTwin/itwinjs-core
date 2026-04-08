/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module iModels
 */

import { GuidString, ITwinError } from "@itwin/core-bentley";

/**
 * An error originating from the [SQLiteDb]($backend) API.
 * @beta
 */
export interface SqliteError extends ITwinError {
  /** The name of the database for this problem. */
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
 * An error originating from the [CloudSqlite]($backend) API.
 * @beta
 */
export interface CloudSqliteError extends ITwinError {
  /** The name of the database that generated the error */
  readonly dbName?: string;
  /** The name of the container associated with the error */
  readonly containerId?: string;
}

/** @beta */
export namespace CloudSqliteError {
  export const scope = "itwin-CloudSqlite";
  export type Key =
    "already-published" |
    "copy-error" |
    "invalid-name" |
    "no-version-available" |
    "not-a-function" |
    "service-not-available" |
    /** The write lock cannot be acquired because it is currently held by somebody else.
     * @see WriteLockHeld for details
     */
    "write-lock-held" |
    /** The write lock on a container is not held, but is required for this operation */
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

/** Errors thrown by the [ViewStore]($backend) API.
 * @beta
 */
export interface ViewStoreError extends ITwinError {
  /** The name of the ViewStore that generated the error */
  viewStoreName?: string;
}

/** @beta */
export namespace ViewStoreError {
  export const scope = "itwin-ViewStore";
  export type Key =
    "invalid-value" |
    "invalid-member" |
    "no-owner" |
    "not-found" |
    "not-unique" |
    "no-viewstore" |
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

/**
 * Errors thrown by the [Workspace]($backend) APIs.
 * @beta
 */
export namespace WorkspaceError {
  export const scope = "itwin-Workspace";
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

  /** Determine whether an error object is a WorkspaceError */
  export function isError<T extends ITwinError>(error: unknown, key?: Key): error is T {
    return ITwinError.isError<T>(error, scope, key);
  }

  export function throwError<T extends ITwinError>(key: Key, e: Omit<T, "name" | "iTwinErrorId">): never {
    ITwinError.throwError<ITwinError>({ ...e, iTwinErrorId: { key, scope } });
  }
}

/**
 * Errors thrown by iTwin settings container APIs.
 * @beta
 */
export interface ITwinSettingsError extends ITwinError {
  /** The iTwin associated with this settings error, when available. */
  readonly iTwinId?: GuidString;
  /** The priority associated with this settings error, when available. */
  readonly priority?: number;
}

/** @beta */
export namespace ITwinSettingsError {
  export const scope = "itwin-settings";
  export type Key =
    "failed-to-obtain-container-token" |
    "multiple-itwin-settings-containers" |
    "no-cloud-container" |
    "blob-service-unavailable" |
    "invalid-priority" |
    "unknown-setting";

  /** Determine whether an error object is an ITwinSettingsError. */
  export function isError(error: unknown, key?: Key): error is ITwinSettingsError {
    return ITwinError.isError<ITwinSettingsError>(error, scope, key);
  }

  /** Instantiate and throw an ITwinSettingsError. */
  export function throwError<T extends ITwinSettingsError>(key: Key, e: Omit<T, "name" | "iTwinErrorId">): never {
    ITwinError.throwError<ITwinSettingsError>({ ...e, iTwinErrorId: { scope, key } });
  }
}


/** Errors originating from the [ChannelControl]($backend) interface.
 * @beta
 */
export interface ChannelControlError extends ITwinError {
  /** The channel key that caused the error. */
  readonly channelKey: string;
}

/** @beta */
export namespace ChannelControlError {
  /** the ITwinError scope for `ChannelControlError`s. */
  export const scope = "itwin-ChannelControl";

  /** Keys that identify `ChannelControlError`s */
  export type Key =
    /** an attempt to create a channel within an existing channel */
    "may-not-nest" |
    /** an attempt to use a channel that was not "allowed" */
    "not-allowed" |
    /** the root channel already exists */
    "root-exists";

  /** Instantiate and throw a ChannelControlError */
  export function throwError(key: Key, message: string, channelKey: string): never {
    ITwinError.throwError<ChannelControlError>({ iTwinErrorId: { scope, key }, message, channelKey });
  }
  /** Determine whether an error object is a ChannelControlError */
  export function isError(error: unknown, key?: Key): error is ChannelControlError {
    return ITwinError.isError<ChannelControlError>(error, scope, key) && typeof error.channelKey === "string";
  }
}

/**
 * An error originating from the [EditTxn]($backend) API.
 * @beta
 */
export interface EditTxnError extends ITwinError {
  /** The iModel key associated with the error. */
  readonly iModelKey?: string;
  /** The description of the EditTxn that caused the error, if applicable. */
  readonly description?: string;
}

/** @beta */
export namespace EditTxnError {
  /** the ITwinError scope for `EditTxnError`s. */
  export const scope = "itwin-EditTxn";

  /** Keys that identify `EditTxnError`s */
  export type Key =
    /** an attempt to start an EditTxn when one is already active */
    "already-active" |
    /** an attempt to modify an iModel through the implicit transaction when explicit transactions are enforced */
    "implicit-txn-write-disallowed" |
    /** an attempt to start an EditTxn when unsaved changes are already present */
    "unsaved-changes" |
    /** an attempt to perform an operation that requires an active EditTxn when none is active */
    "not-active" |
    /** an attempt to use an EditTxn with the wrong iModel */
    "wrong-imodel";

  /** Instantiate and throw an EditTxnError */
  export function throwError(key: Key, message: string, iModelKey?: string, description?: string): never {
    ITwinError.throwError<EditTxnError>({ iTwinErrorId: { scope, key }, message, iModelKey, description });
  }

  /** Determine whether an error object is an EditTxnError */
  export function isError(error: unknown, key?: Key): error is EditTxnError {
    return ITwinError.isError<EditTxnError>(error, scope, key);
  }
}
