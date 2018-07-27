/*---------------------------------------------------------------------------------------------
| $Copyright: (c) 2018 Bentley Systems, Incorporated. All rights reserved. $
 *--------------------------------------------------------------------------------------------*/
/** @module Views */

import { assert, BeDuration, Id64, JsonUtils } from "@bentley/bentleyjs-core";
import { Angle, ClipVector, Point2d, Point3d, Range2d, RotMatrix, Transform, Range3d, IndexedPolyface } from "@bentley/geometry-core";
import { ColorDef, Gradient, GraphicParams, Placement2d, ElementAlignedBox2d, ViewAttachmentProps, ElementAlignedBox3d, RenderTexture, ImageBuffer } from "@bentley/imodeljs-common";
import { ViewContext, SceneContext } from "./ViewContext";
import { GraphicBuilder, GraphicType } from "./render/GraphicBuilder";
import { ViewState, ViewState2d, ViewState3d, SheetViewState, SpatialViewState } from "./ViewState";
import { TileTree, Tile, TileRequests, IModelTileLoader } from "./tile/TileTree";
import { FeatureSymbology } from "./render/FeatureSymbology";
import { GeometricModel2dState, GeometricModelState, GeometricModel3dState } from "./ModelState";
import { RenderTarget, GraphicList, RenderGraphic, RenderPlan } from "./render/System";
import { OffScreenViewport, CoordSystem, ViewRect } from "./Viewport";
import { UpdatePlan } from "./render/UpdatePlan";

/** Describes the geometry and styling of a sheet border decoration. */
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

    return new SheetBorder(rect2d, shadow2d, gradient);
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

/** Contains functionality specific to view attachments. */
export namespace Attachments {

  export class AttachmentViewport extends OffScreenViewport {
    public rendering: boolean = false;
    public toParent: Transform = Transform.createIdentity();  // attachment NPC to sheet world
    private _texture?: RenderTexture;
    private _sceneDepth: number = 0xffffffff;
    private _scene?: GraphicList;

    public constructor(view: ViewState) {
      super(view);
    }

    public get texture(): RenderTexture | undefined { return this._texture; }

    public createScene(currentState: State): State {
      if (currentState === State.Empty || currentState === State.Ready) {
        assert(false);    // these are end states
        return currentState;
      }

      const view = this.view;
      if (view.areFeatureOverridesDirty) {
        this.target.overrideFeatureSymbology(new FeatureSymbology.Overrides(view));
        view.setFeatureOverridesDirty(false);
      }

      if (!this.sync.isValidController)
        this.setupFromView();

      this._scene = [];
      const requests = new TileRequests();
      const sceneContext = new SceneContext(this, requests);
      view.createScene(sceneContext);

      requests.requestMissing();

      // The scene is ready when (1) all required TileTree roots have been created and (2) all required tiles have finished loading
      if (!view.areAllTileTreesLoaded || requests.hasMissingTiles)
        return State.Loading;

      return State.Ready;
    }

    public renderImage(): ImageBuffer | undefined {
      if (!this.sync.isValidRenderPlan) {
        this.target.changeRenderPlan(new RenderPlan(this));
        this.sync.setValidRenderPlan();
      }

      this.target.changeScene(this._scene! /* TODO: Pass view state's active volume... */);
      this.renderFrame(new UpdatePlan());

      this._texture = undefined;
      return this.readImage();
    }

    public renderTexture() {
      const image = this.renderImage();
      if (image === undefined)
        return;   // image most likely consisted entirely of background pixels... don't bother creating graphic

      const params = new RenderTexture.Params(undefined, RenderTexture.Type.TileSection);
      this._texture = this.target.renderSystem.createTextureFromImageBuffer(image, this.view.iModel, params);
      assert(this._texture !== undefined);
    }

