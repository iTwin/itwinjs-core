/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import { expect } from "chai";
import {
  Cone, Point3d, PolyfaceBuilder, Range3d, Sphere, StrokeOptions, Transform,
} from "@itwin/core-geometry";
import { ColorByName, ColorIndex, EmptyLocalization, FeatureIndex, FillFlags, QParams3d, QPoint3dList, RenderMode } from "@itwin/core-common";
import { IModelApp, IModelAppOptions } from "../../IModelApp";
import { IModelConnection } from "../../IModelConnection";
import { createBlankConnection } from "../createBlankConnection";
import { RenderSystem } from "../../render/RenderSystem";
import { ScreenViewport } from "../../Viewport";
import { MeshParams } from "../../common/internal/render/MeshParams";
import { SurfaceType } from "../../common/internal/render/SurfaceParams";
import { MeshArgs } from "../../common/internal/render/MeshPrimitives";
import { MeshGraphic } from "../../render/webgl/Mesh";
import { GraphicDescriptionBuilder, GraphicDescriptionBuilderOptions, InstancedGraphicParams } from "../../common";
import { openBlankViewport } from "../openBlankViewport";
import { GraphicType } from "../../common/render/GraphicType";

describe.only("GraphicDescriptionBuilder", () => {
  before(async () => IModelApp.startup({ localization: new EmptyLocalization() }));
  after(async () => IModelApp.shutdown());

  const graphicTypes = [GraphicType.ViewBackground, GraphicType.Scene, GraphicType.WorldDecoration, GraphicType.WorldOverlay, GraphicType.ViewOverlay];

  function expectOption(options: Omit<GraphicDescriptionBuilderOptions, "constraints" | "computeChordTolerance">, option: "wantEdges" | "wantNormals" | "preserveOrder", expected: boolean): void {
    const builder = GraphicDescriptionBuilder.create({
      ...options,
      constraints: IModelApp.renderSystem.getGraphicDescriptionConstraints(),
      computeChordTolerance: () => 0,
    });

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
});
