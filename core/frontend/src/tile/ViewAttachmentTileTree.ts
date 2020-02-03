/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module Tile
 */

import {
  assert,
  BeDuration,
  dispose,
  Id64,
  Id64String,
  JsonUtils,
} from "@bentley/bentleyjs-core";
import {
  Angle,
  ClipVector,
  IndexedPolyface,
  IndexedPolyfaceVisitor,
  Matrix3d,
  Point2d,
  Point3d,
  Range2d,
  Range3d,
  Transform,
} from "@bentley/geometry-core";
import {
  ColorDef,
  ElementAlignedBox2d,
  ElementAlignedBox3d,
  Feature,
  FeatureTable,
  ImageBuffer,
  PackedFeatureTable,
  Placement2d,
  RenderMode,
  RenderTexture,
  TileProps,
  TileTreeProps,
  ViewAttachmentProps,
  ViewFlag,
  ViewFlags,
} from "@bentley/imodeljs-common";
import { IModelApp } from "../IModelApp";
import { IModelConnection } from "../IModelConnection";
import { FeatureSymbology } from "../render/FeatureSymbology";
import { Scene } from "../render/Scene";
import { RenderPlan } from "../render/RenderPlan";
import { RenderClipVolume } from "../render/RenderClipVolume";
import { RenderTarget } from "../render/RenderTarget";
import {
  SelectParent,
  Tile,
  TileDrawArgs,
  TileLoadPriority,
  TileLoader,
  TileParams,
  TileRequest,
  TileTree,
  TileTreeLoadStatus,
  TileTreeReference,
  TileTreeSet,
  TileVisibility,
  tileTreeParamsFromJSON,
} from "./internal";
import { SceneContext } from "../ViewContext";
import { ChangeFlags, CoordSystem, OffScreenViewport } from "../Viewport";
import { ViewRect } from "../ViewRect";
import { SpatialViewState, ViewState, ViewState2d, ViewState3d } from "../ViewState";
import { SheetViewState } from "../Sheet";

/**
 * Describes the location of a tile within the range of a quad subdivided in four parts.
 * @internal
 */
const enum Tile3dPlacement { // tslint:disable-line:no-const-enum
  UpperLeft,
  UpperRight,
  LowerLeft,
  LowerRight,
  Root,   // root placement is for root tile of a tree: a single placement representing entire image (not subdivided)
}

/**
 * Describes the state of the scene for a given level of the tile tree. All tiles on a given level use the same scene to generate their graphics.
 * @internal
 */
export const enum AttachmentSceneState { // tslint:disable-line:no-const-enum
  NotLoaded,  // We haven't tried to create the scene for this level of the tree
  Empty,      // This level of the tree has an empty scene
  Loading,    // All of the roots for this level of the tree have been created and we are loading their tiles
  Ready,      // All of the tiles required for this level of the tree are ready for rendering
}

const pixelsPerSheetTile = 512;

/** @internal */
abstract class AttachmentTileLoader extends TileLoader {
  public abstract get is3dAttachment(): boolean;
  public tileRequiresLoading(_params: TileParams): boolean { return true; }
  public get priority(): TileLoadPriority { return TileLoadPriority.Primary; }
  public async getChildrenProps(_parent: Tile): Promise<TileProps[]> { assert(false); return Promise.resolve([]); }
  public async requestTileContent(_tile: Tile, _isCanceled: () => boolean): Promise<TileRequest.Response> {
    // ###TODO?
    return Promise.resolve(undefined);
  }
}

/** @internal */
class TileLoader2d extends AttachmentTileLoader {
  private readonly _viewFlagOverrides: ViewFlag.Overrides;

  public constructor(view: ViewState) {
    super();

    // ###TODO: Why do 2d views have camera lights enabled?
    this._viewFlagOverrides = new ViewFlag.Overrides(view.viewFlags);
    this._viewFlagOverrides.setApplyLighting(false);
  }

  public get maxDepth() { return 1; }
  public get viewFlagOverrides() { return this._viewFlagOverrides; }
  public get is3dAttachment(): boolean { return false; }
}

/** @internal */
class TileLoader3d extends AttachmentTileLoader {
  /** DEBUG ONLY - Setting this to true will result in only sheet tile polys being drawn, and not the textures they contain. */
  private static _DEBUG_NO_TEXTURES = false;
  // ----------------------------------------------------------------------------------
  private static _viewFlagOverrides = new ViewFlag.Overrides(ViewFlags.fromJSON({
    renderMode: RenderMode.SmoothShade,
    noCameraLights: true,
    noSourceLights: true,
    noSolarLight: true,
    noTexture: TileLoader3d._DEBUG_NO_TEXTURES,
  }));

