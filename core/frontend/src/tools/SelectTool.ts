/*---------------------------------------------------------------------------------------------
| $Copyright: (c) 2018 Bentley Systems, Incorporated. All rights reserved. $
 *--------------------------------------------------------------------------------------------*/
/** @module SelectionSet */

import { Point3d, Point2d, Range2d } from "@bentley/geometry-core";
import { PrimitiveTool } from "./PrimitiveTool";
import { IModelApp } from "../IModelApp";
import { CoordinateLockOverrides } from "./ToolAdmin";
import { EditManipulator, ManipulatorSelectionMode } from "./EditManipulator";
import { IModelConnection } from "../IModelConnection";
import { SelectEventType } from "../SelectionSet";
import { DecorateContext, DynamicsContext } from "../ViewContext";
import { BeButtonEvent, BeButton, BeGestureEvent, GestureId, BeCursor, InputCollector } from "./Tool";
import { LocateResponse } from "../ElementLocateManager";
import { HitDetail } from "../HitDetail";
import { LinePixels, ColorDef } from "@bentley/imodeljs-common";
import { GraphicBuilder } from "../render/GraphicBuilder";
import { FenceParams } from "../FenceParams";
import { AccuDrawHintBuilder } from "../AccuDraw";
import { Id64Arg, Id64 } from "@bentley/bentleyjs-core/lib/bentleyjs-core";
import { ViewRect } from "../Viewport";
import { Pixel } from "../rendering";

/** The method for choosing elements with the [[SelectionTool]] */
export const enum SelectionMethod {
  /** Identify element(s) by picking for drag selection (inside/overlap for drag box selection determined by point direction and shift key) */
  Pick,
  /** Identify elements by overlap with crossing line */
  Line,
  /** Identify elements by box selection (inside/overlap for box selection determined by point direction and shift ke) */
  Box,
}

/** The mode for choosing elements with the [[SelectionTool]] */
export const enum SelectionMode {
  /** Identified elements replace the current selection set (use control key to add or remove) */
  Replace,
  /** Identified elements are added to the current selection set */
  Add,
  /** Identified elements are removed from the current selection set */
  Remove,
}

export const enum SelectionProcessing {
  AddElementToSelection,
  RemoveElementFromSelection,
  /** (if element is in selection remove it else add it.) */
  InvertElementInSelection,
  ReplaceSelectionWithElement,
}

export const enum ManipulatorPreference { Disabled, Placement, Geometry }

export class ManipulatorToolBase extends InputCollector {
  public static toolId = "Select.Manipulator";
  public static hidden = true;

  public onPostInstall(): void { super.onPostInstall(); IModelApp.accuSnap.enableLocate(false); IModelApp.accuSnap.enableSnap(true); IModelApp.toolAdmin.currentInputState.buttonDownTool = this; }
  //  public onModelMotion(_ev: BeButtonEvent) { console.log("Motion"); }
  //  public onDataButtonDown(_ev: BeButtonEvent): boolean { console.log("Exit"); this.exitTool(); return false; }
}

/** Tool for picking a set of elements of interest, selected by the user. */
export class SelectionTool extends PrimitiveTool {
  public static hidden = false;
  public static toolId = "Select";
  public isDragSelect = false;
  public isDragControl = false;
  public isDragElement = false;
  public removeListener?: () => void;
  public readonly points: Point3d[] = [];
  public manipulatorPreference = ManipulatorPreference.Geometry;
  public manipulator?: EditManipulator;

  public requireWriteableTarget(): boolean { return this.isDragControl || this.isDragElement; }
  public autoLockTarget(): void { } // NOTE: For selecting elements we only care about iModel, so don't lock target model automatically.

  protected wantSelectionClearOnMiss(_ev: BeButtonEvent): boolean { return SelectionMode.Replace === this.getSelectionMode(); }
  protected wantDragOnlyManipulator(): boolean { return false; } // Restrict manipulator operation to drag, default behavior is to support click, click or drag...
  protected wantElementDrag(): boolean { return true; } // A sub-class can override to disable drag move/copy of elements.
  protected getSelectionMethod(): SelectionMethod { return SelectionMethod.Pick; /* NEEDS_WORK: Settings... */ }
  protected getSelectionMode(): SelectionMode { return SelectionMode.Replace;    /* NEEDS_WORK: Settings... */ }
  protected wantToolSettings(): boolean {
    if (!IModelApp.features.check("SelectionTool.ShowToolSettingInReadonlyFile")) {
      if (this.iModel.isReadonly())
        return false; // Tool can't be used when iModel is read only.

      // IBriefcaseManager:: Request req;
      // req.Locks().Insert(GetDgnDb(), LockLevel:: Shared);
      // if (!GetDgnDb().BriefcaseManager().AreResourcesAvailable(req, nullptr, IBriefcaseManager:: FastQuery:: Yes))
      //   return false;   // another briefcase has locked the db for editing
    }
    return true;
  }
  public onRestartTool(): void { this.exitTool(); }
  public onCleanup(): void {
    super.onCleanup();
    this.manipulator = undefined;
    if (this.removeListener) {
      this.removeListener();
      this.removeListener = undefined;
    }
  }

