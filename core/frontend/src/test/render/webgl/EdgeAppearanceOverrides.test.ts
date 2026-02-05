/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import { ColorDef, ColorIndex, EdgeAppearanceOverrides, EmptyLocalization, FeatureIndex, FillFlags, HiddenLine, LinePixels, MeshEdge, MeshPolyline, QParams3d, QPoint3dList } from "@itwin/core-common";
import { Point3d, Range3d, Transform } from "@itwin/core-geometry";
import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";
import { MeshArgs } from "../../../render/MeshArgs";
import { MeshArgsEdges } from "../../../common/internal/render/MeshPrimitives";
import { MeshGraphic } from "../../../internal/webgl";
import { createMeshParams } from "../../../common/internal/render/VertexTableBuilder";
import { IModelApp } from "../../../IModelApp";
import { RenderGraphic, RenderGraphicOwner } from "../../../render/RenderGraphic";
import { TestDecorator } from "../../TestDecorators";
import { DecorateContext } from "../../../ViewContext";
import { GraphicType } from "../../../common";
import { expectUniqueColors, readColorCounts, testBlankViewport } from "../../openBlankViewport";
import { Viewport } from "../../../Viewport";
import { GraphicBranch, GraphicBranchOptions } from "../../../core-frontend";

class EdgeDecorator extends TestDecorator {
  private readonly _graphic: RenderGraphicOwner;
  public constructor(graphic: RenderGraphic, hline?: EdgeAppearanceOverrides) {
    super();

    // Edges are disabled by default for view overlays. Turn them on.
    const branch = new GraphicBranch();
    branch.add(graphic);
    branch.viewFlagOverrides = { visibleEdges: true };

    let options: GraphicBranchOptions | undefined;
    if (hline) {
      options = {
        hline: HiddenLine.Settings.fromJSON({
          visible: {
            ovrColor: undefined !== hline.color,
            color: hline.color?.tbgr,
            pattern: hline.linePixels,
            width: hline.width,
          },
        }),
      };
    }

    const sys = IModelApp.renderSystem;
    this._graphic = sys.createGraphicOwner(sys.createBranch(branch, Transform.createIdentity(), options));
  }

  public decorate(context: DecorateContext): void {
    context.addDecoration(GraphicType.ViewOverlay, this._graphic);
  }

  public static register(edges: MeshArgsEdges, hline?: EdgeAppearanceOverrides): EdgeDecorator {
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

    const decorator = new EdgeDecorator(graphic!, hline);
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

  function test(edges: MeshArgsEdges, testFn: (vp: Viewport) => void, hline?: EdgeAppearanceOverrides): void {
    const decorator = EdgeDecorator.register(edges, hline);

    testBlankViewport(testFn);
    IModelApp.viewManager.dropDecorator(decorator);
  }

  // Returns the unique colors with the number of pixels of that color, in descending order.
  function expectColors(expected: ColorDef[], edges: MeshArgsEdges, hline?: EdgeAppearanceOverrides): void {
    test(edges, (vp) => {
      vp.renderFrame();

      // Add the viewport's background color as an expected color.
      expected = [...expected, ColorDef.black];
      expectUniqueColors(expected, vp);
    }, hline);
  }

  // Asserts that the number of pixels of the specified color is less than or greater than the specified quantity.
  function expectColorCount(color: ColorDef, expected: "greaterThan" | "lessThan", threshold: number, edges: MeshArgsEdges, hline?: EdgeAppearanceOverrides): number {
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
    }, hline);

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
    const edges = makeHardEdges();
    edges.color = ColorDef.blue;
    const countSolid = expectColorCount(ColorDef.blue, "greaterThan", 0, edges);

    edges.linePixels = LinePixels.Invisible;
    const countInvisible = expectColorCount(ColorDef.blue, "lessThan", countSolid, edges);

    edges.linePixels = LinePixels.Code4;
    expectColorCount(ColorDef.blue, "lessThan", countSolid, edges);
    expectColorCount(ColorDef.blue, "greaterThan", countInvisible, edges);
  });

  it("does not override display style", () => {
    const edges = makeHardEdges();
    expectColors([ColorDef.red, ColorDef.green], edges, { color: ColorDef.green });

    edges.color = ColorDef.blue;
    expectColors([ColorDef.red, ColorDef.green], edges, { color: ColorDef.green });
  });

  describe("polyline edges", () => {
    it("use base appearance if by default", () => {
      const args = new MeshArgsEdges();
      args.polylines.groups = [{ polylines: [new MeshPolyline([0, 1, 2])] }];
      expectColors([ColorDef.red], args);

      args.color = ColorDef.blue;
      expectColors([ColorDef.red, ColorDef.blue], args);
    });

    it("override aspects of base appearance per group", () => {
      const args = new MeshArgsEdges();
      args.polylines.groups = [{
        polylines: [new MeshPolyline([0, 1])],
        appearance: { color: ColorDef.blue },
      }];

      expectColors([ColorDef.red, ColorDef.blue], args);

      args.polylines.groups.push({
        polylines: [new MeshPolyline([1, 2])],
        appearance: { color: ColorDef.green },
      });

      expectColors([ColorDef.red, ColorDef.blue, ColorDef.green], args);

      args.polylines.groups.push({
        polylines: [new MeshPolyline([2, 0])],
      });

      expectColors([ColorDef.red, ColorDef.blue, ColorDef.green], args);

      const countBlueSolid1 = expectColorCount(ColorDef.blue, "greaterThan", 0, args);
      args.polylines.groups[0].appearance!.linePixels = LinePixels.Code1;
      const countBlueDashed1 = expectColorCount(ColorDef.blue, "lessThan", countBlueSolid1, args);

      args.polylines.groups[0].appearance!.width = 25;
      expectColorCount(ColorDef.blue, "greaterThan", countBlueDashed1, args);
    });

    it("can have different appearance than segment edges", () => {
      const args = new MeshArgsEdges();
      args.polylines.groups = [{
        polylines: [new MeshPolyline([0, 1])],
        appearance: { color: ColorDef.blue },
      }];
      args.edges.edges = [new MeshEdge(1, 2)],
      args.color = ColorDef.green;

      expectColors([ColorDef.red, ColorDef.blue, ColorDef.green], args);
    });

    it("can have multiple polylines per group", () => {
      const args = new MeshArgsEdges();
      args.polylines.groups = [{
        polylines: [new MeshPolyline([0, 1]), new MeshPolyline([1, 2])],
        appearance: { color: ColorDef.blue },
      }, {
        polylines: [new MeshPolyline([2, 0])],
        appearance: { color: ColorDef.green },
      }];

      expectColors([ColorDef.red, ColorDef.blue, ColorDef.green], args);
      const blueCount = expectColorCount(ColorDef.blue, "greaterThan", 0, args);
      expectColorCount(ColorDef.green, "lessThan", blueCount, args);
    });
  });
});
