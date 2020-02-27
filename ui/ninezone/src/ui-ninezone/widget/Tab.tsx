/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module Widget
 */

import * as classnames from "classnames";
import * as React from "react";
import { CommonProps } from "@bentley/ui-core";
import { useResizeObserver } from "../base/useResizeObserver";
import { useSingleDoubleClick } from "../base/useSingleDoubleClick";
import { useRefs } from "../base/useRefs";
import { useWidgetTab } from "./Tabs";
import { useNineZoneDispatch, WIDGET_TAB_CLICK, WIDGET_TAB_DOUBLE_CLICK, useWidget, TabState, useTabById } from "../base/NineZone";
import { useWidgetPanelSide } from "../widget-panels/Panel";
import "./Tab.scss";

/** Properties of [[WidgetTab]] component.
 * @internal future
 */
export interface WidgetTabProps extends CommonProps {
  id: TabState["id"];
}

/** Component that displays a tab in a side panel widget.
 * @internal future
 */
export function WidgetTab(props: WidgetTabProps) {
  const { isOverflown, onResize } = useWidgetTab();
  const dispatch = useNineZoneDispatch();
  const side = useWidgetPanelSide();
  const widget = useWidget();
  const tab = useTabById(props.id);
  const resizeObserverRef = useResizeObserver<HTMLDivElement>(onResize);
  const handleClick = React.useCallback(() => {
    dispatch({
      type: WIDGET_TAB_CLICK,
      side,
      widgetId: widget.id,
      id: tab.id,
    });
  }, [dispatch, widget, tab, side]);
  const handleDoubleClick = React.useCallback(() => {
    dispatch({
      type: WIDGET_TAB_DOUBLE_CLICK,
      side,
      widgetId: widget.id,
      id: tab.id,
    });
  }, [dispatch, widget, tab, side]);
  const doubleClickRef = useSingleDoubleClick<HTMLDivElement>(handleClick, handleDoubleClick);
  const refs = useRefs<HTMLDivElement>(resizeObserverRef, doubleClickRef);
  const active = widget.activeTabId === props.id;
  const className = classnames(
    "nz-widget-tab",
    active && "nz-active",
    isOverflown && "nz-overflown",
    widget.minimized && "nz-minimized",
    props.className,
  );
  return (
    <div
      className={className}
      ref={refs}
      style={props.style}
    >
      <span>{tab.label}</span>
      {isOverflown && <div className="nz-icon" />}
    </div>
  );
}
