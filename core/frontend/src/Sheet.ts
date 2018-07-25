/*---------------------------------------------------------------------------------------------
| $Copyright: (c) 2018 Bentley Systems, Incorporated. All rights reserved. $
 *--------------------------------------------------------------------------------------------*/
/** @module Views */

import { assert, BeDuration, Id64, JsonUtils } from "@bentley/bentleyjs-core";
import { Angle, ClipVector, Point2d, Point3d, Range2d, RotMatrix, Transform } from "@bentley/geometry-core";
import { ColorDef, Gradient, GraphicParams, Placement2d, ElementAlignedBox2d, ViewAttachmentProps, ElementAlignedBox3d, TileProps, ViewFlag, RenderTexture } from "@bentley/imodeljs-common";
import { ViewContext, SceneContext } from "./ViewContext";
import { GraphicBuilder, GraphicType } from "./render/GraphicBuilder";
import { ViewState, ViewState2d, ViewState3d, SheetViewState, SpatialViewState } from "./ViewState";
import { TileTree, Tile, TileLoader, MissingNodes } from "./tile/TileTree";
import { FeatureSymbology } from "./render/FeatureSymbology";
import { GeometricModel2dState, GeometricModelState, GeometricModel3dState } from "./ModelState";
import { RenderTarget, GraphicList } from "./render/System";
import { OffScreenViewport, CoordSystem } from "./Viewport";