    public setSceneDepth(depth: number, tree: Tree3d) {
      if (this._sceneDepth !== depth) {
        // Ensure that if we return to this depth and need to produce more tile graphics, we first recreate the scene at that depth...
        if (0xffffffff !== this._sceneDepth && tree.getState(this._sceneDepth) === State.Ready)
          tree.setState(this._sceneDepth, State.NotLoaded);

        // Discard any tiles/graphics used for previous level-of-detail - we'll generate them at the new LOD
        this.sync.invalidateScene();
        this.view.cancelAllTileLoads();

        this._sceneDepth = depth;
        let dim = QUERY_SHEET_TILE_PIXELS;
        dim = dim * Math.pow(2, depth); // doubling the rect dimensions for every level of depth
        this.setRect(new ViewRect(0, 0, dim, dim), true);
      }
    }
  }

  /** Describes the location of a tile within the range of a quad subdivided in four parts. */
  export const enum Tile3dPlacement {
    UpperLeft,
    UpperRight,
    LowerLeft,
    LowerRight,
    Root,   // root placement is for root tile of a tree: a single placement representing entire image (not subdivided)
  }

  /** Describes the state of the scene for a given level of the tile tree. All tiles on a given level use the same scene to generate their graphics. */
  export const enum State {
    NotLoaded,  // We haven't tried to create the scene for this level of the tree
    Empty,      // This level of the tree has an empty scene
    Loading,    // All of the roots for this level of the tree have been created and we are loading their tiles
    Ready,      // All of the tiles required for this level of the tree are ready for rendering
  }

  const QUERY_SHEET_TILE_PIXELS: number = 512;

