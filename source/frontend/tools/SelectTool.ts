/*---------------------------------------------------------------------------------------------
| $Copyright: (c) 2018 Bentley Systems, Incorporated. All rights reserved. $
 *--------------------------------------------------------------------------------------------*/
import { Point3d, Point2d } from "@bentley/geometry-core/lib/PointVector";
import { PrimitiveTool } from "./PrimitiveTool";
import { iModelApp } from "../IModelApp";
import { CoordinateLockOverrides } from "./ToolAdmin";
import { EditManipulator, ManipulatorSelectionMode } from "./EditManipulator";
import { IModelConnection } from "../IModelConnection";
import { SelectEventType } from "../SelectionSet";
import { DecorateContext, DynamicsContext } from "../ViewContext";
import { BeButtonEvent, BeButton, BeGestureEvent, GestureId } from "./Tool";
import { LocateResponse } from "../ElementLocateManager";
import { SubSelectionMode, HitDetail } from "../HitDetail";
import { GraphicBuilder, LinePixels } from "../../common/Render";
import { ColorDef } from "../../common/ColorDef";
import { FenceParams } from "../FenceParams";

// tslint:disable:variable-name

export const enum SelectionMethod {
  /** Identify element(s) by picking for drag selection (inside/overlap for drag box selection determined by point direction and shift key) */
  Pick,
  /** Identify elements by overlap with crossing line */
  Line,
  /** Identify elements by box selection (inside/overlap for box selection determined by point direction and shift ke) */
  Box,
}

export const enum SelectionMode {
  /** Identified elements replace the current selection set (use control key to add or remove) */
  Replace,
  /** Identified elements are added to the current selection set */
  Add,
  /** Identified elements are removed from the current selection set */
  Remove,
}

export const enum ManipulatorPreference {
  Disabled = 0,
  Placement = 1,
  Geometry = 2,
}

export class SelectionTool extends PrimitiveTool {
  public static hidden = true;
  public static toolId = "Select";
  public m_isDragSelect = false;
  public m_isDragControl = false;
  public m_isDragElement = false;
  public m_removeListener?: () => void;
  public readonly m_points: Point3d[] = [];
  public manipulatorPreference = ManipulatorPreference.Geometry;
  public m_manipulator?: EditManipulator;

  protected wantSelectionClearOnMiss(_ev: BeButtonEvent): boolean { return SelectionMode.Replace === this.getSelectionMode(); }
  protected wantDragOnlyManipulator() { return false; } // Restrict manipulator operation to drag, default behavior is to support click, click or drag...
  protected wantElementDrag() { return true; } // A sub-class can override to disable drag move/copy of elements.
  protected getSelectionMethod(): SelectionMethod { return SelectionMethod.Pick; /* NEEDS_WORK: Settings... */ }
  protected getSelectionMode(): SelectionMode { return SelectionMode.Replace;    /* NEEDS_WORK: Settings... */ }
  protected wantToolSettings(): boolean {
    if (!iModelApp.features.check("SelectionTool.ShowToolSettingInReadonlyFile")) {
      if (this.iModel.isReadonly())
        return false; // Tool can't be used when iModel is read only.

      // IBriefcaseManager:: Request req;
      // req.Locks().Insert(GetDgnDb(), LockLevel:: Shared);
      // if (!GetDgnDb().BriefcaseManager().AreResourcesAvailable(req, nullptr, IBriefcaseManager:: FastQuery:: Yes))
      //   return false;   // another briefcase has locked the db for editing
    }
    return true;
  }
  public onRestartTool() { this.exitTool(); }
  public onCleanup() {
    super.onCleanup();
    this.m_manipulator = undefined;
    if (this.m_removeListener) {
      this.m_removeListener();
      this.m_removeListener = undefined;
    }
  }

  protected initSelectTool() {
    this.m_isDragSelect = this.m_isDragControl = this.m_isDragElement = this.targetIsLocked = false;
    this.m_points.length = 0;
    /// iModelApp.toolAdmin.setCursor(ViewManager:: GetManager().GetCursor(Display:: Cursor:: Id:: Arrow));
    iModelApp.toolAdmin.setLocateCircleOn(true);
    iModelApp.locateManager.initToolLocate(); // For drag move/copy...
    iModelApp.locateManager.options.allowTransients = true; // Support edit manipulator for transient geometry...
    iModelApp.toolAdmin.toolState.coordLockOvr = CoordinateLockOverrides.OVERRIDE_COORDINATE_LOCK_All;
    iModelApp.accuSnap.enableLocate(true);
    iModelApp.accuSnap.enableSnap(false);
  }

