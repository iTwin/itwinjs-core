/*---------------------------------------------------------------------------------------------
| $Copyright: (c) 2017 Bentley Systems, Incorporated. All rights reserved. $
 *--------------------------------------------------------------------------------------------*/
import { Tool, BeButton, BeButtonEvent, BeGestureEvent, BeWheelEvent } from "./Tool";
import { ToolAdmin } from "./ToolAdmin";
import { ViewManip, ViewHandleType, FitViewTool, RotatePanZoomGestureTool } from "./ViewTool";
import { BentleyStatus } from "@bentley/bentleyjs-core/lib/Bentley";
import { PrimitiveTool } from "./PrimitiveTool";
import { TentativePoint } from "../TentativePoint";
import { AccuDraw } from "../AccuDraw";
import { GeomDetail, HitDetail, HitSource, SnapDetail } from "../HitDetail";

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
export class IdleTool extends Tool {
  public get toolId() { return ""; }

  public onMiddleButtonDown(ev: BeButtonEvent): boolean {
    const vp = ev.viewport;
    if (!vp)
      return true;
    const cur = ToolAdmin.instance.currentInputState;
    if (cur.isDragging(BeButton.Data) || cur.isDragging(BeButton.Reset))
      return false;

    let viewTool;
    if (ev.isDoubleClick) {
      viewTool = new FitViewTool(vp, true);
    } else if (ev.isShiftKey) {
      viewTool = new ViewManip(vp, ViewHandleType.Rotate, true, false, true);
    } else if (false) {
      /* ###TODO: Other view tools if needed... */
    } else {
      const currTool = ToolAdmin.instance.activeViewTool;
      if (currTool && currTool instanceof ViewManip) {
        if (!currTool.isDragging && currTool.viewHandles.hasHandle(ViewHandleType.ViewPan))
          currTool.forcedHandle = ViewHandleType.ViewPan;

        return true;
      }

      viewTool = new ViewManip(vp, ViewHandleType.ViewPan, true, false, true);
    }

    return BentleyStatus.SUCCESS === viewTool.installTool();
  }

  public onMiddleButtonUp(ev: BeButtonEvent): boolean {
    if (ev.isDoubleClick || ev.isControlKey || ev.isShiftKey)
      return false;

    const currTool = ToolAdmin.instance.activeViewTool;
    if (currTool && currTool instanceof ViewManip) {
      if (currTool.viewHandles.hasHandle(ViewHandleType.ViewPan))
        currTool.forcedHandle = ViewHandleType.None; // Didn't get start drag, don't leave ViewPan active...

      if (currTool.viewHandles.hasHandle(ViewHandleType.TargetCenter))
        currTool.invalidateTargetCenter();
    }

    const tp = TentativePoint.instance;
    tp.process(ev);

    if (tp.isSnapped) {
      ToolAdmin.instance.adjustSnapPoint();
    } else {
      if (AccuDraw.instance.isActive) {
        const point = tp.point;
        const vp = ev.viewport!;
        if (vp.isSnapAdjustmentRequired()) {
          ToolAdmin.instance.adjustPointToACS(point, vp, false);

          const geomDetail = new GeomDetail();
          geomDetail.m_closePoint.setFrom(point);
          const hit = new HitDetail(vp, undefined, undefined, point, HitSource.TentativeSnap, geomDetail);
          const snap = new SnapDetail(hit);

          tp.setCurrSnap(snap);
          ToolAdmin.instance.adjustSnapPoint();
          tp.point.setFrom(tp.point);
          tp.setCurrSnap(undefined);
        } else {
          AccuDraw.instance.adjustPoint(point, vp, false);
          const savePoint = point.clone();
          ToolAdmin.instance.adjustPointToGrid(point, vp);
          if (!point.isExactEqual(savePoint))
            AccuDraw.instance.adjustPoint(point, vp, false);
          tp.point.setFrom(point);
        }
      } else {
        ToolAdmin.instance.adjustPoint(tp.point, ev.viewport!);
      }
      AccuDraw.instance.onTentative();
    }

    // NOTE: Need to synch tool dynamics because of UpdateDynamics call in _ExitViewTool from OnMiddleButtonUp before point was adjusted. :(
    if (currTool && currTool instanceof PrimitiveTool) {
      const tmpEv = new BeButtonEvent();
      ToolAdmin.instance.fillEventFromCursorLocation(tmpEv);
      currTool.updateDynamics(tmpEv);
    }

    return true;
  }

  public onMouseWheel(ev: BeWheelEvent) {
    return ToolAdmin.instance.processWheelEvent(ev, true);
  }

  public installToolImplementation() { return BentleyStatus.SUCCESS; }
  public exitTool(): void { }
  public onDataButtonDown(_ev: BeButtonEvent) { return false; }
  public onMultiFingerMove(ev: BeGestureEvent) { const tool = new RotatePanZoomGestureTool(ev, true); tool.installTool(); return true; }
  public onSingleFingerMove(ev: BeGestureEvent) { return this.onMultiFingerMove(ev); }
  public onSingleTap(ev: BeGestureEvent) { ToolAdmin.instance.convertGestureSingleTapToButtonDownAndUp(ev); return true; }
  public onDoubleTap(ev: BeGestureEvent) { if (ev.viewport) { const tool = new FitViewTool(ev.viewport, true); tool.installTool(); } return true; }
  public onTwoFingerTap(ev: BeGestureEvent) { ToolAdmin.instance.convertGestureToResetButtonDownAndUp(ev); return true; }
}
