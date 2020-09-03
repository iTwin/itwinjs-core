/*---------------------------------------------------------------------------------------------
* Copyright (c) 2019 Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module WidgetPanels
 */

import "./Panel.scss";
import classnames from "classnames";
import * as React from "react";
import { DraggedPanelSideContext } from "../base/DragManager";
import { NineZoneDispatchContext } from "../base/NineZone";
import { isHorizontalPanelState, PanelState } from "../base/NineZoneState";
import { PanelWidget } from "../widget/PanelWidget";
import { WidgetTarget } from "../widget/WidgetTarget";
import { WidgetPanelGrip } from "./Grip";
import { PanelTarget } from "./PanelTarget";
import { RectangleProps } from "@bentley/ui-core";
import { assert } from "../base/assert";

/** @internal */
export type TopPanelSide = "top";

/** @internal */
export type BottomPanelSide = "bottom";

/** @internal */
export type LeftPanelSide = "left";

/** @internal */
export type RightPanelSide = "right";

/** @internal */
export type HorizontalPanelSide = TopPanelSide | BottomPanelSide;

/** @internal */
export type VerticalPanelSide = LeftPanelSide | RightPanelSide;

/** @internal future */
export type PanelSide = VerticalPanelSide | HorizontalPanelSide;

/** Properties of [[WidgetPanel]] component.
 * @internal
 */
export interface WidgetPanelProps {
  panel: PanelState;
  spanBottom?: boolean;
  spanTop?: boolean;
}

/** Widget panel component is a side panel with multiple widgets.
 * @internal
 */
export const WidgetPanel = React.memo<WidgetPanelProps>(function WidgetPanel(props) { // eslint-disable-line @typescript-eslint/naming-convention, no-shadow
  return (
    <PanelStateContext.Provider value={props.panel}>
      <PanelSideContext.Provider value={props.panel.side}>
        <PanelPinnedContext.Provider value={props.panel.pinned}>
          <PanelSpanContext.Provider value={isHorizontalPanelState(props.panel) ? props.panel.span : undefined}>
            <WidgetPanelComponent
              panel={props.panel}
              spanTop={props.spanTop}
              spanBottom={props.spanBottom}
            />
          </PanelSpanContext.Provider>
        </PanelPinnedContext.Provider>
      </PanelSideContext.Provider>
    </PanelStateContext.Provider>
  );
});

/** @internal */
export interface WidgetPanelComponentProps {
  panel: PanelState;
  spanBottom?: boolean;
  spanTop?: boolean;
}

