/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module Views
 */

import { ColorDef, Feature, FeatureTable, Frustum, GraphicParams, HiddenLine, PackedFeatureTable, Placement2d, TextureTransparency, ViewAttachmentProps, ViewFlagOverrides } from "@itwin/core-common";
import { CoordSystem, DisclosedTileTreeSet, FeatureSymbology, Frustum2d, GraphicBranch, GraphicType, imageBufferToPngDataUrl, IModelApp, OffScreenViewport, openImageDataUrlInNewWindow, RenderClipVolume, RenderGraphic, RenderMemory, Scene, TileGraphicType, Viewport, ViewRect, ViewState } from "../core-frontend";
import { SceneContext } from "../ViewContext";
import { MockRender } from "./render/MockRender";
import { assert, dispose, expectDefined, Id64String } from "@itwin/core-bentley";
import { ClipShape, ClipVector, Matrix3d, Point2d, Point3d, PolyfaceBuilder, Range3d, StrokeOptions, Transform } from "@itwin/core-geometry";
import { createDefaultViewFlagOverrides } from "./tile/ViewFlagOverrides";

/** Draws the contents of a view attachment into a sheet view. */
export interface ViewAttachmentRenderer extends Disposable {
  readonly areAllTileTreesLoaded: boolean;
  addToScene: (context: SceneContext) => void;
  discloseTileTrees: (trees: DisclosedTileTreeSet) => void;
  readonly zDepth: number;
  collectStatistics: (stats: RenderMemory.Statistics) => void;
  viewAttachmentProps: ViewAttachmentProps;
  readonly viewport?: Viewport;
}

export function createViewAttachmentRenderer(args: {
  view: ViewState,
  backgroundColor: ColorDef,
  sheetModelId: Id64String,
  props: ViewAttachmentProps,
}): ViewAttachmentRenderer {
  const { props, view } = args;
  if (props.jsonProperties?.displayOptions?.drawAsRaster || (view.is3d() && view.isCameraOn)) {
    return new RasterAttachment(view, props, args.backgroundColor);
  } else {
    return new OrthographicAttachment(view, props, args.sheetModelId);
  }
}

/** A mostly no-op RenderTarget for an OrthographicAttachment.
 */
class AttachmentTarget extends MockRender.OffScreenTarget {
  private readonly _attachment: OrthographicAttachment;

  public constructor(attachment: OrthographicAttachment) {
    // The dimensions don't matter - we're not drawing anything.
    const rect = new ViewRect(1, 1);
    super(IModelApp.renderSystem, rect);
    this._attachment = attachment;
  }

  public override changeScene(scene: Scene): void {
    this._attachment.scene = scene;
  }

  public override overrideFeatureSymbology(ovrs: FeatureSymbology.Overrides): void {
    this._attachment.symbologyOverrides = ovrs;
  }
}

/** Draws the contents a 2d or orthographic 3d view directly into a sheet view.
 * We select tiles for the view in the context of a light-weight offscreen viewport with a no-op RenderTarget, then
 * collect the resultant graphics and add them to the sheet view's scene.
 */
class OrthographicAttachment {
  private readonly _viewport: OffScreenViewport;
  private readonly _props: ViewAttachmentProps;
  private readonly _sheetModelId: Id64String;
  private readonly _viewFlagOverrides: ViewFlagOverrides;
  private readonly _toSheet: Transform;
  private readonly _fromSheet: Transform;
  private readonly _sizeInMeters: Point2d;
  private readonly _range: Range3d;
  private readonly _viewRect = new ViewRect(0, 0, 1, 1);
  private readonly _originalFrustum = new Frustum();
  private readonly _clipVolume?: RenderClipVolume;
  private readonly _hiddenLineSettings?: HiddenLine.Settings;
  private readonly _scale: { x: number, y: number };
  private _debugFeatureTable?: PackedFeatureTable;
  public scene?: Scene;
  public symbologyOverrides: FeatureSymbology.Overrides;
  public readonly zDepth: number;

  public get view(): ViewState {
    return this._viewport.view;
  }

  public get viewAttachmentProps() {
    return this._props;
  }

  public get viewport(): Viewport {
    return this._viewport;
  }

