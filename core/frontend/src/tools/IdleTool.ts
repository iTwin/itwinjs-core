/*---------------------------------------------------------------------------------------------
* Copyright (c) 2018 - present Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/
/** @module Tools */

import { BeButton, BeButtonEvent, BeWheelEvent, InteractiveTool, EventHandled, BeTouchEvent } from "./Tool";
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

    if (tp.isSnapped) {
      IModelApp.toolAdmin.adjustSnapPoint();
    } else if (IModelApp.accuDraw.isActive) {
      const point = tp.getPoint().clone();
      const vp = ev.viewport!;
      if (vp.isSnapAdjustmentRequired) {
        IModelApp.toolAdmin.adjustPointToACS(point, vp, false);
        const hit = new HitDetail(point, vp, HitSource.TentativeSnap, point, "", HitPriority.Unknown, 0, 0);
        const snap = new SnapDetail(hit);
        tp.setCurrSnap(snap);
        IModelApp.toolAdmin.adjustSnapPoint();
        tp.setPoint(tp.getPoint());
      } else {
        IModelApp.accuDraw.adjustPoint(point, vp, false);
        const savePoint = point.clone();
        IModelApp.toolAdmin.adjustPointToGrid(point, vp);
        if (!point.isExactEqual(savePoint))
          IModelApp.accuDraw.adjustPoint(point, vp, false);
        tp.setPoint(point);
      }
    } else {
      IModelApp.toolAdmin.adjustPoint(tp.getPoint(), ev.viewport!);
    }

    IModelApp.accuDraw.onTentative();

    if (currTool && currTool instanceof ViewManip && currTool.viewHandles.hasHandle(ViewHandleType.TargetCenter))
      currTool.updateTargetCenter(); // Change target center to tentative location...
    else
      IModelApp.toolAdmin.updateDynamics(); // Don't wait for motion to update tool dynamics...
  }

  public async onMouseStartDrag(ev: BeButtonEvent): Promise<EventHandled> {
    if (!ev.viewport || BeButton.Middle !== ev.button)
      return EventHandled.No;

    let toolId: string;
    let handleId: ViewHandleType;
    if (ev.isControlKey) {
      toolId = ev.viewport.view.allow3dManipulations() ? "View.Look" : "View.Scroll";
      handleId = ev.viewport.view.allow3dManipulations() ? ViewHandleType.Look : ViewHandleType.Scroll;
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
    const viewTool = IModelApp.tools.create(toolId, ev.viewport, true, true) as ViewManip | undefined;
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

  public async onTouchMoveStart(ev: BeTouchEvent, startEv: BeTouchEvent): Promise<EventHandled> {
    const tool = new DefaultViewTouchTool(startEv, ev);
    return (tool.run() ? EventHandled.Yes : EventHandled.No);
  }

  public async onTouchTap(ev: BeTouchEvent): Promise<EventHandled> {
    if (ev.isSingleTap) {
      // Send data down/up for single finger tap.
      IModelApp.toolAdmin.convertTouchTapToButtonDownAndUp(ev, BeButton.Data);
      return EventHandled.Yes;
    } else if (ev.isTwoFingerTap) {
      // Send reset down/up for two finger tap.
      IModelApp.toolAdmin.convertTouchTapToButtonDownAndUp(ev, BeButton.Reset);
      return EventHandled.Yes;
    } else if (ev.isDoubleTap) {
      // Fit view on single finger double tap.
      const tool = new FitViewTool(ev.viewport!, true);
      return (tool.run() ? EventHandled.Yes : EventHandled.No);
    }
    return EventHandled.No;
  }

  public exitTool(): void { }
  public run() { return true; }
}
