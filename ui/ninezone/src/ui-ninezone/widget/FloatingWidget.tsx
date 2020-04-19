/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module Widget
 */

import * as React from "react";
import classnames from "classnames";
import { Rectangle, CommonProps, Point, PointProps } from "@bentley/ui-core";
import { Widget, WidgetProvider } from "./Widget";
import { FloatingWidgetState, WidgetState, FLOATING_WIDGET_RESIZE } from "../base/NineZoneState";
import { WidgetTitleBar } from "./TitleBar";
import { assert } from "../base/assert";
import { useIsDraggedItem, useDragResizeHandle, UseDragResizeHandleArgs } from "../base/DragManager";
import { NineZoneDispatchContext } from "../base/NineZone";
import { WidgetContentContainer } from "./ContentContainer";
import "./FloatingWidget.scss";

/** @internal */
export type FloatingWidgetResizeHandle = "left" | "right" | "top" | "bottom";

/** @internal */
export interface FloatingWidgetProps {
  floatingWidget: FloatingWidgetState;
  widget: WidgetState;
}

/** @internal */
export const FloatingWidget = React.memo<FloatingWidgetProps>(function FloatingWidget(props) { // tslint:disable-line: variable-name no-shadowed-variable
  const { id, bounds } = props.floatingWidget;
  const { minimized } = props.widget;
  const style = React.useMemo(() => {
    const { left, top } = bounds;
    const boundsRect = Rectangle.create(bounds);
    const height = boundsRect.getHeight();
    const width = boundsRect.getWidth();
    return {
      height: minimized ? undefined : height,
      width,
      left,
      top,
    };
  }, [bounds, minimized]);
  const className = React.useMemo(() => classnames(
    minimized && "nz-minimized",
  ), [minimized]);
  return (
    <FloatingWidgetIdContext.Provider value={id}>
      <WidgetProvider
        widget={props.widget}
      >
        <FloatingWidgetComponent
          className={className}
          style={style}
        />
      </WidgetProvider>
    </FloatingWidgetIdContext.Provider>
  );
});

/** @internal */
export const FloatingWidgetIdContext = React.createContext<FloatingWidgetState["id"] | undefined>(undefined); // tslint:disable-line: variable-name
FloatingWidgetIdContext.displayName = "nz:FloatingWidgetIdContext";

const FloatingWidgetComponent = React.memo<CommonProps>(function FloatingWidgetComponent(props) { // tslint:disable-line: no-shadowed-variable variable-name
  const floatingWidgetId = React.useContext(FloatingWidgetIdContext);
  assert(floatingWidgetId);
  const dragged = useIsDraggedItem({
    id: floatingWidgetId,
    type: "widget",
  });
  const className = classnames(
    "nz-widget-floatingWidget",
    dragged && "nz-dragged",
    props.className,
  );
  return (
    <Widget
      className={className}
      style={props.style}
    >
      <WidgetTitleBar />
      <WidgetContentContainer />
      <FloatingWidgetHandle handle="left" />
      <FloatingWidgetHandle handle="top" />
      <FloatingWidgetHandle handle="right" />
      <FloatingWidgetHandle handle="bottom" />
    </Widget>
  );
});

interface FloatingWidgetHandleProps {
  handle: FloatingWidgetResizeHandle;
}

const FloatingWidgetHandle = React.memo<FloatingWidgetHandleProps>(function FloatingWidgetHandle(props) { // tslint:disable-line: no-shadowed-variable variable-name
  const id = React.useContext(FloatingWidgetIdContext);
  assert(id !== undefined);
  const { handle } = props;
  const relativePosition = React.useRef<Point>(new Point());
  const dispatch = React.useContext(NineZoneDispatchContext);

  const onDrag = React.useCallback<NonNullable<UseDragResizeHandleArgs["onDrag"]>>((pointerPosition) => {
    assert(ref.current);
    const bounds = Rectangle.create(ref.current.getBoundingClientRect());
    const newRelativePosition = bounds.topLeft().getOffsetTo(pointerPosition);
    const offset = relativePosition.current.getOffsetTo(newRelativePosition);
    const resizeBy = getResizeBy(handle, offset);
    dispatch({
      type: FLOATING_WIDGET_RESIZE,
      id,
      resizeBy,
    });
  }, [dispatch, handle, id]);
  const handleDragStart = useDragResizeHandle({
    handle,
    widgetId: id,
    onDrag,
  });
  const handlePointerDown = React.useCallback((e: React.PointerEvent) => {
    e.preventDefault();
    assert(ref.current);
    const bounds = Rectangle.create(ref.current.getBoundingClientRect());
    const initialPointerPosition = new Point(e.clientX, e.clientY);
    relativePosition.current = bounds.topLeft().getOffsetTo(initialPointerPosition);
    handleDragStart({
      initialPointerPosition,
    });
  }, [handleDragStart]);
  const ref = React.useRef<HTMLDivElement>(null);
  const className = classnames(
    "nz-widget-floatingWidget_handle",
    `nz-${handle}`,
  );
  return (
    <div
      className={className}
      onPointerDown={handlePointerDown}
      ref={ref}
    />
  );
});

/** @internal */
export function getResizeBy(handle: FloatingWidgetResizeHandle, offset: PointProps) {
  if (handle === "left") {
    return new Rectangle(-offset.x);
  } else if (handle === "top") {
    return new Rectangle(0, -offset.y);
  } else if (handle === "right") {
    return new Rectangle(0, 0, offset.x);
  }
  return new Rectangle(0, 0, 0, offset.y);
}
