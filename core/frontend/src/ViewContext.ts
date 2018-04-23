/*---------------------------------------------------------------------------------------------
| $Copyright: (c) 2018 Bentley Systems, Incorporated. All rights reserved. $
 *--------------------------------------------------------------------------------------------*/
import { Viewport } from "./Viewport";
import { Sprite } from "./Sprites";
import { Point3d, Vector3d, Point2d, RotMatrix, Transform } from "@bentley/geometry-core";
import { HitDetail, SnapMode, SnapDetail } from "./HitDetail";
import { GraphicType, GraphicBuilder, GraphicBuilderCreateParams } from "./render/GraphicBuilder";
import { DecorationList, GraphicList, Decorations, Graphic, ViewFlags } from "@bentley/imodeljs-common";
import { ACSDisplayOptions, AuxCoordSystemState } from "./AuxCoordSys";
import { IModelConnection } from "./IModelConnection";
import { PrimitiveBuilder } from "./render/primitives/Geometry";
import { RenderTarget, RenderSystem } from "./render/System";

export class ViewContext {
  private _viewFlags?: ViewFlags;
  private _viewport?: Viewport;

  public get viewFlags(): ViewFlags { return this._viewFlags!; }
  public get viewport(): Viewport { return this._viewport!; }

  constructor(vp?: Viewport) { if (!!vp) this.attachViewport(vp); }

  public attachViewport(vp: Viewport): void {
    this._viewport = vp;
    this._viewFlags = vp.viewFlags.clone(); // viewFlags can diverge from viewport after attachment
  }

  public getPixelSizeAtPoint(inPoint?: Point3d): number {
    const vp = this.viewport;
    const viewPt = !!inPoint ? vp.worldToView(inPoint) : vp.npcToView(new Point3d(0.5, 0.5, 0.5));
    const viewPt2 = new Point3d(viewPt.x + 1.0, viewPt.y, viewPt.z);
    return vp.viewToWorld(viewPt).distance(vp.viewToWorld(viewPt2));
  }
}

export class NullContext extends ViewContext {
}

export class DynamicsContext extends ViewContext {
}

export class SnapContext extends ViewContext {
  public snapDetail?: SnapDetail; // result of the snap
  public snapAperture = 10;
  public snapMode = SnapMode.Invalid;
  public snapDivisor = 2;

  public async snapToPath(_thisPath: HitDetail, _snapMode: SnapMode, _snapDivisor: number, _hotAperture: number): Promise<SnapDetail | undefined> {
    //   if (!Application.locateManager.isSnappableModel(thisPath.getModel())   {
    //       return undefined nullptr;
    //     return SnapStatus.ModelNotSnappable;
    //   }

    //   // test for un-snappable hits...ex. pattern, linestyle...
    //   GeomDetail const& detail = thisPath -> GetGeomDetail();

    //   if (!detail.IsSnappable())
    //     return SnapStatus:: NotSnappable;

    //   SnapStatus  status = SnapStatus:: NotSnappable;

    //   // attach the context
    //   Attach(& thisPath -> GetViewport(), DrawPurpose:: Pick);

    //   snapMode = snapMode;
    //   snapDivisor = snapDivisor ? snapDivisor : 2;
    //   snapPath = new SnapDetail(thisPath);
    //   snapAperture = hotAperture;

    //   snapPath -> AddRef();

    //   // Save divisor used for this snap
    //   snapPath -> SetSnapDivisor(snapDivisor);

    //   DgnElementCPtr   element = snapPath -> GetElement();
    //   GeometrySourceCP geom = (element.IsValid() ? element -> ToGeometrySource() : nullptr);

    //   if (nullptr == geom) {
    //     IElemTopologyCP elemTopo = snapPath -> GetElemTopology();

    //     geom = (nullptr != elemTopo ? elemTopo -> _ToGeometrySource() : nullptr);
    //   }

    //   if (nullptr != geom)
    //     status = geom -> OnSnap(* this);
    //   else
    //     status = DoDefaultDisplayableSnap(); // Default snap for transients using HitDetail...

    //   if (SnapStatus:: Success == status)
    //   ElementLocateManager:: GetManager()._AdjustSnapDetail(* this);

    //   if (SnapStatus:: Success != status)
    //   {
    //     delete snapPath;
    //     snapPath = nullptr;
    //   }

    //   * snappedPath = snapPath;
    //   snapPath = nullptr;

    //   return status;
    return undefined;
  }
}

export class RenderContext extends ViewContext {
  public get target(): RenderTarget { return this.viewport.target; }
  constructor(vp: Viewport) { super(vp); }
  public createGraphic(_tf: Transform, _type: GraphicType): GraphicBuilder | undefined {
    return this._createGraphic(GraphicBuilderCreateParams.create(_type, this.viewport, _tf));
  }
  private _createGraphic(params: GraphicBuilderCreateParams): GraphicBuilder { return this.target.createGraphic(params); }
}

