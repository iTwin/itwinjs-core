/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/

import { expect } from "chai";
import {
  PointCloudDisplayProps, PointCloudDisplaySettings, RealityModelDisplayProps, RealityModelDisplaySettings,
} from "../RealityModelDisplaySettings";

describe("PointCloudDisplaySettings", () => {
  it("round-trips through JSON", () => {
    const roundTrip = (props: PointCloudDisplayProps | undefined, expected: PointCloudDisplayProps | undefined | "input") => {
      if ("input" === expected)
        expected = props;

      const settings = PointCloudDisplaySettings.fromJSON(props);
      const actual = settings.toJSON();
      expect(actual).to.deep.equal(expected);

      const actualSettings = PointCloudDisplaySettings.fromJSON(actual);
      expect(actualSettings.equals(settings)).to.be.true;
      expect(actualSettings === PointCloudDisplaySettings.defaults).to.equal(settings.equals(PointCloudDisplaySettings.defaults));
      expect(actualSettings === PointCloudDisplaySettings.defaults).to.equal(undefined === actual);
    };

    roundTrip(undefined, undefined);
    roundTrip({ sizeMode: "voxel", voxelScale: 1, minPixelsPerVoxel: 2, maxPixelsPerVoxel: 20, pixelSize: 1, shape: "round" }, undefined);
    roundTrip({ sizeMode: "pixel", voxelScale: 2, minPixelsPerVoxel: 3, maxPixelsPerVoxel: 10, pixelSize: 2, shape: "square" }, "input");
    roundTrip({ sizeMode: "voxel", voxelScale: 2, minPixelsPerVoxel: 2, maxPixelsPerVoxel: 10, pixelSize: 2, shape: "round" },
      { voxelScale: 2, maxPixelsPerVoxel: 10, pixelSize: 2 });

    roundTrip({ shape: "round" }, undefined);
    roundTrip({ shape: "square" }, "input");
    roundTrip({ shape: "not a shape" } as any, "input");

    roundTrip({ sizeMode: "voxel" }, undefined);
    roundTrip({ sizeMode: "pixel" }, "input");
    roundTrip({ sizeMode: "not a size mode" } as any, "input");
  });
});
