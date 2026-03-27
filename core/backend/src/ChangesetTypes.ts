/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module SQLiteDb
 */
import { Id64String } from "@itwin/core-bentley";
import { ECDb } from "./ECDb";
import { IModelDb } from "./IModelDb";

/** Db from which schema will be read. It should be from a timeline to which the changeset belongs.
 * @beta
 */
export type AnyDb = IModelDb | ECDb;

/** Operation that caused the change.
 * @beta
 */
export type SqliteChangeOp = "Inserted" | "Updated" | "Deleted";

/** Stage is the version of the value that needs to be read.
 * @beta
 */
export type SqliteValueStage = "Old" | "New";

/**
 * Metadata attached to every changed EC instance.
 * @beta
 */
export interface ChangeMetaData {
  /** List of SQLite tables that contributed to this EC change. */
  tables: string[];
  /** Fully-qualified class name of the changed EC instance, if known. */
  classFullName?: string;
  /** SQLite operation that caused the change. */
  op: SqliteChangeOp;
  /** Whether this is the pre-change (Old) or post-change (New) value. */
  stage: SqliteValueStage;
  /** Fallback root class id when the ECClassId is not present in the change row. */
  fallbackClassId?: Id64String;
  /** Change index position(s) in the changeset stream that produced this instance. */
  changeIndexes: number[];
}

/**
 * Represents an EC instance derived from a low-level SQLite change.
 * @beta
 */
export interface ChangedECInstance {
  // eslint-disable-next-line @typescript-eslint/naming-convention
  ECInstanceId: Id64String;
  // eslint-disable-next-line @typescript-eslint/naming-convention
  ECClassId?: Id64String;
  $meta?: ChangeMetaData;
  [key: string]: any;
}

/**
 * Shared contract for any reader that produces EC-typed changed instances
 * that can feed {@link PartialECChangeUnifier}.
 *
 * Both {@link ChangesetECAdaptor} and {@link ECChangesetReader} implement this interface,
 * allowing `PartialECChangeUnifier.appendFrom` to accept either without coupling
 * to a specific reader implementation.
 *
 * Every `inserted` / `deleted` instance exposed by an `IECChangeSource` **must**
 * carry a `$meta` property; `PartialECChangeUnifier` relies on it.
 * @beta
 */
export interface IECChangeSource {
  /** The SQLite opcode of the current change row. */
  readonly op: SqliteChangeOp;
  /**
   * The newly-inserted or post-update EC instance.
   * Must carry `$meta` with at minimum `stage: "New"`, `op`, `changeIndexes`, and `tables`.
   * `undefined` when the current row is a Delete.
   */
  readonly inserted?: ChangedECInstance;
  /**
   * The deleted or pre-update EC instance.
   * Must carry `$meta` with at minimum `stage: "Old"`, `op`, `changeIndexes`, and `tables`.
   * `undefined` when the current row is an Insert.
   */
  readonly deleted?: ChangedECInstance;
}