  public onSingleTap(ev: BeGestureEvent): boolean {
    if (this.selectControls(ev) && this.haveSelectedControls()) {
      ev.viewport!.invalidateDecorations();

      // Allow manipulators to respond to clicks on their controls before doing normal processing and drags.
      if (this.m_manipulator!.onClick(ev))
        return true;

      if (!this.wantDragOnlyManipulator()) {
        if (this.multiSelectControls(ev))
          return true;
      }
    }
    return false; // Let idle tool send data button down/up events..
  }

  public onSingleFingerMove(ev: BeGestureEvent): boolean {
    if (this.m_isDragControl || this.m_isDragSelect) {
      iModelApp.toolAdmin.convertGestureMoveToButtonDownAndMotion(ev);
      return true;
    }
    // Decide on first touch notification if we'll start handling this gesture instead of passing it on to the idle tool...
    if (0 !== ev.gestureInfo!.previousNumberTouches)
      return false;

    if (this.selectControls(ev) && this.haveSelectedControls()) {
      const tmpEv = ev.clone();
      tmpEv.button = BeButton.Data; // Don't rely on button type from gesture event being Data...
      if (this.startDragControls(tmpEv))
        return true;
    }

    if (SelectionMethod.Pick !== this.getSelectionMethod()) {
      const tmpEv = ev.clone();
      tmpEv.button = BeButton.Data;
      if (this.startDragSelect(tmpEv))
        return true;
    }
    return false;
  }

  public onEndGesture(ev: BeGestureEvent): boolean {
    if (GestureId.SingleFingerMove !== ev.gestureInfo!.gestureId)
      return false;
    if (this.dragControls(ev))
      return true;
    return this.dragSelect(ev);
  }

  protected onSelectionChanged(iModel: IModelConnection, evType: SelectEventType, ids?: Set<string>) {
    if (this.iModel !== iModel)
      return;

    if (SelectEventType.Clear === evType || !ids || ids.size === 0) {
      // NOTE: Navigator's "clear selection" button should really be restarting the select tool...
      if (this.m_isDragControl || this.m_isDragElement)
        this.endDynamics();

      this.initSelectTool();
    }
    this.synchManipulators(true); // Invalidate current manipulator...
  }