  public get maxDepth() { return 32; }
  public get viewFlagOverrides() { return TileLoader3d._viewFlagOverrides; }
  public get is3dAttachment(): boolean { return true; }
}

/** @internal */
class Tile2d extends Tile {
  public constructor(root: Tree2d, range: ElementAlignedBox2d) {
    const params: TileParams = {
      root,
      contentId: "",
      range: new Range3d(0, 0, -RenderTarget.frustumDepth2d, range.high.x, range.high.y, RenderTarget.frustumDepth2d),
      maximumSize: 512,  // does not matter... have no children
      isLeaf: true,
    };

    super(params);
    this.setIsReady();
  }

  public get hasChildren(): boolean { return false; }
  public get hasGraphics(): boolean { return true; }

  public drawGraphics(args: TileDrawArgs) {
    const myRoot = this.root as Tree2d;
    const viewRoot = myRoot.viewRoot;

    const drawArgs = TileDrawArgs.fromTileTree(args.context, myRoot.drawingToAttachment.clone(), viewRoot, this.root.viewFlagOverrides, myRoot.graphicsClip, args.parentsAndChildrenExclusive, myRoot.symbologyOverrides);
    viewRoot.draw(drawArgs);
  }
}

/** @internal */
class Tile3d extends Tile {
  /** DEBUG ONLY - This member will cause the sheet tile polyfaces to draw along with the underlying textures. */
  private static _DRAW_DEBUG_POLYFACE_GRAPHICS: boolean = false;
  // ------------------------------------------------------------------------------------------
  private _tilePolyfaces: IndexedPolyface[] = [];

  private constructor(root: Tree3d, parent: Tile3d | undefined, tileRange: ElementAlignedBox3d) {
    super({
      root,
      contentId: "",
      range: tileRange,
      maximumSize: .5 * Math.sqrt(2 * pixelsPerSheetTile * pixelsPerSheetTile),
      isLeaf: true,
      parent,
    });
  }

  public static create(root: Tree3d, parent: Tile3d | undefined, placement: Tile3dPlacement): Tile3d {
    let fullRange: Range3d;
    if (parent !== undefined)
      fullRange = parent.range.clone();
    else
      fullRange = root.getRootRange();

    const mid = fullRange.low.interpolate(0.5, fullRange.high);
    const range = new Range3d();
    switch (placement) {
      case Tile3dPlacement.UpperLeft:
        range.extend(mid);
        range.extend(Point3d.create(fullRange.low.x, fullRange.high.y, 0));
        break;
      case Tile3dPlacement.UpperRight:
        range.extend(mid);
        range.extend(fullRange.high);
        break;
      case Tile3dPlacement.LowerLeft:
        range.extend(fullRange.low);
        range.extend(mid);
        break;
      case Tile3dPlacement.LowerRight:
        range.extend(Point3d.create(fullRange.high.x, fullRange.low.y, 0));
        range.extend(mid);
        break;
      case Tile3dPlacement.Root:
      default:
        range.extendRange(fullRange);
        break;
    }
    range.low.z = 0;
    range.high.z = 1;

    return new Tile3d(root, parent, range);
  }

  /** Get the root tile tree cast to a Tree3d. */
  private get _rootAsTree3d(): Tree3d { return this.root as Tree3d; }
  /** Get the load state from the owner attachment's array at this tile's depth. */
  private getState(): AttachmentSceneState { return this._rootAsTree3d.getState(this.depth - 1); }
  /** Set the load state of the owner attachment's array at this tile's depth. */
  private setState(state: AttachmentSceneState) { this._rootAsTree3d.setState(this.depth - 1, state); }

  // override
  public get hasGraphics(): boolean { return this.isReady; }
  // override
  public get hasChildren(): boolean { return true; }  // << means that "there are children and creation may be necessary"... NOT "definitely have children in children list"

  // override
  public selectTiles(selected: Tile[], args: TileDrawArgs, _numSkipped: number = 0): SelectParent { return this.select(selected, args); }

