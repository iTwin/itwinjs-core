/*---------------------------------------------------------------------------------------------
| $Copyright: (c) 2017 Bentley Systems, Incorporated. All rights reserved. $
 *--------------------------------------------------------------------------------------------*/
import { Tool, Button, ButtonEvent } from "./Tool";
import { ToolAdmin } from "./ToolAdmin";

/**
 * The default "idle" tool. If no tool is active, or the active tool does not respond to a given
 * event, input events are forwarded to the idle tool. The default idle tool converts middle mouse button events
 * and constious touch gestures into view navigation operations like pan, zoom, rotate, and fit.
 * Controls are as follows:
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

  protected onMiddleButtonDown(ev: ButtonEvent) {
    const toolAdmin = ToolAdmin.instance;
    const cur = toolAdmin.currentInputState;
    if (cur.isDragging(Button.Data) || cur.isDragging(Button.Reset))
      return false;

    let viewTool;
    if (ev.isDoubleClick) {
      viewTool = new FitViewTool(this.viewport, true);
    } else if (ev.isShiftKey) {
      viewTool = new ViewManip(this.viewport, ViewHandleType.Rotate, true, false, true);
    } else if (false) {
      /* ###TODO: Other view tools if needed... */
    } else {
      const currTool = toolAdmin.activeViewTool;
      if (currTool instanceof ViewManip) {
        if (!currTool.isDragging && currTool.viewHandles.hasHandle(ViewHandleType.ViewPan))
          currTool.forcedHandle = ViewHandleType.ViewPan;

        return true;
      }

      viewTool = new ViewManip(this.viewport, ViewHandleType.ViewPan, true, false, true);
    }

    return viewTool.installTool();
  }

  public onMiddleButtonUp(ev) {
    this.viewport.toolAdmin.resetViewCursor();
    if (ev.isDoubleClick || ev.isControlKey || ev.isShiftkey)
      return false;

    const currTool = dynamicCast(this.viewport.toolAdmin.activeTool, ViewManip);
    if (Cesium.defined(currTool)) {
      if (currTool.viewHandles.hasHandle(ViewHandleType.ViewPan))
        currTool.forcedHandle = ViewHandleType.ViewNone; // Didn't get start drag, don't leave ViewPan active...

      if (currTool.viewHandles.hasHandle(ViewHandleType.TargetCenter))
        currTool.invalidateTargetCenter();
    }

    return true;
  }

  public onMouseWheel(ev) {
    return this.viewport.toolAdmin.processMouseWheelEvent(ev, true);
  }

  private installToolImplementation() { return true; };
  private exitTool() { };
  private onDataButtonDown(ev) { return false; };

  private onMultiFingerMove(ev) {
    const tool = new RotatePanZoomGestureTool(ev, true);
    tool.installTool();
    return true;
  }

  private onSingleFingerMove(ev) {
    return this.onMultiFingerMove(ev);
  }

  private onSingleTap(ev) {
    this.toolAdmin.convertGestureSingleTapToButtonDownAndUp(ev);
    return true;
  }

  private onDoubleTap(ev) {
    const tool = new FitViewTool(this.viewport, true);
    tool.installTool();
    return true;
  };

  private onTwoFingerTap(ev) {
    this.toolAdmin.convertGestureToResetButtonDownAndUp(ev);
  }
}