  public async synchManipulators(clearCurrent: boolean) {
    iModelApp.viewManager.invalidateDecorationsAllViews();
    if (ManipulatorPreference.Disabled === this.manipulatorPreference) {
      this.m_manipulator = undefined;
      return;
    }

    if (!clearCurrent && this.m_manipulator) {
      // Make sure manipulator controls reflect the current element (post-accept)...
      this.m_manipulator.doCleanupControls();
      if (!this.m_manipulator.doCreateControls())
        this.m_manipulator = undefined; // The manipulator is not happy any more so clear it...
      return; // Preserve current manipulator
    }

    // If current hit is for an element, is it the one and only selected element?
    let currHit = iModelApp.locateManager.currHit;
    if (currHit && currHit.elementId) {
      const selSet = this.iModel.selectionSet;
      if (1 !== selSet.numSelected || selSet.isSelected(currHit.elementId))
        currHit = undefined;
    }

    // IEditManipulatorExtension:: ControlType controls = (ManipulatorPreference:: Geometry == manipPref ? IEditManipulatorExtension :: ControlType:: Geometry: IEditManipulatorExtension:: ControlType:: Placement);
    // IEditManipulatorExtension:: DefaultActions actions = IEditManipulatorExtension:: DefaultActions:: Placement;
    // DgnElementCPtr elem;

    // this.m_manipulator = undefined;

    // if (currHit.IsValid()) {
    //   elem = currHit -> GetElement();

    //   if (elem.IsValid()) {
    //     if (!ManipulatorUtil:: IsElementValidForManipulator(* elem))
    //     return;

    //     ElementHandlerR handler = elem -> GetElementHandler();
    //     IEditManipulatorExtension * extension = IEditManipulatorExtension:: Cast(handler);

    //     if (undefined != extension) {
    //       this.m_manipulator = extension -> _GetIEditManipulator(* currHit, controls);

    //       // Ask for placement manipulator in the absence of a geometry manipulator...
    //       if (!this.m_manipulator.IsValid() && IEditManipulatorExtension:: ControlType:: Geometry == controls)
    //       this.m_manipulator = extension -> _GetIEditManipulator(* currHit, IEditManipulatorExtension:: ControlType:: Placement);

    //       if (!this.m_manipulator.IsValid())
    //         actions = extension -> _GetAllowedDefaultActions();
    //     }
    //   } else {
    //     IElemTopologyCP elemTopo = currHit -> GetElemTopology();

    //     this.m_manipulator = (undefined != elemTopo ? elemTopo -> _GetTransientManipulator(* currHit) : undefined);
    //   }
    // } else {
    //   elem = SelectionSetManager:: GetManager(GetDgnDb()).GetElement();

    //   if (elem.IsValid()) {
    //     if (!ManipulatorUtil:: IsElementValidForManipulator(* elem))
    //     return;

    //     ElementHandlerR handler = elem -> GetElementHandler();
    //     IEditManipulatorExtension * extension = IEditManipulatorExtension:: Cast(handler);

    //     if (undefined != extension) {
    //       this.m_manipulator = extension -> _GetIEditManipulator(* elem -> ToGeometrySource(), controls);

    //       // Ask for placement manipulator in the absence of a geometry manipulator...
    //       if (!m_manipulator.IsValid() && IEditManipulatorExtension:: ControlType:: Geometry == controls)
    //       m_manipulator = extension -> _GetIEditManipulator(* elem -> ToGeometrySource(), IEditManipulatorExtension:: ControlType:: Placement);

    //       if (!m_manipulator.IsValid())
    //         actions = extension -> _GetAllowedDefaultActions();
    //     }
    //   }
    // }

    // if (!m_manipulator.IsValid() && IEditManipulatorExtension:: DefaultActions:: None != actions) {
    //   uint32_t geometryActions = (uint32_t)(IEditManipulatorExtension:: DefaultActions:: Geometry);
    //   uint32_t placementActions = ((uint32_t) IEditManipulatorExtension:: DefaultActions:: Placement | (uint32_t) IEditManipulatorExtension:: DefaultActions:: Scale);

    //   if (elem.IsValid() && IEditManipulatorExtension:: ControlType:: Geometry == controls && 0 != ((uint32_t) actions & geometryActions))
    //   m_manipulator = ManipulatorUtil:: GetDefaultGeometryManipulator(* elem);

    //   // Use default placement manipulator in the absence of a geometry manipulator regardless of current control type being requested...
    //   if (!m_manipulator.IsValid() && 0 != ((uint32_t) actions & placementActions)) {
    //     if (elem.IsValid())
    //       m_manipulator = ManipulatorUtil:: GetDefaultPlacementManipulator(* elem, actions); // Actions already checked for extension...
    //         else if (IEditManipulatorExtension:: ControlType:: Placement == controls && SelectionSetManager:: GetManager(GetDgnDb()).IsActive())
    //     m_manipulator = ManipulatorUtil:: GetDefaultPlacementManipulator(SelectionSetManager:: GetManager(GetDgnDb()).GetElementIds(), GetDgnDb(), IEditManipulatorExtension:: DefaultActions:: All);
    //   }
    // }

    // if (m_manipulator.IsValid() && m_manipulator -> _DoCreateControls())
    //   return;

    // m_manipulator = nullptr;
  }

  protected drawControls(context: DecorateContext): boolean {
    if (!this.m_manipulator || !this.m_manipulator.isDisplayedInView(context.viewport))
      return false;
    this.m_manipulator.onDraw(context);
    return true;
  }

  protected modifierTransitionControls(wentDown: boolean, key: number): boolean {
    if (!this.m_manipulator)
      return false;
    this.m_manipulator.onModifierKeyTransition(wentDown, key);
    return true;
  }

