/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module Tiles
 */

import type { Id64String } from "@itwin/core-bentley";
import { assert } from "@itwin/core-bentley";
import type { IModelConnection } from "../IModelConnection";

/**
 * Mapping between transient IDs assigned to 3D tiles "features" and batch table properties (and visa versa).
 * these properties may be present in batched tile sets.
 * @internal
 */
export class BatchedTileIdMap {
  private readonly _iModel: IModelConnection;
  private _featureMap?: Map<string, { id: Id64String, properties: any }>;
  private _idMap?: Map<Id64String, any>;

  public constructor(iModel: IModelConnection) {
    this._iModel = iModel;
  }

  /** Obtains or allocates the Id64String corresponding to the supplied set of JSON properties. */
  public getBatchId(properties: any): Id64String {
    if (undefined === this._featureMap || undefined === this._idMap) {
      assert(undefined === this._featureMap && undefined === this._idMap);
      this._featureMap = new Map<string, { id: Id64String, properties: any }>();
      this._idMap = new Map<Id64String, any>();
    }

    const key = JSON.stringify(properties);
    let entry = this._featureMap.get(key);
    if (undefined === entry) {
      const id = this._iModel.transientIds.next;
      entry = { id, properties };
      this._featureMap.set(key, entry);
      this._idMap.set(id, properties);
    }

    return entry.id;
  }

  /** Obtain the JSON properties associated with the specified Id64String, or undefined if none exist. */
  public getBatchProperties(id: Id64String): any {
    return undefined !== this._idMap ? this._idMap.get(id) : undefined;
  }
}
