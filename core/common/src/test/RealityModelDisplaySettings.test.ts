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

  it("clones", () => {
    const test = (baseProps: PointCloudDisplayProps | undefined, changedProps: PointCloudDisplayProps, expected: PointCloudDisplayProps | undefined | "input") => {
      if (expected === "input")
        expected = baseProps;

      const baseSettings = PointCloudDisplaySettings.fromJSON(baseProps);
      const clone = baseSettings.clone(changedProps);
      const actual = clone.toJSON();
      expect(actual).to.deep.equal(expected);
    };

    test(undefined, { sizeMode: "voxel", voxelScale: 1, minPixelsPerVoxel: 2, maxPixelsPerVoxel: 20, pixelSize: 1, shape: "round" }, "input");
    test({ voxelScale: 2, minPixelsPerVoxel: 3, maxPixelsPerVoxel: 10, pixelSize: 1 }, { voxelScale: 0.5, maxPixelsPerVoxel: 12 }, { voxelScale: 0.5, minPixelsPerVoxel: 3, maxPixelsPerVoxel: 12 });
    test({ voxelScale: 2, minPixelsPerVoxel: 3, maxPixelsPerVoxel: 4, pixelSize: 5, sizeMode: "voxel", shape: "square" },
      { voxelScale: undefined, minPixelsPerVoxel: undefined, maxPixelsPerVoxel: undefined, pixelSize: undefined, sizeMode: undefined, shape: undefined },
      undefined,
    );
    test({ voxelScale: 2, pixelSize: 3, minPixelsPerVoxel: 4 }, { pixelSize: undefined, minPixelsPerVoxel: 5 }, { voxelScale: 2, minPixelsPerVoxel: 5 });
  });
});

describe("RealityModelDisplaySettings", () => {
  it("round-trips through JSON", () => {
    const roundTrip = (props: RealityModelDisplayProps | undefined, expected: RealityModelDisplayProps | undefined | "input") => {
      if ("input" === expected)
        expected = props;

      const settings = RealityModelDisplaySettings.fromJSON(props);
      const actual = settings.toJSON();
      expect(actual).to.deep.equal(expected);

      const actualSettings = RealityModelDisplaySettings.fromJSON(actual);
      expect(actualSettings.equals(settings)).to.be.true;
      expect(actualSettings === RealityModelDisplaySettings.defaults).to.equal(settings.equals(RealityModelDisplaySettings.defaults));
      expect(actualSettings === RealityModelDisplaySettings.defaults).to.equal(undefined === actual);
    };

    roundTrip(undefined, undefined);
    roundTrip({ overrideColorRatio: 0.5 }, undefined);
    roundTrip({ overrideColorRatio: 0.5, pointCloud: undefined }, undefined);
    roundTrip({ overrideColorRatio: 0.5, pointCloud: { sizeMode: "voxel", voxelScale: 1, minPixelsPerVoxel: 2, maxPixelsPerVoxel: 20, pixelSize: 1, shape: "round" } }, undefined);

    roundTrip({ overrideColorRatio: 0.1 }, "input");
    roundTrip({ overrideColorRatio: 0 }, "input");
    roundTrip({ overrideColorRatio: 1 }, "input");
    roundTrip({ overrideColorRatio: -12.5 }, "input");

    roundTrip({ pointCloud: { sizeMode: "pixel", pixelSize: 1, shape: "square" } }, { pointCloud: { sizeMode: "pixel", shape: "square" } });
    roundTrip({ overrideColorRatio: 12.5, pointCloud: { voxelScale: 2 } }, "input");
  });

  it("clones", () => {
    const test = (baseProps: RealityModelDisplayProps | undefined, changedProps: RealityModelDisplayProps, expected: RealityModelDisplayProps | undefined | "input") => {
      if (expected === "input")
        expected = baseProps;

      const baseSettings = RealityModelDisplaySettings.fromJSON(baseProps);
      const clone = baseSettings.clone(changedProps);
      const actual = clone.toJSON();
      expect(actual).to.deep.equal(expected);
    };

    test(undefined, { overrideColorRatio: 0.5 }, undefined);
    test({ overrideColorRatio: 2 }, { overrideColorRatio: undefined }, undefined);
    test({ overrideColorRatio: 2 }, { overrideColorRatio: 3 }, { overrideColorRatio: 3 });
    test({ pointCloud: { sizeMode: "pixel" } }, { overrideColorRatio: 2 }, { pointCloud: { sizeMode: "pixel" }, overrideColorRatio: 2 });
    test({ pointCloud: { sizeMode: "pixel" } }, { pointCloud: { pixelSize: 2 } }, { pointCloud: { sizeMode: "pixel", pixelSize: 2 } });
    test({ pointCloud: { sizeMode: "pixel" }, overrideColorRatio: 2 }, { pointCloud: { sizeMode: undefined} }, { overrideColorRatio: 2 });
    test({ pointCloud: { sizeMode: "pixel" }, overrideColorRatio: 2 }, { pointCloud: { } }, { overrideColorRatio: 2, pointCloud: { sizeMode: "pixel" } });
  });
});