  protected haveSelectedControls(): boolean {
    return !!this.m_manipulator && this.m_manipulator.hasSelectedControls();
  }

  protected selectControls(ev: BeButtonEvent): boolean {
    if (this.m_isDragControl || !this.m_manipulator)
      return false;
    const wasSelected = this.haveSelectedControls();
    return this.m_manipulator.doUpdateFlashedControls(ev) ? true : wasSelected && !this.haveSelectedControls();
  }

  protected multiSelectControls(ev: BeButtonEvent | FenceParams): boolean {
    if (!this.m_manipulator)
      return false;
    const wasSelected = this.haveSelectedControls();
    if (this.m_manipulator.doUpdateSelectedControls(ev, ManipulatorSelectionMode.Inverse))
      return true;
    return wasSelected && !this.haveSelectedControls();
  }

  protected startDragControls(ev: BeButtonEvent): boolean {
    if (BeButton.Data !== ev.button || !this.m_manipulator)
      return false;

    // NOTE: By default, handle drag for "vertex" type handles should honor all locks...
    //       Moved (from Topaz) before _OnPreModify to more easily allow manipulators to
    //       ignore incompatible locks when setting up button event/anchor point.
    const toolState = iModelApp.toolAdmin.toolState;
    const saveCoordLockOvr = toolState.coordLockOvr;
    toolState.coordLockOvr = CoordinateLockOverrides.OVERRIDE_COORDINATE_LOCK_None;
    if (!this.m_manipulator.onPreModify(ev)) {
      toolState.coordLockOvr = saveCoordLockOvr;
      return false;
    }
    this.m_manipulator.onModifyStart(ev);
    this.beginDynamics();
    this.m_isDragControl = this.targetIsLocked = true;
    return true;
  }

  protected dragControls(ev: BeButtonEvent, context?: DynamicsContext): boolean {
    if (!this.m_isDragControl)
      return false;

    if (undefined === context) {
      if (this.m_manipulator)
        this.m_manipulator.onModifyAccept(ev);
      this.endDynamics();
      this.initSelectTool();
      this.synchManipulators(false); // Current manipulator is still valid...
      return true;
    }

    if (this.m_manipulator && this.m_manipulator.isDisplayedInView(ev.viewport!))
      this.m_manipulator.onModify(ev, context);
    return true;
  }

  protected useFenceOverlap(ev: BeButtonEvent): boolean {
    let overlapMode = false;
    const vp = ev.viewport!;
    const pt1 = vp.worldToView(this.m_points[0]);
    const pt2 = vp.worldToView(ev.point);
    overlapMode = (pt1.x > pt2.x);
    return (ev.isShiftKey ? !overlapMode : overlapMode); // Shift inverts inside/overlap selection...
  }

  protected toggleFencePointsSelection(_ev: BeButtonEvent, _worldPts: Point3d[], _nPts: number, _overlap: boolean): void {
    // FenceParams fp;
    // fp.SetViewParams(ev.GetViewport());
    // fp.SetOverlapMode(overlap);
    // fp.StoreClippingPoints(worldPts, nPts, false);

    // if (this.multiSelectControls(fp))
    //   return;

    // DgnElementIdSet contents;
    // DragSelectCheckStop checkStop;

    // if (SUCCESS != fp.GetContents(contents, & checkStop)) {
    //   if (!ev.IsControlKey() && _WantSelectionClearOnMiss(ev))
    //     SelectionSetManager:: GetManager(GetDgnDb()).EmptyAll();
    //   return;
    // }

    // switch (GetSelectionMode()) {
    //   case SelectionMode:: Replace:
    //     {
    //       if (!ev.IsControlKey())
    //         loadSelection(contents, ReplaceSelectionWithElement, GetDgnDb());
    //       else
    //         loadSelection(contents, InvertElementInSelection, GetDgnDb());
    //       break;
    //     }

    //   case SelectionMode:: Add:
    //     {
    //       loadSelection(contents, AddElementToSelection, GetDgnDb());
    //       break;
    //     }

    //   case SelectionMode:: Remove:
    //     {
    //       loadSelection(contents, RemoveElementFromSelection, GetDgnDb());
    //       break;
    //     }
    // }
  }

