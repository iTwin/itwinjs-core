/*---------------------------------------------------------------------------------------------
* Copyright (c) 2018 - present Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/
import { assert } from "chai";
// @ts-ignore
import { ToleranceRatio, GeometryOptions, NormalMode, SurfacesOnly, PreserveOrder, GenerateEdges, GraphicBuilderCreateParams, GraphicType } from "@bentley/imodeljs-frontend/lib/rendering";
// @ts-ignore
import { Transform } from "@bentley/geometry-core";

describe("ToleranceRatio", () => {
  it("ToleranceRatio works as expected", () => {
    assert.isTrue(ToleranceRatio.vertex === 0.1, "pos is correct");
    assert.isTrue(ToleranceRatio.facetArea === 0.1, "normal is correct");
  });
});

describe("GeometryOptions", () => {
  it("GeometryOptions works as expected", () => {
    const a = new GeometryOptions();
    assert.isTrue(a.normals === NormalMode.Always, "default normals correct");
    assert.isTrue(a.surfaces === SurfacesOnly.No, "default surfaces correct");
    assert.isTrue(a.preserveOrder === PreserveOrder.No, "default preserveOrder correct");
    assert.isTrue(a.edges === GenerateEdges.Yes, "default edges correct");

    assert.isTrue(a.wantSurfacesOnly === false, "default wantSurfacesOnly correct");
    assert.isTrue(a.wantPreserveOrder === false, "default wantPreserveOrder correct");
    assert.isTrue(a.wantEdges === true, "default wantEdges correct");

    const b = new GeometryOptions(NormalMode.Never, SurfacesOnly.Yes, PreserveOrder.Yes, GenerateEdges.No);
    assert.isTrue(b.normals === NormalMode.Never, "normals correct");
    assert.isTrue(b.surfaces === SurfacesOnly.Yes, "surfaces correct");
    assert.isTrue(b.preserveOrder === PreserveOrder.Yes, "preserveOrder correct");
    assert.isTrue(b.edges === GenerateEdges.No, "edges correct");

    // const gbcp = new GraphicBuilderCreateParams(Transform.createIdentity(), GraphicType.ViewOverlay);
    // const c = GeometryOptions.createForGraphicBuilder(gbcp);
    // assert.isTrue(c.normals === NormalMode.Always, "fromGraphicBuilderCreateParams normals correct");
    // assert.isTrue(c.surfaces === SurfacesOnly.No, "fromGraphicBuilderCreateParams surfaces correct");
    // assert.isTrue(c.preserveOrder === PreserveOrder.Yes, "fromGraphicBuilderCreateParams preserveOrder correct");
    // assert.isTrue(c.edges === GenerateEdges.No, "fromGraphicBuilderCreateParams edges correct");

    // const gbcp2 = new GraphicBuilderCreateParams(Transform.createIdentity(), GraphicType.Scene);
    // const d = GeometryOptions.createForGraphicBuilder(gbcp2, NormalMode.Never);
    // assert.isTrue(d.normals === NormalMode.Never, "fromGraphicBuilderCreateParams normals correct - 2");
    // assert.isTrue(d.surfaces === SurfacesOnly.No, "fromGraphicBuilderCreateParams surfaces correct - 2");
    // assert.isTrue(d.preserveOrder === PreserveOrder.No, "fromGraphicBuilderCreateParams preserveOrder correct - 2");
    // assert.isTrue(d.edges === GenerateEdges.Yes, "fromGraphicBuilderCreateParams edges correct - 2");

    // const gbcp3 = new GraphicBuilderCreateParams(Transform.createIdentity(), GraphicType.ViewBackground);
    // const e = GeometryOptions.createForGraphicBuilder(gbcp3, NormalMode.Never, SurfacesOnly.Yes);
    // assert.isTrue(e.normals === NormalMode.Never, "fromGraphicBuilderCreateParams normals correct - 3");
    // assert.isTrue(e.surfaces === SurfacesOnly.Yes, "fromGraphicBuilderCreateParams surfaces correct - 3");
    // assert.isTrue(e.preserveOrder === PreserveOrder.Yes, "fromGraphicBuilderCreateParams preserveOrder correct - 3");
    // assert.isTrue(e.edges === GenerateEdges.No, "fromGraphicBuilderCreateParams edges correct - 3");
  });
});