  public constructor(view: ViewState, props: ViewAttachmentProps, sheetModelId: Id64String) {
    this.symbologyOverrides = new FeatureSymbology.Overrides(view);
    const target = new AttachmentTarget(this);
    this._viewport = OffScreenViewport.createViewport(view, target, true);

    this._props = props;
    this._sheetModelId = sheetModelId;

    const applyClip = true; // set to false for debugging
    this._viewFlagOverrides = {
      ...view.viewFlags,
      clipVolume: applyClip,
      lighting: false,
      shadows: false,
    };

    const placement = Placement2d.fromJSON(props.placement);
    const range = placement.calculateRange();
    this._range = range;
    this._sizeInMeters = new Point2d(range.xLength(), range.yLength());

    // Compute transform from attached view's world coordinates to sheet's world coordinates.
    // NB: We obtain the extents and origin from the *viewport* not the *view* - they may have been adjusted by the viewport.
    const applySkew = true; // set to false for debugging
    const skew = applySkew ? view.getAspectRatioSkew() : 1;
    const extents = this._viewport.viewingSpace.viewDelta.clone();
    const zDepth = Math.abs(extents.z);
    const scaleX = this._sizeInMeters.x / Math.abs(extents.x);
    const scaleY = skew * this._sizeInMeters.y / Math.abs(extents.y);
    this._scale = { x: 1 / scaleX, y: 1 / scaleY };

    const zBias = Frustum2d.depthFromDisplayPriority(props.jsonProperties?.displayPriority ?? 0);
    this.zDepth = 1.01 * (zDepth - zBias); // give a little padding so that geometry right up against far plane doesn't get clipped.

    // View origin is at the *back* of the view. Align *front* of view based on display priority.
    const viewRot = view.getRotation();
    const viewOrg = viewRot.multiplyVector(this._viewport.viewingSpace.viewOrigin);
    viewOrg.z += zDepth;
    viewRot.multiplyTransposeVectorInPlace(viewOrg);

    const matrix = Matrix3d.createScale(scaleX, scaleY, 1);
    matrix.multiplyMatrixMatrix(viewRot, matrix);
    const origin = Matrix3d.xyzMinusMatrixTimesXYZ(viewOrg, matrix, viewOrg);
    const attachmentOrigin = Point3d.createFrom(placement.origin);
    attachmentOrigin.z = zBias;
    const viewOrgToAttachment = attachmentOrigin.minus(viewOrg);
    origin.addInPlace(viewOrgToAttachment);
    this._toSheet = Transform.createRefs(origin, matrix);
    this._fromSheet = expectDefined(this._toSheet.inverse());

    // If the attached view is a section drawing, it may itself have an attached spatial view with a clip.
    // The clip needs to be transformed into sheet space.
    if (view.isDrawingView())
      this._viewport.drawingToSheetTransform = this._toSheet;

    // ###TODO? If we also apply the attachment's clip to the attached view, we may get additional culling during tile selection.
    // However the attached view's frustum is already clipped by intersection with sheet view's frustum, and additional clipping planes
    // introduce additional computation, so possibly not worth it.

    // Transform the view's clip (if any) to sheet space
    let viewClip = view.viewFlags.clipVolume ? view.getViewClip()?.clone() : undefined;
    if (viewClip)
      viewClip.transformInPlace(this._toSheet);
    else
      viewClip = ClipVector.createEmpty();

    let sheetClip;
    if (undefined !== props.jsonProperties?.clip)
      sheetClip = ClipVector.fromJSON(props.jsonProperties?.clip);

    if (sheetClip && sheetClip.isValid) {
      // Clip to view attachment's clip. NB: clip is in sheet coordinate space.
      for (const clip of sheetClip.clips)
        viewClip.clips.push(clip);
    } else {
      // Clip to view attachment's bounding box
      viewClip.appendShape([
        Point3d.create(this._range.low.x, this._range.low.y),
        Point3d.create(this._range.high.x, this._range.low.y),
        Point3d.create(this._range.high.x, this._range.high.y),
        Point3d.create(this._range.low.x, this._range.high.y),
      ]);
    }

    this._clipVolume = IModelApp.renderSystem.createClipVolume(viewClip);

    // Save off the original frustum (potentially adjusted by viewport).
    this._viewport.setupFromView();
    this._viewport.viewingSpace.getFrustum(CoordSystem.World, true, this._originalFrustum);

    const applyHiddenLineSettings = true; // for debugging edge display, set to false...
    const style = view.displayStyle;
    if (style.is3d() && applyHiddenLineSettings)
      this._hiddenLineSettings = style.settings.hiddenLineSettings;
  }

  public [Symbol.dispose](): void {
    this._viewport[Symbol.dispose]();
  }

