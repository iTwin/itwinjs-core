/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module WidgetPanels
 */

import "./PanelTarget.scss";
import classnames from "classnames";
import * as React from "react";
import { assert } from "@itwin/core-bentley";
import { DraggedWidgetIdContext, usePanelTarget } from "../base/DragManager";
import { CursorTypeContext, DraggedTabStateContext, getUniqueId, TabsStateContext, WidgetsStateContext } from "../base/NineZone";
import { getCursorClassName } from "../widget-panels/CursorOverlay";
import { isHorizontalPanelSide, PanelSide, PanelStateContext } from "../widget-panels/Panel";
import { Target } from "./Target";

/** @internal */
export interface PanelTargetProps {
  side: PanelSide;
}

/** @internal */
export const PanelTarget = React.memo<PanelTargetProps>(function PanelTarget(props) { // eslint-disable-line @typescript-eslint/naming-convention, no-shadow
  const { side } = props;
  const cursorType = React.useContext(CursorTypeContext);
  const draggedTab = React.useContext(DraggedTabStateContext);
  const draggedWidget = React.useContext(DraggedWidgetIdContext);
  const allowedTarget = useAllowedPanelTarget();
  const newWidgetId = React.useMemo(() => getUniqueId(), []);
  const [ref, targeted] = usePanelTarget<HTMLDivElement>({
    side,
    newWidgetId,
  });
  const visible = (!!draggedTab || !!draggedWidget) && allowedTarget;
  const className = classnames(
    "nz-target-panelTarget",
    !visible && "nz-hidden",
    cursorType && getCursorClassName(cursorType),
  );
  const isHorizontal = isHorizontalPanelSide(side);
  return (
    <Target
      className={className}
      section="fill"
      direction={isHorizontal ? "horizontal" : "vertical"}
      targeted={targeted}
      ref={ref}
    />
  );
});

/** @internal */
export function useAllowedPanelTarget() {
  const panel = React.useContext(PanelStateContext);
  const draggedTab = React.useContext(DraggedTabStateContext);
  const draggedWidget = React.useContext(DraggedWidgetIdContext);
  const tabsState = React.useContext(TabsStateContext);
  const widgetsState = React.useContext(WidgetsStateContext);
  assert(!!panel);

  let allowedPanelTargets: ReadonlyArray<PanelSide> | undefined;
  if (draggedTab) {
    const tab = tabsState[draggedTab.tabId];
    allowedPanelTargets = tab.allowedPanelTargets;
  } else if (draggedWidget && draggedWidget in widgetsState) { // handle a case where DraggedWidgetIdContext exists, but dragged widget is not in WidgetsStateContet
    const widget = widgetsState[draggedWidget];
    const tabId = widget.activeTabId;
    const tab = tabsState[tabId];
    allowedPanelTargets = tab.allowedPanelTargets;
  }
  if (allowedPanelTargets) {
    return allowedPanelTargets.includes(panel.side);
  }
  return true;
}