  private select(selected: Tile[], args: TileDrawArgs, _numSkipped: number = 0): SelectParent {
    if (this.depth === 1)
      this._rootAsTree3d.viewport.rendering = false;

    if (this.isNotFound)
      return SelectParent.No;  // indicates no elements in this tile's range (or some unexpected error occurred during scene creation)

    const vis = this.computeVisibility(args);
    if (vis === TileVisibility.OutsideFrustum) {
      this.unloadChildren(args.purgeOlderThan);
      return SelectParent.No;
    }

    const tooCoarse = TileVisibility.TooCoarse === vis;
    const children = tooCoarse ? this.prepareChildren() : undefined;

    if (children !== undefined) {
      const initialSize = selected.length;
      this._childrenLastUsed = args.now;
      for (const child of children) {
        if (child.selectTiles(selected, args) === SelectParent.Yes) {
          // At lease one of the selected children is not ready to draw. If the parent (this) is drawable, draw in place of all the children.
          selected.length = initialSize;
          if (this.isReady) {
            selected.push(this);
            return SelectParent.No;
          } else {
            // This tile isn't ready to draw either. Try drawing its own parent in its place.
            return SelectParent.Yes;
          }
        }
      }
      return SelectParent.No;
    }

    // This tile is of appropriate resolution to draw. Enqueue it for loading if necessary.
    if (!this.isReady) {
      if (this._tilePolyfaces.length === 0) {
        this.createPolyfaces(args.context);   // graphicsClip on tree must be set before creating polys (the polys that represent the tile)
        if (this._tilePolyfaces.length === 0) {
          this.setNotFound();
          return SelectParent.No;
        }
      }
      this.createGraphics(args.context);
    }

    if (this.isReady) {
      selected.push(this);
      this.unloadChildren(args.purgeOlderThan);
      return SelectParent.No;
    }

    // Inform the sheet view state that it needs to recreate the scene next frame
    this._rootAsTree3d.sheetView.markAttachment3dSceneIncomplete();

    // Tell parent to render in this tile's place until it becomes ready to draw
    return SelectParent.Yes;
  }

  public createPolyfaces(context: SceneContext) {
    const system = context.target.renderSystem;

    // ### TODO: an optimization could be to make the texture non-square to save on space (make match cropped tile aspect ratio)

    // set up initial corner values (before cropping to clip)
    const tree = this._rootAsTree3d;

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
    const clip = undefined !== tree.graphicsClip ? tree.graphicsClip.clipVector : undefined;
    this._tilePolyfaces = system.createSheetTilePolyfaces(corners, clip);
  }

  public createGraphics(context: SceneContext) {
    const tree = this._rootAsTree3d;
    let currentState = this.getState();

    // "Ready" state is a valid situation. It means another tile created the scene for this level of detail. We will use that scene.
    // However, this means we would be using the texture for that other tile, which is not what we want. We must recreate the texture.

    if (currentState === AttachmentSceneState.Empty) {
      this.setNotFound();
      return;
    }

    const system = context.target.renderSystem;
    const viewport = tree.viewport;

    if (currentState !== AttachmentSceneState.Ready) {
      viewport.setSceneDepth(this.depth - 1, tree);
      viewport.vp.setupFromView();

      // Create the scene and if the scene is complete, mark the state as ready
      currentState = viewport.createScene(currentState);
      this.setState(currentState);
    }

    switch (currentState) {
      case AttachmentSceneState.NotLoaded:
      case AttachmentSceneState.Loading:
        return;
      case AttachmentSceneState.Empty:
        this.setNotFound();
        return;
      case AttachmentSceneState.Ready: {
        // Only render one tile per frame - otherwise we swamp the renderer and introduce lag
        if (!viewport.rendering) {
          viewport.rendering = true;

          // render the texture then create graphics from the polys and the rendered texture
          const frustumToRestore = viewport.vp.getFrustum();

          // Scene rect does not match this. That rect increases with depth. This rect is constant, because it is the rect of the final texture
          const dim = pixelsPerSheetTile;
          viewport.vp.setRect(new ViewRect(0, 0, dim, dim));

          // Change the frustum so it looks at only the visible (after clipping) portion of the scene.
          // Also only look at the relevant corner of the scene
          const frust = viewport.vp.getFrustum(CoordSystem.Npc);
          frust.initFromRange(this.range);  // use unclipped range of tile to change the frustum (this is what we're looking at)

          const rootToNpc = viewport.vp.viewingSpace.worldToNpcMap;
          rootToNpc.transform1.multiplyPoint3dArrayQuietNormalize(frust.points);
          viewport.vp.setupViewFromFrustum(frust);

          viewport.renderTexture();
          if (viewport.texture === undefined) {
            this.setNotFound();
          } else {
            let graphic = system.createGraphicList(system.createSheetTile(viewport.texture, this._tilePolyfaces, this._rootAsTree3d.tileColor));
            graphic = system.createBatch(graphic, this._rootAsTree3d.featureTable, this.contentRange);
            this.setContent({ graphic, contentRange: this.contentRange });
          }

          // restore frustum
          viewport.vp.setupViewFromFrustum(frustumToRestore);
        }

        break;
      }
    }
  }

