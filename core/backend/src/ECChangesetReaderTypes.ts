/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module ECDb
 */
import { IModelJsNative } from "@bentley/imodeljs-native";
import { AnyDb } from "./SqliteChangesetReader";

// ---------------------------------------------------------------------------
// Type aliases
// ---------------------------------------------------------------------------

/**
 * Operation that caused an EC change.
 * @beta
 */
export type ECNativeChangeOp = "Inserted" | "Updated" | "Deleted";

/**
 * Which snapshot of the changed EC row.
 * @beta
 */
export type ECNativeChangeStage = "Old" | "New";

// ---------------------------------------------------------------------------
// Public interfaces
// ---------------------------------------------------------------------------

/**
 * Metadata attached to every {@link ECNativeChangeInstance}.
 * @beta
 */
export interface ECNativeChangeMeta {
  /** SQLite tables that contributed columns to this change row. */
  tables: string[];
  /** Operation that produced this change. */
  op: ECNativeChangeOp;
  /** Whether this is the pre-change (`"Old"`) or post-change (`"New"`) snapshot. */
  stage: ECNativeChangeStage;
  /** Change-stream index positions (one per table contribution). */
  changeIndexes: number[];
  /**
   * Native instance key computed by the native layer.
   * Encodes ECInstanceId and root class; used as the merge key in
   * {@link ECNativePartialChangeUnifier}.
   */
  nativeKey: string;
  /** Reader mode that was active when this change row was captured. */
  mode: string;
  /** Set of EC property names fetched from the changeset or transaction or change binary for this row. */
  changesetFetchedProps: Set<string>;
  /** Row adaptor options that were active when this change row was captured. */
  rowOptions?: IModelJsNative.ECSqlRowAdaptorOptions;
  /** `true` when the change was applied indirectly */
  isIndirectChange: boolean;
}

/**
 * An EC instance produced by {@link ECChangesetReader} after each `step()`.
 * Contains the EC property bag plus mandatory `$meta` metadata.
 * @beta
 */
export interface ECNativeChangeInstance {
  /** Metadata describing the origin and identity of this change. */
  $meta: ECNativeChangeMeta;
  /** EC property bag (ECClassId, ECInstanceId, user-defined properties, ...). */
  [key: string]: any;
}

/**
 * Contract for any reader that produces EC-typed changed instances compatible with
 * {@link ECNativePartialChangeUnifier}.
 * @beta
 */
export interface ECNativeChangeSource {
  /** The SQLite opcode of the current change row. */
  readonly op: ECNativeChangeOp;
  /**
   * `true` when the current row belongs to an EC-mapped table.
   * `false` for internal SQLite tables
   * When `false`, `inserted` and `deleted` are both `undefined`.
   */
  readonly isECTable: boolean;
  /**
   * The newly-inserted or post-update EC instance.
   * `undefined` when the current row is a Delete, or when `isECTable` is `false`.
   */
  readonly inserted?: ECNativeChangeInstance;
  /**
   * The deleted or pre-update EC instance.
   * `undefined` when the current row is an Insert, or when `isECTable` is `false`.
   */
  readonly deleted?: ECNativeChangeInstance;
}

// ---------------------------------------------------------------------------
// ECChangesetReader args / options
// ---------------------------------------------------------------------------

/**
 * Arguments common to all {@link ECChangesetReader} `open*` factory methods.
 * @beta
 */
export interface ECChangesetReaderArgs {
  /** The db used to resolve EC schema. Must be at or ahead of the changeset being read. */
  readonly db: AnyDb;
  /** When `true`, all operations are logically inverted (Insert↔Delete). */
  readonly invert?: true;
  /** Row adaptor options controlling how EC property values are formatted. */
  readonly rowOptions?: IModelJsNative.ECSqlRowAdaptorOptions;
  /** Controls which properties are included in the change output. Defaults to `All_Properties`. */
  readonly mode?: IModelJsNative.ECChangesetReader.Mode;
}
