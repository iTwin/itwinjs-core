/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module Widget
 */

import "./TitleBarTarget.scss";
import classnames from "classnames";
import * as React from "react";
import { DraggedWidgetIdContext, useTarget } from "../base/DragManager";
import { CursorTypeContext, DraggedTabContext } from "../base/NineZone";
import { getCursorClassName } from "../widget-panels/CursorOverlay";
import { WidgetState } from "../state/WidgetState";
import { WidgetIdContext } from "../widget/Widget";
import { TabOutline } from "../outline/TabOutline";
import { withTargetVersion } from "./TargetOptions";
import { useAllowedWidgetTarget } from "./useAllowedWidgetTarget";
import { WidgetDropTargetState } from "../state/DropTargetState";

/** @internal */
export const TitleBarTarget = withTargetVersion("2", function TitleBarTarget() {
  const cursorType = React.useContext(CursorTypeContext);
  const draggedTab = React.useContext(DraggedTabContext);
  const draggedWidgetId = React.useContext(DraggedWidgetIdContext);
  const widgetId = React.useContext(WidgetIdContext);
  const [ref] = useTarget<HTMLDivElement>(useTargetArgs(widgetId));
  const allowedTarget = useAllowedWidgetTarget(widgetId);

  // istanbul ignore next
  const hidden = !allowedTarget || ((!draggedTab && !draggedWidgetId) || draggedWidgetId === widgetId);
  const className = classnames(
    "nz-target-titleBarTarget",
    hidden && "nz-hidden",
    // istanbul ignore next
    cursorType && getCursorClassName(cursorType),
  );
  return (
    <div
      className={className}
      ref={ref}
    >
      <TabOutline />
    </div>
  );
});

function useTargetArgs(widgetId: WidgetState["id"]) {
  return React.useMemo<WidgetDropTargetState>(() => {
    return {
      type: "widget",
      widgetId,
    };
  }, [widgetId]);
}
