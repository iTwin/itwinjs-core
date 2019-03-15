/*---------------------------------------------------------------------------------------------
* Copyright (c) 2019 Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/
// WIP import { assert } from "chai";
// WIP import { QPoint3dList } from "@bentley/imodeljs-common";
// WIP import { PointCloudGeometryCreateParams } from "@bentley/imodeljs-frontend";
// WIP
// WIP describe("PointCloudGeometryCreateParams", () => {
// WIP   it("should create PointCloudGeometryCreateParams", () => {
// WIP     const a: QPoint3dList = new QPoint3dList();
// WIP     let params: PointCloudGeometryCreateParams = new PointCloudGeometryCreateParams(a, [], 0);
// WIP     assert.exists(params, "assert PointCloudGeometryCreateParams test 1");
// WIP     assert.isTrue(params.colors.length === 0, "assert PointCloudGeometryCreateParams test 2");
// WIP
// WIP     params = new PointCloudGeometryCreateParams(a, [0x00FF00], 1);
// WIP     assert.exists(params, "assert PointCloudGeometryCreateParams test 3");
// WIP     assert.isTrue(params.colors.length === 1, "assert PointCloudGeometryCreateParams test 4");
// WIP     assert.isTrue(params.colors[0] === 0x00FF00, "assert PointCloudGeometryCreateParams test 5");
// WIP     assert.isFalse(a === params.vertices, "assert PointCloudGeometryCreateParams test 6");
// WIP
// WIP     params = new PointCloudGeometryCreateParams(a, [0x00FF00, 0x000000, 0xFF00FF], 3);
// WIP     assert.exists(params, "assert PointCloudGeometryCreateParams test 6");
// WIP     assert.isTrue(params.colors.length === 3, "assert PointCloudGeometryCreateParams test 7");
// WIP     assert.isTrue(params.colors[0] === 0x00FF00, "assert PointCloudGeometryCreateParams test 8");
// WIP     assert.isTrue(params.colors[1] === 0x000000, "assert PointCloudGeometryCreateParams test 9");
// WIP     assert.isTrue(params.colors[2] === 0xFF00FF, "assert PointCloudGeometryCreateParams test 10");
// WIP     assert.isFalse(a === params.vertices, "assert PointCloudGeometryCreateParams test 11");
// WIP   });
// WIP });