  public prepareChildren(): Tile[] | undefined {
    if (this._children === undefined)
      this._children = [];
    if (this._children.length === 0) {
      const childTileUL = Tile3d.create(this._rootAsTree3d, this, Tile3dPlacement.UpperLeft);
      const childTileUR = Tile3d.create(this._rootAsTree3d, this, Tile3dPlacement.UpperRight);
      const childTileLL = Tile3d.create(this._rootAsTree3d, this, Tile3dPlacement.LowerLeft);
      const childTileLR = Tile3d.create(this._rootAsTree3d, this, Tile3dPlacement.LowerRight);
      this._children.push(childTileUL);
      this._children.push(childTileUR);
      this._children.push(childTileLL);
      this._children.push(childTileLR);
    }
    return this._children.length === 0 ? undefined : this._children;
  }

  public drawGraphics(args: TileDrawArgs) {
    super.drawGraphics(args);
    if (!Tile3d._DRAW_DEBUG_POLYFACE_GRAPHICS) {
      return;
    }

    const polys = this._tilePolyfaces;
    if (polys.length === 0)
      return;

    const lineColor = ColorDef.blue.clone();
    const fillColor = ColorDef.green.clone();
    fillColor.setAlpha(0x88);
    lineColor.setAlpha(0xff);
    const builder = args.context.createSceneGraphicBuilder();
    builder.setSymbology(lineColor, fillColor, 2);
    for (const poly of polys) {
      const polyVisitor = IndexedPolyfaceVisitor.create(poly, 0);
      while (polyVisitor.moveToNextFacet()) {
        const lineString: Point3d[] = [];
        for (let i = 0; i < 3; i++)
          lineString.push(polyVisitor.getPoint(i)!);
        if (lineString.length > 0)
          lineString.push(lineString[0].clone()); // close the loop
        builder.addLineString(lineString);
      }
    }

    args.graphics.add(builder.finish());
  }
}

/** @internal */
abstract class Tree extends TileTree {
  public graphicsClip?: RenderClipVolume;

  public dispose(): void {
    super.dispose();
    this.graphicsClip = dispose(this.graphicsClip);
  }

  public constructor(loader: AttachmentTileLoader, iModel: IModelConnection, modelId: Id64String) {
    // The root tile set here does not matter, as it will be overwritten by the Tree2d and Tree3d constructors
    const isLeaf = loader.is3dAttachment;
    const is3d = false; // NB: The attachment is 3d. The attachment tiles are 2d.
    const props: TileTreeProps = {
      id: modelId,
      rootTile: {
        contentId: "",
        range: {
          low: { x: 0, y: 0, z: 0 },
          high: { x: 0, y: 0, z: 0 },
        },
        maximumSize: 512,
        isLeaf,
      },
      location: Transform.identity.toJSON(),
    };
    const params = tileTreeParamsFromJSON(props, iModel, is3d, loader, modelId);
    super(params);
  }
}

/** @internal */
class Tree2d extends Tree {
  public readonly view: ViewState2d;
  public readonly viewRoot: TileTree;
  public readonly drawingToAttachment: Transform;
  public readonly symbologyOverrides: FeatureSymbology.Overrides;

