/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module Widget
 */

import "./FloatingWidget.scss";
import classnames from "classnames";
import * as React from "react";
import { PointProps } from "@itwin/appui-abstract";
import { CommonProps, Point, Rectangle, useRefs } from "@itwin/core-react";
import { assert } from "@itwin/core-bentley";
import { DragManagerContext, useDragResizeHandle, UseDragResizeHandleArgs, useIsDraggedItem } from "../base/DragManager";
import { MeasureContext, NineZoneDispatchContext, TabsStateContext, UiIsVisibleContext } from "../base/NineZone";
import { FloatingWidgetState, WidgetState } from "../state/WidgetState";
import { WidgetContentContainer } from "./ContentContainer";
import { WidgetTabBar } from "./TabBar";
import { Widget, WidgetComponent, WidgetProvider, WidgetStateContext } from "./Widget";
import { PointerCaptorArgs, usePointerCaptor } from "../base/PointerCaptor";
import { CssProperties } from "../utilities/Css";
import { WidgetTarget } from "../target/WidgetTarget";
import { WidgetOutline } from "../outline/WidgetOutline";
import { toolSettingsTabId } from "../state/ToolSettingsState";

type FloatingWidgetEdgeHandle = "left" | "right" | "top" | "bottom";
type FloatingWidgetCornerHandle = "topLeft" | "topRight" | "bottomLeft" | "bottomRight";

/** @internal */
export type FloatingWidgetResizeHandle = FloatingWidgetEdgeHandle | FloatingWidgetCornerHandle;

/** @internal */
export interface FloatingWidgetProps {
  floatingWidget: FloatingWidgetState;
  widget: WidgetState;
}

/** @internal */
export const FloatingWidget = React.memo<FloatingWidgetProps>(function FloatingWidget(props) { // eslint-disable-line @typescript-eslint/naming-convention, no-shadow
  const { id, bounds, userSized } = props.floatingWidget;
  const { minimized, tabs, activeTabId } = props.widget;
  const isSingleTab = 1 === tabs.length;
  const tabsState = React.useContext(TabsStateContext);
  const activeTab = tabsState[activeTabId];
  const hideWithUiWhenFloating = activeTab.hideWithUiWhenFloating;
  const uiIsVisible = React.useContext(UiIsVisibleContext);
  const autoSized = isSingleTab && !userSized;
  const style = React.useMemo(() => {
    const boundsRect = Rectangle.create(bounds);
    const { height, width } = boundsRect.getSize();
    const position = boundsRect.topLeft();
    // istanbul ignore next
    return {
      ...CssProperties.transformFromPosition(position),
      height: minimized || autoSized ? undefined : height,
      width: autoSized ? undefined : width,
      maxHeight: autoSized ? "60%" : undefined,
      maxWidth: autoSized ? "60%" : undefined,
    };
  }, [autoSized, bounds, minimized]);
  const hideFloatingWidget = !uiIsVisible && hideWithUiWhenFloating;
  const className = React.useMemo(() => classnames(
    minimized && "nz-minimized",
    hideFloatingWidget && "nz-hidden",
  ), [minimized, hideFloatingWidget]);

  return (
    <FloatingWidgetIdContext.Provider value={id}>
      <FloatingWidgetContext.Provider value={props.floatingWidget}>
        <WidgetProvider
          widget={props.widget}
        >
          <FloatingWidgetComponent
            className={className}
            style={style}
          />
        </WidgetProvider>
      </FloatingWidgetContext.Provider>
    </FloatingWidgetIdContext.Provider>
  );
});

/** @internal */
export const FloatingWidgetIdContext = React.createContext<FloatingWidgetState["id"] | undefined>(undefined); // eslint-disable-line @typescript-eslint/naming-convention
FloatingWidgetIdContext.displayName = "nz:FloatingWidgetIdContext";

/** @internal */
export const FloatingWidgetContext = React.createContext<FloatingWidgetState | undefined>(undefined); // eslint-disable-line @typescript-eslint/naming-convention
FloatingWidgetContext.displayName = "nz:FloatingWidgetContext";

const FloatingWidgetComponent = React.memo<CommonProps>(function FloatingWidgetComponent(props) { // eslint-disable-line @typescript-eslint/no-shadow, @typescript-eslint/naming-convention
  const widget = React.useContext(WidgetStateContext);
  const floatingWidgetId = React.useContext(FloatingWidgetIdContext);
  assert(!!widget);
  assert(!!floatingWidgetId);
  const item = React.useMemo(() => ({
    id: floatingWidgetId,
    type: "widget" as const,
  }), [floatingWidgetId]);
  const dragged = useIsDraggedItem(item);
  const ref = useHandleAutoSize(dragged);

  const isToolSettingsTab = widget.tabs[0] === toolSettingsTabId;
  const className = classnames(
    "nz-widget-floatingWidget",
    dragged && "nz-dragged",
    props.className,
    isToolSettingsTab && "nz-floating-toolsettings",
  );

  // never allow resizing of tool settings - always auto-fit them
  const isResizable = (undefined === widget.isFloatingStateWindowResizable || widget.isFloatingStateWindowResizable) && !isToolSettingsTab;

  return (
    <Widget
      className={className}
      widgetId={floatingWidgetId}
      style={props.style}
      ref={ref}
    >
      <WidgetTabBar separator={!widget.minimized} />
      <WidgetContentContainer>
        <WidgetTarget />
        <WidgetOutline />
      </WidgetContentContainer>
      {isResizable && <>
        <FloatingWidgetHandle handle="left" />
        <FloatingWidgetHandle handle="top" />
        <FloatingWidgetHandle handle="right" />
        <FloatingWidgetHandle handle="bottom" />
        <FloatingWidgetHandle handle="topLeft" />
        <FloatingWidgetHandle handle="topRight" />
        <FloatingWidgetHandle handle="bottomLeft" />
        <FloatingWidgetHandle handle="bottomRight" />
      </>}
    </Widget >
  );
});

