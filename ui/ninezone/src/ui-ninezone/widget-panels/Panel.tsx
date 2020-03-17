/*---------------------------------------------------------------------------------------------
* Copyright (c) 2019 Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module WidgetPanels
 */

import * as classnames from "classnames";
import * as React from "react";
import { NineZoneDispatchContext } from "../base/NineZone";
import { PANEL_INITIALIZE, isHorizontalPanelState, PanelState } from "../base/NineZoneState";
import { WidgetPanelGrip } from "./Grip";
import { PanelWidget } from "../widget/PanelWidget";
import { DraggedPanelSideContext } from "../base/DragManager";
import { PanelTarget } from "./PanelTarget";
import { WidgetTarget } from "../widget/WidgetTarget";
import "./Panel.scss";

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
export const WidgetPanel = React.memo<WidgetPanelProps>(function WidgetPanel(props) { // tslint:disable-line: variable-name no-shadowed-variable
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
export const WidgetPanelComponent = React.memo<WidgetPanelComponentProps>(function WidgetPanelComponent(props) { // tslint:disable-line: variable-name no-shadowed-variable
  const draggedPanelSide = React.useContext(DraggedPanelSideContext);
  const dispatch = React.useContext(NineZoneDispatchContext);
  const captured = draggedPanelSide === props.panel.side;
  const { panel } = props;
  const horizontalPanel = isHorizontalPanelState(panel) ? panel : undefined;
  const sizeStyle = React.useMemo(() => {
    return panel.size === undefined ? undefined
      : isHorizontalPanelSide(panel.side) ? { height: `${panel.size}px` }
        : { width: `${panel.size}px` };
  }, [panel.size, panel.side]);
  const ref = React.useRef<HTMLDivElement>(null);
  React.useEffect(() => {
    if (panel.size !== undefined)
      return;
    const bounds = ref.current?.getBoundingClientRect();
    const newSize = isHorizontalPanelSide(panel.side) ? bounds?.height : bounds?.width;
    newSize && dispatch({
      type: PANEL_INITIALIZE,
      side: panel.side,
      size: newSize,
    });
  });
  if (panel.widgets.length === 0)
    return (
      <PanelTarget />
    );
  const maxWidgetCount = getMaxWidgetCount(panel.side);
  const showTargets = panel.widgets.length < maxWidgetCount;
  const className = classnames(
    "nz-widgetPanels-panel",
    `nz-${panel.side}`,
    horizontalPanel && "nz-horizontal",
    panel.collapsed && "nz-collapsed",
    captured && "nz-captured",
    horizontalPanel?.span && "nz-span",
    !horizontalPanel && props.spanTop && "nz-span-top",
    !horizontalPanel && props.spanBottom && "nz-span-bottom",
  );
  return (
    <div
      className={className}
      ref={ref}
      style={panel.collapsed ? undefined : sizeStyle}
    >
      <div>
        <div
          className="nz-content"
          style={panel.collapsed ? sizeStyle : undefined}
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
        <WidgetPanelGrip />
      </div>
    </div>
  );
});

function getMaxWidgetCount(side: PanelSide) {
  if (side === "left" || side === "right")
    return 3;
  return 2;
}

/** @internal */
export const PanelSideContext = React.createContext<PanelSide | undefined>(undefined); // tslint:disable-line: variable-name
PanelSideContext.displayName = "nz:PanelSideContext";

/** @internal */
export const PanelPinnedContext = React.createContext<boolean>(false); // tslint:disable-line: variable-name
PanelPinnedContext.displayName = "nz:PanelPinnedContext";

/** @internal */
export const PanelSpanContext = React.createContext<boolean | undefined>(undefined); // tslint:disable-line: variable-name
PanelSpanContext.displayName = "nz:PanelStateContext";

/** @internal */
export const PanelStateContext = React.createContext<PanelState | undefined>(undefined); // tslint:disable-line: variable-name
PanelStateContext.displayName = "nz:PanelStateContext";

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
