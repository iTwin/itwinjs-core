/*---------------------------------------------------------------------------------------------
| $Copyright: (c) 2017 Bentley Systems, Incorporated. All rights reserved. $
 *--------------------------------------------------------------------------------------------*/
import { Viewport } from "./Viewport";
import { Sprite } from "./Sprites";
import { Point3d, Vector3d } from "@bentley/geometry-core/lib/PointVector";
import { HitDetail, SnapMode, SnapDetail } from "./HitDetail";

// tslint:disable:no-empty

export class ViewContext {
  public viewport: Viewport;
}

export class NullContext extends ViewContext {
}

export class SnapContext extends ViewContext {
  public snapDetail?: SnapDetail; // result of the snap
  public snapAperture: number;
  public snapMode: SnapMode;
  public snapDivisor: number;

  public async snapToPath(_thisPath: HitDetail, _snapMode: SnapMode, _snapDivisor: number, _hotAperture: number): Promise<SnapDetail | undefined> {
    //   if (!ElementLocateManager.instance.isSnappableModel(thisPath.getModel())   {
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

    //   m_snapMode = snapMode;
    //   m_snapDivisor = snapDivisor ? snapDivisor : 2;
    //   m_snapPath = new SnapDetail(thisPath);
    //   m_snapAperture = hotAperture;

    //   m_snapPath -> AddRef();

    //   // Save divisor used for this snap
    //   m_snapPath -> SetSnapDivisor(snapDivisor);

    //   DgnElementCPtr   element = m_snapPath -> GetElement();
    //   GeometrySourceCP geom = (element.IsValid() ? element -> ToGeometrySource() : nullptr);

    //   if (nullptr == geom) {
    //     IElemTopologyCP elemTopo = m_snapPath -> GetElemTopology();

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
    //     delete m_snapPath;
    //     m_snapPath = nullptr;
    //   }

    //   * snappedPath = m_snapPath;
    //   m_snapPath = nullptr;

    //   return status;
    return undefined;
  }
}

export class RenderContext extends ViewContext {
}

export class DecorateContext extends RenderContext {
  public addSprite(_sprite: Sprite, _location: Point3d, _xVec: Vector3d, _transparency: number) { }
  public drawSheetHit(_hit: HitDetail): void { }
  public drawNormalHit(_hit: HitDetail): void { }
  public drawHit(hit: HitDetail): void {
    const sheetVp = hit.m_sheetViewport;
    return (sheetVp && hit.m_viewport === this.viewport) ? this.drawSheetHit(hit) : this.drawNormalHit(hit);
  }
  DGNPLATFORM_EXPORT void AddNormal(Render:: Graphic graphic);

  //! Display world coordinate graphic with smooth shading, default lighting, and z testing enabled.
  DGNPLATFORM_EXPORT void AddWorldDecoration(Render:: GraphicR graphic, Render:: OvrGraphicParamsCP ovr = nullptr);

  //! Display world coordinate graphic with smooth shading, default lighting, and z testing disabled.
  DGNPLATFORM_EXPORT void AddWorldOverlay(Render:: GraphicR graphic, Render:: OvrGraphicParamsCP ovr = nullptr);

  //! Display view coordinate graphic with smooth shading, default lighting, and z testing disabled.
  DGNPLATFORM_EXPORT void AddViewOverlay(Render:: GraphicR graphic, Render:: OvrGraphicParamsCP ovr = nullptr);

  //! Display sprite as view overlay graphic.
  DGNPLATFORM_EXPORT void AddSprite(Render:: ISprite & sprite, DPoint3dCR location, DPoint3dCR xVec, int transparency);

  //! @private
  DGNPLATFORM_EXPORT void DrawStandardGrid(DPoint3dR gridOrigin, RotMatrixR rMatrix, DPoint2d spacing, uint32_t gridsPerRef, bool isoGrid = false, Point2dCP fixedRepetitions = nullptr);

  //! @private
  DGNPLATFORM_EXPORT BentleyStatus DrawHit(HitDetailCR hit);

  //! Display view coordinate graphic as background with smooth shading, default lighting, and z testing disabled. e.g., a sky box.
  DGNPLATFORM_EXPORT void SetViewBackground(Render:: GraphicR graphic);

  Render:: OvrGraphicParams& GetOvrGraphicParams() { return m_ovrParams; }

Render:: GraphicBuilderPtr CreateViewBackground(TransformCR tf = Transform:: FromIdentity()) { return CreateGraphic(tf, Render:: GraphicType:: ViewBackground); }
Render:: GraphicBuilderPtr CreateWorldDecoration(TransformCR tf = Transform:: FromIdentity()) { return CreateGraphic(tf, Render:: GraphicType:: WorldDecoration); }
Render:: GraphicBuilderPtr CreateWorldOverlay(TransformCR tf = Transform:: FromIdentity()) { return CreateGraphic(tf, Render:: GraphicType:: WorldOverlay); }
Render:: GraphicBuilderPtr CreateViewOverlay(TransformCR tf = Transform:: FromIdentity()) { return CreateGraphic(tf, Render:: GraphicType:: ViewOverlay); }

}
