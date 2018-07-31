/*---------------------------------------------------------------------------------------------
| $Copyright: (c) 2018 Bentley Systems, Incorporated. All rights reserved. $
 *--------------------------------------------------------------------------------------------*/
/** @module Tools */

import { BeButton, BeButtonEvent, BeWheelEvent, InteractiveTool, EventHandled, BeTouchEvent, InputSource } from "./Tool";
import { ViewManip, ViewHandleType, FitViewTool, DefaultViewTouchTool } from "./ViewTool";
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
    const currTool = IModelApp.toolAdmin.viewTool;
    if (currTool && currTool.inDynamicUpdate)
      return; // trying to tentative snap while view is changing isn't useful...

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

    if (currTool && currTool instanceof ViewManip && currTool.viewHandles.hasHandle(ViewHandleType.TargetCenter))
      currTool.updateTargetCenter(); // Change target center to tentative location...
  }

  public async onModelStartDrag(ev: BeButtonEvent): Promise<EventHandled> {
    if (!ev.viewport || BeButton.Middle !== ev.button)
      return EventHandled.No;

    let toolId: string;
    let handleId: ViewHandleType;
    if (ev.isControlKey) {
      toolId = "View." + ev.viewport.view.is3d() ? "Look" : "Scroll";
      handleId = ev.viewport.view.is3d() ? ViewHandleType.Look : ViewHandleType.Scroll;
    } else if (ev.isShiftKey) {
      toolId = "View.Rotate";
      handleId = ViewHandleType.Rotate;
    } else {
      toolId = "View.Pan";
      handleId = ViewHandleType.Pan;
    }

    const currTool = IModelApp.toolAdmin.viewTool;
    if (currTool) {
      if (currTool instanceof ViewManip)
        return currTool.startHandleDrag(ev, handleId); // See if current view tool can drag using this handle, leave it active regardless...
      return EventHandled.No;
    }
    const viewTool = IModelApp.tools.create(toolId, ev.viewport, true, false, true) as ViewManip | undefined;
    if (viewTool && viewTool.run())
      return viewTool.startHandleDrag(ev);
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

  public async onTouchMoveStart(ev: BeTouchEvent, _startEv: BeTouchEvent, _touchCount: number): Promise<EventHandled> {
    const tool = new DefaultViewTouchTool(ev, true);
    return (tool.run() ? EventHandled.Yes : EventHandled.No);
  }

  public async onTouchTap(ev: BeTouchEvent, touchCount: number, tapCount: number): Promise<EventHandled> {
    if (touchCount < 1 || touchCount > 2 || tapCount < 1 || tapCount > 2)
      return EventHandled.No;

    if (1 === tapCount) {
      // Send data down/up for single finger tap. Send reset down/up for two finger tap.
      const button = (1 === touchCount ? BeButton.Data : BeButton.Reset);
      const pt2d = ev.getDisplayPoint();
      await IModelApp.toolAdmin.onButtonDown(ev.viewport!, pt2d, button, InputSource.Touch);
      await IModelApp.toolAdmin.onButtonUp(ev.viewport!, pt2d, button, InputSource.Touch);
      return EventHandled.Yes;
    } else if (2 === tapCount && 1 === touchCount) {
      // Fit view on single finger double tap.
      const tool = new FitViewTool(ev.viewport!, true);
      return (tool.run() ? EventHandled.Yes : EventHandled.No);
    }
    return EventHandled.No;
  }

  public exitTool(): void { }
  public run() { return true; }
}
