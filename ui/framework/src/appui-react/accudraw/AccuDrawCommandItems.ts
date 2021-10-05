/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module AccuDraw
 */

import {
  AccuDrawChangeModeTool,
  AccuDrawRotateAxesTool,
  AccuDrawRotateCycleTool,
  AccuDrawRotateElementTool,
  AccuDrawRotateFrontTool,
  AccuDrawRotateSideTool,
  AccuDrawRotateTopTool,
  AccuDrawRotateViewTool,
  AccuDrawSetLockAngleTool,
  AccuDrawSetLockDistanceTool,
  AccuDrawSetLockSmartTool,
  AccuDrawSetLockXTool,
  AccuDrawSetLockYTool,
  AccuDrawSetLockZTool,
  AccuDrawSetOriginTool,
  DefineACSByPointsTool,
} from "@itwin/core-frontend";
import { ToolItemDef } from "../shared/ToolItemDef";
import { BumpToolSetting, FocusToolSettings } from "../tools/ToolSettingsTools";

/** AccuDraw Command Items - useful in Keyboard Shortcuts
 * @beta
 */
// istanbul ignore next
export class AccuDrawCommandItems {

  public static get lockSmart() {
    return ToolItemDef.getItemDefForTool(AccuDrawSetLockSmartTool);
  }

  public static get setOrigin() {
    return ToolItemDef.getItemDefForTool(AccuDrawSetOriginTool);
  }

  public static get lockX() {
    return ToolItemDef.getItemDefForTool(AccuDrawSetLockXTool);
  }

  public static get lockY() {
    return ToolItemDef.getItemDefForTool(AccuDrawSetLockYTool);
  }

  public static get lockZ() {
    return ToolItemDef.getItemDefForTool(AccuDrawSetLockZTool);
  }

  public static get lockAngle() {
    return ToolItemDef.getItemDefForTool(AccuDrawSetLockAngleTool);
  }

  public static get lockDistance() {
    return ToolItemDef.getItemDefForTool(AccuDrawSetLockDistanceTool);
  }

  public static get changeCompassMode() {
    return ToolItemDef.getItemDefForTool(AccuDrawChangeModeTool);
  }

  public static get rotateTop() {
    return ToolItemDef.getItemDefForTool(AccuDrawRotateTopTool);
  }

  public static get rotateFront() {
    return ToolItemDef.getItemDefForTool(AccuDrawRotateFrontTool);
  }

  public static get rotateSide() {
    return ToolItemDef.getItemDefForTool(AccuDrawRotateSideTool);
  }

  public static get rotateView() {
    return ToolItemDef.getItemDefForTool(AccuDrawRotateViewTool);
  }

  public static get rotateCycle() {
    return ToolItemDef.getItemDefForTool(AccuDrawRotateCycleTool);
  }

  public static get rotateAxes() {
    return ToolItemDef.getItemDefForTool(AccuDrawRotateAxesTool);
  }

  public static get rotateToElement() {
    return ToolItemDef.getItemDefForTool(AccuDrawRotateElementTool);
  }

  public static get defineACSByPoints() {
    return ToolItemDef.getItemDefForTool(DefineACSByPointsTool);
  }

  public static get bumpToolSetting() {
    return ToolItemDef.getItemDefForTool(BumpToolSetting);
  }

  public static get focusToolSetting() {
    return ToolItemDef.getItemDefForTool(FocusToolSettings);
  }
}
