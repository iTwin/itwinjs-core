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
  /** Change-stream index positions. */
  changeIndexes: number[];
  /**
   * Native instance key computed by the native layer.
   * Encodes ECInstanceId and class Id.
   */
  nativeKey: string;
  /** Reader mode that was active when this change row was captured. */
  mode: string;
  /** EC property names fetched from the current row of changeset or transaction or any other change stream.
   For compound data properties like point2d, point3d or navigation properties,
  the full name of the property is returned in case all the components of the property are fetched from the change.
  If all of the components are not fetched from the changes(meaning they did not change),
  then the individual component names which changed are returned smartly by using `.` as a separator (e.g. "MyPoint.X", "MyPoint.Y" for a point3d property "MyPoint" if only X and Y changed).
  For struct properties the property names are always returned in the "StructProp.MemberName" format.
  So if only X changed for a point2d property named "Myp2d" inide a struct "CustomStruct", the returned property name will be "CustomStruct.Myp2d.X".
  Similaly if both X and Y changed for the same point2d property, the returned property name will be "CustomStruct.Myp2d". */
  changeFetchedPropNames: string[];
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
  /** invert the changeset operations */
  readonly invert?: boolean;
  /** Row adaptor options controlling how EC property values are formatted. */
  readonly rowOptions?: IModelJsNative.ECSqlRowAdaptorOptions;
  /** Controls which properties are included in the change output. Defaults to `All_Properties`. */
  readonly mode?: IModelJsNative.ECChangesetReader.Mode;
}