  private constructor(iModel: IModelConnection, attachment: Attachment2d, view: ViewState2d, viewRoot: TileTree) {
    super(new TileLoader2d(view), iModel, attachment.id);

    this.view = view;
    this.viewRoot = viewRoot;

    this.symbologyOverrides = new FeatureSymbology.Overrides(view);

    const attachRange = attachment.placement.calculateRange();
    const attachWidth = attachRange.high.x - attachRange.low.x;
    const attachHeight = attachRange.high.y - attachRange.low.y;

    const viewExtents = view.getExtents();
    const scale = Point2d.create(attachWidth / viewExtents.x, attachHeight / viewExtents.y);

    const worldToAttachment = Point3d.createFrom(attachment.placement.origin);
    worldToAttachment.z = RenderTarget.depthFromDisplayPriority(attachment.displayPriority);

    const location = Transform.createOriginAndMatrix(worldToAttachment, Matrix3d.createIdentity());
    this.iModelTransform.setFrom(location);

    const aspectRatioSkew = view.getAspectRatioSkew();
    this.drawingToAttachment = Transform.createOriginAndMatrix(Point3d.create(), view.getRotation());
    this.drawingToAttachment.matrix.scaleColumns(scale.x, aspectRatioSkew * scale.y, 1, this.drawingToAttachment.matrix);
    const translation = viewRoot.iModelTransform.origin.cloneAsPoint3d();
    const viewOrg = view.getOrigin().minus(translation);
    this.drawingToAttachment.multiplyPoint3d(viewOrg, viewOrg);
    translation.plus(viewOrg, viewOrg);
    viewOrg.z = 0;
    const viewOrgToAttachment = worldToAttachment.minus(viewOrg);
    translation.plus(viewOrgToAttachment, translation);
    this.drawingToAttachment.origin.setFrom(translation);

    this.expirationTime = BeDuration.fromSeconds(15);

    // The renderer needs the unclipped range of the attachment to produce polys to be rendered as clip mask...
    // (Containment tests can also be more efficiently performed if boundary range is specified)
    const clipTf = location.inverse();
    if (clipTf !== undefined) {
      const clip = attachment.getOrCreateClip(clipTf);
      this.clipVolume = IModelApp.renderSystem.createClipVolume(clip);
      if (undefined !== this.clipVolume)
        clipTf.multiplyRange(attachRange, this.clipVolume.clipVector.boundingRange);
    }

    const sheetToDrawing = this.drawingToAttachment.inverse();
    if (sheetToDrawing !== undefined) {
      const graphicsClip = attachment.getOrCreateClip(sheetToDrawing);
      sheetToDrawing.multiplyRange(attachRange, graphicsClip.boundingRange);
      this.graphicsClip = IModelApp.renderSystem.createClipVolume(graphicsClip);
    }

    this._rootTile = new Tile2d(this, attachment.placement.bbox);
  }

  /** Create a Tree2d tile tree for a 2d attachment. Returns a Tree2d if the model tile tree is ready. Otherwise, returns the status of the tiles. */
  public static create(attachment: Attachment2d): AttachmentSceneState {
    const view = attachment.view as ViewState2d;
    const viewedModel = view.getViewedModel();
    if (!viewedModel)
      return AttachmentSceneState.Empty;

    if (undefined === attachment.treeRef)
      attachment.treeRef = viewedModel.createTileTreeReference(view);

    const owner = attachment.treeRef.treeOwner;
    const tree = owner.load();
    switch (owner.loadStatus) {
      case TileTreeLoadStatus.Loaded:
        assert(undefined !== tree);
        attachment.tree = new Tree2d(viewedModel.iModel, attachment, view, tree!);
        return AttachmentSceneState.Ready;
      case TileTreeLoadStatus.Loading:
        return AttachmentSceneState.Loading;
      default:
        return AttachmentSceneState.Empty;
    }
  }
}

/** @internal */
class TileColorSequence {
  private _index: number = 0;
  private readonly _colors: number[] = [
    0xff0000,
    0x00ff00,
    0x0000ff,
    0x7fff00,
    0x7f00ff,
    0x007fff,
    0xff7f00,
    0xff007f,
    0x00ff7f,
  ];

  public get next(): ColorDef {
    if (this._index >= this._colors.length)
      this._index = 0;

    const color = new ColorDef(this._colors[this._index]);
    color.setAlpha(0x7f);
    this._index++;
    return color;
  }
}

const tileColorSequence = new TileColorSequence();

/** @internal */
class Tree3d extends Tree {
  public readonly tileColor: ColorDef;
  public readonly biasDistance: number; // distance in z to position tile in parent viewport's z-buffer (should be obtained by calling DepthFromDisplayPriority)
  public readonly viewport: AttachmentViewport;
  public readonly sheetView: SheetViewState;
  public readonly attachment: Attachment3d;
  public readonly featureTable: PackedFeatureTable;

