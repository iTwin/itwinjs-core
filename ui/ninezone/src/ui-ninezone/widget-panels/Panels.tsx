/*---------------------------------------------------------------------------------------------
* Copyright (c) 2019 Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/
/** @module WidgetPanels */

import * as classnames from "classnames";
import * as React from "react";
import { CommonProps } from "@bentley/ui-core";
import { WidgetPanelSide, WidgetPanel, HorizontalWidgetPanel, HorizontalWidgetPanelApi, WidgetPanelApi, useWidgetPanelApi, useHorizontalPanelApi, isHorizontalWidgetPanelSide } from "./Panel";
import { WidgetPanelContent } from "./Content";
import { WidgetPanelGrip } from "./Grip";
import { WidgetPanelsGripOverlay } from "./GripOverlay";
import "./Panels.scss";

/** Properties of [[WidgetPanels]] component.
 * @internal future
 */
export interface WidgetPanelsProps extends CommonProps {
  children?: React.ReactNode;
  panels: WidgetPanels;
  leftContent?: React.ReactNode;
  rightContent?: React.ReactNode;
  topContent?: React.ReactNode;
  bottomContent?: React.ReactNode;
}

/** @internal future */
export interface WidgetPanels {
  readonly bottom: HorizontalWidgetPanel;
  readonly left: WidgetPanel;
  readonly right: WidgetPanel;
  readonly top: HorizontalWidgetPanel;
}

const sides: WidgetPanelSide[] = [
  "left",
  "right",
  "top",
  "bottom",
];

/** Component that displays widget panels.
 * @internal future
 */
export function WidgetPanels(props: WidgetPanelsProps) {
  const [capturedSide, setCapturedSide] = React.useState<WidgetPanelSide>();
  const handleResize = React.useCallback((side: WidgetPanelSide, resizeBy: number) => {
    setCapturedSide(side);
    props.panels[side].resize(resizeBy);
  }, [props.panels]);
  const handleResizeEnd = React.useCallback(() => {
    setCapturedSide(undefined);
  }, []);
  const handleDoubleClick = React.useCallback((side: WidgetPanelSide) => {
    props.panels[side].toggleCollapse();
  }, [props.panels]);
  const className = classnames(
    "nz-widgetPanels-panels",
    props.className,
  );
  return (
    <div
      className={className}
      style={props.style}
    >
      <WidgetPanelContent
        pinnedLeft={props.panels.left.pinned}
        pinnedRight={props.panels.right.pinned}
        pinnedTop={props.panels.top.pinned}
        pinnedBottom={props.panels.bottom.pinned}
      >
        {props.children}
      </WidgetPanelContent>
      {sides.map((side) => {
        if (isHorizontalWidgetPanelSide(side)) {
          const panel = props.panels[side];
          return (
            <WidgetPanel
              captured={side === capturedSide}
              collapsed={panel.collapsed}
              grip={
                <WidgetPanelGrip
                  collapsed={panel.collapsed}
                  onDoubleClick={handleDoubleClick}
                  onResize={handleResize}
                  onResizeEnd={handleResizeEnd}
                  side={side}
                />
              }
              key={side}
              onInitialize={panel.initialize}
              side={side}
              size={panel.size}
              span={panel.span}
            >
              {getContent(side, props)}

            </WidgetPanel>
          );
        } else {
          const panel = props.panels[side];
          return (
            <WidgetPanel
              captured={side === capturedSide}
              collapsed={panel.collapsed}
              grip={
                <WidgetPanelGrip
                  collapsed={panel.collapsed}
                  onDoubleClick={handleDoubleClick}
                  onResize={handleResize}
                  onResizeEnd={handleResizeEnd}
                  side={side}
                />
              }
              key={side}
              onInitialize={panel.initialize}
              side={side}
              size={panel.size}
              spanBottom={props.panels.bottom.span}
              spanTop={props.panels.top.span}
            >
              {getContent(side, props)}
            </WidgetPanel>
          );
        }
      })}
      {capturedSide && <WidgetPanelsGripOverlay
        side={capturedSide}
      />}
    </div>
  );
}

/** @internal future */
export interface WidgetPanelsApi {
  readonly bottom: HorizontalWidgetPanelApi;
  readonly left: WidgetPanelApi;
  readonly right: WidgetPanelApi;
  readonly top: HorizontalWidgetPanelApi;
}

/** @internal future */
export const useWidgetPanelsApi = (): [
  WidgetPanels,
  WidgetPanelsApi,
] => {
  const [left, leftApi] = useWidgetPanelApi();
  const [right, rightApi] = useWidgetPanelApi();
  const [top, topApi] = useHorizontalPanelApi();
  const [bottom, bottomApi] = useHorizontalPanelApi();
  const panels = React.useMemo(() => {
    return {
      left,
      right,
      top,
      bottom,
    };
  }, [left, right, top, bottom]);
  const api = React.useMemo(() => {
    return {
      left: leftApi,
      right: rightApi,
      top: topApi,
      bottom: bottomApi,
    };
  }, [leftApi, rightApi, topApi, bottomApi]);
  return [panels, api];
};

function getContent(side: WidgetPanelSide, props: Pick<WidgetPanelsProps, "bottomContent" | "leftContent" | "rightContent" | "topContent">) {
  switch (side) {
    case "bottom":
      return props.bottomContent;
    case "left":
      return props.leftContent;
    case "right":
      return props.rightContent;
    case "top":
      return props.topContent;
  }
}