  public discloseTileTrees(trees: DisclosedTileTreeSet): void {
    trees.disclose(this._viewport);
  }

  public addToScene(context: SceneContext): void {
    if (context.viewport.freezeScene)
      return;

    if (!context.viewport.view.viewsCategory(this._props.category))
      return;

    const wantBounds = context.viewport.wantViewAttachmentBoundaries;
    const wantClipShapes = context.viewport.wantViewAttachmentClipShapes;
    if (wantBounds || wantClipShapes) {
      const builder = context.createSceneGraphicBuilder();
      if (wantBounds) {
        builder.setSymbology(ColorDef.red, ColorDef.red, 2);
        builder.addRangeBox(this._range);
      }

      if (wantClipShapes && this._clipVolume) {
        builder.setSymbology(ColorDef.blue, ColorDef.blue, 2);
        for (const prim of this._clipVolume.clipVector.clips) {
          if (!(prim instanceof ClipShape))
            continue; // ###TODO handle non-shape primitives, if any such ever encountered

          const pts = [];
          const tf = prim.transformFromClip;
          for (const pt of prim.polygon) {
            const tfPt = tf ? tf.multiplyPoint3d(pt) : pt;
            pts.push(new Point2d(tfPt.x, tfPt.y));
          }

          builder.addLineString2d(pts, 0);
        }
      }

      // Put into a Batch so that we can see tooltip with attachment Id on mouseover.
      const batch = context.target.renderSystem.createBatch(builder.finish(), this.getDebugFeatureTable(), this._range);
      context.outputGraphic(batch);
    }

    if (!context.viewport.wantViewAttachments)
      return;

    // Pixel size used to compute size of ViewRect so that tiles of appropriate LOD are selected.
    const pixelSize = context.viewport.getPixelSizeAtPoint();
    if (0 === pixelSize)
      return;

    // Adjust attached view frustum based on intersection with sheet view frustum.
    const attachFrustum = this._originalFrustum.transformBy(this._toSheet);
    const attachFrustumRange = attachFrustum.toRange();
    const sheetFrustum = context.viewport.getWorldFrustum();
    const sheetFrustumRange = sheetFrustum.toRange();
    const intersect = attachFrustumRange.intersect(sheetFrustumRange);
    if (intersect.isNull)
      return;

    attachFrustum.initFromRange(intersect);
    attachFrustum.transformBy(this._fromSheet, attachFrustum);
    this._viewport.setupViewFromFrustum(attachFrustum);

    // Adjust view rect based on size of attachment on screen so that tiles of appropriate LOD are selected.
    const width = this._sizeInMeters.x * intersect.xLength() / attachFrustumRange.xLength();
    const height = this._sizeInMeters.y * intersect.yLength() / attachFrustumRange.yLength();
    this._viewRect.width = Math.max(1, Math.round(width / pixelSize));
    this._viewRect.height = Math.max(1, Math.round(height / pixelSize));
    this._viewport.setRect(this._viewRect);

    // Propagate settings from on-screen viewport.
    this._viewport.debugBoundingBoxes = context.viewport.debugBoundingBoxes;
    this._viewport.setTileSizeModifier(context.viewport.tileSizeModifier);

    // Create the scene.
    this._viewport.renderFrame();

    const scene = this.scene;
    if (!scene)
      return;

    // Extract scene graphics and insert into on-screen scene context.
    const options = {
      viewAttachmentId: this._props.id,
      clipVolume: this._clipVolume,
      hline: this._hiddenLineSettings,
      frustum: {
        is3d: this.view.is3d(),
        scale: this._scale,
      },
    };

    const outputGraphics = (source: RenderGraphic[]) => {
      if (0 === source.length)
        return;

      const graphics = new GraphicBranch();
      graphics.setViewFlagOverrides(this._viewFlagOverrides);
      graphics.symbologyOverrides = this.symbologyOverrides;

      for (const graphic of source)
        graphics.entries.push(graphic);

      const branch = context.createGraphicBranch(graphics, this._toSheet, options);
      context.outputGraphic(branch);
    };

    outputGraphics(scene.foreground);
    context.withGraphicType(TileGraphicType.BackgroundMap, () => outputGraphics(scene.background));
    context.withGraphicType(TileGraphicType.Overlay, () => outputGraphics(scene.overlay));

    // Report tile statistics to sheet view's viewport.
    const tileAdmin = IModelApp.tileAdmin;
    const selectedAndReady = tileAdmin.getTilesForUser(this._viewport);
    const requested = tileAdmin.getRequestsForUser(this._viewport);
    tileAdmin.addExternalTilesForUser(context.viewport, {
      requested: requested?.size ?? 0,
      selected: selectedAndReady?.selected.size ?? 0,
      ready: selectedAndReady?.ready.size ?? 0,
    });
  }

