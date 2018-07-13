/*---------------------------------------------------------------------------------------------
| $Copyright: (c) 2018 Bentley Systems, Incorporated. All rights reserved. $
 *--------------------------------------------------------------------------------------------*/
/** @module Views */

import { Point2d, Point3d } from "@bentley/geometry-core/lib/PointVector";
import { Gradient, GraphicParams } from "@bentley/imodeljs-common/lib/Render";
import { ViewContext } from "./ViewContext";
import { Angle } from "@bentley/geometry-core/lib/Geometry";
import { ColorDef } from "@bentley/imodeljs-common/lib/common";
import { Range2d } from "@bentley/geometry-core/lib/Range";
import { GraphicBuilder } from "./render/GraphicBuilder";
import { Target } from "./render/webgl/Target";
// import { Target } from "./render/webgl/Target";

/** Describes the geometry of a sheet border. */
export class SheetBorder {
  private rect: Point2d[];
  private shadow: Point2d[];
  private gradient: Gradient.Symb;

  private constructor(rect: Point2d[], shadow: Point2d[], gradient: Gradient.Symb) {
    this.rect = rect;
    this.shadow = shadow;
    this.gradient = gradient;
  }

  /** Create a new sheet border. If a context is supplied, points are transformed to view coordinates. */
  public static create(width: number, height: number, context?: ViewContext) {
    // Rect
    const rect: Point3d[] = [
      Point3d.create(0, height),
      Point3d.create(0, 0),
      Point3d.create(width, 0),
      Point3d.create(width, height),
      Point3d.create(0, height)];
    if (context) {
      context.viewport.worldToViewArray(rect);
    }

    // Shadow
    const shadowWidth = .01 * Math.sqrt(width * width + height * height);
    const shadow: Point3d[] = [
      Point3d.create(shadowWidth, 0),
      Point3d.create(width, 0),
      Point3d.create(width, height - shadowWidth),
      Point3d.create(width + shadowWidth, height - shadowWidth),
      Point3d.create(width + shadowWidth, -shadowWidth),
      Point3d.create(shadowWidth, -shadowWidth),
      Point3d.create(shadowWidth, 0),
    ];

    if (context)
      context.viewport.worldToViewArray(shadow);

    // Gradient
    const gradient = new Gradient.Symb();
    gradient.mode = Gradient.Mode.Linear;
    gradient.angle = Angle.createDegrees(-45);
    gradient.keys = [{ value: 0, color: ColorDef.from(25, 25, 25) }, { value: 0.5, color: ColorDef.from(150, 150, 150) }];

    // Copy over points
    // ### TODO: Allow for conversion of 2d points array to view coordinates from world coordinates to avoid these copies?..
    const rect2d: Point2d[] = [];
    for (const point of rect)
      rect2d.push(Point2d.createFrom(point));
    const shadow2d: Point2d[] = [];
    for (const point of shadow)
      shadow2d.push(Point2d.createFrom(point));

    return new SheetBorder(rect2d, shadow2d, gradient);
  }

  public getRange(): Range2d {
    const range = Range2d.createArray(this.rect);
    const shadowRange = Range2d.createArray(this.shadow);
    range.extendRange(shadowRange);
    return range;
  }

  private static _wantGradient: boolean = false; // ###TODO not working properly yet...

  /** Add this border to the given GraphicBuilder. */
  public addToBuilder(builder: GraphicBuilder) {
    builder.setSymbology(ColorDef.black, ColorDef.black, 2);
    builder.addLineString2d(this.rect, 0);

    const params = new GraphicParams();
    params.setFillColor(ColorDef.black);
    if (SheetBorder._wantGradient)
      params.gradient = this.gradient;

    builder.activateGraphicParams(params);

    builder.addShape2d(this.shadow, Target.frustumDepth2d);
  }
}