  /** @hidden - Internal 'near null' tile loader used to satisfy parameter requirements when instantiating subclasses of Tile. */
  /*
  class AttachmentTileLoader extends TileLoader {
    public async getTileProps(_ids: string[]): Promise<TileProps[]> {
      return Promise.resolve([]);
    }
    public async loadTileContents(_missingtiles: MissingNodes): Promise<void> {
      return Promise.resolve();
    }
    public getMaxDepth(): number {
      return 362;
    }
    public tileRequiresLoading(_params: Tile.Params): boolean {
      return true;  // always true... otherwise our root tiles may get skipped
    }
    public loadGraphics(_tile: Tile, _geometry: any): void {
      assert(false);
    }
  }
*/
  /** An extension of Tile specific to rendering 2d attachments. */
  export class Tile2d extends Tile {
    public constructor(root: Tree2d, range: ElementAlignedBox2d) {
      super(new Tile.Params(
        root,
        "",
        new ElementAlignedBox3d(0, 0, -RenderTarget.frustumDepth2d, range.high.x, range.high.y, RenderTarget.frustumDepth2d),
        512,  // does not matter... have no children
        [],
      ), new IModelTileLoader(root.view.iModel, new Id64()));
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

  /** An extension of Tile specific to rendering 3d attachments. */
  export class Tile3d extends Tile {
    private _tilePolyfaces: IndexedPolyface[] = [];
    private _graphics: RenderGraphic[] = [];
    private _placement: Tile3dPlacement;

    public constructor(root: Tree3d, parent: Tile3d | undefined, placement: Tile3dPlacement) {
      super(new Tile.Params(
        root,
        "",
        new ElementAlignedBox3d(),
        .5 * Math.sqrt(2 * QUERY_SHEET_TILE_PIXELS * QUERY_SHEET_TILE_PIXELS),
        [],
        undefined,
        parent,
      ), new IModelTileLoader(root.sheetView.iModel, new Id64()));

      this._placement = placement;
      const tree = this.rootAsTree3d;

      let fullRange: Range3d;
      if (this.parent !== undefined)
        fullRange = this.parent.range.clone();
      else
        fullRange = tree.getRootRange();

      const mid = fullRange.low.interpolate(0.5, fullRange.high);
      switch (this._placement) {
        case Tile3dPlacement.UpperLeft:
          this.range.extend(mid);
          this.range.extend(Point3d.create(fullRange.low.x, fullRange.high.y, 0));
          break;
        case Tile3dPlacement.UpperRight:
          this.range.extend(mid);
          this.range.extend(fullRange.high);
          break;
        case Tile3dPlacement.LowerLeft:
          this.range.extend(fullRange.low);
          this.range.extend(mid);
          break;
        case Tile3dPlacement.LowerRight:
          this.range.extend(Point3d.create(fullRange.high.x, fullRange.low.y, 0));
          this.range.extend(mid);
          break;
        case Tile3dPlacement.Root:
        default:
          this.range.extendRange(fullRange);
          break;
      }
      this.range.low.z = 0;
      this.range.high.z = 1;
    }

    /** Get the root tile tree cast to a Tree3d. */
    private get rootAsTree3d(): Tree3d { return this.root as Tree3d; }
    /** Get the load state from the owner attachment's array at this tile's depth. */
    private getState(): State { return this.rootAsTree3d.getState(this.depth); }
    /** Set the load state of the onwner attachment's array at this tile's depth. */
    private setState(state: State) { this.rootAsTree3d.setState(this.depth, state); }

    // override
    public get hasGraphics(): boolean { return this.isReady; }
    // override
    public get hasChildren(): boolean { return true; }  // << means that "there are children and creation may be necessary"... NOT "definitely have children in children list"

    // override
    public drawGraphics(args: Tile.DrawArgs) {
      assert(this.isReady);
      for (const graphic of this._graphics)
        args.graphics.add(graphic);
    }

    /** override - Should not be used. Use getChildren() method on Tile3d instead. */
    public get children(): Tile[] | undefined {
      return undefined;
    }

    // override
    public selectTiles(selected: Tile[], args: Tile.DrawArgs, _numSkipped: number = 0): Tile.SelectParent {
      return this.select(selected, args);
    }

    private select(selected: Tile[], args: Tile.DrawArgs, _numSkipped: number = 0): Tile.SelectParent {
      if (this.depth === 0)
        this.rootAsTree3d.viewport.rendering = false;

      if (this.isNotFound)
        return Tile.SelectParent.No;  // indicates no elements in this tile's range (or some unexpected error occurred during scene creation)

      const vis = this.computeVisibility(args);
      if (vis === Tile.Visibility.OutsideFrustum) {
        this.unloadChildren(args.purgeOlderThan);
        return Tile.SelectParent.No;
      }

      const tooCoarse = Tile.Visibility.TooCoarse === vis;
      const children = tooCoarse ? this.getChildren(true) : undefined;

      if (children !== undefined) {
        const initialSize = selected.length;
        this._childrenLastUsed = args.now;
        for (const child of children) {
          if (child.selectTiles(selected, args) === Tile.SelectParent.Yes) {
            // At lease one of the selected children is not ready to draw. If the parent (this) is drawable, draw in place of all the children.
            selected.length = initialSize;
            if (this.isReady) {
              selected.push(this);
              return Tile.SelectParent.No;
            } else {
              // This tile isn't ready to draw either. Try drawing its own parent in its place.
              return Tile.SelectParent.Yes;
            }
          }
        }
        return Tile.SelectParent.No;
      }

      // This tile is of appropriate resolution to draw. Enqueue it for loading if necessary.
      if (!this.isReady) {
        if (this._tilePolyfaces.length === 0) {
          this.createPolyfaces(args.context);   // graphicsClip on tree must be set before creating polys (the polys that represent the tile)
          if (this._tilePolyfaces.length === 0) {
            this.setNotFound();
            return Tile.SelectParent.No;
          }
        }
        this.createGraphics(args.context);
      }

      if (this.isReady) {
        selected.push(this);
        this.unloadChildren(args.purgeOlderThan);
        return Tile.SelectParent.No;
      }

      // Inform the sheet view state that it needs to recreate the scene next frame
      this.rootAsTree3d.sheetView.markAttachment3dSceneIncomplete();

      // Tell parent to render in this tile's place until it becomes ready to draw
      return Tile.SelectParent.Yes;
    }

    public createPolyfaces(context: SceneContext) {
      const system = context.target.renderSystem;

      // ### TODO: an optimization could be to make the texture non-square to save on space (make match cropped tile aspect ratio)

      // set up initial corner values (before cropping to clip)
      const tree = this.rootAsTree3d;

      // Set up initial corner values (before cropping to clip). Range must already be set up (range = unclipped range)
      const east = this.range.low.x;
      const west = this.range.high.x;
      const north = this.range.low.y;
      const south = this.range.high.y;
      const corners: Point3d[] = [
        Point3d.create(east, north, tree.biasDistance),
        Point3d.create(west, north, tree.biasDistance),
        Point3d.create(west, south, tree.biasDistance),
        Point3d.create(east, south, tree.biasDistance),
      ];

      // first create the polys for the tile so we can get the range (create graphics from polys later)
      this._tilePolyfaces = system.createSheetTilePolyfaces(corners, tree.graphicsClip);
    }

    public createGraphics(context: SceneContext) {
      const tree = this.rootAsTree3d;
      let currentState = this.getState();

      // "Ready" state is a valid situation. It means another tile created the scene for this level of detail. We will use that scene.
      // However, this means we would be usng the texture for that other tile, which is not what we want. We must recreate the texture.

      assert(currentState !== State.Empty);
      if (currentState === State.Empty) {
        this.setNotFound();
        return;
      }

      const system = context.target.renderSystem;
      const viewport = tree.viewport;

      if (currentState !== State.Ready) {
        viewport.setSceneDepth(this.depth, tree);
        viewport.setupFromView();

        // Create the scene and if the scene is complete, mark the state as ready
        currentState = viewport.createScene(currentState);
        this.setState(currentState);
      }

      switch (currentState) {
        case State.NotLoaded:
        case State.Loading:
          return;
        case State.Empty:
          this.setNotFound();
          return;
        case State.Ready: {
          // Only render one tile per frame - otherwise we swamp the renderer and introduce lag
          if (!viewport.rendering) {
            viewport.rendering = true;

            // render the texture then create graphics from the polys and the rendered texture
            const frustumToRestore = viewport.getFrustum();

            // Scene rect does not match this. That rect increases with depth. This rect is constant, because it is the rect of the final texture
            const dim = QUERY_SHEET_TILE_PIXELS;
            viewport.setRect(new ViewRect(0, 0, dim, dim));

            // Change the frustum so it looks at only the visible (after clipping) portion of the scene.
            // Also only look at the relevant corner of the scene
            const frust = viewport.getFrustum(CoordSystem.Npc);
            frust.initFromRange(this.range);  // use unclipped range of tile to change the frustum (this is what we're looking at)

            const rootToNpc = viewport.worldToNpcMap;
            rootToNpc.transform1.multiplyPoint3dArrayQuietNormalize(frust.points);
            viewport.setupViewFromFrustum(frust);

            viewport.renderTexture();
            if (viewport.texture === undefined) {
              this.setNotFound();
            } else {
              const gfParams = GraphicParams.fromSymbology(Tree3d.tileColor, Tree3d.tileColor, 0);
              this._graphics = system.createSheetTile(viewport.texture, this._tilePolyfaces, gfParams);
              this.setIsReady();
            }

            // restore frustum
            viewport.setupViewFromFrustum(frustumToRestore);
          }

          break;
        }
      }
    }

    public getChildren(load: boolean): Tile[] | undefined {
      if (this._children === undefined)
        this._children = [];
      if (this._children.length === 0 && load) {
        const childTileUL = new Tile3d(this.rootAsTree3d, this, Tile3dPlacement.UpperLeft);
        const childTileUR = new Tile3d(this.rootAsTree3d, this, Tile3dPlacement.UpperRight);
        const childTileLL = new Tile3d(this.rootAsTree3d, this, Tile3dPlacement.LowerLeft);
        const childTileLR = new Tile3d(this.rootAsTree3d, this, Tile3dPlacement.LowerRight);
        this._children.push(childTileUL);
        this._children.push(childTileUR);
        this._children.push(childTileLL);
        this._children.push(childTileLR);
      }
      return this._children.length === 0 ? undefined : this._children;
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
        new IModelTileLoader(model.iModel, new Id64()),
        Transform.createIdentity(),
        undefined,
        undefined,    // ClipVector build in child class constructors
      ));
    }