  private getDebugFeatureTable(): PackedFeatureTable {
    if (this._debugFeatureTable)
      return this._debugFeatureTable;

    const featureTable = new FeatureTable(1, this._sheetModelId);
    featureTable.insert(new Feature(this._props.id));
    this._debugFeatureTable = PackedFeatureTable.pack(featureTable);
    return this._debugFeatureTable;
  }

  public get areAllTileTreesLoaded(): boolean {
    return this.view.areAllTileTreesLoaded;
  }

  public collectStatistics(_stats: RenderMemory.Statistics): void {
    // Handled by discloseTileTrees()
  }

  public get toSheet(): Transform {
    return this._toSheet;
  }
}

function createRasterAttachmentViewport(_view: ViewState, _rect: ViewRect, _attachment: RasterAttachment): OffScreenViewport {
  class RasterAttachmentViewport extends OffScreenViewport {
    private _sceneContext?: SceneContext;
    private _isSceneReady = false;
    private readonly _attachment: RasterAttachment;

    public constructor(view: ViewState, rect: ViewRect, attachment: RasterAttachment) {
      super(IModelApp.renderSystem.createOffscreenTarget(rect));
      this._attachment = attachment;
      this._isAspectRatioLocked = true;
      this.changeView(view);
    }

    public override createSceneContext(): SceneContext {
      assert(!this._isSceneReady);

      this._sceneContext = super.createSceneContext();
      return this._sceneContext;
    }

    public override renderFrame(): void {
      assert(!this._isSceneReady);

      this.clearSceneContext();
      super.renderFrame();

      if (undefined !== this._sceneContext) {
        this._isSceneReady = !this._sceneContext.hasMissingTiles && this.view.areAllTileTreesLoaded;
        if (this._isSceneReady)
          this._attachment.produceGraphics(this._sceneContext);

        this._sceneContext = undefined;
      }
    }

    private clearSceneContext(): void {
      this._sceneContext = undefined;
    }

    public override addDecorations(): void {
      // ###TODO: skybox, ground plane, possibly grid. DecorateContext requires a ScreenViewport...
    }
  }

  return new RasterAttachmentViewport(_view, _rect, _attachment);
}

/** Draws a 3d view with camera enabled into a sheet view by producing an image of the view's contents offscreen. */
class RasterAttachment {
  private readonly _props: ViewAttachmentProps;
  private readonly _placement: Placement2d;
  private readonly _transform: Transform;
  public readonly zDepth: number;
  private _viewport?: OffScreenViewport;
  private _graphics?: RenderGraphic;

  public constructor(view: ViewState, props: ViewAttachmentProps, bgColor: ColorDef) {
    // Render to a 2048x2048 view rect. Scale in Y to preserve aspect ratio.
    const maxSize = 2048;
    const rect = new ViewRect(0, 0, maxSize, maxSize);
    const height = maxSize * view.getAspectRatio() * view.getAspectRatioSkew();
    const skew = maxSize / height;
    view.setAspectRatioSkew(skew);

    if (true !== props.jsonProperties?.displayOptions?.preserveBackground) {
      // Make background color 100% transparent so that Viewport.readImageBuffer() will discard transparent pixels.
      view.displayStyle.backgroundColor = bgColor.withAlpha(0);
    }

    this._viewport = createRasterAttachmentViewport(view, rect, this);
    this._props = props;
    this._placement = Placement2d.fromJSON(props.placement);
    this._transform = this._placement.transform;
    this.zDepth = Frustum2d.depthFromDisplayPriority(props.jsonProperties?.displayPriority ?? 0);
  }

  public [Symbol.dispose](): void {
    this._viewport?.[Symbol.dispose]();
  }

  public get viewAttachmentProps() {
    return this._props;
  }

  public get viewport(): Viewport | undefined {
    return this._viewport;
  }

  public get areAllTileTreesLoaded() {
    return this._viewport?.areAllTileTreesLoaded ?? true;
  }