  protected checkDoubleClickOnElement(ev: BeButtonEvent): boolean {
    if (!ev.isDoubleClick)
      return false;

    const currHit = iModelApp.locateManager.currHit;
    if (!currHit)
      return false;

    if (this.m_manipulator)
      return this.m_manipulator.onDoubleClick(currHit);

    // // NOTE: Even if manipulators are disabled, we still want to allow double-click processing...
    // DgnElementCPtr elem = currHit -> GetElement();
    // Dgn:: IEditManipulatorPtr manipulator;

    // if (elem.IsValid()) {
    //   if (!ManipulatorUtil:: IsElementValidForManipulator(* elem))
    //   return false;

    //   ElementHandlerR handler = elem -> GetElementHandler();
    //   IEditManipulatorExtension * extension = IEditManipulatorExtension:: Cast(handler);

    //   if (nullptr == extension)
    //     return false;

    //   manipulator = extension -> _GetIEditManipulator(* currHit);
    // } else {
    //   IElemTopologyCP elemTopo = currHit -> GetElemTopology();
    //   manipulator = (nullptr != elemTopo ? elemTopo -> _GetTransientManipulator(* currHit) : nullptr);
    // }

    // return (manipulator.IsValid() ? manipulator -> _OnDoubleClick(* currHit) : false);
    return false;
  }

  protected startDragElements(ev: BeButtonEvent): boolean {
    if (BeButton.Data !== ev.button)
      return false;

    if (!this.wantElementDrag())
      return false;

    if (!this.wantToolSettings())
      return false; // NEEDS_WORK: Navigator is now opening files for write. I thought they should sub-class and override _WantElementDrag...we'll need a different check here when Navigator adds the selection method/mode tool settings...

    // Allow drag move of previously selected elements only to minimize conflict with drag select...
    if (0 === this.iModel.selectionSet.numSelected)
      return false;

    const hit = iModelApp.locateManager.doLocate(new LocateResponse(), true, ev.point, ev.viewport, SubSelectionMode.None, false); // Don't want add/remove mode filtering...
    if (!hit || !this.iModel.selectionSet.isSelected(hit.elementId))
      return false;

    if (this.iModel.isReadonly()) // NOTE: Don't need to check GetFilteredElementIds, this should be sufficient to know we have at least 1 element...
      return false;

    iModelApp.accuSnap.enableLocate(false);
    iModelApp.accuSnap.enableSnap(true);

    // AccuDrawHintBuilderPtr hints = AccuDrawHintBuilder:: Create();
    // hints -> EnableSmartRotation();
    // hints -> SendHints();

    this.m_points.length = 0;
    this.m_points.push(ev.point.clone());
    this.m_isDragElement = this.targetIsLocked = true;
    this.beginDynamics();
    return true;
  }

  protected dragElements(_ev: BeButtonEvent, context: DynamicsContext): boolean {
    if (!this.m_isDragElement)
      return false;

    // NOTE: This is problematic for elements that want to prevent or constrain the drag of their elements...
    //       Could perhaps implement using placement manipulator or just check placement manipulator permissions?
    // const isModifyOriginal = !ev.isControlKey;

    // DgnElementIdSet elements;
    // SelectionSetManager:: GetManager(GetDgnDb()).GetFilteredElementIds(elements, isModifyOriginal, !isModifyOriginal);
    // BeAssert(!elements.empty()); // Should never be empty, being empty means we require an additional check in StartDragElements...

    // DVec3d      dVec;
    // Transform   transform;

    // dVec.DifferenceOf(* ev.GetPoint(), m_points.front());
    // transform.InitFrom(dVec);

    // DgnElementIdSet copies;

    // for (DgnElementId elemId : elements)
    // {
    //   DgnElementCPtr el = GetDgnDb().Elements().GetElement(elemId);

    //   if (!el.IsValid())
    //     continue;

    //   DgnElementPtr writeElem;

    //   if (isModifyOriginal || nullptr != context)
    //     writeElem = el -> CopyForEdit();
    //   else
    //     writeElem = el -> Clone();

    //   if (!writeElem.IsValid())
    //     continue;

    //   if (writeElem -> ToGeometrySource() -> Is3d()) {
    //     Placement3d placement = writeElem -> ToGeometrySource3d() -> GetPlacement();

    //     transform.Multiply(placement.GetOriginR());
    //     writeElem -> ToGeometrySource3dP() -> SetPlacement(placement);
    //   }
    //   else {
    //     Placement2d placement = writeElem -> ToGeometrySource2d() -> GetPlacement();

    //     transform.Multiply(placement.GetOriginR(), placement.GetOriginR());
    //     writeElem -> ToGeometrySource2dP() -> SetPlacement(placement);
    //   }

    //   if (nullptr != context) {
    //     context -> DrawElement(* writeElem);
    //   }
    //   else if (isModifyOriginal) {
    //     writeElem -> Update(nullptr);
    //   }
    //   else {
    //     DgnElementCPtr newElem = writeElem -> Insert(nullptr);

    //     if (newElem.IsValid())
    //       copies.insert(newElem -> GetElementId());
    //   }
    // }

    if (context)
      return true;

    this.endDynamics();
    this.saveChanges();

    // if (0 !== copies.size())
    //   SelectionSetManager:: GetManager(GetDgnDb()).ReplaceWithElementSet(copies);

    this.initSelectTool();
    this.synchManipulators(true); // Invalidate current manipulator...
    return true;
  }

