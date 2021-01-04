/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import { assert } from "chai";
import { Range2d } from "@bentley/geometry-core";
import { CartographicRange } from "@bentley/imodeljs-common";
import { IModelApp, SnapshotConnection } from "@bentley/imodeljs-frontend";

describe("Cartographic range tests", () => {
  let imodel: SnapshotConnection;

  before(async () => {
    await IModelApp.startup();
    imodel = await SnapshotConnection.openFile("mirukuru.ibim");
  });

  after(async () => {
    if (imodel)
      await imodel.close();

    await IModelApp.shutdown();
  });

  it("Cartographic range should convert properly", () => {
    const projectRange = new CartographicRange(imodel.projectExtents, imodel.ecefLocation!.getTransform());
    const expected = Range2d.fromJSON({ low: { x: 2.316129378420503, y: 0.5995855439816498 }, high: { x: 2.316183773897448, y: 0.5996166857950551 } });
    const longLatBox = projectRange.getLongitudeLatitudeBoundingBox();
    assert.isTrue(longLatBox.isAlmostEqual(expected), "range matches correctly");
  });
});
