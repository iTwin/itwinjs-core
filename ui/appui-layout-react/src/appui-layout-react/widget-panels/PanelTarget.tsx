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
import { getCursorClassName } from "./CursorOverlay";
import { PanelSide, PanelStateContext } from "./Panel";
import { withTargetVersion } from "../target/TargetOptions";
import { isHorizontalPanelState } from "../state/PanelState";

/** @internal */
export const PanelTarget = React.memo(
  withTargetVersion("1", function PanelTarget() { // eslint-disable-line @typescript-eslint/naming-convention, no-shadow
    const panel = React.useContext(PanelStateContext);
    const cursorType = React.useContext(CursorTypeContext);
    const draggedTab = React.useContext(DraggedTabStateContext);
    const draggedWidget = React.useContext(DraggedWidgetIdContext);
    assert(!!panel);
    const allowedTarget = useAllowedPanelTarget();
    const newWidgetId = React.useMemo(() => getUniqueId(), []);
    const [ref, targeted] = usePanelTarget<HTMLDivElement>({
      side: panel.side,
      newWidgetId,
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
  }),
);

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
    const activeTabId = widget.activeTabId;
    const activeTab = tabsState[activeTabId];
    allowedPanelTargets = activeTab.allowedPanelTargets;
    widget.tabs.forEach((tabId) => {
      const tab = tabsState[tabId];
      if (!allowedPanelTargets)
        allowedPanelTargets = tab.allowedPanelTargets;
      else /* istanbul ignore else */ if (tab.allowedPanelTargets !== undefined) {
        const tabPanelTargets = tab.allowedPanelTargets;
        allowedPanelTargets = allowedPanelTargets.filter((x) => tabPanelTargets.includes(x));
      }
    });
  }
  if (allowedPanelTargets) {
    return allowedPanelTargets.includes(panel.side);
  }
  return true;
}
