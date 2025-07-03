/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import { afterAll, afterEach, beforeAll, describe, it } from "vitest";
import { TestDecorator } from "../../TestDecorators";
import { IModelApp } from "../../../IModelApp";
import { ColorDef, EmptyLocalization, Feature, FillFlags, GeometryClass, GraphicParams, RenderMode } from "@itwin/core-common";
import { Point2d, Point3d, Range3d, Transform } from "@itwin/core-geometry";
import { DecorateContext } from "../../../ViewContext";
import { GraphicType } from "../../../common";
import { testBlankViewport } from "../../openBlankViewport";
import { StandardViewId } from "../../../StandardView";
import { expectUniqueColors } from "../../ExpectColors";

const lineColor = ColorDef.from(1, 2, 3);
const surfaceColor = ColorDef.from(4, 5, 6);
const pointColor = ColorDef.from(7, 8, 9);
const blankingColor = ColorDef.from(0xa, 0xb, 0xc);
const bgColor = ColorDef.from(0xd, 0xe, 0xf);
const planarColor = ColorDef.from(0xff, 0xfe, 0xfd);

/** Produces a decoration that draws a square as a blanking region, plus a (P)oint, (S)urface, and (L)ine as follows:
 *
 *                        1 1 1
 *    0 1 2 3 4 5 6 7 8 9 0 1 2 
 *  0                           |
 *  1     P P P     S S S S S   |
 *  2   P P P P P   S S S S S   |
 *  3   P P P P P   S S S S S   |
 *  4   P P P P P   S S S S S   |
 *  5     P P P     S S S S S   |
 *  6                           |
 *  7   L L L L L L L L L L L   |
 *  8   L L L L L L L L L L L   |
 *  9   L L L L L L L L L L L   |
 * 10   L L L L L L L L L L L   |
 * 11   L L L L L L L L L L L   |
 * 12 _ _ _ _ _ _ _ _ _ _ _ _ _ |
 *
 * All blank pixels above are part of the blanking region.
 */
class BlankingDecorator extends TestDecorator {
  public constructor(
    private readonly _blankingFeature: Feature,
    private readonly _fgFeature: Feature,
    private readonly _origin: Point3d = new Point3d(0, 0, 0),
  ) {
    super();
  }

  public decorate(context: DecorateContext): void {
    const builder = context.createGraphic({
      type: GraphicType.Scene,
      placement: Transform.createTranslation(this._origin),
      pickable: { id: "0xbaadf00d" },
    });

    builder.activateFeature(this._blankingFeature);
    const blankingParams = new GraphicParams();
    blankingParams.fillColor = blankingParams.lineColor = blankingColor;
    blankingParams.fillFlags = FillFlags.Blanking;
    builder.activateGraphicParams(blankingParams);
    builder.addShape2d([
      new Point2d(0, 0), new Point2d(0, 12), new Point2d(12, 12), new Point2d(12, 0), new Point2d(0, 0),
    ], 0);
    builder.activateFeature(this._fgFeature);
    builder.setSymbology(pointColor, pointColor, 2);
    builder.addPointString2d([new Point2d(3, 3)], 0);
    builder.setSymbology(surfaceColor, surfaceColor, 1);
    builder.addShape2d([
      new Point2d(7, 1), new Point2d(11, 7), new Point2d(11, 11), new Point2d(7, 11), new Point2d(7, 1),
    ], 0);
    builder.setSymbology(lineColor, lineColor, 4);
    builder.addLineString2d([
      new Point2d(1, 9), new Point2d(11, 9),
    ], 0);
    
    context.addDecorationFromBuilder(builder);
  }
}

function expectBlankingRegion(expectedColors: ColorDef[]): void {
  testBlankViewport((vp) => {
    vp.displayStyle.backgroundColor = bgColor;
    vp.displayStyle.viewFlags = vp.displayStyle.viewFlags.copy({
      renderMode: RenderMode.SmoothShade,
      lighting: false,
      visibleEdges: false,
      forceSurfaceDiscard: true,
    });

    vp.view.setStandardRotation(StandardViewId.Top);
    vp.view.lookAtVolume(new Range3d(0, 0, -5, 12, 12, 5));
    vp.turnCameraOff();
    vp.synchWithView();

    vp.invalidateDecorations();
    vp.renderFrame();
    
    expectUniqueColors(vp, expectedColors);
  });
}

describe("Blanking fill", () => {
  beforeAll(async () => IModelApp.startup({ localization: new EmptyLocalization() }));
  afterEach(() => TestDecorator.dropAll());
  afterAll(async () => IModelApp.shutdown());
  
  it("renders behind coplanar geometry from same feature", () => {
    const feature = new Feature("0xabc");
    IModelApp.viewManager.addDecorator(new BlankingDecorator(
      feature,
      feature,
    ));

    expectBlankingRegion([blankingColor, pointColor, surfaceColor, lineColor, bgColor]);
  });

  it("renders behind coplanar geometry from same element", () => {
    IModelApp.viewManager.addDecorator(new BlankingDecorator(
      new Feature("0xabc", undefined, GeometryClass.Primary),
      new Feature("0xabc", undefined, GeometryClass.Construction),
    ));

    expectBlankingRegion([blankingColor, pointColor, surfaceColor, lineColor, bgColor]);
  });

  class PlanarDecorator extends TestDecorator {
    public constructor(private readonly _feature: Feature, private readonly _zDepth: number) {
      super();
    }

    public decorate(context: DecorateContext): void {
      const builder = context.createGraphic({
        type: GraphicType.Scene,
        placement: Transform.createIdentity(),
        pickable: { id: "0x12345678" },
      });

      builder.activateFeature(this._feature);
      builder.setSymbology(planarColor, planarColor, 1);
      builder.addShape2d([
        new Point2d(0, 0), new Point2d(0, 12), new Point2d(12, 12), new Point2d(12, 0), new Point2d(0, 0),
      ], this._zDepth);
      
      context.addDecorationFromBuilder(builder);
    }
  }
  it("renders behind unrelated geometry nearer to camera", () => {
    const blankingFeature = new Feature("0xabc");
    IModelApp.viewManager.addDecorator(new BlankingDecorator(blankingFeature, blankingFeature));
    const planarFeature = new Feature("0xdef");
    IModelApp.viewManager.addDecorator(new PlanarDecorator(planarFeature, 0.01));
    expectBlankingRegion([planarColor, bgColor]);
  });

  it("renders in front of unrelated geometry closer to camera", () => {
    const blankingFeature = new Feature("0xabc");
    IModelApp.viewManager.addDecorator(new BlankingDecorator(blankingFeature, blankingFeature));
    const planarFeature = new Feature("0xdef");
    IModelApp.viewManager.addDecorator(new PlanarDecorator(planarFeature, -0.01));
    expectBlankingRegion([blankingColor, pointColor, surfaceColor, lineColor, bgColor]);
  });
});
