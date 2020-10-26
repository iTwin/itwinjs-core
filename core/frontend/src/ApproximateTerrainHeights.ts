/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module Views
 */

import { assert } from "@bentley/bentleyjs-core";
import { Point2d, Range1d, Range2d } from "@bentley/geometry-core";
import { Cartographic } from "@bentley/imodeljs-common";
import { getJson } from "@bentley/itwin-client";
import { FrontendRequestContext } from "./FrontendRequestContext";
import { GeographicTilingScheme, QuadId } from "./tile/internal";

let instance: ApproximateTerrainHeights | undefined;

/**
 * A collection of functions for approximating terrain height
 * @internal
 */
export class ApproximateTerrainHeights {
  public static readonly maxLevel = 6;
  public readonly globalHeightRange = Range1d.createXX(-400, 90000); // Dead Sea to Mount Everest.
  private _terrainHeights: any;
  private readonly _scratchCorners = [new Cartographic(), new Cartographic(), new Cartographic(), new Cartographic()];
  private readonly _tilingScheme = new GeographicTilingScheme(2, 1, true); // Y at top... ?
  private readonly _scratchTileXY = Point2d.createZero();

  public static get instance(): ApproximateTerrainHeights {
    if (undefined === instance)
      instance = new ApproximateTerrainHeights();

    return instance;
  }

  /**
   * Initializes the minimum and maximum terrain heights.
   * @return {Promise}
   */
  public async initialize(): Promise<void> {
    if (undefined === this._terrainHeights) {
      const requestContext = new FrontendRequestContext();
      this._terrainHeights = await getJson(requestContext, "assets/approximateTerrainHeights.json");
    }
  }

  public getTileHeightRange(quadId: QuadId, result?: Range1d): Range1d {
    result = Range1d.createFrom(this.globalHeightRange, result);
    if (undefined === this._terrainHeights)
      return result;   // Not initialized.

    let level = quadId.level - 1, column = quadId.column, row = quadId.row;
    if (quadId.level > 6) {
      column = column >> (level - 6);
      row = row >> quadId.row >> ((level - 6));
      level = 6;
    }

    const key = `${level}-${column}-${row}`;
    const heights = this._terrainHeights[key];
    assert(undefined !== heights);

    result.low = heights[0];
    result.high = heights[1];

    return result;
  }

  public getMinimumMaximumHeights(rectangle: Range2d, result?: Range1d): Range1d {
    result = Range1d.createFrom(this.globalHeightRange, result);
    if (undefined === this._terrainHeights)
      return result;   // Not initialized.

    const xyLevel = this._getTileXYLevel(rectangle);
    if (undefined !== xyLevel) {
      const key = `${xyLevel.level}-${xyLevel.x}-${xyLevel.y}`;
      const heights = this._terrainHeights[key];
      assert(undefined !== heights);
      if (undefined !== heights) {
        result.low = heights[0];
        result.high = heights[1];
      }
    }

    return result;
  }

  private _getTileXYLevel(rectangle: Range2d): { x: number, y: number, level: number } | undefined {
    Cartographic.fromRadians(rectangle.low.x, rectangle.high.y, 0.0, this._scratchCorners[0]);
    Cartographic.fromRadians(rectangle.high.x, rectangle.high.y, 0.0, this._scratchCorners[1]);
    Cartographic.fromRadians(rectangle.low.x, rectangle.low.y, 0.0, this._scratchCorners[2]);
    Cartographic.fromRadians(rectangle.high.x, rectangle.low.y, 0.0, this._scratchCorners[3]);

    // Determine which tile the bounding rectangle is in
    let lastLevelX = 0, lastLevelY = 0;
    let currentX = 0, currentY = 0;
    const maxLevel = ApproximateTerrainHeights.maxLevel;
    let i;
    for (i = 0; i <= maxLevel; ++i) {
      let failed = false;
      for (let j = 0; j < 4; ++j) {
        const corner = this._scratchCorners[j];
        this._tilingScheme.cartographicToTileXY(corner, i + 1, this._scratchTileXY);    // Note level for iModelJS is Cesium+1 (our root is zero).
        if (j === 0) {
          currentX = this._scratchTileXY.x;
          currentY = this._scratchTileXY.y;
        } else if (currentX !== this._scratchTileXY.x || currentY !== this._scratchTileXY.y) {
          failed = true;
          break;
        }
      }

      if (failed)
        break;

      lastLevelX = currentX;
      lastLevelY = currentY;
    }

    if (i === 0) {
      return undefined;
    }

    return {
      x: lastLevelX,
      y: lastLevelY,
      level: (i > maxLevel) ? maxLevel : (i - 1),
    };
  }
}
