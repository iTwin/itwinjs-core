/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/

import { Tileset3dSchema as schema } from "@itwin/core-common";
import { IModelConnection } from "@itwin/core-frontend";

function isTileset3d(json: unknown): json is schema.Tileset {
  if (typeof "json" !== "object")
    return false;

  const props = json as schema.Tileset;
  return undefined !== props.root && undefined !== props.geometricError && undefined !== props.asset;
}

export class BatchedTilesetReader {
  private readonly _iModel: IModelConnection;
  private readonly _tileset: schema.Tileset;

  public constructor(json: unknown, iModel: IModelConnection) {
    this._iModel = iModel;
    if (!isTileset3d(json))
      throw new Error("Invalid tileset JSON");

    this._tileset = json;
  }
}
