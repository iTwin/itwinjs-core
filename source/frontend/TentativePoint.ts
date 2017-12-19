/*---------------------------------------------------------------------------------------------
|  $Copyright: (c) 2017 Bentley Systems, Incorporated. All rights reserved. $
 *--------------------------------------------------------------------------------------------*/
import { Point3d } from "@bentley/geometry-core/lib/PointVector";
import { Id64 } from "@bentley/bentleyjs-core/lib/Id";
import { Viewport } from "./Viewport";
import { ViewManager } from "./ViewManager";
import { BeButtonEvent } from "./tools/Tool";
import { SnapMode, HitList, SnapDetail, AccuSnap, HitDetail } from "./AccuSnap";
import { DecorateContext } from "./ViewContext";

// tslint:disable:variable-name

export class TentativePoint {
  public static instance = new TentativePoint();
  public m_isActive: boolean;
  public m_qualifierMask: number;        // button qualifiers
  public m_candidateSnapMode: SnapMode;    // during snap creation: the snap to try
  public m_currSnap?: SnapDetail;
  public m_tpHits?: HitList;
  public readonly m_snapPaths: HitList;
  public m_hotDistanceInches: number;
  public readonly m_rawPoint = new Point3d();     // world coordinates
  public readonly m_point = new Point3d();        // world coords (adjusted for locks)
  public readonly m_viewPt = new Point3d();       // view coordinate system
  public m_viewport?: Viewport;

  /** @return true if the tentative point is currently active and snapped to an element. */
  public isSnapped(): boolean { return !!this.m_currSnap; }

  /** @return The current snap path when TentativePoint.isSnapped or undefined. */
  public getCurrSnap(): SnapDetail | undefined { return this.m_currSnap; }

  public getPoint(): Point3d {
    const snapPath = this.m_currSnap;
    return !snapPath ? this.m_point : snapPath.getAdjustedPoint();
  }

  public clear(doErase: boolean): void {
    if (doErase) {
      this.removeTentative();
      // ElementLocateManager:: GetManager()._SynchSnapMode();
    }
    accuSnap.destroy();
    this.m_isActive = false;
    this.m_snapPaths.empty();
    this.setCurrSnap(undefined);
    this.m_tpHits = undefined;
  }

  public removeTentative(): void {
    if (!this.m_isActive)
      return;

    accuSnap.erase();

    if (this.getCurrSnap()) {
      viewManager.invalidateDecorationsAllViews();
    } else
      this.m_viewport!.invalidateDecorations();

    this.m_isActive = false;
  }

  public constructor() {
    this.m_hotDistanceInches = 0.21;
    this.m_isActive = false;
    this.m_candidateSnapMode = SnapMode.First;
  }

  public getTPSnapMode(): SnapMode { return (SnapMode.Intersection === this.activeSnapMode()) ? SnapMode.Nearest : this.activeSnapMode(); }
  public activeSnapMode(): SnapMode { return (this.m_candidateSnapMode !== SnapMode.First) ? this.m_candidateSnapMode : SnapMode.Nearest; }
  public setCurrSnap(newSnap?: SnapDetail): void {
    if (newSnap) {
      newSnap.setSubSelectionMode(SubSelectionMode.Segment);
      newSnap.setHeat(SnapHeat.SNAP_HEAT_InRange);
    }
    this.m_currSnap = newSnap;
  }

  public showTentative(): void {
    if (this.isSnapped()) {
      viewManager.invalidateDecorationsAllViews();
      accuSnap.displayInfoBalloon(this.m_viewPt, this.m_viewport, undefined);
    } else {
      this.m_viewport!.invalidateDecorations();
    }
    this.m_isActive = true;
  }

  public onButtonEvent(): void {
    this.removeTentative();
    // ElementLocateManager:: GetManager()._SynchSnapMode();
    this.m_snapPaths.empty();
    this.setCurrSnap(undefined);
    this.m_tpHits = undefined;
  }

  public clearElemRefFromHitList(element: Id64): void {
    if (element.isValid())
      this.m_snapPaths.removeHitsFrom(element);
  }

  public isView3D(): boolean { return this.m_viewport!.view.is3d(); }

  /** draw the cross as 4 lines rather than 2, so that there's no hole in the middle when drawn in dashed symbology */
  // private drawTpCross(graphic: GraphicBuilder, tpSize: number, x: number, y: number): void {
  //   DPoint2d    tpCross[2];
  //   tpCross[0].x = x;
  //   tpCross[0].y = y;

