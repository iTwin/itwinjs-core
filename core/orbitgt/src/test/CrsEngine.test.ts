/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import { assert } from "chai";
import { CRSManager } from "../spatial/crs/CRSManager";
import { OnlineEngine } from "../spatial/ecrs/OnlineEngine";
import { Bounds } from "../spatial/geom/Bounds";
import { Coordinate } from "../spatial/geom/Coordinate";
import { Downloader } from "../system/runtime/Downloader";
import { DownloaderNode } from "../system/runtime/DownloaderNode";

describe("CRS engine tests", () => {

  it("crs transform of a position", async () => {
    Downloader.INSTANCE = new DownloaderNode();
    CRSManager.ENGINE = await OnlineEngine.create();
    const sourceCRS: string = "31370"; // Belgium, Lambert 72 projection
    const targetCRS: string = "4978"; // wgs-84 geocentric, aka ECEF
    await CRSManager.ENGINE.prepareForArea(sourceCRS, new Bounds());
    await CRSManager.ENGINE.prepareForArea(targetCRS, new Bounds());
    const sourcePosition: Coordinate = new Coordinate(124995, 197495, 52); // the OrbitGT office location in Lokeren, Belgium
    const targetPosition: Coordinate = CRSManager.transformPoint(sourcePosition, sourceCRS, targetCRS);
    const expectedPosition: Coordinate = new Coordinate(4004726.217, 280783.407, 4939653.828);
    assert.isTrue(targetPosition.distance3D(expectedPosition) < 0.25, "found position " + targetPosition + ", expected " + expectedPosition);
  });

});
