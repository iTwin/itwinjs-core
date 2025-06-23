/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import { afterAll, afterEach, beforeAll, describe, it } from "vitest";
import { TestDecorator } from "../../TestDecorators";
import { IModelApp } from "../../../IModelApp";
import { ColorDef, EmptyLocalization, Feature } from "@itwin/core-common";
import { Point2d, Point3d, Transform, XYZProps } from "@itwin/core-geometry";
import { DecorateContext } from "../../../ViewContext";
import { GraphicType } from "../../../common";

class BlankingDecorator extends TestDecorator {
  public constructor(
    private readonly _origin: Point3d,
    private readonly _blankingColor: ColorDef,
    private readonly _blankingFeature: Feature,
    private readonly _fgColor: ColorDef,
    private readonly _fgFeature: Feature
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
    builder.setSymbology(this._blankingColor, this._blankingColor, 1);
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

describe("Blanking fill", () => {
  beforeAll(async () => IModelApp.startup({ localization: new EmptyLocalization() }));
  afterEach(() => TestDecorator.dropAll());
  afterAll(async () => IModelApp.shutdown());
  
  it("renders behind coplanar geometry from same feature", () => {
    
  });

  it("renders behind coplanar geometry from same element", () => {
    
  });

  it("renders behind geometry nearer to camera", () => {
    
  });

  it("renders in front of geometry closer to camera", () => {
    
  });
});