  //   tpCross[1] = tpCross[0];
  //   tpCross[1].x += tpSize;
  //   graphic.AddLineString2d(2, tpCross, 0.0);

  //   tpCross[1].x = x - tpSize;
  //   graphic.AddLineString2d(2, tpCross, 0.0);

  //   tpCross[1].x = x;
  //   tpCross[1].y = y + tpSize;
  //   graphic.AddLineString2d(2, tpCross, 0.0);

  //   tpCross[1].y = y - tpSize;
  //   graphic.AddLineString2d(2, tpCross, 0.0);
  // }

  private displayTP(context: DecorateContext): void {
    // DgnViewportP viewport = context.GetViewport();

    // if (!m_isActive || viewport != m_viewport || !viewport -> IsActive())
    //   return;

    // DVec2d dpiScale = viewport -> GetRenderTarget() -> GetDevice() -> _GetDpiScale();
    // int tpSize = (int)(40 * (dpiScale.x + dpiScale.y) / 2);

    // DPoint3d center = viewport -> WorldToView(m_point);

    // // draw a "background shadow" line: wide, black, mostly transparent
    // GraphicBuilderPtr graphic = context.CreateViewOverlay();
    // ColorDef color(0, 0, 0, 225);
    // graphic -> SetSymbology(color, color, 7);
    // drawTpCross(* graphic, tpSize + 2, center.x + 1, center.y + 1);

    // // draw a background line: narrow, black, slightly transparent (this is in case we're not snapped and showing a dotted line)
    // color = ColorDef(0, 0, 0, 10);
    // graphic -> SetSymbology(color, color, 3);
    // drawTpCross(* graphic, tpSize + 1, center.x, center.y);

    // // off-white (don't want white/black reversal), slightly transparent
    // color = ColorDef(0xfe, 0xff, 0xff, 10);
    // graphic -> SetSymbology(color, color, 1, IsSnapped() ? LinePixels :: Solid : LinePixels:: Code2);

    // drawTpCross(* graphic, tpSize, center.x, center.y);
    // context.AddViewOverlay(* graphic -> Finish());

    // // Draw snapped segment...
    // if (nullptr != m_currSnap)
    //   m_currSnap -> Draw(context);
  }

  public getNextSnap(): SnapDetail | undefined {
    const snap = this.m_snapPaths.getNextHit();
    // if (snap)   // Report which of the multiple active modes we are using
    //   ElementLocateManager:: GetManager()._SetChosenSnapMode(SnapType:: Points, snap -> GetSnapMode());
    return snap;
  }

  /** find an intersection between the current snap path and one of the other paths in the current hitlist. */
  private doTPIntersectSnap(inHit: HitDetail, changeFirst: boolean): SnapDetail | undefined {

    // use the current snapped path as the first path for the intersection
    const currSnap = this.getCurrSnap()!;
    const firstHit = currSnap;

    // // if we're already showing an intersection, use the "second" path as the new first path
    // if (changeFirst && (HitDetailType.Intersection === firstHit.getHitType()))
    //   firstHit = ((IntersectDetail *) firstHit) -> GetSecondHit();

    // // keep searching hits for an acceptable intersection
    // HitList intsctList;
    // for (secondHit = inHit; secondHit; secondHit = ElementLocateManager:: GetManager().GetElementPicker().GetNextHit())
    // {
    //   SnapDetailP thisIntsct = nullptr;
    //   if (SnapStatus:: Success == intsctCtx.IntersectDetails(& thisIntsct, firstHit, secondHit, & m_point, true))
    //   {
    //     intsctList.AddHit(thisIntsct, false, false);
    //     thisIntsct -> Release(); // ref count was incremented when we added to list
    //   }
    // }

    // intsctPath = (SnapDetail *) intsctList.GetHit(0);
    // if (nullptr != intsctPath) {
    //   intsctPath -> AddRef();
    //   intsctPath -> SetSnapMode(SnapMode.Intersection);
    //   ElementLocateManager:: GetManager()._SetChosenSnapMode(SnapType:: Points, SnapMode.Intersection);
    //   return intsctPath;
    // }

    // We couldn't find an intersection, so now we have to decide what to show. If we were previously
    // showing an intersection, and the mouse moved to a new location (that's what "changeFirst" means), then
    // that probably means that s/he was trying to find a new element, but missed. In that case, we re-activate the
    // previous hit as the new snap, but of course we don't show it as an intersection. If we were not previously
    // snapped to an intersection, then s/he just missed, start the TP over and return a nullptr.
    return (changeFirst && (currSnap !== firstHit)) ? firstHit : undefined;
  }

