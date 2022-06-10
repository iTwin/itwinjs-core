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
import { WidgetState, WidgetTargetState } from "../base/NineZoneState";
import { WidgetIdContext } from "../widget/Widget";

/** @internal */
export const TitleBarTarget = React.memo(function TitleBarTarget() { // eslint-disable-line @typescript-eslint/naming-convention, no-shadow
  const cursorType = React.useContext(CursorTypeContext);
  const draggedTab = React.useContext(DraggedTabContext);
  const draggedWidgetId = React.useContext(DraggedWidgetIdContext);
  const widgetId = React.useContext(WidgetIdContext);
  const [ref] = useTarget<HTMLDivElement>(useTargetArgs(widgetId));
  const hidden = (!draggedTab && !draggedWidgetId) || draggedWidgetId === widgetId;
  const className = classnames(
    "nz-target-titleBarTarget",
    hidden && "nz-hidden",
    cursorType && getCursorClassName(cursorType),
  );
  return (
    <div
      className={className}
      ref={ref}
    />
  );
});

function useTargetArgs(widgetId: WidgetState["id"]) {
  return React.useMemo<WidgetTargetState>(() => {
    return {
      type: "widget",
      widgetId,
    };
  }, [widgetId]);
}