  private constructor(sheetView: SheetViewState, attachment: Attachment3d, sceneContext: SceneContext, viewport: AttachmentViewport, view: ViewState3d) {
    super(new TileLoader3d(), view.iModel, Id64.invalid);

    this.tileColor = tileColorSequence.next;
    const featureTable = new FeatureTable(1);
    featureTable.insert(new Feature(attachment.id));
    this.featureTable = PackedFeatureTable.pack(featureTable);

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
    const dim = pixelsPerSheetTile;
    this.viewport.vp.setRect(new ViewRect(0, 0, dim, dim));
    this.viewport.vp.setupFromView();

    const frust = this.viewport.vp.getFrustum(CoordSystem.Npc).transformBy(Transform.createOriginAndMatrix(Point3d.create(), Matrix3d.createScale(scale.x, scale.y, 1)));
    this.viewport.vp.npcToWorldArray(frust.points);
    this.viewport.vp.setupViewFromFrustum(frust);

    const style = view.displayStyle;

    // Override the background color. This is to match v8, but there should probably be an option in the "Details" about whether to do this or not.
    const bgColor = sheetView.displayStyle.backgroundColor.clone();
    // Set fully-transparent so that we discard background pixels (probably no point to the above line any more...)
    bgColor.setAlpha(0);
    style.backgroundColor.setFrom(bgColor);

    // turn off skybox and groundplane
    if (view.isSpatialView()) {
      const spatial = view as SpatialViewState;
      const env = spatial.getDisplayStyle3d().environment;
      env.ground.display = false;
      env.sky.display = false;
    }

    const range = attachment.placement.calculateRange();
    this.biasDistance = RenderTarget.depthFromDisplayPriority(attachment.displayPriority);

    range.getNpcToWorldRangeTransform(this.viewport.toParent);
    this.viewport.toParent.matrix.scaleColumns(scale.x, scale.y, 1, this.viewport.toParent.matrix);

    const fromParent = this.viewport.toParent.inverse();
    if (fromParent !== undefined) {
      const graphicsClip = attachment.getOrCreateClip(fromParent);
      this.graphicsClip = IModelApp.renderSystem.createClipVolume(graphicsClip);
    }

    this._rootTile = Tile3d.create(this, undefined, Tile3dPlacement.Root);
    (this._rootTile as Tile3d).createPolyfaces(sceneContext);    // graphics clip must be set before creating polys (the polys that represent the tile)

    this.iModelTransform.setFrom(this.viewport.toParent.clone());
    this.expirationTime = BeDuration.fromSeconds(15);
  }

  public static create(sheetView: SheetViewState, attachment: Attachment3d, sceneContext: SceneContext): Tree3d {
    const view = attachment.view as ViewState3d;
    const viewport = new AttachmentViewport(view);
    return new Tree3d(sheetView, attachment, sceneContext, viewport, view);
  }

  /** Get the load state from the owner attachment's array at this tile's depth. */
  public getState(depth: number): AttachmentSceneState { return this.attachment.getState(depth); }
  /** Set the load state of the owner attachment's array at this tile's depth. */
  public setState(depth: number, state: AttachmentSceneState) { this.attachment.setState(depth, state); }

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

/** @internal */
class AttachmentViewport {
  public readonly vp: OffScreenViewport;
  public rendering: boolean = false;
  public toParent: Transform = Transform.createIdentity();  // attachment NPC to sheet world
  private _texture?: RenderTexture;
  private _sceneDepth: number = 0xffffffff;
  private readonly _scene = new Scene();

  public constructor(view: ViewState3d) {
    this.vp = OffScreenViewport.create(view);
  }

  public get texture(): RenderTexture | undefined { return this._texture; }
  private get _changeFlags(): ChangeFlags { return (this.vp as any)._changeFlags; } // ###TODO gross.

  public createScene(currentState: AttachmentSceneState): AttachmentSceneState {
    if (currentState === AttachmentSceneState.Empty || currentState === AttachmentSceneState.Ready) {
      assert(false);    // these are end states
      return currentState;
    }

    if (this._changeFlags.areFeatureOverridesDirty) {
      const ovrs = new FeatureSymbology.Overrides(this.vp.view);
      this.vp.target.overrideFeatureSymbology(ovrs);
      this._changeFlags.clear();
    }

    if (!this.vp.controllerValid)
      this.vp.setupFromView();

    this._scene.foreground.length = 0;
    const sceneContext = this.vp.createSceneContext();
    this.vp.view.createScene(sceneContext);

    sceneContext.requestMissingTiles();

    // The scene is ready when (1) all required TileTree roots have been created and (2) all required tiles have finished loading
    if (!this.vp.view.areAllTileTreesLoaded || sceneContext.hasMissingTiles)
      return AttachmentSceneState.Loading;

    return AttachmentSceneState.Ready;
  }

  public renderImage(): ImageBuffer | undefined {
    if (!this.vp.renderPlanValid) {
      this.vp.target.changeRenderPlan(RenderPlan.createFromViewport(this.vp));
      this.vp.setRenderPlanValid();
    }

    this.vp.target.changeScene(this._scene);
    this.vp.renderFrame();

    this._texture = undefined;
    return this.vp.readImage();
  }