  // /*---------------------------------------------------------------------------------**//**
  // *  We're looking for the second path for an intersection.
  // *   m_currHit already points to the first path.
  // *   nextHit is the next snapPath after m_currHit in m_snapPaths.
  // *
  // * Multiple snaps:
  // *   Because m_snapPaths can contain snaps of different types and because
  // *   this list is sorted by proxmimity to the cursor, the
  // *   SnapMode::IntersectionCandidate snaps may not be contiguous in the list.
  // *
  // * This function returns the next snapPath in the m_snapPaths list that is
  // *   a SnapMode::IntersectionCandidate snapPath. This might be nextHit, or
  // *   it might be a snapPath farther along.
  // *
  // * @bsimethod                                                    Sam.Wilson      06/03
  // +---------------+---------------+---------------+---------------+---------------+------*/
  // SnapDetailP TentativePoint:: FindNextIntersectionCandidate(SnapDetailP nextHit) {
  //   if (nullptr == nextHit)
  //     return nullptr;

  //   if (SnapMode.IntersectionCandidate == nextHit -> GetSnapMode())
  //     return nextHit;

  //   if (m_snapPaths.m_currHit == -1)
  //     return nullptr; // There is no current hit?! This happens when we TP twice to the same element.

  //   //  Now search for the NEXT intersection target
  //   // m_currHit already points to the item in the list that follows nextHit
  //   for (uint32_t iSnapDetail = m_snapPaths.m_currHit; iSnapDetail < m_snapPaths.GetCount(); ++iSnapDetail)
  //   {
  //     SnapDetail * snap = (SnapDetail *) m_snapPaths.Get(iSnapDetail);

  //     if (SnapMode.IntersectionCandidate == snap -> GetSnapMode())
  //       return snap;
  //   }

  //   return nullptr;
  // }

  private optimizeHitList(): void {
    // // Remove snaps that refer to same point on same element
    // // (This makes it less frustrating to the user when stepping through atl. points!)
    // for (let iSnapDetail = 0; iSnapDetail < this.m_snapPaths.getCount(); ++iSnapDetail) {
    //   SnapDetailP snap = (SnapDetail *) m_snapPaths.Get(iSnapDetail);
    //   DgnElementCPtr snapElem = snap -> GetElement();

    //   if (!snapElem.IsValid())
    //     continue;

    //   bool any = false;

    //   for (uint32_t jSnapDetail = iSnapDetail + 1; jSnapDetail < m_snapPaths.GetCount(); ++jSnapDetail)   {
    //     SnapDetailP otherSnap = (SnapDetail *) m_snapPaths.Get(jSnapDetail);

    //     if (otherSnap -> GetAdjustedPoint().IsEqual(snap -> GetAdjustedPoint())) {
    //       DgnElementCPtr otherElem = otherSnap -> GetElement();

    //       if (snapElem.get() == otherElem.get()) {
    //         m_snapPaths.Set(jSnapDetail, nullptr);
    //         any = true;
    //       }
    //     }
    //   }

    //   if (any)
    //     m_snapPaths.DropNulls();
    // }
  }

  //  private testHitsForSnapMode(snapContext: SnapContext, snapMode: SnapMode): BentleyStatus {
  // this.m_tpHits.resetCurrentHit();

  // m_candidateSnapMode = snapMode;

  // HitDetailCP thisPath;

  // while (nullptr != (thisPath = (HitDetailCP) m_tpHits -> GetNextHit()))
  // {
  //   SnapDetailP snapPath;

  //   if ((SnapStatus:: Success == snapContext -> SnapToPath(& snapPath, thisPath, GetTPSnapMode(), ElementLocateManager:: GetManager()._GetKeypointDivisor(), thisPath -> GetViewport().PixelsFromInches(m_hotDistanceInches))) && snapPath)
  //   {
  //     // Original hit list is already sorted...preserve order...
  //     m_snapPaths.Insert(-1, snapPath);

  //     snapPath -> Release();

  //     // Annotate the SnapDetail with the snap mode that was used to generate it
  //     if (SnapMode.Intersection == snapMode)
  //       snapPath -> SetSnapMode(SnapMode.IntersectionCandidate); // NB! This identifies the first of the two needed
  //   }
  // }

  //   this.m_candidateSnapMode = SnapMode.First;
  //   return BentleyStatus.SUCCESS;
  // }

