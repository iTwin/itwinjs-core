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
import { isHorizontalPanelSide, PanelSide, PanelSideContext } from "../widget-panels/Panel";

/** @internal */
export interface PanelTargetProps {
  side: PanelSide;
}

/** @internal */
export function PanelTarget(props: PanelTargetProps) {
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
  // istanbul ignore next
  const visible = (!!draggedTab || !!draggedWidget) && allowedTarget;
  const isHorizontal = isHorizontalPanelSide(side);
  const className = classnames(
    "nz-target-panelTarget",
    // istanbul ignore next
    isHorizontal ? "nz-horizontal" : "nz-vertical",
    // istanbul ignore next
    targeted && "nz-targeted",
    !visible && "nz-hidden",
    // istanbul ignore next
    cursorType && getCursorClassName(cursorType),
  );
  return (
    <div
      className={className}
      ref={ref}
    />
  );
}

/** @internal */
export function useAllowedPanelTarget() {
  const side = React.useContext(PanelSideContext);
  assert(!!side);
  const draggedTab = React.useContext(DraggedTabStateContext);
  const draggedWidget = React.useContext(DraggedWidgetIdContext);
  const tabsState = React.useContext(TabsStateContext);
  const widgetsState = React.useContext(WidgetsStateContext);

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
    return allowedPanelTargets.includes(side);
  }
  return true;
}
