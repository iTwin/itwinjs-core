/*---------------------------------------------------------------------------------------------
| $Copyright: (c) 2018 Bentley Systems, Incorporated. All rights reserved. $
 *--------------------------------------------------------------------------------------------*/
import { Tool, BeButton, BeButtonEvent, BeGestureEvent, BeWheelEvent } from "./Tool";
import { ViewManip, ViewHandleType, FitViewTool, RotatePanZoomGestureTool } from "./ViewTool";
import { BentleyStatus } from "@bentley/bentleyjs-core/lib/Bentley";
import { PrimitiveTool } from "./PrimitiveTool";
import { GeomDetail, HitDetail, HitSource, SnapDetail } from "../HitDetail";
import { iModelApp } from "../IModelApp";

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
  public static toolId = "Idle";
  public static hidden = true;

  public onMiddleButtonDown(ev: BeButtonEvent): boolean {
    const vp = ev.viewport;
    if (!vp)
      return true;
    const cur = iModelApp.toolAdmin.currentInputState;
    if (cur.isDragging(BeButton.Data) || cur.isDragging(BeButton.Reset))
      return false;

    let viewTool;
    if (ev.isDoubleClick) {
      viewTool = new FitViewTool(vp, true);
    } else if (ev.isControlKey) {
      viewTool = iModelApp.createTool("View." + vp.view.is3d() ? "Look" : "Scroll", vp);
    } else if (ev.isShiftKey) {
      viewTool = iModelApp.createTool("View.Rotate", vp);
    } else if (false) {
      /* ###TODO: Other view tools if needed... */
    } else {
      const currTool = iModelApp.toolAdmin.activeViewTool;
      if (currTool && currTool instanceof ViewManip) {
        if (!currTool.isDragging && currTool.viewHandles.hasHandle(ViewHandleType.ViewPan))
          currTool.forcedHandle = ViewHandleType.ViewPan;

        return true;
      }

      viewTool = iModelApp.createTool("View.Pan", vp);
    }

    return !!viewTool && BentleyStatus.SUCCESS === viewTool.installTool();
  }

  public onMiddleButtonUp(ev: BeButtonEvent): boolean {
    if (ev.isDoubleClick || ev.isControlKey || ev.isShiftKey)
      return false;

    const currTool = iModelApp.toolAdmin.activeViewTool;
    if (currTool && currTool instanceof ViewManip) {
      if (currTool.viewHandles.hasHandle(ViewHandleType.ViewPan))
        currTool.forcedHandle = ViewHandleType.None; // Didn't get start drag, don't leave ViewPan active...

      if (currTool.viewHandles.hasHandle(ViewHandleType.TargetCenter))
        currTool.invalidateTargetCenter();
    }

    const tp = iModelApp.tentativePoint;
    tp.process(ev);

    if (tp.isSnapped) {
      iModelApp.toolAdmin.adjustSnapPoint();
    } else {
      if (iModelApp.accuDraw.isActive) {
        const point = tp.point;
        const vp = ev.viewport!;
        if (vp.isSnapAdjustmentRequired()) {
          iModelApp.toolAdmin.adjustPointToACS(point, vp, false);

          const geomDetail = new GeomDetail();
          geomDetail.closePoint.setFrom(point);
          const hit = new HitDetail(vp, undefined, undefined, point, HitSource.TentativeSnap, geomDetail);
          const snap = new SnapDetail(hit);

          tp.setCurrSnap(snap);
          iModelApp.toolAdmin.adjustSnapPoint();
          tp.point.setFrom(tp.point);
          tp.setCurrSnap(undefined);
        } else {
          iModelApp.accuDraw.adjustPoint(point, vp, false);
          const savePoint = point.clone();
          iModelApp.toolAdmin.adjustPointToGrid(point, vp);
          if (!point.isExactEqual(savePoint))
            iModelApp.accuDraw.adjustPoint(point, vp, false);
          tp.point.setFrom(point);
        }
      } else {
        iModelApp.toolAdmin.adjustPoint(tp.point, ev.viewport!);
      }
      iModelApp.accuDraw.onTentative();
    }

    // NOTE: Need to synch tool dynamics because of UpdateDynamics call in _ExitViewTool from OnMiddleButtonUp before point was adjusted. :(
    if (currTool && currTool instanceof PrimitiveTool) {
      const tmpEv = new BeButtonEvent();
      iModelApp.toolAdmin.fillEventFromCursorLocation(tmpEv);
      currTool.updateDynamics(tmpEv);
    }

    return true;
  }

  public onMouseWheel(ev: BeWheelEvent) {
    return iModelApp.toolAdmin.processWheelEvent(ev, true);
  }

  public installToolImplementation() { return BentleyStatus.SUCCESS; }
  public exitTool(): void { }
  public onDataButtonDown(_ev: BeButtonEvent) { return false; }
  public onMultiFingerMove(ev: BeGestureEvent) { const tool = new RotatePanZoomGestureTool(ev, true); tool.installTool(); return true; }
  public onSingleFingerMove(ev: BeGestureEvent) { return this.onMultiFingerMove(ev); }
  public onSingleTap(ev: BeGestureEvent) { iModelApp.toolAdmin.convertGestureSingleTapToButtonDownAndUp(ev); return true; }
  public onDoubleTap(ev: BeGestureEvent) { if (ev.viewport) { const tool = new FitViewTool(ev.viewport, true); tool.installTool(); } return true; }
  public onTwoFingerTap(ev: BeGestureEvent) { iModelApp.toolAdmin.convertGestureToResetButtonDownAndUp(ev); return true; }
}