  private getSnaps(): SnapDetail | undefined {
    // clear any current snaps
    this.m_snapPaths.empty();

    // make sure we don't have any hits.
    this.m_tpHits = undefined;

    // HitDetailCP   currHit = AccuSnap:: GetInstance().GetHitAndList(& m_tpHits);

    // // use existing accusnap hit list if one exists...
    // if (nullptr == currHit) {
    //   // search for elements around the current raw point (search should not be affected by locks!)
    //   double          aperture = (TP_TOLERANCE * GetViewport() -> PixelsFromInches(ElementLocateManager:: GetManager().GetApertureInches()) / 2.0) + 1.5;
    //   ElementPicker & picker = ElementLocateManager:: GetManager().GetElementPicker();
    //   LocateOptions   options = ElementLocateManager:: GetManager().GetLocateOptions(); // Copy to avoid changing out from under active DgnTool...

    //   picker.Empty();
    //   options.SetHitSource(HitSource:: TentativeSnap);

    //   if (0 == picker.DoPick(nullptr, * GetViewport(), m_rawPoint, aperture, nullptr, options))
    //     return nullptr;

    //   // take ownership of the hitlist from pickElem
    //   m_tpHits = picker.GetHitList(true);
    // }

    // SnapContext snapContext; // calls constructor

    // // Construct each active point snap mode
    // bvector < SnapMode > snaps;
    // ElementLocateManager:: GetManager()._GetPreferredPointSnapModes(snaps, HitSource:: TentativeSnap);

    // for (auto snap : snaps)
    // TestHitsForSnapMode(& snapContext, snap);

    // BeAssert(SnapMode.None == m_candidateSnapMode);

    // OptimizeHitList();

    // // if something is accusnap'd, make that the current tp snap
    // if (nullptr != currHit && HitDetailType:: Snap <= currHit -> GetHitType())
    // {
    //   // now we have to remove that path from the tp list.
    //   m_snapPaths.RemoveHitsFrom(* currHit);
    //   m_snapPaths.ResetCurrentHit();

    //   return (SnapDetailP) currHit;
    // }

    return this.getNextSnap();
  }

  private static arePointsCloseEnough(pt1: Point3d, pt2: Point3d, pixelDistance: number): boolean {
    const aperture = pixelDistance + 1.5;
    return pt1.distance(pt2) < aperture;
  }

  public process(ev: BeButtonEvent): void {
    // remove the TP cross if it's already on the screen
    this.removeTentative();

    const lastPtView = this.m_viewPt;

    this.m_viewport = ev.viewport;
    this.m_point.setFrom(ev.point);
    this.m_rawPoint.setFrom(ev.rawPoint);
    this.m_viewPt.setFrom(ev.viewPoint);
    this.m_qualifierMask = ev.keyModifiers;

    let snap: SnapDetail | undefined;
    const snapAgain = (this.isSnapped() && TentativePoint.arePointsCloseEnough(lastPtView, this.m_viewPt, this.m_viewport!.pixelsFromInches(elementLocateManager.getApertureInches())));

    snap = (snapAgain ? this.getNextSnap() : this.getSnaps());

    // If the the previous snap was done in intersection mode,
    // we now want to try to find intersections with the previous snap.
    if (this.isSnappedToIntersectionCandidate()) {
      // (If the mouse didn't move, then keep the previous "first" path and try to find more intersections with it.)
      const isectSnap = this.doTPIntersectSnap(this.findNextIntersectionCandidate(snap), !snapAgain);

      //  If we can't create an intersection, then move on to the next active snap
      if (isectSnap)
        snap = isectSnap;
    }

    if (snap && ElementLocateManager:: GetManager()._IsConstraintSnapActive()) {
      //  Does the user actually want to create a constraint?
      //  (Note you can't construct a constraint on top of a partially defined intersection)
      if (SnapMode.IntersectionCandidate !== snap.getSnapMode()) {
        //  Construct constraint on top of TP
        snap.setHeat(SnapHeat.SNAP_HEAT_InRange);  // If we got here, the snap is "in range". Tell xSnap_convertToConstraint.
        if (SnapStatus:: Success != ElementLocateManager:: GetManager()._PerformConstraintSnap(snap, m_viewport -> PixelsFromInches(ElementLocateManager:: GetManager().GetApertureInches()), HitSource:: TentativeSnap))
        {
          snap = undefined;
        }
      }
    }

    //  Adopt the snap as current
    this.setCurrSnap(snap);

    // make sure there's no accusnap active after a tentative point (otherwise we continually snap to it).
    accuSnap.clear();

    if (this.isSnapped())
      this.m_point.setFrom(this.getCurrSnap().getSnapPoint());

    // show the TP cross
    this.showTentative();
  }
}

const accuSnap = AccuSnap.instance;
const viewManager = ViewManager.instance;
