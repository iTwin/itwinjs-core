/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/

import { expect } from "chai";
import { Angle } from "../../geometry3d/Angle";
import { Point3d } from "../../geometry3d/Point3dVector3d";
import { PolyfaceBuilder } from "../../polyface/PolyfaceBuilder";
import { IndexedPolyface } from "../../polyface/Polyface";

describe("IndexedPolyface.buildNormalsFast", () => {
  type NormalProps = [number, number, number];

  function expectNormals(polyface: IndexedPolyface, expectedNormals: NormalProps[], expectedIndices: number[]): void {
    polyface.buildNormalsFast(Angle.degreesToRadians(45), 5);
    expect(polyface.data.normal).not.to.be.undefined;
    expect(polyface.data.normalIndex).not.to.be.undefined;

    // NB: Javascript's equality operators treat 0 and -0 as equal, but deepEqual does not for some reason.
    function component(val: number) { return -0 === val ? 0 : val; }

    const normals = polyface.data.normal!.getPoint3dArray().map((n) => [component(n.x), component(n.y), component(n.z)]);
    expect(normals).to.deep.equal(expectedNormals);
    expect(polyface.data.normalIndex).to.deep.equal(expectedIndices);
  }

  function createPolygon(polygon: Point3d[]): IndexedPolyface {
    const builder = PolyfaceBuilder.create();
    builder.addPolygon(polygon);
    const polyface = builder.claimPolyface();
    expect(polyface.data.normal).to.be.undefined;
    expect(polyface.data.normalIndex).to.be.undefined;
    return polyface;
  }

  it("produces expected normals for triangle", () => {
    const pts = [new Point3d(0, 0, 0), new Point3d(1, 0, 0), new Point3d(1, 1, 0)];
    expectNormals(createPolygon(pts), [[0, 0, 1]], [0, 0, 0]);

    pts.reverse();
    expectNormals(createPolygon(pts), [[0, 0, -1]], [0, 0, 0]);
  });

  it("produces expected normals for quad", () => {
    const pts = [new Point3d(0, 0, 0), new Point3d(0, 0, 1), new Point3d(1, 0, 1), new Point3d(1, 0, 0)];
    expectNormals(createPolygon(pts), [[0, 1, 0]], [0, 0, 0, 0]);

    pts.reverse();
    expectNormals(createPolygon(pts), [[0, -1, 0]], [0, 0, 0, 0]);
  });

  it("produces expected normals for triangle mesh", () => {
    const builder = PolyfaceBuilder.create();
    builder.addPolygon([new Point3d(0, 0, 0), new Point3d(1, 0, 0), new Point3d(1, 1, 0)]);
    builder.addPolygon([new Point3d(1, 0, 0), new Point3d(1, 0, 1), new Point3d(1, 1, 0)]);
    const polyface = builder.claimPolyface();
    expectNormals(polyface, [[0, 0, 1], [-1, 0, 0]], [0, 0, 0, 1, 1, 1]);
  });
});