/** Contains functionality specific to sheet views. */
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

    /** Add this border to the given GraphicBuilder. */
    public addToBuilder(builder: GraphicBuilder) {
      const lineColor = ColorDef.black;
      const fillColor = ColorDef.black;

      const params = new GraphicParams();
      params.setFillColor(fillColor);
      params.gradient = this.gradient;

      builder.activateGraphicParams(params);
      builder.addShape2d(this.shadow, RenderTarget.frustumDepth2d);

      builder.setSymbology(lineColor, fillColor, 2);
      builder.addLineString2d(this.rect, 0);
    }
  }

  class AttachmentViewport extends OffScreenViewport {
    private _texture?: RenderTexture;
    private _textureSize: number = 0;
    private _sceneDepth: number = 0xffffffff;
    private _scene?: GraphicList;
    private _rendering: boolean = false;
    public toParent: Transform = Transform.createIdentity();  // attachment NPC to sheet world
    private _biasDistance = 0;  // distance in z to position tile in parent viweport's z-buffer (should be obtained by calling DepthFromDisplayPriority)
    private terrain?: GraphicList;
    private clips?: ClipVector;

    public constructor(view: ViewState) {
      super(view);
    }
  }

  /** @hidden - Internal null tile loader used to satisfy parameter requirements when instantiating subclasses of Tile. */
  class NullTileLoader extends TileLoader {
    public async getTileProps(_ids: string[]): Promise<TileProps[]> {
      return Promise.resolve([]);
    }
    public async loadTileContents(_missingtiles: MissingNodes): Promise<void> {
      return Promise.resolve();
    }
    public getMaxDepth(): number {
      return 1;
    }
    public tileRequiresLoading(_params: Tile.Params): boolean {
      return false;
    }
    public loadGraphics(_tile: Tile, _geometry: any): void {
      assert(false);
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
      ), new NullTileLoader());
      this.range.low.set(0, 0, -RenderTarget.frustumDepth2d);
      this.range.high.set(range.high.x, range.high.y, RenderTarget.frustumDepth2d);
    }

    // override
    public get hasChildren(): boolean { return false; }
    // override
    public get hasGraphics(): boolean { return true; }

    // override
    public drawGraphics(args: Tile.DrawArgs) {
      const myRoot = this.root as Tree2d;
      const viewRoot = myRoot.viewRoot;

      const drawArgs = viewRoot.createDrawArgs(args.context);
      drawArgs.location.setFrom(myRoot.drawingToAttachment);
      // drawArgs.viewFlagOverrides = new ViewFlag.Overrides(myRoot.view.viewFlags);
      drawArgs.clip = myRoot.graphicsClip;
      drawArgs.graphics.symbologyOverrides = myRoot.symbologyOverrides;

      myRoot.view.createSceneFromDrawArgs(drawArgs);
    }
  }

  /** An extension of TileTree specific to rendering attachments. */
  export abstract class Tree extends TileTree {
    public graphicsClip: ClipVector = ClipVector.createEmpty();

    public constructor(model: GeometricModelState) {
      // The root tile set here does not matter, as it will be overwritten by the Tree2d and Tree3d constructors
      super(new TileTree.Params(
        new Id64(),
        {
          id: { treeId: "", tileId: "" },
          range: {
            low: { x: 0, y: 0, z: 0 },
            high: { x: 0, y: 0, z: 0 },
          },
          maximumSize: 512,
          childIds: [],
        },
        model,
        new NullTileLoader(),
        Transform.createIdentity(),
        undefined,
        undefined,    // ClipVector build in child class constructors
      ));
    }
  }

  /** An extension of TileTree specific to rendering 2d attachments. */
  export class Tree2d extends Tree {
    public readonly view: ViewState2d;
    public readonly viewRoot: TileTree;
    public readonly drawingToAttachment: Transform;
    public readonly symbologyOverrides: FeatureSymbology.Overrides;

    private constructor(model: GeometricModel2dState, attachment: Attachment2d, view: ViewState2d, viewRoot: TileTree) {
      super(model);

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
      this.drawingToAttachment.matrix.scaleColumns(scale.x, aspectRatioSkew * scale.y, 1, this.drawingToAttachment.matrix);
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
        this.clipVector = attachment.getOrCreateClip(clipTf);
        clipTf.multiplyRange(attachRange, this.clipVector.boundingRange);
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

    /** Create a Tree2d tile tree for a 2d attachment. Returns a Tree2d if the model tile tree is ready. Otherwise, returns the status of the tiles. */
    public static create(attachment: Attachment2d): TileTree.LoadStatus {
      const view = attachment.view as ViewState2d;
      const viewedModel = view.getViewedModel();
      if (!viewedModel)
        return TileTree.LoadStatus.NotFound;

      const tileTree = viewedModel.getOrLoadTileTree();
      if (tileTree !== undefined)
        attachment.tree = new Tree2d(viewedModel, attachment, view, tileTree);

      return viewedModel.loadStatus;
    }
  }

  /** An extension of TileTree specific to rendering 3d attachments. It contains a chain of tiles with texture renderings of the sheet (increasing in detail). */
  export class Tree3d extends Tree {
    public readonly biasDistance: number;
    private _viewport: AttachmentViewport;
    private _sheetView: SheetViewState;

    private constructor(sheetView: SheetViewState, attachment: Attachment3d, sceneContext: SceneContext, viewport: AttachmentViewport, view: ViewState3d) {
      super(new GeometricModel3dState({ modeledElement: { id: "" }, classFullName: "", id: "" }, view.iModel));   // Pass along a null Model3dState

      this._viewport = viewport;
      this._sheetView = sheetView;

      let scale: Point2d;

      // We use square tiles.. if the view's aspect ratio isn't square, expand the short side in tile NPC space. We'll clip out the extra area below.
      const aspect = view.getAspectRatio();
      if (aspect < 1)
        scale = Point2d.create(1 / aspect, 1);
      else
        scale = Point2d.create(1, aspect);

      // now expand the frustum in one direction so that the view is square (so we can use square tiles)
      const dim = this.querySheetTilePixels();
      this._viewport.target.viewRect.init(0, 0, dim, dim);
      this._viewport.setupFromView();

      const frust = this._viewport.getFrustum(CoordSystem.Npc).transformBy(Transform.createOriginAndMatrix(Point3d.create(), RotMatrix.createScale(scale.x, scale.y, 1)));
      this._viewport.npcToWorldArray(frust.points);
      this._viewport.setupViewFromFrustum(frust);

      const style = view.displayStyle;

      // Override the background color. This is to match v8, but there should probably be an option in the "Details" about whether to do this or not.
      const bgColor = sheetView.displayStyle.backgroundColor.clone();
      // Set fully-transparent so that we discard background pixels (probably no point to the above line any more...)
      bgColor.setAlpha(0x00);
      style.backgroundColor.setFrom(bgColor);

      // turn off skybox and groundplane
      if (view.isSpatialView()) {
        const spatial = view as SpatialViewState;
        const env = spatial.getDisplayStyle3d().getEnvironment();
        env.ground.display = false;
        env.sky.display = false;
        spatial.getDisplayStyle3d().setEnvironment(env);
      }

      const range = attachment.placement.calculateRange();
      const biasDistance = RenderTarget.depthFromDisplayPriority(attachment.displayPriority);
      this.biasDistance = biasDistance;

      range.getNpcToWorldRangeTransform(this._viewport.toParent);
      this._viewport.toParent.matrix.scaleColumns(scale.x, scale.y, 1);

      const fromParent = this._viewport.toParent.inverse();
      if (fromParent !== undefined)
        this.graphicsClip = attachment.getOrCreateClip(fromParent);

      this._rootTile = new Tile3d(this, attachment.placement.bbox);
      this._rootTile.createPolys(sceneContext);    // graphics clip must be set before creating polys (the polys that represent the tile)
    }

    public static create(sheetView: SheetViewState, attachment: Attachment3d, sceneContext: SceneContext): Tree3d {
      const view = attachment.view as ViewState3d;
      const viewport = new AttachmentViewport(view);
      return new Tree3d(sheetView, attachment, sceneContext, viewport, view);
    }
  }

  /** An attachment is a reference to a View, placed on a sheet. THe attachment specifies its view and its position on the sheet. */
  export abstract class Attachment {
    public id: Id64;
    public readonly view: ViewState;
    public scale: number;
    public placement: Placement2d;
    public clip: ClipVector;
    public displayPriority: number;
    protected _tree?: Tree;
    public static readonly boundingBoxColor: ColorDef = ColorDef.red;   // ***DEBUG

    protected constructor(props: ViewAttachmentProps, view: ViewState) {
      this.id = new Id64(props.id);
      this.view = view;
      this.displayPriority = 0;
      let scale: number | undefined;
      let placement: Placement2d | undefined;
      const jsonProps = props.jsonProperties;

      if (props.placement)
        placement = Placement2d.fromJSON(props.placement);

      if (jsonProps !== undefined) {
        scale = jsonProps.scale !== undefined ? JsonUtils.asDouble(jsonProps.scale) : undefined;
        this.clip = jsonProps.clip !== undefined ? ClipVector.fromJSON(jsonProps.clip) : ClipVector.createEmpty();
        this.displayPriority = JsonUtils.asInt(props.jsonProperties.displayPriority);
      } else {
        this.clip = ClipVector.createEmpty();
      }
      this.clip.parseClipPlanes();

      // Compute placement from scale, or scale from placement if necessary
      if (scale === undefined && placement === undefined) {
        scale = 1;
        placement = Attachment.computePlacement(view, Point2d.create(), scale);
      } else if (scale === undefined) {
        scale = Attachment.computeScale(view, placement!);
      } else if (placement === undefined) {
        placement = Attachment.computePlacement(view, Point2d.create(), scale);
      }

      this.scale = scale;
      this.placement = placement!;
    }

    /** Returns true if this attachment is a 2d view attachment. */
    public abstract get is2d(): boolean;
    /** Returns true if this attachment is a 3d view attachment. */
    public abstract get is3d(): boolean;
    /** Returns the tile tree corresponding to this attachment, which may be 2d or 3d. Returns undefined if the tree has not been loaded. */
    public get tree(): Tree | undefined { return this._tree; }
    /** @hidden - Sets the reference to the tile tree corresponding to this attachment view's model. */
    public set tree(tree: Tree | undefined) { this._tree = tree; }

    /** Given a view and placement, compute a scale for an attachment. */
    private static computeScale(view: ViewState, placement: Placement2d): number {
      return view.getExtents().x / placement.bbox.width;
    }

    /** Given a view and an origin point, compute a placement for an attachment. */
    private static computePlacement(view: ViewState, origin: Point2d, scale: number): Placement2d {
      const viewExtents = view.getExtents();
      const box = new ElementAlignedBox2d();
      box.low.setZero();
      box.high.x = viewExtents.x / scale;
      box.high.y = viewExtents.y / scale;

      return new Placement2d(origin, Angle.createDegrees(0), box);
    }

    /** Returns the load status of this attachment view's tile tree. */
    public abstract getLoadStatus(_depth?: number): TileTree.LoadStatus;

    /** Load the tile tree for this attachment, updating the attachment's load status. */
    public abstract load(sheetView: SheetViewState, sceneContext: SceneContext): void;

    /** Remove the clip vector from this view attachment. */
    public clearClipping() { this.clip.clear(); }

    /** Create a boundary clip vector around this attachment. */
    private createBoundaryClip(): ClipVector {
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

    /** Returns a clone of the current clipping if it is defined and not null. Otherwise, attempt to create a new stored boundary clipping. */
    public getOrCreateClip(transform?: Transform): ClipVector {
      if (!this.clip.isValid())
        this.clip = this.createBoundaryClip();

      const clipReturn = this.clip.clone();
      if (transform !== undefined)
        clipReturn.transformInPlace(transform);
      return clipReturn;
    }

    // DEBUG ONLY
    public drawDebugBorder(context: SceneContext) {
      const origin = this.placement.origin;
      const bbox = this.placement.bbox;
      const rect: Point2d[] = [
        Point2d.create(origin.x, origin.y),
        Point2d.create(origin.x + bbox.high.x, origin.y),
        Point2d.create(origin.x + bbox.high.x, origin.y + bbox.high.y),
        Point2d.create(origin.x, origin.y + bbox.high.y),
        Point2d.create(origin.x, origin.y)];

      const builder = context.createGraphic(Transform.createIdentity(), GraphicType.WorldDecoration);
      builder.setSymbology(Attachment.boundingBoxColor, Attachment.boundingBoxColor, 2);
      builder.addLineString2d(rect, 0);
      const attachmentBorder = builder.finish();
      context.outputGraphic(attachmentBorder);
    }
  }

  /** A 2d sheet view attachment. */
  export class Attachment2d extends Attachment {
    protected _loadStatus: TileTree.LoadStatus = TileTree.LoadStatus.NotLoaded;

    public constructor(props: ViewAttachmentProps, view: ViewState2d) {
      super(props, view);
    }

    public getLoadStatus(): TileTree.LoadStatus { return this._loadStatus; }

    public get is2d(): boolean { return true; }
    public get is3d(): boolean { return false; }

    public load(_sheetView: SheetViewState, _sceneContext: SceneContext) {
      if (this._loadStatus === TileTree.LoadStatus.Loaded)
        return;
      this._loadStatus = Tree2d.create(this);
    }
  }

  /** A 3d sheet view attachment. */
  export class Attachment3d extends Attachment {
    private states: TileTree.LoadStatus[];  // per level of the tree

    public constructor(props: ViewAttachmentProps, view: ViewState3d) {
      super(props, view);
      this.states = [];
    }

    /** Returns the load status of the tile tree up to the depth level provided. */
    public getLoadStatus(depth: number): TileTree.LoadStatus {
      return depth < this.states.length ? this.states[depth] : TileTree.LoadStatus.NotLoaded;
    }

    public get is2d(): boolean { return false; }
    public get is3d(): boolean { return false; }

    public load(sheetView: SheetViewState, sceneContext: SceneContext) {
      if (this._tree === undefined)
        this._tree = Tree3d.create(sheetView, this, sceneContext);
    }
  }

  /** A list of view attachments for a sheet. */
  export class Attachments {
    public readonly list: Attachment[] = [];
    private _allLoaded: boolean = true;

    public constructor() { }

    /** The number of attachments in this list. */
    public get length(): number { return this.list.length; }
    /** Returns true if all of the attachments in the list have loaded tile trees. */
    public get allLoaded(): boolean { return this._allLoaded; }

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
      this._allLoaded = this._allLoaded && (attachment.getLoadStatus() === TileTree.LoadStatus.Loaded);
      this.list.push(attachment);
    }

    /** Drop an attachment from this list by reference. */
    public drop(attachment: Attachment) {
      const idx = this.list.indexOf(attachment);
      if (idx !== -1)
        this.list.splice(idx, 1);
      this.updateAllLoaded();
    }

    /** Update the flag on this attachments list recording whether or not all attachments have loaded tile trees. */
    public updateAllLoaded() {
      this._allLoaded = true;
      for (const attachment of this.list) {
        if (attachment.getLoadStatus() !== TileTree.LoadStatus.Loaded) {
          this._allLoaded = false;
          break;
        }
      }
    }

    /** Load the tile tree for the attachment at the given index. Returns the load status of that attachment. */
    public load(idx: number, sheetView: SheetViewState, sceneContext: SceneContext): TileTree.LoadStatus {
      assert(idx < this.length);

      const attachment = this.list[idx];
      if (attachment.tree !== undefined)
        return TileTree.LoadStatus.Loaded;

      attachment.load(sheetView, sceneContext);
      if (attachment.getLoadStatus() === TileTree.LoadStatus.NotFound || attachment.getLoadStatus() === TileTree.LoadStatus.NotLoaded)
        this.list.splice(idx, 1);

      this.updateAllLoaded();
      return attachment.getLoadStatus();
    }
  }
}
