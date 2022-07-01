/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module Widget
 */

import "./WidgetTarget.scss";
import classnames from "classnames";
import * as React from "react";
import { DraggedWidgetIdContext, useTarget } from "../base/DragManager";
import { CursorTypeContext, DraggedTabContext } from "../base/NineZone";
import { getCursorClassName } from "../widget-panels/CursorOverlay";
import { Target } from "./Target";
import { WidgetState, WidgetTargetState } from "../base/NineZoneState";

/** @internal */
export interface WidgetTargetProps {
  widgetId: WidgetState["id"];
}

/** @internal */
export const WidgetTarget = React.memo<WidgetTargetProps>(function WidgetTarget(props) { // eslint-disable-line @typescript-eslint/naming-convention, no-shadow
  const { widgetId } = props;
  const cursorType = React.useContext(CursorTypeContext);
  const draggedTab = React.useContext(DraggedTabContext);
  const draggedWidgetId = React.useContext(DraggedWidgetIdContext);
  const [ref, targeted] = useTarget<HTMLDivElement>(useTargetArgs(widgetId));
  const hidden = (!draggedTab && !draggedWidgetId) || draggedWidgetId === widgetId;
  const className = classnames(
    "nz-target-widgetTarget",
    hidden && "nz-hidden",
    cursorType && getCursorClassName(cursorType),
  );
  return (
    <Target
      className={className}
      direction="horizontal"
      section="fill"
      targeted={targeted}
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
