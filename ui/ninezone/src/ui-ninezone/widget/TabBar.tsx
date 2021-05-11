/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module Widget
 */

import "./TabBar.scss";
import classnames from "classnames";
import * as React from "react";
import { Point, Timer } from "@bentley/ui-core";
import { assert } from "@bentley/bentleyjs-core";
import { isTabTarget, useDragWidget, UseDragWidgetArgs } from "../base/DragManager";
import { getUniqueId, NineZoneDispatchContext } from "../base/NineZone";
import { WidgetTargetState } from "../base/NineZoneState";
import { PointerCaptorArgs, PointerCaptorEvent, usePointerCaptor } from "../base/PointerCaptor";
import { TabBarButtons } from "./Buttons";
import { FloatingWidgetIdContext } from "./FloatingWidget";
import { WidgetTabs } from "./Tabs";
import { WidgetIdContext } from "./Widget";

/** @internal */
export interface WidgetTabBarProps {
  separator?: boolean;
}

/** @internal */
export const WidgetTabBar = React.memo(function WidgetTabBar(props: WidgetTabBarProps) { // eslint-disable-line @typescript-eslint/naming-convention, no-shadow
  const dispatch = React.useContext(NineZoneDispatchContext);
  const id = React.useContext(WidgetIdContext);
  const floatingWidgetId = React.useContext(FloatingWidgetIdContext);
  const widgetId = floatingWidgetId === undefined ? id : floatingWidgetId;
  const onDrag = React.useCallback<NonNullable<UseDragWidgetArgs["onDrag"]>>((dragBy) => {
    floatingWidgetId !== undefined && dispatch({
      type: "WIDGET_DRAG",
      dragBy,
      floatingWidgetId,
    });
  }, [dispatch, floatingWidgetId]);
  const onDragEnd = React.useCallback<NonNullable<UseDragWidgetArgs["onDragEnd"]>>((dragTarget) => {
    let target: WidgetTargetState = {
      type: "floatingWidget",
    };
    if (dragTarget && isTabTarget(dragTarget)) {
      target = dragTarget;
    } else if (dragTarget) {
      target = {
        ...dragTarget,
        newWidgetId: getUniqueId(),
      };
    }
    floatingWidgetId !== undefined && dispatch({
      type: "WIDGET_DRAG_END",
      floatingWidgetId,
      target,
    });
  }, [dispatch, floatingWidgetId]);
  const handleWidgetDragStart = useDragWidget({
    widgetId,
    onDrag,
    onDragEnd,
  });
  const handleDragStart = React.useCallback((initialPointerPosition: Point) => {
    handleWidgetDragStart({
      initialPointerPosition,
    });
  }, [handleWidgetDragStart]);
  const handleTouchStart = React.useCallback(() => {
    floatingWidgetId && dispatch({
      type: "FLOATING_WIDGET_BRING_TO_FRONT",
      id: floatingWidgetId,
    });
  }, [dispatch, floatingWidgetId]);
  const ref = useDrag(handleDragStart, undefined, undefined, handleTouchStart);
  const className = classnames(
    "nz-widget-tabBar",
    props.separator && "nz-separator",
  );
  return (
    <div
      className={className}
    >
      <div
        className="nz-handle"
        ref={ref}
      />
      <WidgetTabs />
      <TabBarButtons />
    </div>
  );
});

/** Hook to control drag interactions.
 * Starts drag interaction after pointer moves or after timeout.
 * @internal
 */
export function useDrag<T extends HTMLElement>(
  onDragStart?: (initialPointerPosition: Point) => void,
  onDrag?: (position: Point) => void,
  onDragEnd?: () => void,
  onTouchStart?: () => void,
) {
  const dragStartTimer = React.useRef<Timer>(new Timer(300));
  const initialPointerPosition = React.useRef<Point>();
  const handlePointerDown = React.useCallback((args: PointerCaptorArgs, e: PointerCaptorEvent) => {
    initialPointerPosition.current = new Point(args.clientX, args.clientY);
    dragStartTimer.current.start();
    e.type === "touchstart" && onTouchStart && onTouchStart();
  }, [onTouchStart]);
  const handlePointerMove = React.useCallback((args: PointerCaptorArgs) => {
    if (initialPointerPosition.current) {
      onDragStart && onDragStart(initialPointerPosition.current);
      dragStartTimer.current.stop();
      initialPointerPosition.current = undefined;
      return;
    }
    onDrag && onDrag(new Point(args.clientX, args.clientY));
  }, [onDragStart, onDrag]);
  const handlePointerUp = React.useCallback(() => {
    dragStartTimer.current.stop();
    initialPointerPosition.current = undefined;
    onDragEnd && onDragEnd();
  }, [onDragEnd]);
  React.useEffect(() => {
    const listener = () => {
      assert(!!initialPointerPosition.current);
      onDragStart && onDragStart(initialPointerPosition.current);
      initialPointerPosition.current = undefined;
    };
    const timer = dragStartTimer.current;
    timer.setOnExecute(listener);
    return () => {
      timer.setOnExecute(undefined);
    };
  }, [onDragStart]);
  const ref = usePointerCaptor<T>(handlePointerDown, handlePointerMove, handlePointerUp);
  return ref;
}
