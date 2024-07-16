/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import { expect } from "chai";
import {
  Cone, Point2d, Point3d, PolyfaceBuilder, Range3d, Sphere, StrokeOptions, Transform,
} from "@itwin/core-geometry";
import { ColorByName, ColorDef, ColorIndex, EmptyLocalization, FeatureIndex, FillFlags, QParams3d, QPoint3dList, RenderMode } from "@itwin/core-common";
import { IModelApp, IModelAppOptions } from "../../IModelApp";
import { IModelConnection } from "../../IModelConnection";
import { createBlankConnection } from "../createBlankConnection";
import { RenderSystem } from "../../render/RenderSystem";
import { ScreenViewport } from "../../Viewport";
import { MeshParams } from "../../common/internal/render/MeshParams";
import { SurfaceType } from "../../common/internal/render/SurfaceParams";
import { MeshArgs } from "../../common/internal/render/MeshPrimitives";
import { MeshGraphic } from "../../render/webgl/Mesh";
import { GraphicDescription, GraphicDescriptionBuilder, GraphicDescriptionBuilderOptions, GraphicDescriptionConstraints, InstancedGraphicParams } from "../../common";
import { openBlankViewport } from "../openBlankViewport";
import { GraphicType } from "../../common/render/GraphicType";
import { GraphicDescriptionImpl, isGraphicDescription } from "../../common/internal/render/GraphicDescriptionBuilderImpl";
import { Branch, Graphic, Primitive } from "../../webgl";

function expectRange(range: Readonly<Range3d>, lx: number, ly: number, lz: number, hx: number, hy: number, hz: number): void {
  expect(range.low.x).to.equal(lx);
  expect(range.low.y).to.equal(ly);
  expect(range.low.z).to.equal(lz);
  expect(range.high.x).to.equal(hx);
  expect(range.high.y).to.equal(hy);
  expect(range.high.z).to.equal(hz);
}

describe.only("GraphicDescriptionBuilder", () => {
  let constraints: GraphicDescriptionConstraints;
  before(async () => {
    await IModelApp.startup({ localization: new EmptyLocalization() });
    constraints = IModelApp.renderSystem.getGraphicDescriptionConstraints();
  });
    
  after(async () => IModelApp.shutdown());

  const computeChordTolerance = () => 0;
  const graphicTypes = [GraphicType.ViewBackground, GraphicType.Scene, GraphicType.WorldDecoration, GraphicType.WorldOverlay, GraphicType.ViewOverlay];

  function expectOption(options: Omit<GraphicDescriptionBuilderOptions, "constraints" | "computeChordTolerance">, option: "wantEdges" | "wantNormals" | "preserveOrder", expected: boolean): void {
    const builder = GraphicDescriptionBuilder.create({ ...options, constraints, computeChordTolerance });
    expect(builder[option]).to.equal(expected);
  }

  it("preserves order for overlay and background graphics", () => {
    for (const type of graphicTypes) {
      expectOption({ type }, "preserveOrder", type === GraphicType.ViewOverlay || type === GraphicType.WorldOverlay || type === GraphicType.ViewBackground);
    }
  });
  
  it("wants edges for scene graphics or if explicitly requested", () => {
    for (const type of graphicTypes) {
      expectOption({ type, generateEdges: true }, "wantEdges", true);
      expectOption({ type, generateEdges: false }, "wantEdges", false);
      expectOption({ type }, "wantEdges", GraphicType.Scene === type);
    }
  });
  
  it("wants normals for scene graphics or if edges are requested", () => {
    for (const type of graphicTypes) {
      expectOption({ type, generateEdges: true }, "wantNormals", true);
      expectOption({ type }, "wantNormals", GraphicType.Scene === type);
      expectOption({ type, generateEdges: false }, "wantNormals", GraphicType.Scene === type);
    }
  });

  function finish(builder: GraphicDescriptionBuilder): GraphicDescriptionImpl {
    const descr = builder.finish();
    if (!isGraphicDescription(descr)) {
      throw new Error("not a graphic description");
    }

    return descr;
  }

  it("creates a graphic", async () => {
    const builder = GraphicDescriptionBuilder.create({ type: GraphicType.ViewOverlay, constraints, computeChordTolerance });
    builder.setSymbology(ColorDef.red, ColorDef.blue, 2);
    builder.addShape2d([
      new Point2d(0, 0), new Point2d(10, 0), new Point2d(10, 5), new Point2d(0, 5),
    ], 2);

    const descr = finish(builder);
    expect(descr.batch).to.be.undefined;
    expect(descr.type).to.equal(GraphicType.ViewOverlay);
    expect(descr.translation!.x).to.equal(5);
    expect(descr.translation!.y).to.equal(2.5);
    expect(descr.translation!.z).to.equal(2);
    expect(descr.translation).not.to.be.undefined;
    expect(descr.primitives.length).to.equal(1);
    expect(descr.primitives[0].type).to.equal("mesh");
    // ###TODO vertices

    const branch = await IModelApp.renderSystem.createGraphicFromDescription({ description: descr }) as Branch;
    expect(branch instanceof Branch).to.be.true;
    expect(branch.branch.entries.length).to.equal(1);

    const mesh = branch.branch.entries[0] as MeshGraphic;
    expect(mesh instanceof MeshGraphic).to.be.true;
    expect(mesh.primitives.length).to.equal(1);
    expectRange(mesh.meshRange, -5, -2.5, 0, 5, 2.5, 0);
    const gfPrim = mesh.primitives[0].toPrimitive()!;
    expect(gfPrim).not.to.be.undefined;
    expect(gfPrim.cachedGeometry.asMesh).not.to.be.undefined;
  });

  it("creates a graphic with edges", async () => {
    
  });

  it("applies a placement transform to the graphics", () => {
    
  });
  
  it("creates a batch containing a single feature", async () => {
    
  });

  it("creates a view-independent graphic", async () => {
    
  });
  
  it("creates a batch containing multiple features", async () => {
    
  });
});
