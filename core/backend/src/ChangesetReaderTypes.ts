/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module ECDb
 */
import { AnyDb, SqliteChangeOp, SqliteValueStage } from "./SqliteChangesetReader";

// ---------------------------------------------------------------------------
// Type aliases
// ---------------------------------------------------------------------------

/**
 * Controls which properties are included in the output of [ChangesetReader]($backend).
 * @beta
 */
export enum PropertyFilter {
  /** All EC properties mapped to changed tables. */
  All = 0,
  /** For classes whose base class is `BisCore:Element`, only `BisCore:Element` properties
   * mapped to changed tables are returned. If no `BisCore:Element` class property changed,
   * only `ECInstanceId` and `ECClassId` are returned. For other classes all mapped properties
   * are returned. */
  BisCoreElement = 1,
  /** Only `ECInstanceId` and `ECClassId`. */
  InstanceKey = 2,
}

/**
 * Row-formatting options for [ChangesetReader]($backend) factory methods.
 * Controls how EC property values are represented in the returned instances.
 * @beta
 */
export interface RowFormatOptions {
  /**
   * When `false`, binary properties are returned as full `Uint8Array` values.
   * When `true` (or omitted), binary properties are summarized as `{ bytes: N }`.
   */
  abbreviateBlobs?: boolean;
  /**
   * When `true`, `ECClassId` and `RelECClassId` values are converted from hex strings
   * to fully-qualified class names (e.g. `"BisCore.DrawingModel"`).
   */
  classIdsToClassNames?: boolean;
  /**
   * When `true`, all property keys and struct sub-keys are returned in camelCase
   * (e.g. `id`, `className`, `lastMod`). Navigation property sub-keys use
   * `{ id, relClassName }` instead of `{ Id, RelECClassId }`.
   */
  useJsName?: boolean;
}

// ---------------------------------------------------------------------------
// Public interfaces
// ---------------------------------------------------------------------------

/**
 * Metadata attached to every [[ChangeInstance]].
 * @beta
 */
export interface ChangeMeta {
  /** SQLite tables that contributed columns to this change row. */
  tables: string[];
  /** Operation that produced this change. */
  op: SqliteChangeOp;
  /** Whether this is the pre-change (`"Old"`) or post-change (`"New"`) snapshot. */
  stage: SqliteValueStage;
  /** Change-stream index positions. */
  changeIndexes: number[];
  /**
   * ECInstanceId and class Id in format "<ECInstanceId>-<ECClassId>".
   */
  instanceKey: string;
  /** Reader property filter that was active when this change row was captured. */
  propFilter: PropertyFilter;
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
  rowOptions?: RowFormatOptions;
  /** `true` when the change was applied indirectly */
  isIndirectChange: boolean;
}

/**
 * An EC instance produced by [ChangesetReader]($backend) after each `step()`.
 * Contains the EC property bag plus mandatory `$meta` metadata.
 * @beta
 */
export interface ChangeInstance {
  /** Metadata describing the origin and identity of this change. */
  $meta: ChangeMeta;
  /** EC property bag (ECClassId, ECInstanceId, user-defined properties, ...). */
  [key: string]: any;
}

/**
 * Contract for any reader that produces EC-typed changed instances compatible with
 * [PartialChangeUnifier]($backend).
 * @beta
 */
export interface ChangeSource {
  /** The SQLite opcode of the current change row. */
  readonly op: SqliteChangeOp;
  /**
   * The newly-inserted or post-update EC instance.
   * `undefined` when the current row is a Delete, or when `isECTable` is `false`.
   */
  readonly inserted?: ChangeInstance;
  /**
   * The deleted or pre-update EC instance.
   * `undefined` when the current row is an Insert, or when `isECTable` is `false`.
   */
  readonly deleted?: ChangeInstance;
}

// ---------------------------------------------------------------------------
// ChangesetReader args / options
// ---------------------------------------------------------------------------

/**
 * Arguments common to all [ChangesetReader]($backend) `open*` factory methods.
 * @beta
 */
export interface ChangesetReaderArgs {
  /** The db used to resolve EC schema. Must be at or ahead of the changeset being read. */
  readonly db: AnyDb;
  /** invert the changeset operations */
  readonly invert?: boolean;
  /** Row adaptor options controlling how EC property values are formatted. */
  readonly rowOptions?: RowFormatOptions;
  /** Controls which properties are included in the change output. Defaults to PropertyFilter.All. */
  readonly propFilter?: PropertyFilter;
}