// Re-adjust bounds so that widget is behind pointer when auto-sized.
// istanbul ignore next
function useHandleAutoSize(dragged: boolean) {
  const dragManager = React.useContext(DragManagerContext);
  const dispatch = React.useContext(NineZoneDispatchContext);
  const measureNz = React.useContext(MeasureContext);
  const floatingWidgetId = React.useContext(FloatingWidgetIdContext);
  assert(!!floatingWidgetId);

  const updatePosition = React.useRef(true);
  const ref = React.useRef<WidgetComponent>(null);

  React.useLayoutEffect(() => {
    if (!updatePosition.current)
      return;
    if (!dragged)
      return;
    if (!dragManager.draggedItem)
      return;
    if (!ref.current)
      return;

    let bounds = ref.current.measure();
    const nzBounds = measureNz();
    const pointerPosition = dragManager.draggedItem.info.pointerPosition;

    if (bounds.containsPoint(pointerPosition))
      return;

    // Pointer is outside of tab area. Need to re-adjust widget bounds so that tab is behind pointer
    if (pointerPosition.x > bounds.right) {
      const offset = pointerPosition.x - bounds.right + 20;
      bounds = bounds.offsetX(offset);
    }

    // Adjust bounds to be relative to 9z origin
    bounds = bounds.offset({ x: -nzBounds.left, y: -nzBounds.top });

    dispatch({
      type: "FLOATING_WIDGET_SET_BOUNDS",
      id: floatingWidgetId,
      bounds: bounds.toProps(),
    });
    updatePosition.current = false;
  }, [dragged, dragManager, dispatch, floatingWidgetId, measureNz]);
  return ref;
}

interface FloatingWidgetHandleProps {
  handle: FloatingWidgetResizeHandle;
}

const FloatingWidgetHandle = React.memo<FloatingWidgetHandleProps>(function FloatingWidgetHandle(props) { // eslint-disable-line @typescript-eslint/no-shadow, @typescript-eslint/naming-convention
  const id = React.useContext(FloatingWidgetIdContext);
  const dispatch = React.useContext(NineZoneDispatchContext);
  const { handle } = props;
  const relativePosition = React.useRef<Point>(new Point());
  assert(id !== undefined);
  const onDrag = React.useCallback<NonNullable<UseDragResizeHandleArgs["onDrag"]>>((pointerPosition) => {
    assert(!!ref.current);
    const bounds = Rectangle.create(ref.current.getBoundingClientRect());
    const newRelativePosition = bounds.topLeft().getOffsetTo(pointerPosition);
    const offset = relativePosition.current.getOffsetTo(newRelativePosition);
    const resizeBy = getResizeBy(handle, offset);
    dispatch({
      type: "FLOATING_WIDGET_RESIZE",
      id,
      resizeBy,
    });
  }, [dispatch, handle, id]);
  const handleDragStart = useDragResizeHandle({
    handle,
    widgetId: id,
    onDrag,
  });
  const handlePointerDown = React.useCallback((args: PointerCaptorArgs) => {
    assert(!!ref.current);
    const bounds = Rectangle.create(ref.current.getBoundingClientRect());
    const initialPointerPosition = new Point(args.clientX, args.clientY);
    relativePosition.current = bounds.topLeft().getOffsetTo(initialPointerPosition);
    handleDragStart({
      initialPointerPosition,
      pointerPosition: initialPointerPosition,
    });
    dispatch({
      type: "FLOATING_WIDGET_BRING_TO_FRONT",
      id,
    });
  }, [dispatch, handleDragStart, id]);
  const pointerCaptorRef = usePointerCaptor(handlePointerDown);
  const ref = React.useRef<HTMLDivElement>(null);
  const refs = useRefs(ref, pointerCaptorRef);
  const className = classnames(
    "nz-widget-floatingWidget_handle",
    `nz-${handle}`,
  );
  return (
    <div
      className={className}
      ref={refs}
    />
  );
});

/** @internal */
export function getResizeBy(handle: FloatingWidgetResizeHandle, offset: PointProps) {
  switch (handle) {
    case "left":
      return new Rectangle(-offset.x);
    case "top":
      return new Rectangle(0, -offset.y);
    case "right":
      return new Rectangle(0, 0, offset.x);
    case "bottom":
      return new Rectangle(0, 0, 0, offset.y);
    case "topLeft":
      return new Rectangle(-offset.x, -offset.y);
    case "topRight":
      return new Rectangle(0, -offset.y, offset.x);
    case "bottomLeft":
      return new Rectangle(-offset.x, 0, 0, offset.y);
    case "bottomRight":
      return new Rectangle(0, 0, offset.x, offset.y);
  }
}
