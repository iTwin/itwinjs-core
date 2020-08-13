/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module Widget
 */

import "./TabTarget.scss";
import classnames from "classnames";
import * as React from "react";
import { DraggedWidgetIdContext, useTabTarget } from "../base/DragManager";
import { CursorTypeContext, DraggedTabContext } from "../base/NineZone";
import { getCursorClassName } from "../widget-panels/CursorOverlay";
import { WidgetIdContext } from "./Widget";

/** @internal */
export interface WidgetTabTargetProps {
  tabIndex: number;
  first?: boolean;
}

/** Component that displays a tab target.
 * @internal
 */
export const WidgetTabTarget = React.memo<WidgetTabTargetProps>(function WidgetTabTarget(props) { // eslint-disable-line @typescript-eslint/naming-convention, no-shadow
  const { first, tabIndex } = props;
  const cursorType = React.useContext(CursorTypeContext);
  const widgetId = React.useContext(WidgetIdContext);
  const draggedTab = React.useContext(DraggedTabContext);
  const draggedWidget = React.useContext(DraggedWidgetIdContext);
  const [ref, targeted] = useTabTarget<HTMLDivElement>({
    tabIndex: first ? tabIndex : tabIndex + 1,
    widgetId,
  });
  const hidden = !draggedTab && !draggedWidget || draggedWidget === widgetId;
  const className = classnames(
    "nz-widget-tabTarget",
    hidden && "nz-hidden",
    targeted && "nz-targeted",
    cursorType && getCursorClassName(cursorType),
  );
  return (
    <div
      className={className}
      ref={ref}
    />
  );
});