/** @internal */
export const WidgetPanelComponent = React.memo<WidgetPanelComponentProps>(function WidgetPanelComponent(props) { // eslint-disable-line @typescript-eslint/naming-convention, no-shadow
  const draggedPanelSide = React.useContext(DraggedPanelSideContext);
  const dispatch = React.useContext(NineZoneDispatchContext);
  const captured = draggedPanelSide === props.panel.side;
  const { panel } = props;
  const horizontalPanel = isHorizontalPanelState(panel) ? panel : undefined;
  const [transition, setTransition] = React.useState<"prepared" | "transitioning">();
  const [size, setSize] = React.useState<number | undefined>(panel.size);
  const mounted = React.useRef<boolean>(false);
  const style = React.useMemo(() => {
    if (size === undefined)
      return undefined;
    const s: React.CSSProperties = {};
    if (isHorizontalPanelSide(panel.side)) {
      s.height = `${size}px`;
    } else {
      s.width = `${size}px`;
    }
    return s;
  }, [size, panel.side]);
  const contentStyle = React.useMemo(() => {
    if (size === undefined)
      return undefined;
    const s: React.CSSProperties = {};
    if (isHorizontalPanelSide(panel.side)) {
      s.height = `${panel.size}px`;
    } else {
      s.width = `${panel.size}px`;
    }
    return s;
  }, [panel.size, panel.side, size]);
  const ref = React.useRef<HTMLDivElement>(null);
  React.useLayoutEffect(() => {
    if (panel.size !== undefined)
      return;
    const bounds = ref.current?.getBoundingClientRect();
    const newSize = isHorizontalPanelSide(panel.side) ? bounds?.height : bounds?.width;
    newSize && dispatch({
      type: "PANEL_INITIALIZE",
      side: panel.side,
      size: newSize,
    });
  });
  React.useLayoutEffect(() => {
    setTransition(undefined);
    setSize(panel.size);
  }, [panel.size])
  React.useLayoutEffect(() => {
    if (!mounted.current)
      return;
    setTransition("prepared");
  }, [panel.collapsed, panel.side]);
  React.useLayoutEffect(() => {
    if (transition === "prepared") {
      const transitionTo = panel.collapsed ? 0 : panel.size;
      setTransition("transitioning");
      setSize(transitionTo);
    }
  }, [transition, panel.side, panel.size, panel.collapsed]);
  React.useEffect(() => {
    mounted.current = true;
  }, []);
  const getBounds = React.useCallback(() => {
    assert(ref.current);
    return ref.current.getBoundingClientRect();
  }, []);
  const widgetPanel = React.useMemo<WidgetPanelContextArgs>(() => {
    return {
      getBounds,
    }
  }, [getBounds]);
  if (panel.widgets.length === 0)
    return (
      <PanelTarget />
    );
  const showTargets = panel.widgets.length < panel.maxWidgetCount;
  const className = classnames(
    "nz-widgetPanels-panel",
    `nz-${panel.side}`,
    panel.pinned && "nz-pinned",
    horizontalPanel && "nz-horizontal",
    panel.collapsed && "nz-collapsed",
    captured && "nz-captured",
    horizontalPanel?.span && "nz-span",
    !horizontalPanel && props.spanTop && "nz-span-top",
    !horizontalPanel && props.spanBottom && "nz-span-bottom",
    !!transition && "nz-transition",
  );
  return (
    <WidgetPanelContext.Provider value={widgetPanel}>
      <div
        className={className}
        ref={ref}
        style={style}
        onTransitionEnd={() => {
          setTransition(undefined);
        }}
      >
        <div
          className="nz-content"
          style={contentStyle}
        >
          {panel.widgets.map((widgetId, index, array) => {
            const last = index === array.length - 1;
            return (
              <React.Fragment key={widgetId}>
                {index === 0 && showTargets && <WidgetTarget
                  position="first"
                  widgetIndex={0}
                />}
                <PanelWidget
                  widgetId={widgetId}
                />
                {showTargets && <WidgetTarget
                  position={last ? "last" : undefined}
                  widgetIndex={index + 1}
                />}
              </React.Fragment>
            );
          })}
        </div>
        {panel.resizable &&
          <div className="nz-grip-container">
            <WidgetPanelGrip className="nz-grip" />
          </div>
        }
      </div>
    </WidgetPanelContext.Provider>
  );
});

/** @internal */
export const PanelSideContext = React.createContext<PanelSide | undefined>(undefined); // eslint-disable-line @typescript-eslint/naming-convention
PanelSideContext.displayName = "nz:PanelSideContext";

/** @internal */
export const PanelPinnedContext = React.createContext<boolean>(false); // eslint-disable-line @typescript-eslint/naming-convention
PanelPinnedContext.displayName = "nz:PanelPinnedContext";

/** @internal */
export const PanelSpanContext = React.createContext<boolean | undefined>(undefined); // eslint-disable-line @typescript-eslint/naming-convention
PanelSpanContext.displayName = "nz:PanelStateContext";

/** @internal */
export const PanelStateContext = React.createContext<PanelState | undefined>(undefined); // eslint-disable-line @typescript-eslint/naming-convention
PanelStateContext.displayName = "nz:PanelStateContext";

/** @internal */
export interface WidgetPanelContextArgs {
  getBounds(): RectangleProps;
}

/** @internal */
export const WidgetPanelContext = React.createContext<WidgetPanelContextArgs | undefined>(undefined);
WidgetPanelContext.displayName = "nz:WidgetPanelContext";

/** @internal */
export const isHorizontalPanelSide = (side: PanelSide): side is HorizontalPanelSide => {
  return side === "top" || side === "bottom";
};

/** @internal */
export const panelSides: [LeftPanelSide, RightPanelSide, TopPanelSide, BottomPanelSide] = [
  "left",
  "right",
  "top",
  "bottom",
];