  private drawPlus(graphic: GraphicBuilder, size: number, x: number, y: number): void {
    const pts = [new Point2d(x, y), new Point2d(x + size, y)];
    graphic.addLineString2d(2, pts, 0.0);
    pts[1].x = x - size;
    graphic.addLineString2d(2, pts, 0.0);
    pts[1].x = x;
    pts[1].y = y + size;
    graphic.addLineString2d(2, pts, 0.0);
    pts[1].y = y - size;
    graphic.addLineString2d(2, pts, 0.0);
  }

  private drawDragStateIndicator(context: DecorateContext): void {
    if (!this.m_isDragElement)
      return;

    const ev = new BeButtonEvent();
    iModelApp.toolAdmin.fillEventFromCursorLocation(ev);
    if (!ev.isControlKey)
      return;

    const white = ColorDef.from(255, 255, 255, 10);
    const black = ColorDef.from(0, 0, 0, 10);
    const center = context.viewport.worldToView(ev.point);
    const plusLoc = new Point2d(center.x + 10, center.y - 5);
    const graphic = context.createViewOverlay();
    graphic.setSymbology(white, white, 3);
    this.drawPlus(graphic, 5, plusLoc.x, plusLoc.y);
    graphic.setSymbology(black, black, 1);
    this.drawPlus(graphic, 3, plusLoc.x, plusLoc.y);
    context.addViewOverlay(graphic.finish()!);
  }

  private drawDragSelect(context: DecorateContext): void {
    if (!this.m_isDragSelect)
      return;

    const ev = new BeButtonEvent();
    iModelApp.toolAdmin.fillEventFromCursorLocation(ev);

    const graphic = context.createViewOverlay();

    const vp = context.viewport;
    const origin = vp.worldToView(this.m_points[0]);
    const corner = vp.worldToView(ev.point);
    origin.z = corner.z = 0.0;

    const viewPts: Point3d[] = [];
    if (SelectionMethod.Line === this.getSelectionMethod() || (SelectionMethod.Pick === this.getSelectionMethod() && BeButton.Reset === ev.button)) {
      viewPts[0] = origin;
      viewPts[1] = corner;

      graphic.setSymbology(vp.getContrastToBackgroundColor(), ColorDef.black, 1, LinePixels.Code2);
      graphic.addLineString(2, viewPts);
    } else {
      viewPts[0] = viewPts[4] = origin;
      viewPts[1] = new Point3d(corner.x, origin.y, corner.z);
      viewPts[2] = corner;
      viewPts[3] = new Point3d(origin.x, corner.y, origin.z);
      graphic.setSymbology(vp.getContrastToBackgroundColor(), ColorDef.black, 1, this.useFenceOverlap(ev) ? LinePixels.Code2 : LinePixels.Solid);
      graphic.addLineString(5, viewPts);
    }
    context.addViewOverlay(graphic.finish()!);
  }

