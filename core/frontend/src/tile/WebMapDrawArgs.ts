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
} from "@bentley/geometry-core";
import {
  MapTile,
  Tile,
  TileDrawArgs,
} from "./internal";

const scratchXRange = Range1d.createNull();
const scratchYRange = Range1d.createNull();
const scratchCorners = [Point3d.createZero(), Point3d.createZero(), Point3d.createZero(), Point3d.createZero(), Point3d.createZero(), Point3d.createZero(), Point3d.createZero(), Point3d.createZero()];

/** @internal */
export class WebMapDrawArgs extends TileDrawArgs {
  private readonly _tileToView: Matrix4d;
  private readonly _scratchViewCorner = Point4d.createZero();

  public constructor(args: TileDrawArgs) {
    super(args.context, args.location, args.root, args.now, args.purgeOlderThan, args.graphics.viewFlagOverrides, args.clipVolume, false, args.graphics.symbologyOverrides);

    const tileToWorld = Matrix4d.createTransform(this.location);
    this._tileToView = tileToWorld.multiplyMatrixMatrix(this.worldToViewMap.transform0);
  }

  public getPixelSize(tile: Tile): number {
    /* For background maps which contain only rectangles with textures, use the projected screen rectangle rather than sphere to calculate pixel size.  */
    const rangeCorners = (tile as MapTile).getRangeCorners(scratchCorners);
    scratchXRange.setNull();
    scratchYRange.setNull();

    let behindEye = false;
    for (let i = 0; i < 4; i++) {  // Look at only 4 of 8 corners -- before height adjustment terrain tiles may have exaggerated heihts that will cause excessive loading.
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

    return super.getPixelSize(tile);
  }
}
