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
import { CommonProps, Icon, Point, Rectangle, Timer, useRefs, useResizeObserver } from "@itwin/core-react";
import { assert } from "@itwin/core-bentley";
import { useDragTab } from "../base/DragManager";
import { MeasureContext, NineZoneDispatchContext, ShowWidgetIconContext, TabNodeContext } from "../base/NineZone";
import { TabState } from "../state/TabState";
import { PointerCaptorArgs, PointerCaptorEvent, usePointerCaptor } from "../base/PointerCaptor";
import { PanelSideContext } from "../widget-panels/Panel";
import { FloatingWidgetIdContext } from "./FloatingWidget";
import { WidgetTabsEntryContext } from "./Tabs";
import { ActiveTabIdContext, restrainInitialWidgetSize, WidgetContext, WidgetStateContext } from "./Widget";
import { TabIdContext } from "./ContentRenderer";
import { TabTarget } from "../target/TabTarget";
import { WidgetMenuTab } from "./MenuTab";
import { WidgetOverflowContext } from "./Overflow";

/** @internal */
export interface WidgetTabProviderProps extends TabPositionContextArgs {
  tab: TabState;
  showOnlyTabIcon?: boolean;
}

/** @internal */
export function WidgetTabProvider({ tab, first, firstInactive, last, showOnlyTabIcon }: WidgetTabProviderProps) {
  const tabNode = React.useContext(TabNodeContext);
  const position = React.useMemo<TabPositionContextArgs>(() => ({
    first,
    firstInactive,
    last,
  }), [first, firstInactive, last]);
  return (
    <TabIdContext.Provider value={tab.id}>
      <TabStateContext.Provider value={tab}>
        <TabPositionContext.Provider value={position}>
          <IconOnlyOnWidgetTabContext.Provider value={!!showOnlyTabIcon}>
            {tabNode}
          </IconOnlyOnWidgetTabContext.Provider>
        </TabPositionContext.Provider>
      </TabStateContext.Provider>
    </TabIdContext.Provider>
  );
}

/** Properties of [[WidgetTab]] component.
 * @internal
 */
export interface WidgetTabProps extends CommonProps {
  badge?: React.ReactNode;
}

/** Component that displays a tab in a side panel widget.
 * @internal
 */
export const WidgetTab = React.memo<WidgetTabProps>(function WidgetTab(props) { // eslint-disable-line @typescript-eslint/naming-convention, no-shadow
  const widgetOverflow = React.useContext(WidgetOverflowContext);
  const overflown = !!widgetOverflow;
  if (overflown)
    return <WidgetMenuTab {...props} />;
  return <WidgetTabComponent {...props} />;
});

const WidgetTabComponent = React.memo<WidgetTabProps>(function WidgetTabComponent(props) { // eslint-disable-line @typescript-eslint/naming-convention, no-shadow
  const tab = React.useContext(TabStateContext);
  const { first, firstInactive, last } = React.useContext(TabPositionContext);
  const widgetTabsEntryContext = React.useContext(WidgetTabsEntryContext);
  const side = React.useContext(PanelSideContext);
  const widget = React.useContext(WidgetStateContext);
  assert(!!widget);
  const activeTabId = React.useContext(ActiveTabIdContext);

  const resizeObserverRef = useResizeObserver<HTMLDivElement>(widgetTabsEntryContext?.onResize);
  const pointerCaptorRef = useTabInteractions({});
  const refs = useRefs<HTMLDivElement>(resizeObserverRef, pointerCaptorRef);

  const active = activeTabId === tab.id;
  const className = classnames(
    "nz-widget-tab",
    active && "nz-active",
    undefined === side && widget.minimized && "nz-minimized",
    first && "nz-first",
    last && "nz-last",
    firstInactive && "nz-first-inactive",
    props.className,
  );

  const showIconOnly = React.useContext(IconOnlyOnWidgetTabContext);
  const showWidgetIcon = React.useContext(ShowWidgetIconContext);
  const showLabel = (showIconOnly && !tab.iconSpec) || (showWidgetIcon && !showIconOnly) || !showWidgetIcon;
  return (
    <div
      data-item-id={tab.id}
      data-item-type="widget-tab"
      className={className}
      ref={refs}
      role="tab"
      style={props.style}
      title={tab.label}
    >
      {(showWidgetIcon || showIconOnly) && tab.iconSpec && <Icon iconSpec={tab.iconSpec} />}
      {showLabel && <span>{tab.label}</span>}
      {props.badge && <div className="nz-badge">
        {props.badge}
      </div>}
      <TabTarget />
    </div>
  );
});

/** @internal */
export interface UseTabInteractionsArgs {
  onClick?: () => void;
  onDoubleClick?: () => void;
  onDragStart?: () => void;
}

