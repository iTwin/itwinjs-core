/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import { assert } from "chai";
import { CartographicRange } from "@itwin/core-common";
import { SnapshotConnection } from "@itwin/core-frontend";
import { Range2d } from "@itwin/core-geometry";
import { TestUtility } from "../TestUtility";

describe("Cartographic range tests", () => {
  let imodel: SnapshotConnection;

  before(async () => {
    await TestUtility.startFrontend();
    imodel = await SnapshotConnection.openFile("mirukuru.ibim");
  });

  after(async () => {
    if (imodel)
      await imodel.close();

    await TestUtility.shutdownFrontend();
  });

  it("Cartographic range should convert properly", () => {
    const projectRange = new CartographicRange(imodel.projectExtents, imodel.ecefLocation!.getTransform());
    const expected = Range2d.fromJSON({ low: { x: 2.316129378420503, y: 0.5995855439816498 }, high: { x: 2.316183773897448, y: 0.5996166857950551 } });
    const longLatBox = projectRange.getLongitudeLatitudeBoundingBox();
    assert.isTrue(longLatBox.isAlmostEqual(expected), "range matches correctly");
  });
});