  protected startDragSelect(ev: BeButtonEvent): boolean {
    if (BeButton.Data !== ev.button && BeButton.Reset !== ev.button)
      return false;
    this.m_points.length = 0;
    this.m_points.push(ev.point.clone());
    this.m_isDragSelect = true;
    iModelApp.accuSnap.enableLocate(false);
    iModelApp.toolAdmin.setLocateCircleOn(false);
    return true;
  }

  protected dragSelect(ev: BeButtonEvent): boolean {
    if (!this.m_isDragSelect)
      return false;

    const vp = ev.viewport;
    if (!vp) {
      this.initSelectTool();
      return false;
    }

    const worldPts: Point3d[] = [];
    const origin = vp.worldToView(this.m_points[0]);
    const corner = vp.worldToView(ev.point);
    origin.z = corner.z = 0.0;

    if (SelectionMethod.Line === this.getSelectionMethod() || (SelectionMethod.Pick === this.getSelectionMethod() && BeButton.Reset === ev.button)) {
      worldPts[0] = origin;
      worldPts[1] = corner;
      vp.viewToWorldArray(worldPts);
      this.toggleFencePointsSelection(ev, worldPts, 2, true);
    } else {
      worldPts[0] = worldPts[4] = origin;
      worldPts[1] = new Point3d(corner.x, origin.y, corner.z);
      worldPts[2] = corner;
      worldPts[3] = new Point3d(origin.x, corner.y, origin.z);
      vp.viewToWorldArray(worldPts);
      this.toggleFencePointsSelection(ev, worldPts, 5, this.useFenceOverlap(ev));
    }

    this.initSelectTool();
    vp.invalidateDecorations();
    return true;
  }

  public decorateSuspended(context: DecorateContext): void {
    // NOTE: Still want edit manipulator controls to display during viewing operations.
    //       drawOverlayGraphics is only called for the active tool...
    this.drawControls(context);
  }

  public decorate(context: DecorateContext): void {
    this.drawControls(context);
    this.drawDragStateIndicator(context);
    this.drawDragSelect(context);
  }

  public onDynamicFrame(ev: BeButtonEvent, context: DynamicsContext): void {
    if (this.dragControls(ev, context))
      return;
    this.dragElements(ev, context);
  }

  public onDataButtonUp(ev: BeButtonEvent): boolean {
    if (!ev.viewport)
      return false;

    if (this.checkDoubleClickOnElement(ev))
      return false;

    if (this.dragControls(ev))
      return false;

    if (this.selectControls(ev) && this.haveSelectedControls()) {
      // Allow manipulators to respond to clicks on their controls before doing normal processing...
      if (this.m_manipulator!.onClick(ev))
        return false;

      if (!this.wantDragOnlyManipulator()) {
        if (ev.isControlKey && this.multiSelectControls(ev))
          return false;

        const tmpEv = ev.clone();
        this.startDragControls(tmpEv);
        return false;
      }
    }

    if (SelectionMethod.Pick !== this.getSelectionMethod()) {
      if (!this.dragSelect(ev)) { // If line/box selection active, end it...otherwise start it...
        if (!ev.isControlKey && this.wantSelectionClearOnMiss(ev))
          this.iModel.selectionSet.emptyAll();

        this.startDragSelect(ev);
      }
      return false;
    }

    const hit = iModelApp.locateManager.doLocate(new LocateResponse(), true, ev.point, ev.viewport);
    if (hit) {
      // DgnElementCPtr element = hit -> GetElement();

      // switch (GetSelectionMode()) {
      //   case SelectionMode:: Replace:
      //     {
      //       if (ev.IsControlKey()) {
      //         if (element.IsValid())
      //           loadSelection(* element, InvertElementInSelection);
      //         else
      //           SynchManipulators(true); // Replace transient manipulator...
      //       }
      //       else {
      //         if (element.IsValid()) {
      //           if (!loadSelection(* element, ReplaceSelectionWithElement)) {
      //             // Selection un-changed...give manipulator a chance to use new HitDetail...
      //             if (this.m_manipulator.IsValid() && this.m_manipulator -> _OnNewHit(* hit))
      //               SynchManipulators(true); // Clear manipulator...
      //           }
      //         }
      //         else {
      //           // If we don't have a current manipulator, or if the current manipulator doesn't like the new HitDetail, synch...
      //           if (!this.m_manipulator.IsValid() || this.m_manipulator -> _OnNewHit(* hit))
      //             SynchManipulators(true); // Clear manipulator...
      //         }
      //       }
      //       break;
      //     }

      //   case SelectionMode:: Add:
      //     {
      //       if (element.IsValid())
      //         loadSelection(* element, AddElementToSelection);
      //       else
      //         SynchManipulators(true); // Clear manipulator...
      //       break;
      //     }

      //   case SelectionMode:: Remove:
      //     {
      //       if (element.IsValid())
      //         loadSelection(* element, RemoveElementFromSelection);
      //       else
      //         SynchManipulators(true); // Clear manipulator...
      //       break;
      //     }
      // }
      return false;
    }

    if (!ev.isControlKey) {
      if (0 !== this.iModel.selectionSet.numSelected) {
        if (this.wantSelectionClearOnMiss(ev))
          this.iModel.selectionSet.emptyAll();
      } else if (this.m_manipulator) {
        this.synchManipulators(true); // Clear transient manipulator...
      }
    }

    return false;
  }

