/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import { afterAll, afterEach, beforeAll, describe, it } from "vitest";
import { TestDecorator } from "../../TestDecorators";
import { IModelApp } from "../../../IModelApp";
import { ColorDef, EmptyLocalization, Feature, FillFlags, GraphicParams, RenderMode } from "@itwin/core-common";
import { Point2d, Point3d, Range3d, Transform, XYZProps } from "@itwin/core-geometry";
import { DecorateContext } from "../../../ViewContext";
import { GraphicType } from "../../../common";
import { Viewport } from "../../../Viewport";
import { testBlankViewport } from "../../openBlankViewport";
import { StandardViewId } from "../../../StandardView";
import { expectColors } from "../../ExpectColors";



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
    private readonly _blankingColor: ColorDef,
    private readonly _blankingFeature: Feature,
    private readonly _fgColor: ColorDef,
    private readonly _fgFeature: Feature,
    private readonly _origin: Point3d = new Point3d(0, 0, 0),
  ) {
    super();
  }

  public decorate(context: DecorateContext): void {
    const builder = context.createGraphic({
      type: GraphicType.WorldDecoration,
      placement: Transform.createTranslation(this._origin),
      pickable: { id: "0xbaadf00d" },
    });

    builder.activateFeature(this._blankingFeature);
    const blankingParams = new GraphicParams();
    blankingParams.fillColor = blankingParams.lineColor = this._blankingColor;
    blankingParams.fillFlags = FillFlags.Blanking;
    builder.activateGraphicParams(blankingParams);
    builder.addShape2d([
      new Point2d(0, 0), new Point2d(0, 12), new Point2d(12, 12), new Point2d(12, 0), new Point2d(0, 0),
    ], 0);

    builder.activateFeature(this._fgFeature);
    builder.setSymbology(this._fgColor, this._fgColor, 2);
    builder.addPointString2d([new Point2d(3, 3)], 0);
    builder.setSymbology(this._fgColor, this._fgColor, 1);
    builder.addShape2d([
      new Point2d(7, 1), new Point2d(11, 7), new Point2d(11, 11), new Point2d(7, 11), new Point2d(7, 1),
    ], 0);
    builder.setSymbology(this._fgColor, this._fgColor, 4);
    builder.addLineString2d([
      new Point2d(1, 9), new Point2d(11, 9),
    ], 0);
    
    context.addDecorationFromBuilder(builder);
  }
}

const bgColor = ColorDef.from(12, 34, 56);

function expectBlankingRegion(expectedBlankingColor: ColorDef, expectedForegroundColor: ColorDef): void {
  testBlankViewport((vp) => {
    vp.displayStyle.backgroundColor = bgColor;
    vp.displayStyle.viewFlags = vp.displayStyle.viewFlags.copy({
      renderMode: RenderMode.SmoothShade,
      lighting: false,
      visibleEdges: false,
    });

    vp.view.setStandardRotation(StandardViewId.Top);
    vp.view.lookAtVolume(new Range3d(-5, -5, -5, 17, 17, 5));
    vp.turnCameraOff();
    vp.synchWithView();

    vp.invalidateDecorations();
    vp.renderFrame();
    
    expectColors(vp, [expectedBlankingColor, expectedForegroundColor, bgColor]);

    // ###TODO test individual pixels
  });
}

describe("Blanking fill", () => {
  beforeAll(async () => IModelApp.startup({ localization: new EmptyLocalization() }));
  afterEach(() => TestDecorator.dropAll());
  afterAll(async () => IModelApp.shutdown());
  
  it("renders behind coplanar geometry from same feature", () => {
    const feature = new Feature("0xabc");
    IModelApp.viewManager.addDecorator(new BlankingDecorator(
      ColorDef.red,
      feature,
      ColorDef.blue,
      feature,
    ));

    expectBlankingRegion(ColorDef.red, ColorDef.blue);
  });

  it("renders behind coplanar geometry from same element", () => {
    
  });

  it("renders behind geometry nearer to camera", () => {
    
  });

  it("renders in front of geometry closer to camera", () => {
    
  });
});
