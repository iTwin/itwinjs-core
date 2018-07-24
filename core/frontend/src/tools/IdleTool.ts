/*---------------------------------------------------------------------------------------------
| $Copyright: (c) 2018 Bentley Systems, Incorporated. All rights reserved. $
 *--------------------------------------------------------------------------------------------*/
/** @module Tools */

import { BeButton, BeButtonEvent, BeGestureEvent, BeWheelEvent, InteractiveTool, EventHandled } from "./Tool";
import { ViewManip, ViewHandleType, FitViewTool, RotatePanZoomGestureTool, ViewTool } from "./ViewTool";
import { HitDetail, HitSource, SnapDetail, HitPriority } from "../HitDetail";
import { IModelApp } from "../IModelApp";

/**
 * The default "idle" tool. If no tool is active, or the active tool does not respond to a given
 * event, input events are forwarded to the idle tool. The default idle tool converts middle mouse button events
 * and touch gestures into view navigation operations like pan, zoom, rotate, and fit.
 */

/* Controls are as follows:
*  Mouse/keyboard:
*      mmb: pan
*      shift-mmb: rotate
*      wheel: zoom in/out
*      double-mmb: fit view
*  Touch:
*      single-finger drag: rotate
*      two-finger drag: pan
*      pinch: zoom in/out
*      double-tap: fit view
*  Touch inputs can be combined e.g. drag two fingers while moving them closer together => pan + zoom in
*/
export class IdleTool extends InteractiveTool {
  public static toolId = "Idle";
  public static hidden = true;

  private async performTentative(ev: BeButtonEvent): Promise<void> {
    const tp = IModelApp.tentativePoint;
    await tp.process(ev);

    if (tp.isSnapped()) {
      IModelApp.toolAdmin.adjustSnapPoint();
    } else {
      if (IModelApp.accuDraw.isActive()) {
        const point = tp.point;
        const vp = ev.viewport!;
        if (vp.isSnapAdjustmentRequired()) {
          IModelApp.toolAdmin.adjustPointToACS(point, vp, false);
          const hit = new HitDetail(point, vp, HitSource.TentativeSnap, point, "", HitPriority.Unknown, 0, 0);
          const snap = new SnapDetail(hit);
          tp.setCurrSnap(snap);
          IModelApp.toolAdmin.adjustSnapPoint();
          tp.point.setFrom(tp.point);
          tp.setCurrSnap(undefined);
        } else {
          IModelApp.accuDraw.adjustPoint(point, vp, false);
          const savePoint = point.clone();
          IModelApp.toolAdmin.adjustPointToGrid(point, vp);
          if (!point.isExactEqual(savePoint))
            IModelApp.accuDraw.adjustPoint(point, vp, false);
          tp.point.setFrom(point);
        }
      } else {
        IModelApp.toolAdmin.adjustPoint(tp.point, ev.viewport!);
      }
    }

    IModelApp.accuDraw.onTentative();

    const currTool = IModelApp.toolAdmin.activeViewTool;
    if (currTool && currTool instanceof ViewManip) {
      if (currTool.viewHandles.hasHandle(ViewHandleType.ViewPan))
        currTool.forcedHandle = ViewHandleType.None; // Didn't get start drag, don't leave ViewPan active...

      if (currTool.viewHandles.hasHandle(ViewHandleType.TargetCenter))
        currTool.updateTargetCenter(); // Change target center to tentative location...
    }

    // NOTE: Need to synch tool dynamics because of updateDynamics call in _ExitViewTool before point was adjusted.
    IModelApp.toolAdmin.updateDynamics();
  }

  public async onModelStartDrag(ev: BeButtonEvent): Promise<EventHandled> {
    if (!ev.viewport || BeButton.Middle !== ev.button)
      return EventHandled.No;

    let viewTool: ViewTool | undefined;
    if (ev.isControlKey) {
      viewTool = IModelApp.tools.create("View." + ev.viewport.view.is3d() ? "Look" : "Scroll", ev.viewport, true, false, true) as ViewTool | undefined;
    } else if (ev.isShiftKey) {
      viewTool = IModelApp.tools.create("View.Rotate", ev.viewport, true, false, true) as ViewTool | undefined;
    } else {
      const currTool = IModelApp.toolAdmin.activeViewTool;
      if (currTool && currTool instanceof ViewManip) {
        // A current tool is active. If it's not already changing the view, tell it to choose the pan handle if it has one (leave it active regardless)...
        if (!currTool.isDragging && currTool.viewHandles.hasHandle(ViewHandleType.ViewPan))
          currTool.forcedHandle = ViewHandleType.ViewPan;
        return EventHandled.Yes;
      }

      viewTool = IModelApp.tools.create("View.Pan", ev.viewport, true, false, true) as ViewTool | undefined;
    }

    if (viewTool && viewTool.run()) {
      IModelApp.toolAdmin.currentInputState.buttonDownTool = viewTool;
      viewTool.onModelStartDrag(ev);
    }
    return EventHandled.Yes;
  }

  public async onMiddleButtonUp(ev: BeButtonEvent): Promise<EventHandled> {
    if (!ev.viewport)
      return EventHandled.No;

    if (ev.isDoubleClick) {
      const viewTool = new FitViewTool(ev.viewport, true);
      return viewTool.run() ? EventHandled.Yes : EventHandled.No;
    }

    if (ev.isControlKey || ev.isShiftKey)
      return EventHandled.No;

    await this.performTentative(ev);
    return EventHandled.Yes;
  }

  public async onMouseWheel(ev: BeWheelEvent) { return IModelApp.toolAdmin.processWheelEvent(ev, true); }
  public onMultiFingerMove(ev: BeGestureEvent) { const tool = new RotatePanZoomGestureTool(ev, true); tool.run(); return true; }
  public onSingleFingerMove(ev: BeGestureEvent) { return this.onMultiFingerMove(ev); }
  public onSingleTap(ev: BeGestureEvent) { IModelApp.toolAdmin.convertGestureSingleTapToButtonDownAndUp(ev); return true; }
  public onDoubleTap(ev: BeGestureEvent) { if (ev.viewport) { const tool = new FitViewTool(ev.viewport, true); tool.run(); } return true; }
  public onTwoFingerTap(ev: BeGestureEvent) { IModelApp.toolAdmin.convertGestureToResetButtonDownAndUp(ev); return true; }

  public exitTool(): void { }
  public run() { return true; }
}