  protected initSelectTool(): void {
    this.isDragSelect = this.isDragControl = this.isDragElement = this.targetIsLocked = false;
    this.points.length = 0;
    const enableLocate = SelectionMethod.Pick === this.getSelectionMethod();
    IModelApp.toolAdmin.setCursor(enableLocate ? BeCursor.Arrow : BeCursor.CrossHair);
    IModelApp.toolAdmin.setLocateCircleOn(true);
    IModelApp.locateManager.initToolLocate(); // For drag move/copy...
    IModelApp.locateManager.options.allowDecorations = true; // Support edit manipulator for transient geometry...
    IModelApp.toolAdmin.toolState.coordLockOvr = CoordinateLockOverrides.All;
    IModelApp.accuSnap.enableLocate(enableLocate);
    IModelApp.accuSnap.enableSnap(false);
  }

  public processSelection(elementId: Id64Arg, process: SelectionProcessing): boolean {
    // NEEDSWORK...SelectionScope
    switch (process) {
      case SelectionProcessing.AddElementToSelection:
        return this.iModel.selectionSet.add(elementId);
      case SelectionProcessing.RemoveElementFromSelection:
        return this.iModel.selectionSet.remove(elementId);
      case SelectionProcessing.InvertElementInSelection: // (if element is in selection remove it else add it.)
        return this.iModel.selectionSet.invert(elementId);
      case SelectionProcessing.ReplaceSelectionWithElement:
        this.iModel.selectionSet.replace(elementId);
        return true;
      default:
        return false;
    }
  }

  public onSingleTap(ev: BeGestureEvent): boolean {
    if (this.selectControls(ev) && this.haveSelectedControls()) {
      ev.viewport!.invalidateDecorations();

      // Allow manipulators to respond to clicks on their controls before doing normal processing and drags.
      if (this.manipulator!.onClick(ev))
        return true;

      if (!this.wantDragOnlyManipulator()) {
        if (this.multiSelectControls(ev))
          return true;
      }
    }
    return false; // Let idle tool send data button down/up events..
  }

