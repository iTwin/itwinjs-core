/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module Framework
 */
import { ExternalSourceAspect, IModelDb } from "@bentley/imodeljs-backend";
import { AuthorizedClientRequestContext } from "@bentley/itwin-client";
import { Id64String } from "@bentley/bentleyjs-core";

/** The state of the given SourceItem against the iModelDb
 * @alpha
 */
export enum ItemState {
  /** The SourceItem is unchanged */
  Unchanged,
  /** The SourceItem is not currently in the iModelDb */
  New,
  /** The SourceItem has been changed */
  Changed,
}
/** Interface for presenting an item in the source repository
 * @alpha
 */
export interface SourceItem {
  /** Unique Identity of the source item (relative to its scope and kind). */
  getId(): string;
  /** An optional value that is typically a version number or a pseudo version number like last modified time.
   * It will be used by the synchronization process to detect that a source object is unchanged so that computing a cryptographic hash can be avoided.
   * If present, this value must be guaranteed to change when any of the source object's content changes.
   */
  getVersion(): string;
  /** The optional cryptographic hash (any algorithm) of the source object's content. If defined, it must be guaranteed to change when the source object's content changes.
   * The definition and method of computing this value is known only to source repository.
   */
  getChecksum(): string;
}

/** Helper class for interacting with the iModelDb during synchronization.
 * @alpha
 */
export class Synchronizer {
  public constructor(protected _iModelDb: IModelDb, protected _requestContext: AuthorizedClientRequestContext) {

  }
  /** Returns the iModelDb */
  public getDgnDb(): IModelDb { return this._iModelDb; }

  /** Detect if the item has changed or is new.
   * @param scope The scoping item
   * @param kind the kind of source item
   * @param item the source item
   * @returns the results of looking in the iModelDb and comparing the existing source record, if any, with the item's current state.
   * @alpha
   */
  public detectChanges(scope: Id64String, sourceKind: string, item: SourceItem): ItemState {
    let ids: any;
    if (item.getId() !== "")
      ids = ExternalSourceAspect.findBySource(this._iModelDb, scope, sourceKind, item.getId());
    if (ids.aspectId === undefined)
      return ItemState.New;

    const aspect = this._iModelDb.elements.getAspect(ids.aspectId) as ExternalSourceAspect;
    if (undefined === aspect)
      return ItemState.New;

    if (undefined !== aspect.version && undefined !== item.getVersion() && aspect.version !== item.getVersion())
      return ItemState.Changed;
    if (undefined !== aspect.checksum && undefined !== item.getChecksum() && aspect.checksum !== item.getChecksum())
      return ItemState.Changed;
    return ItemState.New;
  }

}
