/*---------------------------------------------------------------------------------------------
| $Copyright: (c) 2018 Bentley Systems, Incorporated. All rights reserved. $
 *--------------------------------------------------------------------------------------------*/
/** @module Views */

import { Point2d, Point3d } from "@bentley/geometry-core/lib/PointVector";
import { Gradient, GraphicParams } from "@bentley/imodeljs-common/lib/Render";
import { ViewContext } from "./ViewContext";
import { Angle } from "@bentley/geometry-core/lib/Geometry";
import { ColorDef, Placement2d, ElementAlignedBox2d } from "@bentley/imodeljs-common/lib/common";
import { Range2d } from "@bentley/geometry-core/lib/Range";
import { GraphicBuilder } from "./render/GraphicBuilder";
import { RenderTarget } from "./render/System";
import { Target } from "./render/webgl/Target";
import { ViewState } from "./ViewState";
import { ClipVector } from "@bentley/geometry-core/lib/geometry-core";
// import { Target } from "./render/webgl/Target";

/** Contains functionality specific to Sheet views. */
export namespace Sheet {
  /** Describes the geometry and styling of a sheet border decoration. */
  export class Border {
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
        Point3d.create(shadowWidth, -shadowWidth),
        Point3d.create(width + shadowWidth, -shadowWidth),
        Point3d.create(width + shadowWidth, height - shadowWidth),
        Point3d.create(width, height - shadowWidth),
        Point3d.create(width, 0),
        Point3d.create(shadowWidth, 0),
      ];
      if (context) {
        context.viewport.worldToViewArray(shadow);
      }

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

      return new Border(rect2d, shadow2d, gradient);
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
      if (Border._wantGradient)
        params.gradient = this.gradient;

      builder.activateGraphicParams(params);

      builder.addShape2d(this.shadow, Target.frustumDepth2d);
    }
  }

  /**
   * Describes the state of the scene for an attachment for a given level of the tile tree. All tiles on a given level use the same
   * scene to generate their graphics.
   */
  export enum AttachmentState {
    /** Haven't tried to create the scene for this level of the tree */
    NotLoaded,
    /** This level of the tree has an empty scene */
    Empty,
    /** All of the roots for this level of the tree have been created and we are loading their tiles */
    Loading,
    /** All of the tiles required for this level of the tree are ready for rendering */
    Ready,
  }

  /** An attachment is a reference to a View, placed on a sheet. THe attachment specifies the id of the view and its position on the sheet. */
  export class Attachment {
    public readonly view: ViewState;
    public readonly scale: number;
    public readonly placement: Placement2d;
    public clipping?: ClipVector;
    // ###TODO: public readonly displayPriority;

    private constructor(view: ViewState, scale: number, placement: Placement2d, clipping?: ClipVector) {
      this.view = view;
      this.scale = scale;
      this.placement = placement;
      this.clipping = clipping;
    }

    /** Create an attachment using a known size. The view scale will be computed. */
    public static createFromPlacement(view: ViewState, placement: Placement2d): Attachment {
      const scale = this.computeScale(view, placement.bbox);
      return new Attachment(view, scale, placement);
    }

    /** Create an attachment using a known view scale. The placement's size will be computed. */
    public static createFromScale(view: ViewState, origin: Point2d, scale: number): Attachment {
      const placement = this.computePlacement(view, origin, scale);
      return new Attachment(view, scale, placement);
    }

    /** Given a view and placement, compute a scale for an attachment. */
    public static computeScale(view: ViewState, placement: ElementAlignedBox2d): number {
      return view.getExtents().x / placement.width;
    }

    /** Given a view and an origin point, compute a placement for an attachment. */
    public static computePlacement(view: ViewState, origin: Point2d, scale: number): Placement2d {
      const viewExtents = view.getExtents();
      const box = new ElementAlignedBox2d();
      box.low.setZero();
      box.high.x = viewExtents.x / scale;
      box.high.y = viewExtents.y / scale;

      return new Placement2d(origin, Angle.createDegrees(0), box);
    }

    public clearClipping() { this.clipping = undefined; }
  }
}