  public onSingleFingerMove(ev: BeGestureEvent): boolean {
    if (this.isDragControl || this.isDragSelect) {
      IModelApp.toolAdmin.convertGestureMoveToButtonDownAndMotion(ev);
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

  protected onSelectionChanged(iModel: IModelConnection, evType: SelectEventType, ids?: Set<string>): void {
    if (this.iModel !== iModel)
      return;

    if (SelectEventType.Clear === evType || !ids || ids.size === 0) {
      // NOTE: Navigator's "clear selection" button should really be restarting the select tool...
      if (this.isDragControl || this.isDragElement)
        this.endDynamics();

      this.initSelectTool();
    }
    this.synchManipulators(true); // Invalidate current manipulator...
  }

  public async synchManipulators(clearCurrent: boolean) {
    IModelApp.viewManager.invalidateDecorationsAllViews();
    if (ManipulatorPreference.Disabled === this.manipulatorPreference) {
      this.manipulator = undefined;
      return;
    }

    if (!clearCurrent && this.manipulator) {
      // Make sure manipulator controls reflect the current element (post-accept)...
      this.manipulator.doCleanupControls();
      if (!this.manipulator.doCreateControls())
        this.manipulator = undefined; // The manipulator is not happy any more so clear it...
      return; // Preserve current manipulator
    }

    // If current hit is for an element, is it the one and only selected element?
    let currHit = IModelApp.locateManager.currHit;
    if (currHit && currHit.isElementHit()) {
      const selSet = this.iModel.selectionSet;
      if (1 !== selSet.size || selSet.has(currHit.sourceId))
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
    if (!this.manipulator || !this.manipulator.isDisplayedInView(context.viewport!))
      return false;
    this.manipulator.onDraw(context);
    return true;
  }

  protected modifierTransitionControls(wentDown: boolean, key: number): boolean {
    if (!this.manipulator)
      return false;
    this.manipulator.onModifierKeyTransition(wentDown, key);
    return true;
  }

  protected haveSelectedControls(): boolean {
    return !!this.manipulator && this.manipulator.hasSelectedControls();
  }

  protected selectControls(ev: BeButtonEvent): boolean {
    if (this.isDragControl || !this.manipulator)
      return false;
    const wasSelected = this.haveSelectedControls();
    return this.manipulator.doUpdateFlashedControls(ev) ? true : wasSelected && !this.haveSelectedControls();
  }

  protected multiSelectControls(ev: BeButtonEvent | FenceParams): boolean {
    if (!this.manipulator)
      return false;
    const wasSelected = this.haveSelectedControls();
    if (this.manipulator.doUpdateSelectedControls(ev, ManipulatorSelectionMode.Inverse))
      return true;
    return wasSelected && !this.haveSelectedControls();
  }

  protected startDragControls(ev: BeButtonEvent): boolean {
    if (BeButton.Data !== ev.button || !this.manipulator)
      return false;

    // NOTE: By default, handle drag for "vertex" type handles should honor all locks...
    //       Moved (from Topaz) before _OnPreModify to more easily allow manipulators to
    //       ignore incompatible locks when setting up button event/anchor point.
    const toolState = IModelApp.toolAdmin.toolState;
    const saveCoordLockOvr = toolState.coordLockOvr;
    toolState.coordLockOvr = CoordinateLockOverrides.None;
    if (!this.manipulator.onPreModify(ev)) {
      toolState.coordLockOvr = saveCoordLockOvr;
      return false;
    }
    this.manipulator.onModifyStart(ev);
    this.beginDynamics();
    this.isDragControl = this.targetIsLocked = true;
    return true;
  }

  protected dragControls(ev: BeButtonEvent, context?: DynamicsContext): boolean {
    if (!this.isDragControl)
      return false;

    if (undefined === context) {
      if (this.manipulator)
        this.manipulator.onModifyAccept(ev);
      this.endDynamics();
      this.initSelectTool();
      this.synchManipulators(false); // Current manipulator is still valid...
      return true;
    }

    if (this.manipulator && this.manipulator.isDisplayedInView(ev.viewport!))
      this.manipulator.onModify(ev, context);
    return true;
  }

  protected useOverlapSelection(ev: BeButtonEvent): boolean {
    let overlapMode = false;
    const vp = ev.viewport!;
    const pt1 = vp.worldToView(this.points[0]);
    const pt2 = vp.worldToView(ev.point);
    overlapMode = (pt1.x > pt2.x);
    return (ev.isShiftKey ? !overlapMode : overlapMode); // Shift inverts inside/overlap selection...
  }

  protected checkDoubleClickOnElement(ev: BeButtonEvent): boolean {
    if (!ev.isDoubleClick)
      return false;

    const currHit = IModelApp.locateManager.currHit;
    if (!currHit)
      return false;

    if (this.manipulator)
      return this.manipulator.onDoubleClick(currHit);

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
    if (0 === this.iModel.selectionSet.size)
      return false;

    const hit = IModelApp.locateManager.doLocate(new LocateResponse(), true, ev.point, ev.viewport, false); // Don't want add/remove mode filtering...
    if (!hit || !this.iModel.selectionSet.has(hit.sourceId))
      return false;

    if (this.iModel.isReadonly()) // NOTE: Don't need to check GetFilteredElementIds, this should be sufficient to know we have at least 1 element...
      return false;

    IModelApp.accuSnap.enableLocate(false);
    IModelApp.accuSnap.enableSnap(true);

    const hints = new AccuDrawHintBuilder();
    hints.enableSmartRotation;
    hints.sendHints();

    this.points.length = 0;
    this.points.push(ev.point.clone());
    this.isDragElement = this.targetIsLocked = true;
    this.beginDynamics();
    return true;
  }

  protected dragElements(_ev: BeButtonEvent, context?: DynamicsContext): boolean {
    if (!this.isDragElement)
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
    graphic.addLineString2d(pts, 0.0);
    pts[1].x = x - size;
    graphic.addLineString2d(pts, 0.0);
    pts[1].x = x;
    pts[1].y = y + size;
    graphic.addLineString2d(pts, 0.0);
    pts[1].y = y - size;
    graphic.addLineString2d(pts, 0.0);
  }

  private drawDragStateIndicator(context: DecorateContext): void {
    if (!this.isDragElement)
      return;

    const ev = new BeButtonEvent();
    IModelApp.toolAdmin.fillEventFromCursorLocation(ev);
    if (!ev.isControlKey)
      return;

    const white = ColorDef.from(255, 255, 255, 10);
    const black = ColorDef.from(0, 0, 0, 10);
    const center = context.viewport!.worldToView(ev.point);
    const plusLoc = new Point2d(center.x + 10, center.y - 5);
    const graphic = context.createViewOverlay();
    graphic.setSymbology(white, white, 3);
    this.drawPlus(graphic, 5, plusLoc.x, plusLoc.y);
    graphic.setSymbology(black, black, 1);
    this.drawPlus(graphic, 3, plusLoc.x, plusLoc.y);
    context.addViewOverlay(graphic.finish()!);
  }

  private drawDragSelect(context: DecorateContext): void {
    if (!this.isDragSelect)
      return;

    const ev = new BeButtonEvent();
    IModelApp.toolAdmin.fillEventFromCursorLocation(ev);

    const graphic = context.createViewOverlay();

    const vp = context.viewport!;
    const origin = vp.worldToView(this.points[0]);
    const corner = vp.worldToView(ev.point);
    origin.z = corner.z = 0.0;

    const viewPts: Point3d[] = [];
    if (SelectionMethod.Line === this.getSelectionMethod() || (SelectionMethod.Pick === this.getSelectionMethod() && BeButton.Reset === ev.button)) {
      viewPts[0] = origin;
      viewPts[1] = corner;

      graphic.setSymbology(vp.getContrastToBackgroundColor(), ColorDef.black, 1, LinePixels.Code2);
      graphic.addLineString(viewPts);
    } else {
      viewPts[0] = viewPts[4] = origin;
      viewPts[1] = new Point3d(corner.x, origin.y, corner.z);
      viewPts[2] = corner;
      viewPts[3] = new Point3d(origin.x, corner.y, origin.z);
      graphic.setSymbology(vp.getContrastToBackgroundColor(), ColorDef.black, 1, this.useOverlapSelection(ev) ? LinePixels.Code2 : LinePixels.Solid);
      graphic.addLineString(viewPts);
    }
    context.addViewOverlay(graphic.finish()!);
  }

  protected startDragSelect(ev: BeButtonEvent): boolean {
    if (BeButton.Data !== ev.button && BeButton.Reset !== ev.button)
      return false;
    this.points.length = 0;
    this.points.push(ev.point.clone());
    this.isDragSelect = true;
    IModelApp.accuSnap.enableLocate(false);
    IModelApp.toolAdmin.setLocateCircleOn(false);
    return true;
  }

  protected doDragSelect(origin: Point3d, corner: Point3d, ev: BeButtonEvent, method: SelectionMethod, overlap: boolean) {
    const vp = ev.viewport;
    if (!vp)
      return;
    const pts: Point2d[] = [];
    pts[0] = new Point2d(Math.floor(origin.x + 0.5), Math.floor(origin.y + 0.5));
    pts[1] = new Point2d(Math.floor(corner.x + 0.5), Math.floor(corner.y + 0.5));
    const range = Range2d.createArray(pts);

    const rect = new ViewRect();
    rect.initFromRange(range);
    const pixels = vp.readPixels(rect, Pixel.Selector.ElementId);
    if (undefined === pixels)
      return;

    let contents = new Set<string>();
    const testPoint = Point2d.createZero();

    if (SelectionMethod.Box === method) {
      const outline = overlap ? undefined : new Set<string>();
      const offset = range.clone();
      offset.expandInPlace(-2); // NEEDWORK: Why doesn't -1 work?!?
      for (testPoint.x = range.low.x; testPoint.x <= range.high.x; ++testPoint.x) {
        for (testPoint.y = range.low.y; testPoint.y <= range.high.y; ++testPoint.y) {
          const pixel = pixels.getPixel(testPoint.x, testPoint.y);
          if (undefined === pixel || undefined === pixel.elementId || !pixel.elementId.isValid())
            continue; // no geometry at this location...
          if (undefined !== outline && !offset.containsPoint(testPoint))
            outline.add(pixel.elementId.toString());
          else
            contents.add(pixel.elementId.toString());
        }
      }
      if (undefined !== outline && 0 !== outline.size) {
        const inside = new Set<string>();
        Id64.toIdSet(contents).forEach((id) => { if (!outline.has(id)) inside.add(id); });
        contents = inside;
      }
    } else {
      const closePoint = Point2d.createZero();
      for (testPoint.x = range.low.x; testPoint.x <= range.high.x; ++testPoint.x) {
        for (testPoint.y = range.low.y; testPoint.y <= range.high.y; ++testPoint.y) {
          const pixel = pixels.getPixel(testPoint.x, testPoint.y);
          if (undefined === pixel || undefined === pixel.elementId || !pixel.elementId.isValid())
            continue; // no geometry at this location...
          const fraction = testPoint.fractionOfProjectionToLine(pts[0], pts[1], 0.0);
          pts[0].interpolate(fraction, pts[1], closePoint);
          if (closePoint.distance(testPoint) < 1.5)
            contents.add(pixel.elementId.toString());
        }
      }
    }

    if (0 === contents.size) {
      if (!ev.isControlKey && this.wantSelectionClearOnMiss(ev))
        this.iModel.selectionSet.emptyAll();
      return;
    }

    switch (this.getSelectionMode()) {
      case SelectionMode.Replace:
        if (!ev.isControlKey)
          this.processSelection(contents, SelectionProcessing.ReplaceSelectionWithElement);
        else
          this.processSelection(contents, SelectionProcessing.InvertElementInSelection);
        break;
      case SelectionMode.Add:
        this.processSelection(contents, SelectionProcessing.AddElementToSelection);
        break;
      case SelectionMode.Remove:
        this.processSelection(contents, SelectionProcessing.RemoveElementFromSelection);
        break;
    }
  }

  protected dragSelect(ev: BeButtonEvent): boolean {
    if (!this.isDragSelect)
      return false;

    const vp = ev.viewport;
    if (!vp) {
      this.initSelectTool();
      return false;
    }

    const origin = vp.worldToView(this.points[0]);
    const corner = vp.worldToView(ev.point);
    if (SelectionMethod.Line === this.getSelectionMethod() || (SelectionMethod.Pick === this.getSelectionMethod() && BeButton.Reset === ev.button))
      this.doDragSelect(origin, corner, ev, SelectionMethod.Line, true);
    else
      this.doDragSelect(origin, corner, ev, SelectionMethod.Box, this.useOverlapSelection(ev));

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

  /*   public testInputCollectorManip(_ev: BeButtonEvent): boolean {
      if (!this.iModel.selectionSet.isActive())
        return false;
      const autoHit = IModelApp.accuSnap.currHit;
      if (undefined === autoHit || !this.iModel.selectionSet.has(autoHit.sourceId))
        return false;
      // NOTE: Could check ev.isControlKey and just "select" a control handle without installing tool yet...
      const manipTool = new ManipulatorToolBase();
      return manipTool.run();
    } */

  public onModelStartDrag(ev: BeButtonEvent): boolean {
    /** TESTING InputCollector */
    //    if (this.testInputCollectorManip(ev))
    //      return false;

    if (this.selectControls(ev) && this.haveSelectedControls()) {
      const tmpEv = ev.clone();
      if (this.startDragControls(tmpEv))
        return false;
    }

    if (!ev.isControlKey) {
      if (this.startDragElements(ev))
        return false;
    }

    this.startDragSelect(ev);
    return false;
  }

  public onModelEndDrag(ev: BeButtonEvent): boolean {
    if (this.dragControls(ev))
      return false;

    if (this.dragElements(ev))
      return false;

    this.dragSelect(ev);
    return false;
  }

  public onDataButtonUp(ev: BeButtonEvent): boolean {
    if (!ev.viewport)
      return false;

    if (this.checkDoubleClickOnElement(ev))
      return false;

    /** TESTING InputCollector */
    //    if (this.testInputCollectorManip(ev))
    //      return false;

    if (this.dragControls(ev))
      return false;

    if (this.selectControls(ev) && this.haveSelectedControls()) {
      // Allow manipulators to respond to clicks on their controls before doing normal processing...
      if (this.manipulator!.onClick(ev))
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

    const hit = IModelApp.locateManager.doLocate(new LocateResponse(), true, ev.point, ev.viewport);
    if (hit) {
      switch (this.getSelectionMode()) {
        case SelectionMode.Replace: {
          if (ev.isControlKey) {
            if (hit.isElementHit())
              this.processSelection(hit.sourceId, SelectionProcessing.InvertElementInSelection);
            else
              this.synchManipulators(true); // Replace transient manipulator...
          } else {
            if (hit.isElementHit()) {
              if (!this.processSelection(hit.sourceId, SelectionProcessing.ReplaceSelectionWithElement)) {
                // Selection un-changed...give manipulator a chance to use new HitDetail...
                if (this.manipulator && this.manipulator.onNewHit(hit))
                  this.synchManipulators(true); // Clear manipulator...
              }
            } else {
              // If we don't have a current manipulator, or if the current manipulator doesn't like the new HitDetail, synch...
              if (!this.manipulator || this.manipulator.onNewHit(hit))
                this.synchManipulators(true); // Clear manipulator...
            }
          }
          break;
        }

        case SelectionMode.Add: {
          if (hit.isElementHit())
            this.processSelection(hit.sourceId, SelectionProcessing.AddElementToSelection);
          else
            this.synchManipulators(true); // Clear manipulator...
          break;
        }

        case SelectionMode.Remove: {
          if (hit.isElementHit())
            this.processSelection(hit.sourceId, SelectionProcessing.RemoveElementFromSelection);
          else
            this.synchManipulators(true); // Clear manipulator...
          break;
        }
      }
      return false;
    }

    if (!ev.isControlKey) {
      if (0 !== this.iModel.selectionSet.size) {
        if (this.wantSelectionClearOnMiss(ev))
          this.iModel.selectionSet.emptyAll();
      } else if (this.manipulator) {
        this.synchManipulators(true); // Clear transient manipulator...
      }
    }

    return false;
  }

  public onResetButtonUp(ev: BeButtonEvent): boolean {
    if (this.isDragSelect) {
      this.initSelectTool();
      this.synchManipulators(false);
      return false;
    }

    if (this.isDragElement) {
      this.endDynamics();
      this.initSelectTool();
      this.synchManipulators(false);
      return true;
    }

    if (this.manipulator) {
      if (this.isDragControl) {
        this.manipulator.onModifyCancel(ev);
        this.endDynamics();
        this.initSelectTool();
        this.synchManipulators(false);
        return false;
      }
      if (this.manipulator.onRightClick(ev))
        return false;
    }

    // Check for overlapping hits...
    const lastHit = SelectionMode.Remove === this.getSelectionMode() ? undefined : IModelApp.locateManager.currHit;
    if (lastHit && this.iModel.selectionSet.has(lastHit.sourceId)) {
      const autoHit = IModelApp.accuSnap.currHit;

      // Play nice w/auto-locate, only remove previous hit if not currently auto-locating or over previous hit...
      if (undefined === autoHit || autoHit.isSameHit(lastHit)) {
        const response = new LocateResponse();
        const nextHit = IModelApp.locateManager.doLocate(response, false, ev.point, ev.viewport);

        // remove element(s) previously selected if in replace mode, or if we have a next element in add mode...
        if (SelectionMode.Replace === this.getSelectionMode() || undefined !== nextHit)
          this.processSelection(lastHit.sourceId, SelectionProcessing.RemoveElementFromSelection);

        // add element(s) located via reset button
        if (undefined !== nextHit)
          this.processSelection(nextHit.sourceId, SelectionProcessing.AddElementToSelection);
        return false;
      }
    }

    IModelApp.accuSnap.resetButton();
    return false;
  }

  public onPostLocate(hit: HitDetail, _out?: LocateResponse): boolean {
    const mode = this.getSelectionMode();
    if (SelectionMode.Replace === mode)
      return true;

    const elementId = (hit.isElementHit() ? hit.sourceId : undefined);
    if (!elementId)
      return true; // Don't reject transients...

    const isSelected = this.iModel.selectionSet.has(elementId);
    return (SelectionMode.Add === mode ? !isSelected : isSelected);
  }

  public onPostInstall(): void {
    super.onPostInstall();
    this.initSelectTool();
    this.synchManipulators(true); // Add manipulators for an existing selection set...
    if (!this.targetView)
      return;
    this.removeListener = this.iModel.selectionSet.onChanged.addListener(this.onSelectionChanged, this);
    IModelApp.notifications.outputPromptByKey("CoreTools:tools.ElementSet.Prompt.IdentifyElement");
  }

  public static startTool(): boolean {
    const tool = new SelectionTool();
    return tool.run();
  }

}
