/*---------------------------------------------------------------------------------------------
| $Copyright: (c) 2018 Bentley Systems, Incorporated. All rights reserved. $
 *--------------------------------------------------------------------------------------------*/
/** @module Views */

import { Point2d, Point3d } from "@bentley/geometry-core/lib/PointVector";
import { Gradient, GraphicParams } from "@bentley/imodeljs-common/lib/Render";
import { ViewContext } from "./ViewContext";
import { Angle } from "@bentley/geometry-core/lib/Geometry";
import { ColorDef, Placement2d, ElementAlignedBox2d, ViewAttachmentProps, ColorByName } from "@bentley/imodeljs-common/lib/common";
import { Range2d } from "@bentley/geometry-core/lib/Range";
import { GraphicBuilder } from "./render/GraphicBuilder";
import { RenderTarget } from "./render/System";
import { Target } from "./render/webgl/Target";
import { ViewState, SheetViewState } from "./ViewState";
import { ClipVector, Transform } from "@bentley/geometry-core/lib/geometry-core";
import { Id64 } from "@bentley/bentleyjs-core/lib/Id";
import { JsonUtils } from "@bentley/bentleyjs-core/lib/JsonUtils";
import { TileTreeRoot } from "./tile/TileTree";
// import { GeometricModelState } from "./ModelState";
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

  /** Stores a pointer to the root of a tile tree for an attachment view. */
  export class Root extends TileTreeRoot {
    public boundingBoxColor: ColorDef = Attachments.boundingColors[0];
    public biasDistance?: number;
    private _clip?: ClipVector;

    public constructor(modelId: Id64, sheetView: SheetViewState) {
      super(sheetView.iModel, modelId, false, Transform.createIdentity(), undefined, undefined);
    }
  }

  /** Stores a pointer to the root of a tile tree for a 2d attachment view. */
  export class Root2d {

  }

  /** Stores a pointer to the root of a tile tree for a 3d attachment view. */
  export class Root3d {

  }

  /** Describes the state of an attachment or attachment list. */
  export enum State {
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
  export abstract class Attachment {
    // ###TODO: This class may need to store the actu and modelstate of the attachment in order to avoid unneccessary
    // requests when working with tiles and displaying
    public readonly view: ViewState;
    public scale: number;
    public placement: Placement2d;
    public clip: ClipVector;
    public displayPriority: number;

    protected constructor(props: ViewAttachmentProps, view: ViewState) {
      this.view = view;
      this.placement = Placement2d.fromJSON(props.placement);
      if (props.jsonProperties) {
        this.scale = JsonUtils.asDouble(props.jsonProperties.scale);
        this.clip = ClipVector.fromJSON(props.jsonProperties.clip);
        this.displayPriority = JsonUtils.asInt(props.jsonProperties.displayPriority);
      } else {
        this.scale = 0;
        this.clip = ClipVector.createEmpty();
        this.displayPriority = 0;
      }
    }

    // ###TODO: Provide ability in subclasses to create using only a view and a placement or scale

    /** Given a view and placement, compute a scale for an attachment. */
    protected static computeScale(view: ViewState, placement: ElementAlignedBox2d): number {
      return view.getExtents().x / placement.width;
    }

    /** Given a view and an origin point, compute a placement for an attachment. */
    protected static computePlacement(view: ViewState, origin: Point2d, scale: number): Placement2d {
      const viewExtents = view.getExtents();
      const box = new ElementAlignedBox2d();
      box.low.setZero();
      box.high.x = viewExtents.x / scale;
      box.high.y = viewExtents.y / scale;

      return new Placement2d(origin, Angle.createDegrees(0), box);
    }

    /** Remove the clip vector from this view attachment. */
    public clearClipping() { this.clip.clear(); }
  }

  /** A 2d sheet view attachment. */
  export class Attachment2d extends Attachment {
    private _tree: Root2d;

    public constructor(props: ViewAttachmentProps, view: ViewState) {
      super(props, view);
    }
  }

  /** A 3d sheet view attachment. */
  export class Attachment3d extends Attachment {
    private _tree: Root3d;

    public constructor(props: ViewAttachmentProps, view: ViewState) {
      super(props, view);
    }
  }

  /** A list of view attachments for a sheet. */
  export class Attachments {
    /** Re-usable bounding box colors for attachments. */
    public static boundingColors: ColorDef[] = [
      new ColorDef(ColorByName.darkOrange),
      new ColorDef(ColorByName.darkBlue),
      new ColorDef(ColorByName.darkRed),
      new ColorDef(ColorByName.darkCyan),
      new ColorDef(ColorByName.olive),
      new ColorDef(ColorByName.darkMagenta),
      new ColorDef(ColorByName.darkBrown),
      new ColorDef(ColorByName.darkGray),
    ];

    public readonly list: Attachment[] = [];
    private allAttachmentsLoaded: boolean = true;

    public constructor() { }

    /** Returns true if every attachment has a valid reference to a root. Otherwise, returns false. */
    public get allLoaded(): boolean { return this.allAttachmentsLoaded; }
    /** The number of attachments in this list. */
    public get length(): number { return this.list.length; }

    /** Given a view id, return an attachment containing that view from the list. If no attachment in the list stores that view, returns undefined. */
    public findByViewId(viewId: Id64): Attachment | undefined {
      for (const attachment of this.list)
        if (attachment.view.id.equals(viewId))
          return attachment;
      return undefined;
    }

    /** Clear this list of attachments. */
    public clear() {
      this.list.length = 0;
    }

    /** Add an attachment to this list of attachments. */
    public add(attachment: Attachment) {
      this.list.push(attachment);
    }

    /** Drop an attachment from this list by reference. */
    public drop(attachment: Attachment) {
      const idx = this.list.indexOf(attachment);
      if (idx !== -1)
        this.list.splice(idx, 1);
    }

    /** Set the bounding box color of each attachment. */
    public initBoundingBoxColors() {
      for (let i = 0; i < this.length; i++) {
        const tree = this.list[i].getTree();
        if (tree !== undefined)
          tree.boundingBoxColor = Attachments.boundingColors[i % 8];
      }
    }
  }
}
