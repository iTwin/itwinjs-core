/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import { expect } from "chai";
import { Point2d, Point3d, Range3d } from "@itwin/core-geometry";
import { ColorDef, MeshPolyline, OctEncodedNormal, QPoint3d } from "@itwin/core-common";
import { DisplayParams } from "../../../render/primitives/DisplayParams";
import { Triangle } from "../../../render/primitives/Primitives";
import { Mesh } from "../../../render/primitives/mesh/MeshPrimitives";
import { VertexKey } from "../../../render/primitives/VertexKey";

export class FakeDisplayParams extends DisplayParams {
  public constructor() { super(DisplayParams.Type.Linear, ColorDef.black, ColorDef.black); }
}

/**
 * MESH BUILDER TESTS
 * tests all paths for each public method
 */
describe("MeshPrimitive Tests", () => {
  it("constructor", () => {
    const displayParams = new FakeDisplayParams();
    let type = Mesh.PrimitiveType.Mesh;
    const range = Range3d.createNull();
    const is2d = false;
    const isPlanar = true;

    let m = Mesh.create({ displayParams, type, range, is2d, isPlanar });
    expect(m.type).to.equal(type);
    expect(m.displayParams).to.equal(displayParams);
    expect(m.features).to.be.undefined;
    expect(m.is2d).to.equal(is2d);
    expect(m.isPlanar).to.equal(isPlanar);
    expect(m.points).to.not.be.empty;
    expect(m.edges).to.be.undefined;
    expect(m.triangles).to.not.be.undefined;
    expect(m.polylines).to.be.undefined;

    type = Mesh.PrimitiveType.Polyline;
    m = Mesh.create({ displayParams, type, range, is2d, isPlanar });
    expect(m.polylines).to.not.be.undefined;
    expect(m.triangles).to.be.undefined;

    type = Mesh.PrimitiveType.Point;
    m = Mesh.create({ displayParams, type, range, is2d, isPlanar });
    expect(m.polylines).to.not.be.undefined;
    expect(m.triangles).to.be.undefined;
  });

  it("addPolyline", () => {
    const displayParams = new FakeDisplayParams();
    let type = Mesh.PrimitiveType.Polyline;
    const range = Range3d.createNull();
    const is2d = false;
    const isPlanar = true;

    let m = Mesh.create({ displayParams, type, range, is2d, isPlanar });

    expect(m.polylines!.length).to.equal(0);
    let mp = new MeshPolyline([1, 2, 3]);
    m.addPolyline(mp);
    expect(m.polylines!.length).to.equal(1);

    // doesn't add polyline if meshpolyline indices has a length less that 2
    type = Mesh.PrimitiveType.Polyline;
    m = Mesh.create({ displayParams, type, range, is2d, isPlanar });
    expect(m.polylines!.length).to.equal(0);
    mp = new MeshPolyline([1]);
    m.addPolyline(mp);
    expect(m.polylines!.length).to.equal(0);
  });

  it("addTriangle", () => {
    const displayParams = new FakeDisplayParams();
    const type = Mesh.PrimitiveType.Mesh;
    const range = Range3d.createNull();
    const is2d = false;
    const isPlanar = true;

    const m = Mesh.create({ displayParams, type, range, is2d, isPlanar });

    expect(m.triangles!.length).to.equal(0);
    const t = new Triangle();
    m.addTriangle(t);
    expect(m.triangles!.length).to.equal(1);
  });

  it("addVertex", () => {
    const displayParams = new FakeDisplayParams();
    const type = Mesh.PrimitiveType.Mesh;
    const range = Range3d.createArray([new Point3d(), new Point3d(1000, 1000, 1000)]);
    const is2d = false;
    const isPlanar = true;

    let m = Mesh.create({ displayParams, type, range, is2d, isPlanar });

    expect(m.points.length).to.equal(0);
    let q = QPoint3d.create(new Point3d(100, 100, 100), m.points.params);
    let index = m.addVertex({ position: q, fillColor: ColorDef.white.tbgr });
    expect(index).to.equal(0);
    expect(m.points.length).to.equal(1);
    expect(m.normals.length).to.equal(0);
    expect(m.uvParams.length).to.equal(0);

    m = Mesh.create({ displayParams, type, range, is2d, isPlanar });
    expect(m.normals.length).to.equal(0);
    expect(m.uvParams.length).to.equal(0);
    expect(m.points.length).to.equal(0);
    const oct = new OctEncodedNormal(10);
    const param = new Point2d(10, 10);
    q = QPoint3d.create(new Point3d(100, 100, 100), m.points.params);
    index = m.addVertex({ position: q, fillColor: ColorDef.white.tbgr, normal: oct, uvParam: param });
    expect(m.normals.length).to.equal(1);
    expect(m.uvParams.length).to.equal(1);
    expect(m.points.length).to.equal(1);

    m = Mesh.create({ displayParams, type, range, is2d, isPlanar });
    const key = new VertexKey(q, ColorDef.white.tbgr, oct, param);
    m.addVertex(key);
    expect(m.points.length).to.equal(1);
    expect(m.normals.length).to.equal(1);
    expect(m.uvParams.length).to.equal(1);
  });
});