  public onDataButtonDown(_ev: BeButtonEvent): boolean { return false; }

  public onResetButtonUp(ev: BeButtonEvent): boolean {
    if (this.m_isDragSelect) {
      this.initSelectTool();
      this.synchManipulators(false);
      return false;
    }

    if (this.m_isDragElement) {
      this.endDynamics();
      this.initSelectTool();
      this.synchManipulators(false);
      return true;
    }

    if (this.m_manipulator) {
      if (this.m_isDragControl) {
        this.m_manipulator.onModifyCancel(ev);
        this.endDynamics();
        this.initSelectTool();
        this.synchManipulators(false);
        return false;
      }
      if (this.m_manipulator.onRightClick(ev))
        return false;
    }

    // Check for overlapping hits...
    const lastHit = SelectionMode.Remove === this.getSelectionMode() ? undefined : iModelApp.locateManager.currHit;
    if (lastHit && this.iModel.selectionSet.isSelected(lastHit.elementId)) {
      const autoHit = iModelApp.accuSnap.currHit;

      // Play nice w/auto-locate, only remove previous hit if not currently auto-locating or over previous hit...
      if (!autoHit || autoHit.isSameHit(lastHit)) {
        //   DgnElementCPtr element = lastHit -> GetElement();

        //   if (element.IsValid()) {
        //     HitDetailCP nextHit = ElementLocateManager:: GetManager().DoLocate(NULL, NULL, false, * ev.GetPoint(), ev.GetViewport());
        //     DgnElementCPtr nextElement = (nullptr != nextHit ? nextHit -> GetElement() : nullptr);

        //     // remove element(s) previously selected if in replace mode, or if we have a next element in add mode...
        //     if (SelectionMode:: Replace == GetSelectionMode() || nextElement.IsValid())
        //     loadSelection(* element, RemoveElementFromSelection);

        //     // add element(s) located via reset button
        //     if (nextElement.IsValid())
        //       loadSelection(* nextElement, AddElementToSelection);
        //   return false;
        // }
      }
    }
    iModelApp.accuSnap.resetButton();
    return false;
  }

  public onPostLocate(hit: HitDetail, _out?: LocateResponse) {
    const mode = this.getSelectionMode();
    if (SelectionMode.Replace === mode)
      return true;

    const elementId = hit.elementId;
    if (!elementId)
      return true; // Don't reject transients...

    const isSelected = this.iModel.selectionSet.isSelected(elementId);
    return (SelectionMode.Add === mode ? !isSelected : isSelected);
  }

  public onPostInstall() {
    super.onPostInstall();
    this.initSelectTool();
    this.synchManipulators(true); // Add manipulators for an existing selection set...
    this.m_removeListener = this.iModel.selectionSet.onChanged.addListener(this.onSelectionChanged, this);
    // Utf8String msgStr = DgnClientFxToolsL10N:: GetString(DgnClientFxToolsL10N:: ELEMENT_SET_TOOL_PROMPT_IdentifyElement());
    // NotificationManager:: OutputPrompt(msgStr.c_str());
  }

  public static startTool() {
    const tool = new SelectionTool();
    return tool.run();
  }

}
