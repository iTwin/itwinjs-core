/*---------------------------------------------------------------------------------------------
| $Copyright: (c) 2018 Bentley Systems, Incorporated. All rights reserved. $
 *--------------------------------------------------------------------------------------------*/
/** @module SelectionSet */

import { Point3d, Point2d, Range2d } from "@bentley/geometry-core";
import { PrimitiveTool } from "./PrimitiveTool";
import { IModelApp } from "../IModelApp";
import { CoordinateLockOverrides } from "./ToolAdmin";
import { DecorateContext } from "../ViewContext";
import { BeButtonEvent, BeButton, BeCursor, BeModifierKeys, EventHandled } from "./Tool";
import { LocateResponse } from "../ElementLocateManager";
import { HitDetail } from "../HitDetail";
import { LinePixels, ColorDef } from "@bentley/imodeljs-common";
import { Id64Arg, Id64 } from "@bentley/bentleyjs-core";
import { ViewRect } from "../Viewport";
import { Pixel } from "../rendering";
import { EditManipulator } from "./EditManipulator";

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
  /** If element is in selection remove it, else add it. */
  InvertElementInSelection,
  ReplaceSelectionWithElement,
}

/** Tool for picking a set of elements of interest, selected by the user. */
export class SelectionTool extends PrimitiveTool {
  public static hidden = false;
  public static toolId = "Select";
  public isSelectByPoints = false;
  public readonly points: Point3d[] = [];
  public manipulator?: EditManipulator.Provider;

  public requireWriteableTarget(): boolean { return false; }
  public autoLockTarget(): void { } // NOTE: For selecting elements we only care about iModel, so don't lock target model automatically.

  // protected getManipulator(): EditManipulator.Provider | undefined { return new TestEditManipulatorProvider(this.iModel); } // NEEDSWORK: Testing...
  protected getManipulator(): EditManipulator.Provider | undefined { return undefined; } // Override to create sub-class of EditManipulator.Provider...
  protected wantSelectionClearOnMiss(_ev: BeButtonEvent): boolean { return SelectionMode.Replace === this.getSelectionMode(); }
  protected getSelectionMethod(): SelectionMethod { return SelectionMethod.Pick; } // NEEDSWORK: Setting...
  protected getSelectionMode(): SelectionMode { return SelectionMode.Replace; } // NEEDSWORK: Settings...
  protected wantToolSettings(): boolean { return true; } // NEEDSWORK: Settings...

