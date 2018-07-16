/*---------------------------------------------------------------------------------------------
| $Copyright: (c) 2018 Bentley Systems, Incorporated. All rights reserved. $
 *--------------------------------------------------------------------------------------------*/
/** @module Views */

import { Point2d, Point3d } from "@bentley/geometry-core/lib/PointVector";
import { Gradient, GraphicParams } from "@bentley/imodeljs-common/lib/Render";
import { ViewContext } from "./ViewContext";
import { Angle } from "@bentley/geometry-core/lib/Geometry";
import { ColorDef, Placement2d, ElementAlignedBox2d, ViewAttachmentProps, ElementAlignedBox3d } from "@bentley/imodeljs-common/lib/common";
import { Range2d } from "@bentley/geometry-core/lib/Range";
import { GraphicBuilder } from "./render/GraphicBuilder";
import { Target } from "./render/webgl/Target";
import { ViewState, ViewState2d, SheetViewState } from "./ViewState";
import { ClipVector, Transform, RotMatrix } from "@bentley/geometry-core/lib/geometry-core";
import { Id64 } from "@bentley/bentleyjs-core/lib/Id";
import { JsonUtils } from "@bentley/bentleyjs-core/lib/JsonUtils";
import { TileTree, Tile } from "./tile/TileTree";
import { FeatureSymbology } from "./render/FeatureSymbology";
import { GeometricModel2dState } from "./ModelState";
import { BeDuration } from "@bentley/bentleyjs-core/lib/Time";
import { RenderTarget } from "./render/System";
import { IModelConnection } from "./IModelConnection";
import { assert } from "@bentley/bentleyjs-core/lib/Assert";

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

  /** An extension of Tile specific to rendering 2d attachments. */
  export class Tile2d extends Tile {
    public constructor(root: Tree2d, range: ElementAlignedBox2d) {
      super(new Tile.Params(
        root,
        "",
        new ElementAlignedBox3d(),
        512,  // does not matter... have no children
        [],
      ));
      this.range.low.set(0, 0, -RenderTarget.frustumDepth2d);
      this.range.high.set(range.high.x, range.high.y, RenderTarget.frustumDepth2d);
    }

    // override
    public get hasChildren(): boolean { return false; }
    // override
    public get hasGraphics(): boolean { return true; }
    // override
    public get maximumSize(): number { return 512; }

    // override
    public drawGraphics(args: Tile.DrawArgs) {
      const myRoot = this.root as Tree2d;
      const viewRoot = myRoot.viewRoot;

      const drawArgs = viewRoot.createDrawArgs(args.context);
      drawArgs.location.setFrom(myRoot.drawingToAttachment);
      // drawArgs.viewFlagOverrides = new ViewFlag.Overrides(myRoot.view.viewFlags);
      drawArgs.clip = myRoot.graphicsClip;
      drawArgs.graphics.symbologyOverrides = myRoot.symbologyOverrides;

      myRoot.view.createScene(drawArgs.context);

      // DEBUG
      /*
      if (false)
        myRoot.drawClipPolys(args);
      if (true)
        return;

      const params = new GraphicParams();
      params.linePixels = 2;
      params.setLineColor(myRoot.boundingBoxColor);
      params.setFillColor(myRoot.boundingBoxColor);

      const gf = args.context.createGraphic(Transform.createIdentity(), GraphicType.WorldDecoration);
      gf.activateGraphicParams(params);
      gf.addRangeBox(this.range);

      // Put in a branch so it doesn't get clipped...
      const branch = new GraphicBranch();
      branch.add(gf.finish());
      args.graphics.add(drawArgs.context.createBranch(branch, Transform.createIdentity()));
      */
    }
  }

  /** An extension of TileTree specific to rendering 2d attachments. */
  export class Tree2d extends TileTree {
    public readonly view: ViewState2d;
    public readonly viewRoot: TileTree;
    public readonly drawingToAttachment: Transform;
    public readonly graphicsClip: ClipVector;
    public readonly clip: ClipVector;
    public readonly symbologyOverrides: FeatureSymbology.Overrides;
    public readonly biasDistance: number = 0;
    public readonly boundingBoxColor: ColorDef = ColorDef.black;   // ***DEBUG

    private constructor(model: GeometricModel2dState, attachment: Attachment2d, view: ViewState2d, viewRoot: TileTree) {
      super(new TileTree.Params(
        new Id64(),
        undefined,    // we will build and set root tile manually below
        model,
        undefined,
        Transform.createIdentity(),
        undefined,
        undefined,
        undefined,
      ));

      this.view = view;
      this.viewRoot = viewRoot;

      // Ensure elements inside the view attachment are not affected to changes to category display for the sheet view
      this.symbologyOverrides = new FeatureSymbology.Overrides(view);

      const attachRange = attachment.placement.calculateRange();
      const attachWidth = attachRange.high.x - attachRange.low.x;
      const attachHeight = attachRange.high.y - attachRange.low.y;

      const viewExtents = view.getExtents();
      const scale = Point2d.create(attachWidth / viewExtents.x, attachHeight / viewExtents.y);

      const worldToAttachment = Point3d.createFrom(attachment.placement.origin);
      worldToAttachment.z = RenderTarget.depthFromDisplayPriority(attachment.displayPriority);

      const location = Transform.createOriginAndMatrix(worldToAttachment, RotMatrix.createIdentity());
      this.location.setFrom(location);

      const aspectRatioSkew = view.getAspectRatioSkew();
      this.drawingToAttachment = Transform.createOriginAndMatrix(Point3d.create(), view.getRotation());
      this.drawingToAttachment.matrix.scaleColumns(scale.x, aspectRatioSkew * scale.y, 1);
      const translation = viewRoot.location.origin.cloneAsPoint3d();
      const viewOrg = view.getOrigin().minus(translation);
      this.drawingToAttachment.multiplyPoint3d(viewOrg, viewOrg);
      translation.plus(viewOrg, viewOrg);
      viewOrg.z = 0;
      const viewOrgToAttachment = worldToAttachment.minus(viewOrg);
      translation.plus(viewOrgToAttachment, translation);
      this.drawingToAttachment.origin.setFrom(translation);

      this.expirationTime = BeDuration.fromSeconds(15);

      // The renderer needs the unclipped range of the attachment in order to produce polys to be rendered as clip mask...
      // (Containment tests can also be more efficiently performed if boundary range is specified)
      const clipTf = location.inverse();
      if (clipTf !== undefined) {
        this.clip = attachment.getOrCreateClip(clipTf);
        clipTf.multiplyRange(attachRange, this.clip.boundingRange);
      } else {
        this.clip = ClipVector.createEmpty();
      }

      const sheetToDrawing = this.drawingToAttachment.inverse();
      if (sheetToDrawing !== undefined) {
        this.graphicsClip = attachment.getOrCreateClip(sheetToDrawing);
        sheetToDrawing.multiplyRange(attachRange, this.graphicsClip.boundingRange);
      } else {
        this.graphicsClip = ClipVector.createEmpty();
      }

      this._rootTile = new Tile2d(this, attachment.placement.bbox);
    }

    /** Create a Tree2d tile tree for a 2d attachment. */
    public static create(attachment: Attachment2d): Tree2d | undefined {
      const viewedModel = attachment.view.getViewedModel();
      if (!viewedModel || !viewedModel.tileTree)
        return undefined;
      return new Tree2d(viewedModel, attachment, attachment.view, viewedModel.tileTree);
    }
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
    public id: Id64;
    public readonly view: ViewState2d;
    public scale: number;
    public placement: Placement2d;
    public clip: ClipVector;
    public displayPriority: number;

    protected constructor(props: ViewAttachmentProps, view: ViewState2d) {
      this.id = new Id64(props.id);
      this.view = view;
      this.placement = Placement2d.fromJSON(props.placement);
      if (props.jsonProperties) {
        this.scale = JsonUtils.asDouble(props.jsonProperties.scale);
        this.clip = ClipVector.fromJSON(props.jsonProperties.clip);
        this.displayPriority = JsonUtils.asInt(props.jsonProperties.displayPriority);
      } else {
        this.scale = 0;
        this.clip = ClipVector.createEmpty();
        this.displayPriority = 0; // ###TODO: is there a valid "default" value here?
      }
    }

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

    /** Load the tile tree for this attachment. Returns true if successful. */
    public abstract load(sheetView: ViewState): boolean;

    /** Returns the tile tree corresponding to this attachment, which may be 2d or 3d. Returns undefined if the tree has not been loaded. */
    public get tree(): Tree2d | undefined { return this.tree; }

    /** Remove the clip vector from this view attachment. */
    public clearClipping() { this.clip.clear(); }

    /** Create a boundary clip vector around this attachment. */
    public createBoundaryClip(): ClipVector {
      const range = this.placement.calculateRange();
      const box: Point3d[] = [
        Point3d.create(range.low.x, range.low.y),
        Point3d.create(range.high.x, range.low.y),
        Point3d.create(range.high.x, range.high.y),
        Point3d.create(range.low.x, range.high.y),
        Point3d.create(range.low.x, range.low.y),
      ];
      const clip = ClipVector.createEmpty();
      clip.appendShape(box);
      return clip;
    }

    /** Returns the current clipping if it is defined and not null. Otherwise, attempt to create a new stored boundary clipping. */
    public getOrCreateClip(transform?: Transform): ClipVector {
      if (!this.clip.isValid())
        this.clip = this.createBoundaryClip();
      if (transform !== undefined)
        this.clip.transformInPlace(transform);
      return this.clip;
    }
  }

  /** A 2d sheet view attachment. */
  export class Attachment2d extends Attachment {
    private _tree?: Tree2d;

    public constructor(props: ViewAttachmentProps, view: ViewState2d) {
      super(props, view);
    }

    public load(_sheetView: ViewState): boolean {
      if (this._tree === undefined)
        this._tree = Tree2d.create(this);
      return this._tree !== undefined;
    }
  }

  /** A list of view attachments for a sheet. */
  export class Attachments {
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

    /** If all attachments are loaded, set the allAttachmentsLoaded flag to true. */
    protected updateAllLoaded() {
      this.allAttachmentsLoaded = true;
      for (const attachment of this.list) {
        if (attachment.tree === undefined) {
          this.allAttachmentsLoaded = false;
          break;
        }
      }
    }

    /** Load the tile tree for the attachment at the given index. Returns true if successful. */
    public load(idx: number, sheetView: SheetViewState): boolean {
      assert(idx < this.length);

      const attachment = this.list[idx];
      if (attachment.tree !== undefined)
        return true;

      const loaded = attachment.load(sheetView);
      if (!loaded)
        this.list.splice(idx, 1);

      this.updateAllLoaded();
      return loaded;
    }
  }
}
