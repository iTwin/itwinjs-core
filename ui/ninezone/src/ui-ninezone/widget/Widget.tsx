/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module Widget
 */

import "./Widget.scss";
import classnames from "classnames";
import * as React from "react";
import { CommonProps, Rectangle, SizeProps } from "@bentley/ui-core";
import { assert } from "../base/assert";
import { useDragWidget, UseDragWidgetArgs } from "../base/DragManager";
import { getUniqueId, MeasureContext, NineZoneDispatchContext } from "../base/NineZone";
import { WidgetState } from "../base/NineZoneState";
import { PanelSideContext } from "../widget-panels/Panel";
import { FloatingWidgetIdContext } from "./FloatingWidget";

/** @internal */
export interface WidgetProviderProps {
  widget: WidgetState;
  children?: React.ReactNode;
}

/** @internal */
export const WidgetProvider = React.memo<WidgetProviderProps>(function WidgetProvider(props) { // tslint:disable-line: variable-name no-shadowed-variable
  return (
    <WidgetStateContext.Provider value={props.widget}>
      <WidgetIdContext.Provider value={props.widget.id}>
        <ActiveTabIdContext.Provider value={props.widget.activeTabId}>
          {props.children}
        </ActiveTabIdContext.Provider>
      </WidgetIdContext.Provider>
    </WidgetStateContext.Provider>
  );
});

/** @internal */
export interface WidgetProps extends CommonProps {
  children?: React.ReactNode;
}

/** @internal */
export const Widget = React.memo<WidgetProps>(function Widget(props) { // tslint:disable-line: variable-name no-shadowed-variable
  const dispatch = React.useContext(NineZoneDispatchContext);
  const side = React.useContext(PanelSideContext);
  const id = React.useContext(WidgetIdContext);
  assert(id !== undefined);
  const floatingWidgetId = React.useContext(FloatingWidgetIdContext);
  const measureNz = React.useContext(MeasureContext);
  const ref = React.useRef<HTMLDivElement>(null);
  const widgetId = floatingWidgetId === undefined ? id : floatingWidgetId;
  const onDragStart = React.useCallback<NonNullable<UseDragWidgetArgs["onDragStart"]>>((updateId, initialPointerPosition) => {
    assert(ref.current);
    if (floatingWidgetId !== undefined)
      return;
    const nzBounds = measureNz();
    const bounds = Rectangle.create(ref.current.getBoundingClientRect());

    const size = restrainInitialWidgetSize(bounds.getSize(), nzBounds.getSize());
    let adjustedBounds = bounds.setSize(size);

    // Pointer is outside of tab area. Need to re-adjust widget bounds so that tab is behind pointer
    if (initialPointerPosition.x > adjustedBounds.right) {
      const offset = initialPointerPosition.x - adjustedBounds.right + 20;
      adjustedBounds = adjustedBounds.offsetX(offset);
    }

    // Adjust bounds to be relative to 9z origin
    adjustedBounds = adjustedBounds.offset({ x: -nzBounds.left, y: -nzBounds.top });

    const newFloatingWidgetId = getUniqueId();
    updateId(newFloatingWidgetId);
    side && dispatch({
      type: "PANEL_WIDGET_DRAG_START",
      newFloatingWidgetId,
      id,
      bounds: adjustedBounds.toProps(),
      side,
    });
  }, [dispatch, floatingWidgetId, id, side, measureNz]);
  useDragWidget({
    widgetId,
    onDragStart,
  });
  React.useEffect(() => {
    const listener = () => {
      floatingWidgetId && dispatch({
        type: "FLOATING_WIDGET_BRING_TO_FRONT",
        id: floatingWidgetId,
      });
    };
    const element = ref.current!;
    element.addEventListener("click", listener);
    return () => {
      element.removeEventListener("click", listener);
    };
  }, [dispatch, floatingWidgetId]);
  const measure = React.useCallback<WidgetContextArgs["measure"]>(() => {
    const bounds = ref.current!.getBoundingClientRect();
    return bounds;
  }, []);
  const widgetContextValue = React.useMemo<WidgetContextArgs>(() => ({
    measure,
  }), [measure]);
  const className = classnames(
    "nz-widget-widget",
    props.className,
  );
  return (
    <WidgetContext.Provider value={widgetContextValue}>
      <div
        className={className}
        ref={ref}
        style={props.style}
      >
        {props.children}
      </div>
    </WidgetContext.Provider>
  );
});

/** @internal */
export const WidgetIdContext = React.createContext<WidgetState["id"] | undefined>(undefined); // tslint:disable-line: variable-name
WidgetIdContext.displayName = "nz:WidgetIdContext";

/** @internal */
export const WidgetStateContext = React.createContext<WidgetState | undefined>(undefined); // tslint:disable-line: variable-name
WidgetStateContext.displayName = "nz:WidgetStateContext";

/** @internal */
export const ActiveTabIdContext = React.createContext<WidgetState["activeTabId"]>(undefined); // tslint:disable-line: variable-name
ActiveTabIdContext.displayName = "nz:ActiveTabIdContext";

/** @internal */
export interface WidgetContextArgs {
  measure: () => SizeProps;
}

/** @internal */
export const WidgetContext = React.createContext<WidgetContextArgs>(null!); // tslint:disable-line: variable-name
WidgetContext.displayName = "nz:WidgetContext";

const minWidth = 200;
const minHeight = 200;

/** @internal */
export function restrainInitialWidgetSize(size: SizeProps, nzSize: SizeProps): SizeProps {
  const width = Math.max(Math.min(nzSize.width / 3, size.width), minWidth);
  const height = Math.max(Math.min(nzSize.height / 3, size.height), minHeight);
  return {
    width,
    height,
  };
}