    // override (don't depend on viewed model)
    public get is2d(): boolean { return true; }
    // override (don't depend on viewed model)
    public get is3d(): boolean { return false; }
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
    public static create(attachment: Attachment2d): State {
      const view = attachment.view as ViewState2d;
      const viewedModel = view.getViewedModel();
      if (!viewedModel)
        return State.Empty;

      viewedModel.getOrLoadTileTree();
      if (viewedModel.tileTree !== undefined)
        attachment.tree = new Tree2d(viewedModel, attachment, view, viewedModel.tileTree);

      if (viewedModel.loadStatus === TileTree.LoadStatus.Loaded)
        return State.Ready;
      else if (viewedModel.loadStatus === TileTree.LoadStatus.Loading)
        return State.Loading;
      else
        return State.Empty;
    }
  }

  /** An extension of TileTree specific to rendering 3d attachments. It contains a chain of tiles with texture renderings of the sheet (increasing in detail). */
  export class Tree3d extends Tree {
    public static readonly tileColor: ColorDef = ColorDef.white;
    public readonly biasDistance: number; // distance in z to position tile in parent viweport's z-buffer (should be obtained by calling DepthFromDisplayPriority)
    public readonly viewport: AttachmentViewport;
    /** A reference to the SheetViewState that this attachment corresponds to. */
    public readonly sheetView: SheetViewState;
    /** A reference to the attachment that owns this tile tree. */
    public readonly attachment: Attachment3d;