  public addToScene(context: SceneContext): void {
    // ###TODO: check viewport.wantViewAttachmentClipShapes
    if (!context.viewport.view.viewsCategory(this._props.category))
      return;

    if (context.viewport.wantViewAttachmentBoundaries) {
      const builder = context.createSceneGraphicBuilder(this._transform);
      builder.setSymbology(ColorDef.red, ColorDef.red, 2);
      builder.addRangeBox(Range3d.createRange2d(this._placement.bbox));
      context.outputGraphic(builder.finish());
    }

    if (!context.viewport.wantViewAttachments)
      return;

    if (this._graphics) {
      context.outputGraphic(this._graphics);
      return;
    }

    if (undefined === this._viewport)
      return;

    this._viewport.debugBoundingBoxes = context.viewport.debugBoundingBoxes;
    this._viewport.setTileSizeModifier(context.viewport.tileSizeModifier);

    this._viewport.renderFrame();
    if (this._graphics)
      context.outputGraphic(this._graphics);
  }

  public discloseTileTrees(trees: DisclosedTileTreeSet) {
    if (this._viewport)
      trees.disclose(this._viewport);
  }

  public produceGraphics(context: SceneContext): void {
    assert(context.viewport === this._viewport);
    this._graphics = this.createGraphics(this._viewport);
    this._viewport = dispose(this._viewport);

    if (undefined !== this._graphics)
      context.outputGraphic(this._graphics);
  }

  private createGraphics(vp: Viewport): RenderGraphic | undefined {
    // Create a texture from the contents of the view.
    const image = vp.readImageBuffer({ upsideDown: true });
    if (undefined === image)
      return undefined;

    const debugImage = false; // set to true to open a window displaying the captured image.
    if (debugImage) {
      const url = imageBufferToPngDataUrl(image, false);
      if (url)
        openImageDataUrlInNewWindow(url, "Attachment");
    }

    const texture = IModelApp.renderSystem.createTexture({
      image: { source: image, transparency: TextureTransparency.Opaque },
    });
    if (!texture)
      return undefined;

    // Create a material for the texture
    const graphicParams = new GraphicParams();
    graphicParams.material = IModelApp.renderSystem.createRenderMaterial({ textureMapping: { texture } });

    // Apply the texture to a rectangular polyface.
    const depth = this.zDepth;
    const east = this._placement.bbox.low.x;
    const west = this._placement.bbox.high.x;
    const north = this._placement.bbox.low.y;
    const south = this._placement.bbox.high.y;
    const corners = [
      Point3d.create(east, north, depth),
      Point3d.create(west, north, depth),
      Point3d.create(west, south, depth),
      Point3d.create(east, south, depth),
    ];
    const params = [
      Point2d.create(0, 0),
      Point2d.create(1, 0),
      Point2d.create(1, 1),
      Point2d.create(0, 1),
    ];

    const strokeOptions = new StrokeOptions();
    strokeOptions.needParams = strokeOptions.shouldTriangulate = true;
    const polyfaceBuilder = PolyfaceBuilder.create(strokeOptions);
    polyfaceBuilder.addQuadFacet(corners, params);
    const polyface = polyfaceBuilder.claimPolyface();

    const graphicBuilder = IModelApp.renderSystem.createGraphicBuilder(Transform.createIdentity(), GraphicType.Scene, vp, this._props.id);
    graphicBuilder.activateGraphicParams(graphicParams);
    graphicBuilder.addPolyface(polyface, false);
    const graphic = graphicBuilder.finish();

    // Wrap the polyface in a GraphicBranch.
    const branch = new GraphicBranch(true);
    const vfOvrs = createDefaultViewFlagOverrides({ clipVolume: true, shadows: false, lighting: false, thematic: false });

    // Disable transparency - background pixels are 100% transparent so they will be discarded anyway. Other pixels are 100% opaque.
    vfOvrs.transparency = false;
    branch.setViewFlagOverrides(vfOvrs);
    branch.symbologyOverrides = new FeatureSymbology.Overrides();
    branch.entries.push(graphic);

    // Apply the attachment's clip, if any.
    let clipVolume;
    if (this._props.jsonProperties?.clip) {
      const clipVector = ClipVector.fromJSON(this._props.jsonProperties?.clip);
      if (clipVector.isValid)
        clipVolume = IModelApp.renderSystem.createClipVolume(clipVector);
    }

    return IModelApp.renderSystem.createGraphicBranch(branch, this._transform, { clipVolume });
  }

  public collectStatistics(stats: RenderMemory.Statistics): void {
    if (this._graphics)
      this._graphics.collectStatistics(stats);
  }
}

