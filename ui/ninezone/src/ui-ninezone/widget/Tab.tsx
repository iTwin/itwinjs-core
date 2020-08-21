/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module Widget
 */

import "./Tab.scss";
import classnames from "classnames";
import * as React from "react";
import { Point, Rectangle, Timer, useRefs, useResizeObserver } from "@bentley/ui-core";
import { assert } from "../base/assert";
import { useDragTab } from "../base/DragManager";
import { MeasureContext, NineZoneDispatchContext } from "../base/NineZone";
import { TabState } from "../base/NineZoneState";
import { PointerCaptorArgs, PointerCaptorEvent, usePointerCaptor } from "../base/PointerCaptor";
import { PanelSideContext } from "../widget-panels/Panel";
import { FloatingWidgetIdContext } from "./FloatingWidget";
import { WidgetTabsEntryContext } from "./Tabs";
import { restrainInitialWidgetSize, WidgetContext, WidgetStateContext } from "./Widget";
import { WidgetOverflowContext } from "./Overflow";

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
export const WidgetTab = React.memo<WidgetTabProps>(function WidgetTab(props) { // eslint-disable-line @typescript-eslint/naming-convention, no-shadow
  const { tab } = props;
  const { id } = tab;
  const widgetTabsEntryContext = React.useContext(WidgetTabsEntryContext);
  const overflowContext = React.useContext(WidgetOverflowContext);
  const dispatch = React.useContext(NineZoneDispatchContext);
  const side = React.useContext(PanelSideContext);
  const floatingWidgetId = React.useContext(FloatingWidgetIdContext);
  const widget = React.useContext(WidgetStateContext);
  const widgetContext = React.useContext(WidgetContext);
  const measure = React.useContext(MeasureContext);
  assert(widget);
  const handleDragStart = useDragTab({
    tabId: id,
  });
  const widgetId = widget.id;
  const handleTabDragStart = React.useCallback(() => {
    assert(ref.current);
    assert(initialPointerPosition.current);
    const nzBounds = measure();
    let bounds = Rectangle.create(ref.current.getBoundingClientRect());
    bounds = bounds.offset({ x: -nzBounds.left, y: -nzBounds.top });
    const position = bounds.topLeft();
    const size = widgetContext.measure();
    const widgetSize = restrainInitialWidgetSize(size, nzBounds.getSize());
    overflowContext && overflowContext.close();
    handleDragStart({
      initialPointerPosition: initialPointerPosition.current,
      widgetSize,
    });
    dispatch({
      type: "WIDGET_TAB_DRAG_START",
      floatingWidgetId,
      side,
      widgetId,
      id,
      position,
    });
    dragStartTimer.current.stop();
    initialPointerPosition.current = undefined;
  }, [dispatch, floatingWidgetId, handleDragStart, measure, side, widgetContext, widgetId, id, overflowContext]);
  const handleClick = React.useCallback(() => {
    overflowContext && overflowContext.close();
    dispatch({
      type: "WIDGET_TAB_CLICK",
      side,
      widgetId,
      id,
    });
  }, [dispatch, widgetId, id, side, overflowContext]);
  const handleDoubleClick = React.useCallback(() => {
    overflowContext && overflowContext.close();
    dispatch({
      type: "WIDGET_TAB_DOUBLE_CLICK",
      side,
      widgetId,
      floatingWidgetId,
      id,
    });
  }, [dispatch, floatingWidgetId, widgetId, id, side, overflowContext]);
  const handlePointerDown = React.useCallback((args: PointerCaptorArgs, e: PointerCaptorEvent) => {
    initialPointerPosition.current = new Point(args.clientX, args.clientY);
    dragStartTimer.current.start();
    e.type === "touchstart" && floatingWidgetId && dispatch({
      type: "FLOATING_WIDGET_BRING_TO_FRONT",
      id: floatingWidgetId,
    });
  }, [dispatch, floatingWidgetId]);
  const handlePointerMove = React.useCallback((args: PointerCaptorArgs) => {
    if (!initialPointerPosition.current)
      return;
    const distance = initialPointerPosition.current.getDistanceTo({ x: args.clientX, y: args.clientY });
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
      role="tab"
    >
      <span title={tab.label}>{tab.label}</span>
      {!widgetTabsEntryContext && <div className="nz-icon" />}
    </div>
  );
});
