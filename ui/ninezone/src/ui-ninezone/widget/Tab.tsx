/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module Widget
 */

import classnames from "classnames";
import * as React from "react";
import { useResizeObserver, useRefs, Timer, Rectangle, Point } from "@bentley/ui-core";
import { NineZoneDispatchContext } from "../base/NineZone";
import { WIDGET_TAB_CLICK, WIDGET_TAB_DOUBLE_CLICK, TabState, WIDGET_TAB_DRAG_START } from "../base/NineZoneState";
import { assert } from "../base/assert";
import { usePointerCaptor } from "../base/PointerCaptor";
import { WidgetTabsEntryContext } from "./Tabs";
import { FloatingWidgetIdContext } from "./FloatingWidget";
import { WidgetStateContext, WidgetContext } from "./Widget";
import { PanelSideContext } from "../widget-panels/Panel";
import { useDragTab } from "../base/DragManager";
import "./Tab.scss";

/** Properties of [[WidgetTab]] component.
 * @internal
 */
export interface WidgetTabProps {
  tab: TabState;
  first?: boolean;
  last?: boolean;
  firstInactive?: boolean;
}

/** Component that displays a tab in a side panel widget.
 * @internal
 */
export const WidgetTab = React.memo<WidgetTabProps>(function WidgetTab(props) { // tslint:disable-line: variable-name no-shadowed-variable
  const { tab } = props;
  const { id } = tab;
  const widgetTabsEntryContext = React.useContext(WidgetTabsEntryContext);
  const dispatch = React.useContext(NineZoneDispatchContext);
  const side = React.useContext(PanelSideContext);
  const floatingWidgetId = React.useContext(FloatingWidgetIdContext);
  const widget = React.useContext(WidgetStateContext);
  const widgetContext = React.useContext(WidgetContext);
  assert(widget);
  const handleDragStart = useDragTab({
    tabId: id,
  });
  const widgetId = widget.id;
  const handleTabDragStart = React.useCallback(() => {
    assert(ref.current);
    assert(initialPointerPosition.current);
    const position = Rectangle.create(ref.current.getBoundingClientRect()).topLeft().toProps();
    const widgetSize = widgetContext.measure();
    handleDragStart({
      initialPointerPosition: initialPointerPosition.current,
      widgetSize,
    });
    dispatch({
      type: WIDGET_TAB_DRAG_START,
      floatingWidgetId,
      side,
      widgetId,
      id,
      position,
    });
    dragStartTimer.current.stop();
    initialPointerPosition.current = undefined;
  }, [dispatch, floatingWidgetId, handleDragStart, side, widgetContext, widgetId, id]);
  const handleClick = React.useCallback(() => {
    dispatch({
      type: WIDGET_TAB_CLICK,
      side,
      widgetId,
      id,
    });
  }, [dispatch, widgetId, id, side]);
  const handleDoubleClick = React.useCallback(() => {
    dispatch({
      type: WIDGET_TAB_DOUBLE_CLICK,
      side,
      widgetId,
      floatingWidgetId,
      id,
    });
  }, [dispatch, floatingWidgetId, widgetId, id, side]);
  const handlePointerDown = React.useCallback((e: PointerEvent) => {
    initialPointerPosition.current = new Point(e.clientX, e.clientY);
    dragStartTimer.current.start();
  }, []);
  const handlePointerMove = React.useCallback((e: PointerEvent) => {
    assert(initialPointerPosition.current);
    const distance = initialPointerPosition.current.getDistanceTo({ x: e.clientX, y: e.clientY });
    if (distance < 10)
      return;
    handleTabDragStart();
  }, [handleTabDragStart]);
  const handlePointerUp = React.useCallback(() => {
    clickCount.current++;
    initialPointerPosition.current = undefined;
    doubleClickTimer.current.start();
    dragStartTimer.current.stop();
  }, []);
  const resizeObserverRef = useResizeObserver<HTMLDivElement>(widgetTabsEntryContext?.onResize);
  const ref = React.useRef<HTMLDivElement>(null);
  const pointerCaptorRef = usePointerCaptor(handlePointerDown, handlePointerMove, handlePointerUp);
  const refs = useRefs<HTMLDivElement>(ref, resizeObserverRef, pointerCaptorRef);
  const dragStartTimer = React.useRef(new Timer(300));
  const doubleClickTimer = React.useRef(new Timer(300));
  const initialPointerPosition = React.useRef<Point>();
  const clickCount = React.useRef(0);

  React.useEffect(() => {
    const timer = dragStartTimer.current;
    timer.setOnExecute(handleTabDragStart);
    return () => {
      timer.setOnExecute(undefined);
    };
  }, [handleTabDragStart]);
  React.useEffect(() => {
    const handleExecute = () => {
      if (clickCount.current === 1)
        handleClick();
      else
        handleDoubleClick();
      clickCount.current = 0;
    };
    const timer = doubleClickTimer.current;
    timer.setOnExecute(handleExecute);
    return () => {
      timer.setOnExecute(undefined);
    };
  }, [handleClick, handleDoubleClick]);
  const active = widget.activeTabId === id;
  const className = classnames(
    "nz-widget-tab",
    active && "nz-active",
    !widgetTabsEntryContext && "nz-overflown",
    widget.minimized && "nz-minimized",
    props.first && "nz-first",
    props.last && "nz-last",
    props.firstInactive && "nz-first-inactive",
    widgetTabsEntryContext?.lastNotOverflown && "nz-last-not-overflown",
  );
  return (
    <div
      className={className}
      ref={refs}
    >
      <span title={tab.label}>{tab.label}</span>
      {!widgetTabsEntryContext && <div className="nz-icon" />}
    </div>
  );
});
