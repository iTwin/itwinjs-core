/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import { describe, expect, it } from "vitest";
import { Point2d, Point3d, Range3d } from "@itwin/core-geometry";
import { ColorDef, MeshPolyline, OctEncodedNormal } from "@itwin/core-common";
import { DisplayParams } from "../../../common/internal/render/DisplayParams";
import { MeshPrimitiveType } from "../../../common/internal/render/MeshPrimitive";
import { Mesh } from "../../../common/internal/render/MeshPrimitives";
import { Triangle } from "../../../common/internal/render/Primitives";
import { VertexKey } from "../../../common/internal/render/VertexKey";

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
    let type = MeshPrimitiveType.Mesh;
    const range = Range3d.createNull();
    const is2d = false;
    const isPlanar = true;

    let m = Mesh.create({ quantizePositions: false, displayParams, type, range, is2d, isPlanar });
    expect(m.type).toEqual(type);
    expect(m.displayParams).toEqual(displayParams);
    expect(m.features).toBeUndefined();
    expect(m.is2d).toEqual(is2d);
    expect(m.isPlanar).toEqual(isPlanar);
    expect(m.points.length).toEqual(0);
    expect(m.edges).toBeUndefined();
    expect(m.triangles).toBeDefined();
    expect(m.polylines).toBeUndefined();

    type = MeshPrimitiveType.Polyline;
    m = Mesh.create({ quantizePositions: false, displayParams, type, range, is2d, isPlanar });
    expect(m.polylines).toBeDefined();
    expect(m.triangles).toBeUndefined();

    type = MeshPrimitiveType.Point;
    m = Mesh.create({ quantizePositions: false, displayParams, type, range, is2d, isPlanar });
    expect(m.polylines).toBeDefined();
    expect(m.triangles).toBeUndefined();
  });

  it("addPolyline", () => {
    const displayParams = new FakeDisplayParams();
    let type = MeshPrimitiveType.Polyline;
    const range = Range3d.createNull();
    const is2d = false;
    const isPlanar = true;

    let m = Mesh.create({ quantizePositions: false, displayParams, type, range, is2d, isPlanar });

    expect(m.polylines!.length).toEqual(0);
    let mp = new MeshPolyline([1, 2, 3]);
    m.addPolyline(mp);
    expect(m.polylines!.length).toEqual(1);

    // doesn't add polyline if meshpolyline indices has a length less that 2
    type = MeshPrimitiveType.Polyline;
    m = Mesh.create({ quantizePositions: false, displayParams, type, range, is2d, isPlanar });
    expect(m.polylines!.length).toEqual(0);
    mp = new MeshPolyline([1]);
    m.addPolyline(mp);
    expect(m.polylines!.length).toEqual(0);
  });

  it("addTriangle", () => {
    const displayParams = new FakeDisplayParams();
    const type = MeshPrimitiveType.Mesh;
    const range = Range3d.createNull();
    const is2d = false;
    const isPlanar = true;

    const m = Mesh.create({ quantizePositions: false, displayParams, type, range, is2d, isPlanar });

    expect(m.triangles!.length).toEqual(0);
    const t = new Triangle();
    m.addTriangle(t);
    expect(m.triangles!.length).toEqual(1);
  });

  it("addVertex", () => {
    const displayParams = new FakeDisplayParams();
    const type = MeshPrimitiveType.Mesh;
    const range = Range3d.createArray([new Point3d(), new Point3d(1000, 1000, 1000)]);
    const is2d = false;
    const isPlanar = true;

    let m = Mesh.create({ quantizePositions: true, displayParams, type, range, is2d, isPlanar });

    expect(m.points.length).toEqual(0);
    let p = new Point3d(100, 100, 100);
    let index = m.addVertex({ position: p, fillColor: ColorDef.white.tbgr });
    expect(index).toEqual(0);
    expect(m.points.length).toEqual(1);
    expect(m.normals.length).toEqual(0);
    expect(m.uvParams.length).toEqual(0);

    m = Mesh.create({ quantizePositions: true, displayParams, type, range, is2d, isPlanar });
    expect(m.normals.length).toEqual(0);
    expect(m.uvParams.length).toEqual(0);
    expect(m.points.length).toEqual(0);
    const oct = new OctEncodedNormal(10);
    const param = new Point2d(10, 10);
    p = new Point3d(100, 100, 100);
    index = m.addVertex({ position: p, fillColor: ColorDef.white.tbgr, normal: oct, uvParam: param });
    expect(m.normals.length).toEqual(1);
    expect(m.uvParams.length).toEqual(1);
    expect(m.points.length).toEqual(1);

    m = Mesh.create({ quantizePositions: true, displayParams, type, range, is2d, isPlanar });
    const key = new VertexKey(p, ColorDef.white.tbgr, oct, param);
    m.addVertex(key);
    expect(m.points.length).toEqual(1);
    expect(m.normals.length).toEqual(1);
    expect(m.uvParams.length).toEqual(1);
  });
});
