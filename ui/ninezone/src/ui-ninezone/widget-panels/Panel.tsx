/*---------------------------------------------------------------------------------------------
* Copyright (c) 2019 Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module WidgetPanels
 */

import * as classnames from "classnames";
import * as React from "react";
import { useNineZone, INITIALIZE_PANEL, useNineZoneDispatch, usePanelBySide } from "../base/NineZone";
import { WidgetPanelGrip, WidgetPanelGripProps } from "./Grip";
import { WidgetComponent } from "../widget/Widget";
import "./Panel.scss";

/** @internal future */
export type HorizontalWidgetPanelSide = "top" | "bottom";

/** @internal future */
export type VerticalWidgetPanelSide = "left" | "right";

/** @internal future */
export type WidgetPanelSide = VerticalWidgetPanelSide | HorizontalWidgetPanelSide;

/** Properties of [[Panel]] component.
 * @internal
 */
export interface WidgetPanelProps extends Pick<WidgetPanelGripProps, "onResize" | "onResizeEnd"> {
  captured?: boolean;
  children?: React.ReactNode;
  side: WidgetPanelSide;
}

/** @internal */
export const isHorizontalWidgetPanelSide = (side: WidgetPanelSide): side is HorizontalWidgetPanelSide => {
  return side === "top" || side === "bottom";
};

/** Widget panel component.
 * @internal
 */
export function WidgetPanel(props: WidgetPanelProps) {
  const { side } = props;
  const nineZone = useNineZone();
  const panel = usePanelBySide(side);
  const { size } = panel;
  const dispatch = useNineZoneDispatch();
  const horizontalPanel = isHorizontalWidgetPanelSide(side) ? nineZone.panels[side] : undefined;
  const isVertical = !horizontalPanel;
  const latestProps = React.useRef(props);
  const sizeStyle = size === undefined ? undefined
    : isVertical ? { width: `${size}px` }
      : { height: `${size}px` };
  const ref = React.useRef<HTMLDivElement>(null);
  React.useEffect(() => {
    const bounds = ref.current?.getBoundingClientRect();
    const newSize = isHorizontalWidgetPanelSide(latestProps.current.side) ? bounds?.height : bounds?.width;
    size === undefined && newSize && dispatch({
      type: INITIALIZE_PANEL,
      side,
      size: newSize,
    });
  });
  if (panel.widgets.length === 0)
    return null;
  const className = classnames(
    "nz-widgetPanels-panel",
    `nz-${side}`,
    horizontalPanel && "nz-horizontal",
    panel.collapsed && "nz-collapsed",
    props.captured && "nz-captured",
    horizontalPanel && horizontalPanel.span && "nz-span",
    isVertical && nineZone.panels.top.span && "nz-span-top",
    isVertical && nineZone.panels.bottom.span && "nz-span-bottom",
  );
  return (
    <WidgetPanelContext.Provider value={side}>
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
            {panel.widgets.map((widgetId) => {
              return (
                <WidgetComponent
                  children={props.children}
                  id={widgetId}
                  key={widgetId}
                />
              );
            })}
          </div>
          <WidgetPanelGrip
            onResize={props.onResize}
            onResizeEnd={props.onResizeEnd}
          />
        </div>
      </div>
    </WidgetPanelContext.Provider>
  );
}

/** @internal */
export const WidgetPanelContext = React.createContext<WidgetPanelSide>(null!); // tslint:disable-line: variable-name

/** @internal future */
export function useWidgetPanelSide() {
  return React.useContext(WidgetPanelContext);
}