  public renderTexture() {
    const image = this.renderImage();
    if (image === undefined)
      return;   // image most likely consisted entirely of background pixels... don't bother creating graphic

    const params = new RenderTexture.Params(undefined, RenderTexture.Type.TileSection);
    this._texture = this.vp.target.renderSystem.createTextureFromImageBuffer(image, this.vp.view.iModel, params);
    assert(this._texture !== undefined);
  }

  public setSceneDepth(depth: number, tree: Tree3d) {
    if (this._sceneDepth !== depth) {
      // Ensure that if we return to this depth and need to produce more tile graphics, we first recreate the scene at that depth...
      if (0xffffffff !== this._sceneDepth && tree.getState(this._sceneDepth) === AttachmentSceneState.Ready)
        tree.setState(this._sceneDepth, AttachmentSceneState.NotLoaded);

      // Discard any tiles/graphics used for previous level-of-detail - we'll generate them at the new LOD
      this.vp.invalidateScene();
      // ###TODO this.view.cancelAllTileLoads();

      this._sceneDepth = depth;
      let dim = pixelsPerSheetTile;
      dim = dim * Math.pow(2, depth); // doubling the rect dimensions for every level of depth
      this.vp.setRect(new ViewRect(0, 0, dim, dim), true);
    }
  }

  // override
  public get isAspectRatioLocked(): boolean { return true; }
}

/** @internal */
export abstract class Attachment {
  /** DEBUG ONLY - The color of the attachment bounding box if drawn. */
  public static readonly DEBUG_BOUNDING_BOX_COLOR: ColorDef = ColorDef.red;
  // ---------------------------------------------------
  public id: Id64String;
  public readonly view: ViewState;
  public scale: number;
  public placement: Placement2d;
  public clip: ClipVector;
  public displayPriority: number;
  protected _tree?: Tree;

  protected constructor(props: ViewAttachmentProps, view: ViewState) {
    this.id = Id64.fromJSON(props.id);
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
  /** Returns true if this attachment has a defined tile tree and is ready to be drawn. */
  public get isReady(): boolean { return this._tree !== undefined; }
  /** The tile tree corresponding to this attachment, which may be 2d or 3d. Returns undefined if the tree has not been loaded. */
  public get tree(): Tree | undefined { return this._tree; }
  public set tree(tree: Tree | undefined) { this._tree = tree; }

  /** Given a view and placement, compute a scale for an attachment. */
  private static computeScale(view: ViewState, placement: Placement2d): number {
    return view.getExtents().x / placement.bbox.xLength();
  }

  public discloseTileTrees(trees: TileTreeSet): void {
    // ###TODO: An Attachment.Tree is *NOT* owned by a TileTreeOwner. It should be.
    // We disclose it for purpose of tracking memory consumption - but it will not be affected by tile tree purging (that only handles trees registered with IModelConnection.tiles)
    if (undefined !== this._tree)
      trees.add(this._tree);
  }

  /** Given a view and an origin point, compute a placement for an attachment. */
  private static computePlacement(view: ViewState, origin: Point2d, scale: number): Placement2d {
    const viewExtents = view.getExtents();
    const box = new Range2d();
    box.low.setZero();
    box.high.x = viewExtents.x / scale;
    box.high.y = viewExtents.y / scale;

    return new Placement2d(origin, Angle.createDegrees(0), box);
  }

  /** Load the tile tree for this attachment. Returns an Attachment.State to indicate success (Ready, Loading), or failure (Empty, NotLoaded, etc). */
  public abstract load(sheetView: SheetViewState, sceneContext: SceneContext): AttachmentSceneState;

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
    if (!this.clip.isValid)
      this.clip = this.createBoundaryClip();

    const clipReturn = this.clip.clone();
    if (transform !== undefined)
      clipReturn.transformInPlace(transform);
    return clipReturn;
  }

  /** DEBUG ONLY - Draw a border around this attachment using its placement. */
  public debugDrawBorder(context: SceneContext) {
    const origin = this.placement.origin;
    const bbox = this.placement.bbox;
    const rect: Point2d[] = [
      Point2d.create(origin.x, origin.y),
      Point2d.create(origin.x + bbox.high.x, origin.y),
      Point2d.create(origin.x + bbox.high.x, origin.y + bbox.high.y),
      Point2d.create(origin.x, origin.y + bbox.high.y),
      Point2d.create(origin.x, origin.y)];

    const builder = context.createSceneGraphicBuilder();
    builder.setSymbology(Attachment.DEBUG_BOUNDING_BOX_COLOR, Attachment.DEBUG_BOUNDING_BOX_COLOR, 2);
    builder.addLineString2d(rect, 0);
    const attachmentBorder = builder.finish();
    context.outputGraphic(attachmentBorder);
  }