/** @internal */
export function useTabInteractions<T extends HTMLElement>({
  onClick,
  onDoubleClick,
  onDragStart,
}: UseTabInteractionsArgs) {
  const tab = React.useContext(TabStateContext);
  const widgetContext = React.useContext(WidgetContext);
  const measure = React.useContext(MeasureContext);
  const dispatch = React.useContext(NineZoneDispatchContext);
  const side = React.useContext(PanelSideContext);
  const floatingWidgetId = React.useContext(FloatingWidgetIdContext);
  const widget = React.useContext(WidgetStateContext);
  assert(!!widget);
  const widgetTabsEntryContext = React.useContext(WidgetTabsEntryContext);

  const clickCount = React.useRef(0);
  const doubleClickTimer = React.useRef(new Timer(300));
  const initialPointerPosition = React.useRef<Point>();

  const { id } = tab;
  const { id: widgetId } = widget;
  const overflown = !widgetTabsEntryContext;

  const handleClick = React.useCallback(() => {
    dispatch({
      type: "WIDGET_TAB_CLICK",
      side,
      widgetId,
      id,
    });
    onClick?.();
  }, [dispatch, widgetId, id, side, onClick]);
  const handleDoubleClick = React.useCallback(() => {
    dispatch({
      type: "WIDGET_TAB_DOUBLE_CLICK",
      side,
      widgetId,
      floatingWidgetId,
      id,
    });
    onDoubleClick?.();
  }, [dispatch, floatingWidgetId, widgetId, id, side, onDoubleClick]);

  const handleDragTabStart = useDragTab({
    tabId: id,
  });
  const handleDragStart = React.useCallback((pointerPosition: Point) => {
    assert(!!ref.current);
    assert(!!initialPointerPosition.current);
    const nzBounds = measure();
    const nzOffset = new Point(-nzBounds.left, -nzBounds.top);
    let bounds = Rectangle.create(ref.current.getBoundingClientRect());
    bounds = bounds.offset(nzOffset);
    const userSized = tab.userSized || (tab.isFloatingStateWindowResizable && /* istanbul ignore next */ !!tab.preferredFloatingWidgetSize);
    let position = bounds.topLeft();
    const widgetBounds = widgetContext.measure();
    const widgetSize = restrainInitialWidgetSize(widgetBounds.getSize(), nzBounds.getSize());
    if (overflown) {
      position = initialPointerPosition.current.offset(nzOffset);
      position = position.offset({ x: -7, y: -7 });
    }

    const dragOffset = initialPointerPosition.current.getOffsetTo(pointerPosition);
    position = position.offset(dragOffset);

    handleDragTabStart({
      initialPointerPosition: Point.create(initialPointerPosition.current),
      pointerPosition,
      widgetSize,
    });
    dispatch({
      type: "WIDGET_TAB_DRAG_START",
      floatingWidgetId,
      side,
      widgetId,
      id,
      position,
      userSized,
    });
    onDragStart?.();

    initialPointerPosition.current = undefined;
  }, [measure, tab.userSized, tab.isFloatingStateWindowResizable, tab.preferredFloatingWidgetSize, widgetContext, handleDragTabStart, dispatch, floatingWidgetId, side, widgetId, id, onDragStart, overflown]);
  const handlePointerDown = React.useCallback((args: PointerCaptorArgs, e: PointerCaptorEvent) => {
    e.type === "touchstart" && floatingWidgetId && dispatch({
      type: "FLOATING_WIDGET_BRING_TO_FRONT",
      id: floatingWidgetId,
    });

    initialPointerPosition.current = new Point(args.clientX, args.clientY);
  }, [dispatch, floatingWidgetId]);
  const handlePointerMove = React.useCallback((args: PointerCaptorArgs) => {
    // istanbul ignore next
    if (!initialPointerPosition.current)
      return;

    const pointerPosition = new Point(args.clientX, args.clientY);
    const distance = initialPointerPosition.current.getDistanceTo(pointerPosition);
    if (distance < 10)
      return;
    handleDragStart(pointerPosition);
  }, [handleDragStart]);
  const handlePointerUp = React.useCallback(() => {
    clickCount.current++;
    initialPointerPosition.current = undefined;
    doubleClickTimer.current.start();
  }, []);

  const pointerCaptorRef = usePointerCaptor<T>(handlePointerDown, handlePointerMove, handlePointerUp);
  const ref = React.useRef<T>();
  const refs = useRefs(pointerCaptorRef, ref);

  React.useEffect(() => {
    const timer = doubleClickTimer.current;
    timer.setOnExecute(() => {
      if (clickCount.current === 1)
        handleClick();
      else
        handleDoubleClick();
      clickCount.current = 0;
    });
    return () => {
      timer.setOnExecute(undefined);
    };
  }, [handleClick, handleDoubleClick]);
  return refs;
}

/** @internal */
export interface TabPositionContextArgs {
  first?: boolean;
  last?: boolean;
  firstInactive?: boolean;
}

/** @internal */
export const TabPositionContext = React.createContext<TabPositionContextArgs>(undefined!);
TabPositionContext.displayName = "nz:TabPositionContext";

/** @internal */
export const TabStateContext = React.createContext<TabState>(undefined!);
TabStateContext.displayName = "nz:TabStateContext";

/** @internal */
export const IconOnlyOnWidgetTabContext = React.createContext<boolean>(false);
IconOnlyOnWidgetTabContext.displayName = "nz:IconOnlyOnWidgetTabContext";
