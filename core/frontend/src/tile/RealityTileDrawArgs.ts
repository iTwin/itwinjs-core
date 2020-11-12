/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module Tiles
 */

import { Map4d, Matrix4d, Point3d, Point4d, Range1d } from "@bentley/geometry-core";
import { FrustumPlanes } from "@bentley/imodeljs-common";
import { MapTile, RealityTile, Tile, TileDrawArgs } from "./internal";

const scratchXRange = Range1d.createNull();
const scratchYRange = Range1d.createNull();
const scratchCorners = [Point3d.createZero(), Point3d.createZero(), Point3d.createZero(), Point3d.createZero()];

/** @internal */
export class RealityTileDrawArgs extends TileDrawArgs {
  private readonly _tileToView: Matrix4d;
  private readonly _scratchViewCorner = Point4d.createZero();
  private readonly _worldToViewMap: Map4d;
  public get worldToViewMap(): Map4d { return this._worldToViewMap; }

  public constructor(args: TileDrawArgs, worldToViewMap: Map4d, frustumPlanes: FrustumPlanes) {
    super({ ...args, viewFlagOverrides: args.viewFlagOverrides, symbologyOverrides: args.symbologyOverrides, parentsAndChildrenExclusive: false });

    const tileToWorld = Matrix4d.createTransform(this.location);
    this._worldToViewMap = worldToViewMap;
    this._frustumPlanes = frustumPlanes;
    this._tileToView = tileToWorld.multiplyMatrixMatrix(worldToViewMap.transform0);
  }

  public getPixelSize(tile: Tile): number {
    const sizeProjectionCorners = (tile instanceof RealityTile) ? tile.getSizeProjectionCorners() : undefined;
    if (sizeProjectionCorners) {
      /* For maps or global reality models we use the projected screen rectangle rather than sphere to calculate pixel size to avoid excessive tiles at horizon.  */
      scratchXRange.setNull();
      scratchYRange.setNull();

      let behindEye = false;
      for (const corner of sizeProjectionCorners) {
        const viewCorner = this._tileToView.multiplyPoint3d(corner, 1, this._scratchViewCorner);
        if (viewCorner.w < 0.0) {
          behindEye = true;
          break;
        }

        scratchXRange.extendX(viewCorner.x / viewCorner.w);
        scratchYRange.extendX(viewCorner.y / viewCorner.w);
      }

      if (!behindEye)
        return scratchXRange.isNull ? 1.0E-3 : this.context.adjustPixelSizeForLOD(Math.sqrt(scratchXRange.length() * scratchYRange.length()));
    }

    return super.getPixelSize(tile);
  }
}
