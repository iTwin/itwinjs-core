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
import { CursorTypeContext, DraggedTabStateContext, TabsStateContext, WidgetsStateContext } from "../base/NineZone";
import { isHorizontalPanelState } from "../base/NineZoneState";
import { getCursorClassName } from "./CursorOverlay";
import type { PanelSide} from "./Panel";
import { PanelStateContext } from "./Panel";

/** @internal */
export const PanelTarget = React.memo(function PanelTarget() { // eslint-disable-line @typescript-eslint/naming-convention, no-shadow
  const panel = React.useContext(PanelStateContext);
  const cursorType = React.useContext(CursorTypeContext);
  const draggedTab = React.useContext(DraggedTabStateContext);
  const draggedWidget = React.useContext(DraggedWidgetIdContext);
  assert(!!panel);
  const allowedTarget = useAllowedPanelTarget();
  const [ref, targeted] = usePanelTarget<HTMLDivElement>({
    side: panel.side,
  });
  const visible = (!!draggedTab || !!draggedWidget) && allowedTarget;
  const className = classnames(
    "nz-widgetPanels-panelTarget",
    !visible && "nz-hidden",
    targeted && "nz-targeted",
    isHorizontalPanelState(panel) && panel.span && "nz-span",
    `nz-${panel.side}`,
    cursorType && getCursorClassName(cursorType),
  );
  return (
    <div
      className={className}
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
