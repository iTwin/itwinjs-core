/*---------------------------------------------------------------------------------------------
* Copyright (c) 2018 Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/
import { expect, assert } from "chai";
import { IModelConnection, SpatialViewState, StandardViewId } from "@bentley/imodeljs-frontend";
import { Range3d, Point3d, Point2d } from "@bentley/geometry-core";
import * as path from "path";
import { Mesh, Triangle } from "@bentley/imodeljs-frontend/lib/rendering";
import { FakeDisplayParams } from "./DisplayParams.test";
import { CONSTANTS } from "../common/Testbed";
import { WebGLTestContext } from "./WebGLTestContext";
import { MeshPolyline } from "@bentley/imodeljs-common/lib/Render";
import { QPoint3d } from "@bentley/imodeljs-common/lib/QPoint";
import { ColorDef, OctEncodedNormal } from "@bentley/imodeljs-common/lib/common";

const iModelLocation = path.join(CONSTANTS.IMODELJS_CORE_DIRNAME, "core/backend/lib/test/assets/test.bim");

/**
 * MESH BUILDER TESTS
 * tests all paths for each public method
 */
describe("MeshPrimitive Tests", () => {
  let imodel: IModelConnection;
  let spatialView: SpatialViewState;

  const canvas = document.createElement("canvas") as HTMLCanvasElement;
  assert(null !== canvas);
  canvas!.width = canvas!.height = 1000;
  document.body.appendChild(canvas!);

  before(async () => {   // Create a ViewState to load into a Viewport
    imodel = await IModelConnection.openStandalone(iModelLocation);
    spatialView = await imodel.views.load("0x34") as SpatialViewState;
    spatialView.setStandardRotation(StandardViewId.RightIso);
    WebGLTestContext.startup();
  });

  after(async () => {
    WebGLTestContext.shutdown();
    if (imodel) await imodel.closeStandalone();
  });

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
    let mp = new MeshPolyline(undefined, [1, 2, 3]);
    m.addPolyline(mp);
    expect(m.polylines!.length).to.equal(1);

    // throws error if type isn't polyline
    type = Mesh.PrimitiveType.Mesh;
    m = Mesh.create({ displayParams, type, range, is2d, isPlanar });
    expect(() => m.addPolyline(mp)).to.throw("Programmer Error");

    // doesn't add polyline if meshpolyline indices has a length less that 2
    type = Mesh.PrimitiveType.Polyline;
    m = Mesh.create({ displayParams, type, range, is2d, isPlanar });
    expect(m.polylines!.length).to.equal(0);
    mp = new MeshPolyline(undefined, [1]);
    m.addPolyline(mp);
    expect(m.polylines!.length).to.equal(0);
  });

  it("addTriangle", () => {
    const displayParams = new FakeDisplayParams();
    let type = Mesh.PrimitiveType.Mesh;
    const range = Range3d.createNull();
    const is2d = false;
    const isPlanar = true;

    let m = Mesh.create({ displayParams, type, range, is2d, isPlanar });

    expect(m.triangles!.length).to.equal(0);
    const t = new Triangle();
    m.addTriangle(t);
    expect(m.triangles!.length).to.equal(1);

    // throws error if type isn't mesh
    type = Mesh.PrimitiveType.Polyline;
    m = Mesh.create({ displayParams, type, range, is2d, isPlanar });
    expect(() => m.addTriangle(t)).to.throw("Programmer Error");
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
  });
});
