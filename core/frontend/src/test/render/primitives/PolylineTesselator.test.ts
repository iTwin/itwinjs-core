/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import { expect } from "chai";
import { Point3d } from "@itwin/core-geometry";
import { PolylineData, QPoint3dList } from "@itwin/core-common";
import { tesselatePolyline } from "../../../render/primitives/VertexTable";

describe("PolylineTesselator", () => {
  it("produces joint triangles", () => {
    const pts = [ new Point3d(0, 0, 0), new Point3d(0, 10, 0), new Point3d(10, 10, 0), new Point3d(10, 20, 0) ];
    const qpts = QPoint3dList.fromPoints(pts);
    const polylines = [ new PolylineData([0, 1, 2, 3], 4) ];

    const tesselated = tesselatePolyline(polylines, qpts, true);
    expect(tesselated.indices.length).to.equal(72);

    expect(tesselated.indices.decodeIndices()).to.deep.equal([0,1,0,0,1,1,0,1,0,0,1,1,1,1,1,1,1,1,1,1,1,1,2,1,1,2,2,1,2,1,1,2,2,1,1,1,1,1,1,1,1,1,2,2,2,2,2,2,2,2,2,2,3,2,2,3,3,2,3,2,2,3,3,2,2,2,2,2,2,2,2,2]);

    expect(tesselated.prevIndices.decodeIndices()).to.deep.equal([0,2,0,0,2,2,0,2,0,0,2,2,2,2,2,2,2,2,2,2,2,0,3,0,0,3,3,0,3,0,0,3,3,0,0,0,0,0,0,0,0,0,3,3,3,3,3,3,3,3,3,1,3,1,1,3,3,1,3,1,1,3,3,1,1,1,1,1,1,1,1,1]);

    const next32 = Array.from(new Uint32Array(tesselated.nextIndicesAndParams.buffer));
    const nextIndices = next32.map((x) => (x & 0x00ffffff) >>> 0);
    expect(nextIndices).to.deep.equal([1,0,1,1,0,0,1,0,1,1,0,0,0,0,0,0,0,0,0,0,0,2,1,2,2,1,1,2,1,2,2,1,1,2,2,2,2,2,2,2,2,2,1,1,1,1,1,1,1,1,1,3,2,3,3,2,2,3,2,3,3,2,2,3,3,3,3,3,3,3,3,3]);

    const params = next32.map((x) => (x & 0xff000000) >>> 24);
    expect(params).to.deep.equal([27,57,96,96,57,144,96,144,3,3,144,81,144,13,12,144,14,13,144,15,14,33,57,96,96,57,144,96,144,9,9,144,81,96,13,12,96,14,13,96,15,14,144,13,12,144,14,13,144,15,14,33,51,96,96,51,144,96,144,9,9,144,75,96,13,12,96,14,13,96,15,14]);
  });
});
