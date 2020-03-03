/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module Tile
 */

import {
  Matrix4d,
  Point3d,
  Point4d,
  Range1d,
  Map4d,
} from "@bentley/geometry-core";
import {
  MapTile,
  Tile,
  TileDrawArgs,
} from "./internal";

import {
  FrustumPlanes,
} from "@bentley/imodeljs-common";

const scratchXRange = Range1d.createNull();
const scratchYRange = Range1d.createNull();
const scratchCorners = [Point3d.createZero(), Point3d.createZero(), Point3d.createZero(), Point3d.createZero(), Point3d.createZero(), Point3d.createZero(), Point3d.createZero(), Point3d.createZero()];

/** @internal */
export class RealityTileDrawArgs extends TileDrawArgs {
  private readonly _tileToView: Matrix4d;
  private readonly _scratchViewCorner = Point4d.createZero();
  private readonly _worldToViewMap: Map4d;
  public get worldToViewMap(): Map4d { return this._worldToViewMap; }

  public constructor(args: TileDrawArgs, worldToViewMap: Map4d, frustumPlanes: FrustumPlanes) {
    super(args.context, args.location, args.tree, args.now, args.purgeOlderThan, args.graphics.viewFlagOverrides, args.clipVolume, false, args.graphics.symbologyOverrides);

    const tileToWorld = Matrix4d.createTransform(this.location);
    this._worldToViewMap = worldToViewMap;
    this._frustumPlanes = frustumPlanes;
    this._tileToView = tileToWorld.multiplyMatrixMatrix(worldToViewMap.transform0);
  }

  public getPixelSize(tile: Tile): number {
    if (tile instanceof MapTile) {
      /* For background maps which contain only rectangles with textures, use the projected screen rectangle rather than sphere to calculate pixel size.  */
      const rangeCorners = (tile as MapTile).getRangeCorners(scratchCorners);
      scratchXRange.setNull();
      scratchYRange.setNull();

      let behindEye = false;
      for (let i = 0; i < 4; i++) {  // Look at only 4 of 8 corners -- before height adjustment terrain tiles may have exaggerated heights that will cause excessive loading.
        const corner = rangeCorners[i];
        const viewCorner = this._tileToView.multiplyPoint3d(corner, 1, this._scratchViewCorner);
        if (viewCorner.w < 0.0) {
          behindEye = true;
          break;
        }

        scratchXRange.extendX(viewCorner.x / viewCorner.w);
        scratchYRange.extendX(viewCorner.y / viewCorner.w);
      }

      if (!behindEye)
        return scratchXRange.isNull ? 1.0E-3 : Math.sqrt(scratchXRange.length() * scratchYRange.length());
    }

    return super.getPixelSize(tile);
  }
}
