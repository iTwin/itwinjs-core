/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module Widget
 */

import "./FloatingTab.scss";
import classnames from "classnames";
import * as React from "react";
import { isTabTarget, useDragTab, UseDragTabArgs } from "../base/DragManager";
import { DraggedTabStateContext, getUniqueId, NineZoneDispatchContext, TabsStateContext } from "../base/NineZone";
import { TabTargetState } from "../base/NineZoneState";
import { CssProperties } from "../utilities/Css";

/** Component that displays a floating tab.
 * @internal
 */
export function FloatingTab() {
  const draggedTab = React.useContext(DraggedTabStateContext);
  const tabs = React.useContext(TabsStateContext);
  const dispatch = React.useContext(NineZoneDispatchContext);
  const id = draggedTab?.tabId;
  const onDrag = React.useCallback<NonNullable<UseDragTabArgs["onDrag"]>>((dragBy) => {
    id && dispatch({
      type: "WIDGET_TAB_DRAG",
      dragBy,
    });
  }, [dispatch, id]);
  const onDragEnd = React.useCallback<NonNullable<UseDragTabArgs["onDragEnd"]>>((dragTarget, size) => {
    let target: TabTargetState;
    if (dragTarget && isTabTarget(dragTarget)) {
      target = {
        ...dragTarget,
      };
    } else if (dragTarget) {
      target = {
        ...dragTarget,
        newWidgetId: getUniqueId(),
      };
    } else {
      target = {
        type: "floatingWidget",
        newFloatingWidgetId: getUniqueId(),
        size,
      };
    }
    id && dispatch({
      type: "WIDGET_TAB_DRAG_END",
      id,
      target,
    });
  }, [dispatch, id]);
  useDragTab({
    tabId: id || "",
    onDrag,
    onDragEnd,
  });
  const style = draggedTab && CssProperties.transformFromPosition(draggedTab.position);
  const className = classnames(
    "nz-widget-floatingTab",
    !draggedTab && "nz-hidden",
  );
  return (
    <div
      className={className}
      style={style}
    >
      <span>{id && tabs[id].label}</span>
    </div>
  );
}
