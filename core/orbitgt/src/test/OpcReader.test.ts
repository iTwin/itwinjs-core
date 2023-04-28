/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import { assert } from "chai";
import * as path from "path";
import { OPCReader } from "../pointcloud/format/opc/OPCReader";
import { PointCloudReader } from "../pointcloud/model/PointCloudReader";
import { ALong } from "../system/runtime/ALong";
import { NodeFS } from "../system/storage/NodeFS";

describe("OPC reader tests", () => {
  it("should open a point cloud file", async () => {
    let opcFileName: string = path.join(__dirname, "assets", "pointcloud.opc");
    let nodeFS: NodeFS = new NodeFS();
    let fileReader: PointCloudReader = await OPCReader.openFile(
      nodeFS,
      opcFileName,
      true /*lazyLoading*/
    );
    let levelCount: number = fileReader.getLevelCount();
    let pointCount: ALong = fileReader.getLevelPointCount(0);
    fileReader.close();
    let expectedLevelCount: number = 2;
    let expectedPointCount: ALong = ALong.fromInt(1868);
    assert.isTrue(
      levelCount == expectedLevelCount,
      "found " + levelCount + " levels, expected " + expectedLevelCount
    );
    assert.isTrue(
      pointCount.same(expectedPointCount),
      "found " + pointCount + " points, expected " + expectedPointCount
    );
  });
});
