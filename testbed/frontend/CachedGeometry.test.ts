/*---------------------------------------------------------------------------------------------
|  $Copyright: (c) 2018 Bentley Systems, Incorporated. All rights reserved. $
 *--------------------------------------------------------------------------------------------*/
import { assert } from "chai";
import { QPoint3dList } from "@bentley/imodeljs-common";
import { PointCloudGeometryCreateParams } from "@bentley/imodeljs-frontend/lib/rendering";

describe("PointCloudGeometryCreateParams", () => {
  it("should create PointCloudGeometryCreateParams", () => {
    const a: QPoint3dList = new QPoint3dList();
    let params: PointCloudGeometryCreateParams = new PointCloudGeometryCreateParams(a, [], 0);
    assert.exists(params, "assert PointCloudGeometryCreateParams test 1");
    assert.isTrue(params.colors.length === 0, "assert PointCloudGeometryCreateParams test 2");

    params = new PointCloudGeometryCreateParams(a, [0x00FF00], 1);
    assert.exists(params, "assert PointCloudGeometryCreateParams test 3");
    assert.isTrue(params.colors.length === 1, "assert PointCloudGeometryCreateParams test 4");
    assert.isTrue(params.colors[0] === 0x00FF00, "assert PointCloudGeometryCreateParams test 5");
    assert.isFalse(a === params.vertices, "assert PointCloudGeometryCreateParams test 6");

    params = new PointCloudGeometryCreateParams(a, [0x00FF00, 0x000000, 0xFF00FF], 3);
    assert.exists(params, "assert PointCloudGeometryCreateParams test 6");
    assert.isTrue(params.colors.length === 3, "assert PointCloudGeometryCreateParams test 7");
    assert.isTrue(params.colors[0] === 0x00FF00, "assert PointCloudGeometryCreateParams test 8");
    assert.isTrue(params.colors[1] === 0x000000, "assert PointCloudGeometryCreateParams test 9");
    assert.isTrue(params.colors[2] === 0xFF00FF, "assert PointCloudGeometryCreateParams test 10");
    assert.isFalse(a === params.vertices, "assert PointCloudGeometryCreateParams test 11");
  });
});