    private constructor(sheetView: SheetViewState, attachment: Attachment3d, sceneContext: SceneContext, viewport: AttachmentViewport, view: ViewState3d) {
      super(new GeometricModel3dState({ modeledElement: { id: "" }, classFullName: "", id: "" }, view.iModel));   // Pass along a null Model3dState

      this.viewport = viewport;
      this.sheetView = sheetView;
      this.attachment = attachment;

      let scale: Point2d;

      // We use square tiles.. if the view's aspect ratio isn't square, expand the short side in tile NPC space. We'll clip out the extra area below.
      const aspect = view.getAspectRatio();
      if (aspect < 1)
        scale = Point2d.create(1 / aspect, 1);
      else
        scale = Point2d.create(1, aspect);

      // now expand the frustum in one direction so that the view is square (so we can use square tiles)
      const dim = QUERY_SHEET_TILE_PIXELS;
      this.viewport.setRect(new ViewRect(0, 0, dim, dim));
      this.viewport.setupFromView();

      const frust = this.viewport.getFrustum(CoordSystem.Npc).transformBy(Transform.createOriginAndMatrix(Point3d.create(), RotMatrix.createScale(scale.x, scale.y, 1)));
      this.viewport.npcToWorldArray(frust.points);
      this.viewport.setupViewFromFrustum(frust);

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

      range.getNpcToWorldRangeTransform(this.viewport.toParent);
      this.viewport.toParent.matrix.scaleColumns(scale.x, scale.y, 1);

      const fromParent = this.viewport.toParent.inverse();
      if (fromParent !== undefined)
        this.graphicsClip = attachment.getOrCreateClip(fromParent);

      this._rootTile = new Tile3d(this, undefined, Tile3dPlacement.Root);
      (this._rootTile as Tile3d).createPolyfaces(sceneContext);    // graphics clip must be set before creating polys (the polys that represent the tile)

      this.location.setFrom(this.viewport.toParent.clone());
      this.expirationTime = BeDuration.fromSeconds(15);
    }

    public static create(sheetView: SheetViewState, attachment: Attachment3d, sceneContext: SceneContext): Tree3d {
      const view = attachment.view as ViewState3d;
      const viewport = new AttachmentViewport(view);
      return new Tree3d(sheetView, attachment, sceneContext, viewport, view);
    }

    /** Get the load state from the owner attachment's array at this tile's depth. */
    public getState(depth: number): State { return this.attachment.getState(depth); }
    /** Set the load state of the owner attachment's array at this tile's depth. */
    public setState(depth: number, state: State) { this.attachment.setState(depth, state); }

