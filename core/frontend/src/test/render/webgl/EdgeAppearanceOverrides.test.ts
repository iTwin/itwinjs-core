/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import { ColorDef, ColorIndex, EmptyLocalization, FeatureIndex, FillFlags, LinePixels, MeshEdge, QParams3d, QPoint3dList, RenderMode } from "@itwin/core-common";
import { Point3d, Range3d } from "@itwin/core-geometry";
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { MeshArgs } from "../../../render/MeshArgs";
import { MeshArgsEdges } from "../../../common/internal/render/MeshPrimitives";
import { Graphic, MeshGraphic, Primitive } from "../../../internal/webgl";
import { createMeshParams } from "../../../common/internal/render/VertexTableBuilder";
import { IModelApp } from "../../../IModelApp";
import { ColorInfo } from "../../../internal/render/webgl/ColorInfo";
import { lineCodeFromLinePixels } from "../../../common/internal/render/LineCode";
import { RenderGraphic, RenderGraphicOwner } from "../../../render/RenderGraphic";
import { TestDecorator } from "../../TestDecorators";
import { DecorateContext } from "../../../ViewContext";
import { GraphicType } from "../../../common";
import { expectUniqueColors, testBlankViewport } from "../../openBlankViewport";
import { Viewport } from "../../../Viewport";

class EdgeDecorator extends TestDecorator {
  private readonly _graphic: RenderGraphicOwner;
  public constructor(graphic: RenderGraphic) {
    super();
    this._graphic = IModelApp.renderSystem.createGraphicOwner(graphic);
  }

  public decorate(context: DecorateContext): void {
    context.addDecoration(GraphicType.ViewOverlay, this._graphic);
  }

  public static register(edges: MeshArgsEdges): EdgeDecorator {
    const colors = new ColorIndex();
    colors.initUniform(ColorDef.red);

    const points = [new Point3d(0, 0, 0), new Point3d(1, 0, 0), new Point3d(1, 1, 0)];
    const qpoints = new QPoint3dList(QParams3d.fromRange(Range3d.createXYZXYZ(0, 0, 0, 1, 1, 1)));
    for (const point of points) {
      qpoints.add(point);
    }

    const args: MeshArgs = {
      points: qpoints,
      vertIndices: [0, 1, 2],
      isPlanar: true,
      colors,
      features: new FeatureIndex(),
      fillFlags: FillFlags.None,
      edges,
    };

    const params = createMeshParams(args, IModelApp.renderSystem.maxTextureSize, true);
    const graphic = IModelApp.renderSystem.createMesh(params);
    expect(graphic).instanceof(MeshGraphic);

    const decorator = new EdgeDecorator(graphic!);
    IModelApp.viewManager.addDecorator(decorator);
    return decorator;
  }
}

function makeHardEdges(): MeshArgsEdges {
  const args = new MeshArgsEdges();
  args.edges.edges = [new MeshEdge(0, 1), new MeshEdge(1, 2), new MeshEdge(2, 0)];
  return args;
}

describe("EdgeAppearanceOverrides", () => {
  beforeAll(async () => IModelApp.startup({ localization: new EmptyLocalization() }));
  afterEach(() => TestDecorator.dropAll());
  afterAll(async () => IModelApp.shutdown());

  function expectColors(expected: ColorDef[], edges: MeshArgsEdges, customizeViewport?: (vp: Viewport) => void): void {
    const decorator = EdgeDecorator.register(edges);

    testBlankViewport((vp) => {
      vp.viewFlags = vp.viewFlags.copy({
        acsTriad: false,
        grid: false,
        lighting: false,
        renderMode: RenderMode.SmoothShade,
      });
      
      if (customizeViewport) {
        customizeViewport(vp);
      }
      
      vp.renderFrame();

      // Add the viewport's background color as an expected color.
      expected = [...expected, ColorDef.black];
      expectUniqueColors(expected, vp);
    });

    IModelApp.viewManager.dropDecorator(decorator);
  }

  it("overrides nothing by default", () => {
    expectColors([ColorDef.red], makeHardEdges());
  });

  it("overrides color", () => {
    const edges = makeHardEdges();
    edges.color = ColorDef.blue;
    expectColors([ColorDef.red, ColorDef.blue], edges);
  });

  it("does not override display style", () => {
    
  });
});