export class DecorateContext extends RenderContext {
  private readonly decorations = new Decorations();
  constructor(vp: Viewport, decorations?: Decorations) { super(vp); if (!!decorations) this.decorations = decorations; }
  public drawSheetHit(hit: HitDetail): void { hit.viewport.setFlashed(hit.elementId, 0.25); } // NEEDSWORK
  public drawNormalHit(hit: HitDetail): void { hit.viewport.setFlashed(hit.elementId, 0.25); } // NEEDSWORK
  public drawHit(hit: HitDetail): void {
    const sheetVp = hit.sheetViewport;
    return (sheetVp && hit.viewport === this.viewport) ? this.drawSheetHit(hit) : this.drawNormalHit(hit);
  }
  public addNormal(graphic: Graphic) {
    // if (nullptr != viewlet) {
    //   viewlet -> Add(graphic);
    //   return;
    // }

    if (!this.decorations.normal)
      this.decorations.normal = new GraphicList();

    this.decorations.normal.add(graphic);
  }

  /** Display world coordinate graphic with smooth shading, default lighting, and z testing enabled. */
  public addWorldDecoration(graphic: Graphic, _ovr?: any) {
    if (!this.decorations.world)
      this.decorations.world = new DecorationList();
    this.decorations.world.add(graphic); // , ovrParams);
  }

  /** Display world coordinate graphic with smooth shading, default lighting, and z testing disabled. */
  public addWorldOverlay(graphic: Graphic, _ovr?: any) {
    if (!this.decorations.worldOverlay)
      this.decorations.worldOverlay = new DecorationList();
    this.decorations.worldOverlay.add(graphic); // , ovrParams);
  }

  /** Display view coordinate graphic with smooth shading, default lighting, and z testing disabled. */
  public addViewOverlay(graphic: Graphic, _ovr?: any) {
    if (!this.decorations.viewOverlay)
      this.decorations.viewOverlay = new DecorationList();
    this.decorations.viewOverlay.add(graphic); // , ovrParams);
  }

  /** Display sprite as view overlay graphic. */
  public addSprite(_sprite: Sprite, _location: Point3d, _xVec: Vector3d, _transparency: number) {
    //  this.addViewOverlay(* target.CreateSprite(sprite, location, xVec, transparency, GetDgnDb()), nullptr);
  }

  /** @private */
  public drawStandardGrid(_gridOrigin: Point3d, _rMatrix: RotMatrix, _spacing: Point2d, _gridsPerRef: number, _isoGrid = false, _fixedRepetitions?: Point2d) { }

  /** Display view coordinate graphic as background with smooth shading, default lighting, and z testing disabled. e.g., a sky box. */
  public setViewBackground(graphic: Graphic) { this.decorations.viewBackground = graphic; }

  public createViewBackground(tf = Transform.createIdentity()): GraphicBuilder { return this.createGraphic(tf, GraphicType.ViewBackground)!; }
  public createWorldDecoration(tf = Transform.createIdentity()): GraphicBuilder { return this.createGraphic(tf, GraphicType.WorldDecoration)!; }
  public createWorldOverlay(tf = Transform.createIdentity()): GraphicBuilder { return this.createGraphic(tf, GraphicType.WorldOverlay)!; }
  public createViewOverlay(tf = Transform.createIdentity()): GraphicBuilder { return this.createGraphic(tf, GraphicType.ViewOverlay)!; }

  public displayAuxCoordSystem(_acs: AuxCoordSystemState, _options: ACSDisplayOptions): void {
    //   const checkOutOfView = (ACSDisplayOptions.None !== (options & ACSDisplayOptions.CheckVisible));
    //   const drawOrigin = acs.getOrigin();

    //   if (checkOutOfView && !isOriginInView(drawOrigin, * context.GetViewport(), true))
    //     options = options | ACSDisplayOptions:: Deemphasized;

    //   double      pixelSize = context.GetViewport() -> PixelsFromInches(TRIAD_SIZE_INCHES); // Active size...

    //   if (ACSDisplayOptions:: None != (options & ACSDisplayOptions:: Deemphasized))
    //   pixelSize *= 0.8;
    // else if (ACSDisplayOptions:: None == (options & ACSDisplayOptions:: Active))
    //   pixelSize *= 0.9;

    //   double      exagg = context.GetViewport() -> GetViewController().GetViewDefinition().GetAspectRatioSkew();
    //   double      scale = context.GetPixelSizeAtPoint(& drawOrigin) * pixelSize;
    //   RotMatrix   rMatrix = _GetRotation();
    //   Transform   transform;

    //   rMatrix.InverseOf(rMatrix);
    //   rMatrix.ScaleRows(rMatrix, scale, scale / exagg, scale);
    //   transform.InitFrom(rMatrix, drawOrigin);

    //   auto graphic = context.CreateWorldOverlay(transform);

    //   DgnViewportR vp = * context.GetViewport();
    //   _AddAxis(* graphic, 0, options, vp);
    //   _AddAxis(* graphic, 1, options, vp);
    //   _AddAxis(* graphic, 2, options, vp);

    //   return graphic;

    //   if (!graphic.IsValid())
    //     return;

    //   context.AddWorldOverlay(* graphic -> Finish());
  }

}

export class PrimitiveBuilderContext extends ViewContext {
  constructor(public viewport: Viewport, public imodel: IModelConnection, public system: RenderSystem) { super(viewport); }
  public static fromPrimitiveBuilder(builder: PrimitiveBuilder): PrimitiveBuilderContext { return new PrimitiveBuilderContext(builder.viewport, builder.iModel, builder.system); }
}