  public draw(context: SceneContext): void {
    if (this.isReady && undefined !== this._tree) {
      const tree = this._tree;
      const args = TileDrawArgs.fromTileTree(context, tree.iModelTransform, tree, tree.viewFlagOverrides, tree.clipVolume, tree.loader.parentsAndChildrenExclusive);
      tree.draw(args);
    }
  }
}

/** @internal */
class Attachment2d extends Attachment {
  public treeRef?: TileTreeReference;

  public discloseTileTrees(trees: TileTreeSet): void {
    super.discloseTileTrees(trees);
    if (undefined !== this.treeRef)
      trees.disclose(this.treeRef);
  }

  public constructor(props: ViewAttachmentProps, view: ViewState2d) {
    super(props, view);
  }

  public get is2d(): boolean { return true; }
  public load(_sheetView: SheetViewState, _sceneContext: SceneContext): AttachmentSceneState {
    if (this.tree === undefined)
      return Tree2d.create(this);
    else
      return AttachmentSceneState.Ready;
  }
}

/** @internal */
class Attachment3d extends Attachment {
  private _states: AttachmentSceneState[];  // per level of the tree

  public constructor(props: ViewAttachmentProps, view: ViewState3d) {
    super(props, view);
    this._states = [];
  }

  public get is2d(): boolean { return false; }

  public discloseTileTrees(trees: TileTreeSet): void {
    super.discloseTileTrees(trees);
    const tree = this._tree as Tree3d;
    if (undefined !== tree)
      trees.disclose(tree.viewport.vp);
  }

  /** Returns the load state of this attachment's tile tree at a given depth. */
  public getState(depth: number): AttachmentSceneState { return depth < this._states.length ? this._states[depth] : AttachmentSceneState.NotLoaded; }

  /** Sets the state of this attachment's tile tree at a given depth. */
  public setState(depth: number, state: AttachmentSceneState) {
    while (this._states.length < depth + 1)
      this._states.push(AttachmentSceneState.NotLoaded);  // Fill any gaps
    this._states[depth] = state;
  }

  public load(sheetView: SheetViewState, sceneContext: SceneContext): AttachmentSceneState {
    if (this._tree === undefined)
      this._tree = Tree3d.create(sheetView, this, sceneContext);
    return AttachmentSceneState.Ready;
  }
}

/** @internal */
export class AttachmentList {
  public readonly list: Attachment[] = [];
  private _allReady: boolean = true;

  public constructor() { }

  /** The number of attachments in this list. */
  public get length(): number { return this.list.length; }

  /** Returns true if all attachments in this list have defined tile trees. */
  public get allReady(): boolean { return this._allReady; }

  /** Clear this list of attachments. */
  public clear() {
    this.list.length = 0;
    this._allReady = true;
  }

  /** Add an attachment to this list of attachments. */
  public add(attachment: Attachment) {
    this._allReady = this._allReady && attachment.isReady;
    this.list.push(attachment);
  }

  /** Drop an attachment from this list by reference. */
  public drop(attachment: Attachment) {
    const idx = this.list.indexOf(attachment);
    if (idx !== -1)
      this.list.splice(idx, 1);
    this.updateAllReady();
  }

  /** Update the flag on this attachments list recording whether or not all attachments are ready to be drawn. */
  private updateAllReady() {
    this._allReady = true;
    for (const attachment of this.list) {
      if (!attachment.isReady) {
        this._allReady = false;
        break;
      }
    }
  }

  /**
   * Load the tile tree for the attachment at the given index. Returns the resulting load status. If the load reported
   * anything other than "Ready" or "Loading", the load failed and the attachment has been removed from the list.
   */
  public load(idx: number, sheetView: SheetViewState, sceneContext: SceneContext): AttachmentSceneState {
    assert(idx < this.length);

    const attachment = this.list[idx];

    // Load the attachment. On failure, remove it from the array
    const loadStatus = attachment.load(sheetView, sceneContext);
    if (loadStatus !== AttachmentSceneState.Ready && loadStatus !== AttachmentSceneState.Loading)
      this.list.splice(idx, 1);

    this.updateAllReady();
    return loadStatus;
  }
}

/** @internal */
export function createAttachment(props: ViewAttachmentProps, view: ViewState): Attachment {
  if (view.is3d())
    return new Attachment3d(props, view);
  else
  return new Attachment2d(props, view as ViewState2d);
}
