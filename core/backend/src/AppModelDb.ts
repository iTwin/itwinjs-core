/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module SQLiteDb
 */

import { IModelJsNative } from "@bentley/imodeljs-native";
import { LocalFileName } from "@itwin/core-common";
import { IModelNative } from "./internal/NativePlatform";
import { SQLiteDb } from "./SQLiteDb";
import { _nativeDb } from "./internal/Symbols";

/** The kind of change carried by an *AppModel* changeset file.
 * @internal
 */
export enum AppModelChangesetType {
  /** The changeset contains data changes only. */
  Regular = 0,
  /** The changeset contains schema (DDL) changes, possibly along with data changes. */
  Schema = 1,
}

/** Properties that describe an *AppModel* changeset file produced by [[AppModelDb.beginCreateChangeset]].
 *
 * A changeset is identified by a SHA1 [[id]] computed from its [[parentId]] and its file contents, exactly as iModel
 * changesets are. This forms a parent/child chain and lets a changeset be validated before it is merged.
 * @internal
 */
export interface AppModelChangesetProps {
  /** The SHA1 id of this changeset, computed from its parent id and its file contents. */
  readonly id: string;
  /** The id of the parent changeset this changeset chains onto (`""` for the first changeset). */
  readonly parentId: string;
  /** The guid of the [[AppModelDb]] this changeset originated from. */
  readonly dbGuid: string;
  /** Whether this changeset carries schema (DDL) changes or data-only changes. */
  readonly changesetType: AppModelChangesetType;
  /** The full path of the changeset file. */
  readonly fileName: LocalFileName;
}

/**
 * A [[SQLiteDb]] that carries the *AppModel* profile and can serialize its local changes into *AppModel* changeset
 * files that can be validated and merged into other `AppModelDb`s with the same schema.
 *
 * Unlike a generic [[SQLiteDb]], an `AppModelDb` stamps an AppModel profile when it is created and automatically records
 * local changes into an internal txns table on each [[saveChanges]] (when open read-write). Use [[beginCreateChangeset]]
 * and [[endCreateChangeset]] to combine the recorded txns into a changeset file, and [[applyChangeset]] to validate and
 * merge a changeset file into another `AppModelDb`. Each changeset is SHA1-identified and chains onto the db's current
 * changeset (see [[getParentChangesetId]]), so a changeset can be verified before it is applied.
 *
 * AppModel changesets are independent of the iModel changeset pipeline.
 * @internal
 */
export class AppModelDb extends SQLiteDb {
  /** @internal */
  public declare readonly [_nativeDb]: IModelJsNative.AppModelDb;

  /** @internal */
  protected override createNativeDb(): IModelJsNative.AppModelDb {
    return new IModelNative.platform.AppModelDb();
  }

  /** Commit the outermost transaction, writing changes to the file, then restart the default transaction.
   * @param description an optional human-readable description stored on the resulting txn.
   * @internal
   */
  public override saveChanges(description?: string): void {
    this[_nativeDb].saveChanges(description);
  }

  /** Begin creating an AppModel changeset from all changes recorded since the last changeset. Writes the changeset
   * file and returns its properties (the changeset is SHA1-identified and chains onto this db's current changeset,
   * see [[getParentChangesetId]]), but does not yet delete the captured txns or advance this db's changeset id.
   * Call [[endCreateChangeset]] once the changeset file has been safely persisted to finalize.
   * @param changesetFileName the full path of the changeset file to create.
   * @returns the properties of the created changeset.
   * @throws if there are no recorded changes, or if the file could not be written.
   * @internal
   */
  public beginCreateChangeset(changesetFileName: LocalFileName): AppModelChangesetProps {
    // The native and core-backend changesetType enums have identical values; cast across the boundary.
    return this[_nativeDb].beginCreateChangeset(changesetFileName) as unknown as AppModelChangesetProps;
  }

  /** Finalize the changeset started by [[beginCreateChangeset]]: delete the txns that were captured into it (so the
   * next changeset contains only subsequent changes) and advance this db's current changeset id to the newly created
   * changeset (so the next changeset chains onto it). Call only after the changeset file has been safely persisted.
   * @throws if there is no changeset creation in progress.
   * @internal
   */
  public endCreateChangeset(): void {
    this[_nativeDb].endCreateChangeset();
  }

  /** Validate and merge an AppModel changeset into this database, advancing this db's current changeset id.
   * The changeset is first validated: it must have originated from this db (matching db guid), chain onto this db's
   * current changeset (matching parent id), and have a correct SHA1 id for its contents. Schema (DDL) and data changes
   * are then applied atomically: if any change conflicts with existing data, the entire changeset is aborted and
   * rolled back, and this method throws.
   * @param props the properties of the changeset to apply. Its [[AppModelChangesetProps.fileName]] must point at the file.
   * @throws if the changeset did not originate from this db, does not chain onto its current changeset, has an incorrect
   * id, or results in a conflict.
   * @internal
   */
  public applyChangeset(props: AppModelChangesetProps): void {
    this[_nativeDb].applyChangeset(props as unknown as IModelJsNative.AppModelChangesetProps);
  }

  /** The id of this db's current changeset (`""` if no changeset has been created or merged yet). This is the parent id
   * used when creating or validating the next changeset.
   * @internal
   */
  public getParentChangesetId(): string {
    return this[_nativeDb].getParentChangesetId();
  }

  /** Determine whether any local changes have been recorded but not yet serialized into a changeset.
   * @internal
   */
  public get hasPendingTxns(): boolean {
    return this[_nativeDb].hasPendingTxns();
  }

  /** Stage a JSON properties string to store on the next committed txn. Cleared after that txn is written.
   * @param propsJson the JSON properties string to attach to the next txn.
   * @internal
   */
  public setTxnProps(propsJson: string): void {
    this[_nativeDb].setTxnProps(propsJson);
  }
}
