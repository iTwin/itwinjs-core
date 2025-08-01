/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import { ColorDef, ColorIndex, EmptyLocalization, FeatureIndex, FillFlags, LinePixels, MeshEdge, QParams3d, QPoint3dList, RenderMode } from "@itwin/core-common";
import { Point3d, Range3d, Transform } from "@itwin/core-geometry";
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
import { expectUniqueColors, readColorCounts, testBlankViewport } from "../../openBlankViewport";
import { Viewport } from "../../../Viewport";
import { GraphicBranch } from "../../../core-frontend";

class EdgeDecorator extends TestDecorator {
  private readonly _graphic: RenderGraphicOwner;
  public constructor(graphic: RenderGraphic) {
    super();

    // Edges are disabled by default for view overlays. Turn them on.
    const branch = new GraphicBranch();
    branch.viewFlagOverrides = { visibleEdges: true };
    branch.add(graphic);

    const sys = IModelApp.renderSystem;
    this._graphic = sys.createGraphicOwner(sys.createBranch(branch, Transform.createIdentity()));
  }

  public decorate(context: DecorateContext): void {
    context.addDecoration(GraphicType.ViewOverlay, this._graphic);
  }

  public static register(edges: MeshArgsEdges): EdgeDecorator {
    const colors = new ColorIndex();
    colors.initUniform(ColorDef.red);

    const points = [new Point3d(0, 0, 0), new Point3d(10, 0, 0), new Point3d(10, 10, 0)];
    const qpoints = new QPoint3dList(QParams3d.fromRange(Range3d.createArray(points)));
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

  function test(edges: MeshArgsEdges, testFn: (vp: Viewport) => void): void {
    const decorator = EdgeDecorator.register(edges);

    testBlankViewport(testFn);
    IModelApp.viewManager.dropDecorator(decorator);
  }

  // Returns the unique colors with the number of pixels of that color, in descending order.
  function expectColors(expected: ColorDef[], edges: MeshArgsEdges): void {
    test(edges, (vp) => {
      vp.renderFrame();

      // Add the viewport's background color as an expected color.
      expected = [...expected, ColorDef.black];
      expectUniqueColors(expected, vp);
    });
  }

  // Asserts that the number of pixels of the specified color is less than or greater than the specified quantity.
  function expectColorCount(color: ColorDef, expected: "greaterThan" | "lessThan", threshold: number, edges: MeshArgsEdges): number {
    let count: number | undefined;

    test(edges, (vp) => {
      vp.renderFrame();
      
      const colors = readColorCounts(vp);
      for (const kvp of colors) {
        if (kvp.key.toColorDef().tbgr === color.tbgr) {
          count = kvp.value;
          break;
        }
      }

      expect(count).not.to.be.undefined;
      if (expected === "greaterThan") {
        expect(count).greaterThan(threshold);
      } else {
        expect(count).lessThan(threshold);
      }
    });

    return count!;
  }

  it("overrides nothing by default", () => {
    expectColors([ColorDef.red], makeHardEdges());
  });

  it("overrides color", () => {
    const edges = makeHardEdges();
    edges.color = ColorDef.blue;
    expectColors([ColorDef.red, ColorDef.blue], edges);
  });


  it("overrides width", () => {
    const edges = makeHardEdges();
    edges.color = ColorDef.blue;
    const count1 = expectColorCount(ColorDef.blue, "greaterThan", 0, edges);

    edges.width = 5;
    const count5 = expectColorCount(ColorDef.blue, "greaterThan", count1, edges);

    edges.width = 3;
    expectColorCount(ColorDef.blue, "greaterThan", count1, edges);
    expectColorCount(ColorDef.blue, "lessThan", count5, edges);
  });

  it("overrides pattern", () => {
  });

  it("does not override display style", () => {
    
  });
});
