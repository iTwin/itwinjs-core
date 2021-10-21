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
import { Point, Timer } from "@itwin/core-react";
import { assert } from "@itwin/core-bentley";
import { isTabTarget, useDragWidget, UseDragWidgetArgs } from "../base/DragManager";
import { getUniqueId, NineZoneDispatchContext } from "../base/NineZone";
import { WidgetTargetState } from "../base/NineZoneState";
import { PointerCaptorArgs, PointerCaptorEvent, usePointerCaptor } from "../base/PointerCaptor";
import { TabBarButtons } from "./Buttons";
import { FloatingWidgetIdContext } from "./FloatingWidget";
import { WidgetTabs } from "./Tabs";
import { WidgetIdContext } from "./Widget";
import { useDoubleClick } from "../widget-panels/Grip";

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
  const handleDoubleClick = React.useCallback(() => {
    floatingWidgetId && dispatch({
      type: "FLOATING_WIDGET_CLEAR_USER_SIZED",
      id: floatingWidgetId,
    });
  }, [dispatch, floatingWidgetId]);
  const handleActionAreaClick = useDoubleClick(handleDoubleClick);

  const onDrag = React.useCallback<NonNullable<UseDragWidgetArgs["onDrag"]>>((dragBy) => {
    floatingWidgetId !== undefined && dispatch({
      type: "WIDGET_DRAG",
      dragBy,
      floatingWidgetId,
    });
  }, [dispatch, floatingWidgetId]);
  const onDragEnd = React.useCallback<NonNullable<UseDragWidgetArgs["onDragEnd"]>>((dragTarget) => {
    floatingWidgetId !== undefined && handleActionAreaClick();

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
  }, [dispatch, floatingWidgetId, handleActionAreaClick]);
  const handleWidgetDragStart = useDragWidget({
    widgetId,
    onDrag,
    onDragEnd,
  });

  const containerRef = React.useRef<HTMLDivElement>(null);
  const handleDragStart = React.useCallback((initialPointerPosition: Point) => {
    /* if floating widget extract the bounding rect and update state in case bounds are set by content.
      This is needed so the drag operation can keep widget inside ninezone container. */
    if (floatingWidgetId) {
      // istanbul ignore next
      const containerRect = containerRef.current?.closest(".nz-widget-floatingWidget")?.getBoundingClientRect();
      // istanbul ignore else
      if (containerRect) {
        dispatch({
          type: "FLOATING_WIDGET_SET_BOUNDS",
          id: floatingWidgetId,
          bounds: { left: containerRect.left, top: containerRect.top, right: containerRect.right, bottom: containerRect.bottom },
        });
      }
    }
    handleWidgetDragStart({
      initialPointerPosition,
    });
  }, [dispatch, floatingWidgetId, handleWidgetDragStart]);
  const handleTouchStart = React.useCallback(() => {
    floatingWidgetId && dispatch({
      type: "FLOATING_WIDGET_BRING_TO_FRONT",
      id: floatingWidgetId,
    });
  }, [dispatch, floatingWidgetId]);
  const ref = useDrag(handleDragStart, undefined, undefined, handleTouchStart, handleDoubleClick);
  const className = classnames(
    "nz-widget-tabBar",
    props.separator && "nz-separator",
  );

  return (
    <div ref={containerRef}
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
  onDoubleClick?: () => void,
) {
  const doubleClickTimer = React.useRef(new Timer(300));
  const clickCount = React.useRef(0);
  const dragStartTimer = React.useRef<Timer>(new Timer(300));
  const initialPointerPosition = React.useRef<Point>();

  React.useEffect(() => {
    const handleExecute = () => {
      // istanbul ignore else
      if (clickCount.current === 2)
        onDoubleClick && onDoubleClick();
      clickCount.current = 0;
    };
    const timer = doubleClickTimer.current;
    timer.setOnExecute(handleExecute);
    return () => {
      timer.setOnExecute(undefined);
    };
  }, [onDoubleClick]);

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
    clickCount.current++;
    doubleClickTimer.current.start();
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
