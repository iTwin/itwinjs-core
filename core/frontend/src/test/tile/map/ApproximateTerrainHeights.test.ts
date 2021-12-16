/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import { Range1d } from "@itwin/core-geometry";
import { expect } from "chai";
import { ApproximateTerrainHeights } from "../../../ApproximateTerrainHeights";
import { GeographicTilingScheme, QuadId } from "../../../core-frontend";

describe("ApproximateTerrainHeights", () => {
  it("test correct heights", async () => {
    const tilingScheme = new GeographicTilingScheme();
    const testPairs = [
      { id: new QuadId(3, 2, 1), range: Range1d.createXX(-102.31, 3682.63) },
      { id: new QuadId(5, 4, 4), range: Range1d.createXX(-132.79, 3970.41) },
      { id: new QuadId(6, 32, 31), range: Range1d.createXX(-20.88, 716.38) },
      { id: new QuadId(8, 21, 11), range: Range1d.createXX(-98.4, -43.74) },
      { id: new QuadId(0, 0, 0), range: Range1d.createXX(-400, 90000) },
    ];
    const terrainHeights = ApproximateTerrainHeights.instance;
    await terrainHeights.initialize();

    testPairs.forEach((pair) => {
      const quadId = pair.id;
      const rectangle = tilingScheme.tileXYToRectangle(quadId.column, quadId.row, quadId.level);
      const heightRange = terrainHeights.getMinimumMaximumHeights(rectangle);
      expect(heightRange.isAlmostEqual(pair.range)).to.be.true;
    });
  });
});
