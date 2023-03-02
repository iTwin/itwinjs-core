/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/

import {
  HitDetail, TileTreeOwner, TileTreeReference,
} from "@itwin/core-frontend";

class BatchedTileTreeReference extends TileTreeReference {
  private readonly _treeOwner: TileTreeOwner;

  public constructor(treeOwner: TileTreeOwner) {
    super();
    this._treeOwner = treeOwner;
  }

  public override get treeOwner(): TileTreeOwner {
    return this._treeOwner;
  }

  public override async getToolTip(_hit: HitDetail): Promise<HTMLElement | string | undefined> {
    return "###TODO";
  }
}