  protected initSelectTool(): void {
    this.isSelectByPoints = false;
    this.points.length = 0;
    const enableLocate = SelectionMethod.Pick === this.getSelectionMethod();
    IModelApp.toolAdmin.setCursor(enableLocate ? BeCursor.Arrow : BeCursor.CrossHair);
    IModelApp.toolAdmin.setLocateCircleOn(true);
    IModelApp.toolAdmin.toolState.coordLockOvr = CoordinateLockOverrides.All;
    IModelApp.locateManager.initToolLocate();
    IModelApp.locateManager.options.allowDecorations = (undefined !== this.manipulator && this.manipulator.allowTransientControls());
    IModelApp.accuSnap.enableLocate(enableLocate);
    IModelApp.accuSnap.enableSnap(false);
    IModelApp.notifications.outputPromptByKey("CoreTools:tools.ElementSet.Prompt.IdentifyElement");
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

  protected useOverlapSelection(ev: BeButtonEvent): boolean {
    let overlapMode = false;
    const vp = ev.viewport!;
    const pt1 = vp.worldToView(this.points[0]);
    const pt2 = vp.worldToView(ev.point);
    overlapMode = (pt1.x > pt2.x);
    return (ev.isShiftKey ? !overlapMode : overlapMode); // Shift inverts inside/overlap selection...
  }

  private selectByPointsDecorate(context: DecorateContext): void {
    if (!this.isSelectByPoints)
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

  protected selectByPointsProcess(origin: Point3d, corner: Point3d, ev: BeButtonEvent, method: SelectionMethod, overlap: boolean) {
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
          if (undefined === pixel || undefined === pixel.elementId || !pixel.elementId.isValid)
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
          if (undefined === pixel || undefined === pixel.elementId || !pixel.elementId.isValid)
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

  protected selectByPointsStart(ev: BeButtonEvent): boolean {
    if (BeButton.Data !== ev.button && BeButton.Reset !== ev.button)
      return false;
    this.points.length = 0;
    this.points.push(ev.point.clone());
    this.isSelectByPoints = true;
    IModelApp.accuSnap.enableLocate(false);
    IModelApp.toolAdmin.setLocateCircleOn(false);
    return true;
  }

  protected selectByPointsEnd(ev: BeButtonEvent): boolean {
    if (!this.isSelectByPoints)
      return false;

    const vp = ev.viewport;
    if (vp === undefined) {
      this.initSelectTool();
      return false;
    }

    const origin = vp.worldToView(this.points[0]);
    const corner = vp.worldToView(ev.point);
    if (SelectionMethod.Line === this.getSelectionMethod() || (SelectionMethod.Pick === this.getSelectionMethod() && BeButton.Reset === ev.button))
      this.selectByPointsProcess(origin, corner, ev, SelectionMethod.Line, true);
    else
      this.selectByPointsProcess(origin, corner, ev, SelectionMethod.Box, this.useOverlapSelection(ev));

    this.initSelectTool();
    vp.invalidateDecorations();
    return true;
  }

  public async onModelStartDrag(ev: BeButtonEvent): Promise<EventHandled> {
    if (this.manipulator && EventHandled.Yes === await this.manipulator.onButtonEvent(ev))
      return EventHandled.Yes;
    return this.selectByPointsStart(ev) ? EventHandled.Yes : EventHandled.No;
  }

  public async onModelEndDrag(ev: BeButtonEvent): Promise<EventHandled> {
    // NOTE: If manipulator installed an `input collector, it would get the end drag event directly
    return this.selectByPointsEnd(ev) ? EventHandled.Yes : EventHandled.No;
  }

  public async onDataButtonUp(ev: BeButtonEvent): Promise<EventHandled> {
    if (ev.viewport === undefined)
      return EventHandled.No;

    if (this.manipulator && EventHandled.Yes === await this.manipulator.onButtonEvent(ev))
      return EventHandled.Yes;

    if (SelectionMethod.Pick !== this.getSelectionMethod()) {
      if (!this.selectByPointsEnd(ev)) { // If line/box selection active, end it...otherwise start it
        if (!ev.isControlKey && this.wantSelectionClearOnMiss(ev))
          this.iModel.selectionSet.emptyAll();
        this.selectByPointsStart(ev);
        return EventHandled.Yes;
      }
      return EventHandled.No;
    }

    // NOTE: Non-element hits are only handled by a manipulator that specifically requested them, can be ignored here
    const hit = IModelApp.locateManager.doLocate(new LocateResponse(), true, ev.point, ev.viewport);
    if (hit !== undefined && hit.isElementHit) {
      switch (this.getSelectionMode()) {
        case SelectionMode.Replace:
          this.processSelection(hit.sourceId, ev.isControlKey ? SelectionProcessing.InvertElementInSelection : SelectionProcessing.ReplaceSelectionWithElement);
          break;

        case SelectionMode.Add:
          this.processSelection(hit.sourceId, SelectionProcessing.AddElementToSelection);
          break;

        case SelectionMode.Remove:
          this.processSelection(hit.sourceId, SelectionProcessing.RemoveElementFromSelection);
          break;
      }
      return EventHandled.No;
    }

    if (!ev.isControlKey && 0 !== this.iModel.selectionSet.size && this.wantSelectionClearOnMiss(ev))
      this.iModel.selectionSet.emptyAll();

    return EventHandled.No;
  }

  public async onResetButtonUp(ev: BeButtonEvent): Promise<EventHandled> {
    if (this.isSelectByPoints) {
      this.initSelectTool();
      return EventHandled.No;
    }

    if (this.manipulator && EventHandled.Yes === await this.manipulator.onButtonEvent(ev))
      return EventHandled.Yes;

    // Check for overlapping hits...
    const lastHit = SelectionMode.Remove === this.getSelectionMode() ? undefined : IModelApp.locateManager.currHit;
    if (lastHit && this.iModel.selectionSet.has(lastHit.sourceId)) {
      const autoHit = IModelApp.accuSnap.currHit;

      // Play nice w/auto-locate, only remove previous hit if not currently auto-locating or over previous hit
      if (undefined === autoHit || autoHit.isSameHit(lastHit)) {
        const response = new LocateResponse();
        const nextHit = IModelApp.locateManager.doLocate(response, false, ev.point, ev.viewport);

        // remove element(s) previously selected if in replace mode, or if we have a next element in add mode
        if (SelectionMode.Replace === this.getSelectionMode() || undefined !== nextHit)
          this.processSelection(lastHit.sourceId, SelectionProcessing.RemoveElementFromSelection);

        // add element(s) located via reset button
        if (undefined !== nextHit)
          this.processSelection(nextHit.sourceId, SelectionProcessing.AddElementToSelection);
        return EventHandled.No;
      }
    }

    IModelApp.accuSnap.resetButton();
    return EventHandled.No;
  }

  // public onSingleTap(_ev: BeGestureEvent): boolean {
  // ### TODO Touch events...
  //    if (undefined !== this.manipulator)
  //      return this.manipulator.onGestureEvent(ev);
  // return false;
  // Let idle tool send data button down/up events if not handled by manipulator
  // }

  // public onSingleFingerMove(ev: BeGestureEvent): boolean {
  //    if (this.isSelectByPoints) {
  //      IModelApp.toolAdmin.convertGestureMoveToButtonDownAndMotion(ev);
  //      return true;
  //    }
  //    if (0 !== ev.gestureInfo!.previousNumberTouches)
  //      return false; // Decide on first touch notification if we'll start handling this gesture instead of passing it on to the idle tool

  // ### TODO Touch events...
  //    return (undefined !== this.manipulator && this.manipulator.onGestureEvent(ev)); // Let idle tool handle event if not handled by manipulator
  //    return false;
  //  }

  //  public onEndGesture(ev: BeGestureEvent): boolean {
  //    if (GestureId.SingleFingerMove !== ev.gestureInfo!.gestureId)
  //      return false;

  // if (this.isSelectByPoints)
  //      return this.selectByPointsEnd(ev);

  // ### TODO Touch events...
  //    return (undefined !== this.manipulator && this.manipulator.onGestureEvent(ev)); // Let idle tool handle event if not handled by manipulator
  //    return false;
  //  }

  public decorate(context: DecorateContext): void { this.selectByPointsDecorate(context); }

  public async onModifierKeyTransition(_wentDown: boolean, modifier: BeModifierKeys, _event: KeyboardEvent): Promise<boolean> {
    return modifier === BeModifierKeys.Shift && this.isSelectByPoints;
  }

  public onPostLocate(hit: HitDetail, _out?: LocateResponse): boolean {
    const mode = this.getSelectionMode();
    if (SelectionMode.Replace === mode)
      return true;

    const elementId = (hit.isElementHit ? hit.sourceId : undefined);
    if (!elementId)
      return true; // Don't reject transients...

    const isSelected = this.iModel.selectionSet.has(elementId);
    return (SelectionMode.Add === mode ? !isSelected : isSelected);
  }

  public onRestartTool(): void { this.exitTool(); }

  public onCleanup(): void {
    super.onCleanup();
    if (this.manipulator) {
      this.manipulator.clear();
      this.manipulator = undefined;
    }
  }

  public onPostInstall(): void {
    super.onPostInstall();
    if (!this.targetView)
      return;
    this.manipulator = this.getManipulator();
    if (this.manipulator)
      this.manipulator.init(); // create controls for an existing selection set...
    this.initSelectTool();
  }

  public static startTool(): boolean { return new SelectionTool().run(); }
}