    /** Get the range for the root tile of this tile tree. */
    public getRootRange(result?: Range3d): Range3d {
      const tileSize = 1;
      const east = 0;
      const west = east + tileSize;
      const north = 0;
      const south = north + tileSize;

      const corners: Point3d[] = [
        Point3d.create(east, north, this.biasDistance),
        Point3d.create(west, north, this.biasDistance),
        Point3d.create(east, south, this.biasDistance),
        Point3d.create(west, south, this.biasDistance),
      ];

      return Range3d.createArray(corners, result);
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
    /** Returns true if this attachment is ready to be drawn. */
    public abstract get state(): State;
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
    /** The status of whether or not this attachment's tile tree is still attempting to load any tiles, forcing the SheetViewState to continue creating the scene. */
    private _status: State = State.NotLoaded;

    public constructor(props: ViewAttachmentProps, view: ViewState2d) {
      super(props, view);
    }

    public get is2d(): boolean { return true; }
    public get is3d(): boolean { return false; }
    public get state(): State { return this._status; }

    public load(_sheetView: SheetViewState, _sceneContext: SceneContext) {
      if (this.tree === undefined)
        this._status = Tree2d.create(this);
    }
  }

  /** A 3d sheet view attachment. */
  export class Attachment3d extends Attachment {
    private states: State[];  // per level of the tree

    public constructor(props: ViewAttachmentProps, view: ViewState3d) {
      super(props, view);
      this.states = [];
    }

    // ###TODO: Make this state used by attachments list and get rid of 3d attachments flag on SheetViewState
    /**
     * Returns "loaded" state.
     * 3d view attachments tell the SheetViewState directly whether or not to continue creating the scene using its "all3dAttachmentTilesReady" member.
     */
    public get state(): State { return State.Ready; }

    public get is2d(): boolean { return false; }
    public get is3d(): boolean { return false; }

    /** Returns the load state of this attachment's tile tree at a given depth. */
    public getState(depth: number): State { return depth < this.states.length ? this.states[depth] : State.NotLoaded; }

    /** Sets the load state of this attachment's tile tree at a given depth. */
    public setState(depth: number, state: State) {
      while (this.states.length < depth + 1)
        this.states.push(State.NotLoaded);  // Fill any gaps
      this.states[depth] = state;
    }

    public load(sheetView: SheetViewState, sceneContext: SceneContext) {
      if (this._tree === undefined)
        this._tree = Tree3d.create(sheetView, this, sceneContext);
    }
  }

  /** A list of view attachments for a sheet. */
  export class AttachmentList {
    public readonly list: Attachment[] = [];
    private _all2dReady: boolean = true;

    public constructor() { }

    /** The number of attachments in this list. */
    public get length(): number { return this.list.length; }

    /** Returns true if all of the 2d attachments in the list have tile trees that are fully loaded, and all 3d attachments have tile trees that are atleast not undefined. */
    public get allLoaded(): boolean {
      if (!this._all2dReady)
        return false;
      for (const attachment of this.list)
        if (attachment.tree === undefined)
          return false;
      return true;
    }

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
      if (attachment.is2d)
        this._all2dReady = this._all2dReady && (attachment.state === State.Ready);
      this.list.push(attachment);
    }

    /** Drop an attachment from this list by reference. */
    public drop(attachment: Attachment) {
      const idx = this.list.indexOf(attachment);
      if (idx !== -1)
        this.list.splice(idx, 1);
      this.updateAllReady();
    }

    /** Update the flag on this attachments list recording whether or not all 2d attachments are ready to be drawn. */
    private updateAllReady() {
      this._all2dReady = true;
      for (const attachment of this.list) {
        if (attachment.state !== State.Ready) {
          this._all2dReady = false;
          break;
        }
      }
    }

    /** Load the tile tree for the attachment at the given index. Returns the state of the attachment. */
    public load(idx: number, sheetView: SheetViewState, sceneContext: SceneContext): State {
      assert(idx < this.length);

      const attachment = this.list[idx];

      // Load each attachment and clean out any attachments that failed to load
      attachment.load(sheetView, sceneContext);
      if (attachment.state === State.Empty || attachment.state === State.NotLoaded)
        this.list.splice(idx, 1);

      this.updateAllReady();
      return attachment.state;
    }
  }
}
