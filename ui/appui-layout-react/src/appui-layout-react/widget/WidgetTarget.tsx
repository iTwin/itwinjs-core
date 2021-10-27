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
import { assert } from "@itwin/core-bentley";
import { DraggedWidgetIdContext, useWidgetTarget } from "../base/DragManager";
import { CursorTypeContext, DraggedTabContext } from "../base/NineZone";
import { getCursorClassName } from "../widget-panels/CursorOverlay";
import { PanelSideContext } from "../widget-panels/Panel";

/** @internal */
export interface WidgetTargetProps {
  position?: "first" | "last";
  widgetIndex: number;
}

/** @internal */
export const WidgetTarget = React.memo<WidgetTargetProps>(function WidgetTarget(props) { // eslint-disable-line @typescript-eslint/naming-convention, no-shadow
  const cursorType = React.useContext(CursorTypeContext);
  const draggedTab = React.useContext(DraggedTabContext);
  const draggedWidget = React.useContext(DraggedWidgetIdContext);
  const side = React.useContext(PanelSideContext);
  assert(!!side);
  const [ref, targeted] = useWidgetTarget<HTMLDivElement>({
    side,
    widgetIndex: props.widgetIndex,
  });
  const hidden = !draggedTab && !draggedWidget;
  const className = classnames(
    "nz-widget-widgetTarget",
    hidden && "nz-hidden",
    targeted && "nz-targeted",
    `nz-${side}`,
    props.position && `nz-${props.position}`,
    cursorType && getCursorClassName(cursorType),
  );
  return (
    <div
      className={className}
      ref={ref}
    />
  );
});
