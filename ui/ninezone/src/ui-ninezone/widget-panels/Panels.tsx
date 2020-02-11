/*---------------------------------------------------------------------------------------------
* Copyright (c) 2019 Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/
/** @module WidgetPanels */

import * as classnames from "classnames";
import * as React from "react";
import { CommonProps } from "@bentley/ui-core";
import { WidgetPanelSide, WidgetPanel } from "./Panel";
import { WidgetPanelContent } from "./Content";
import { WidgetPanelsGripOverlay } from "./GripOverlay";
import { RESIZE_PANEL, useNineZoneDispatch, useNineZone } from "../base/NineZone";
import "./Panels.scss";

/** Properties of [[WidgetPanels]] component.
 * @internal future
 */
export interface WidgetPanelsProps extends CommonProps {
  /** Content that is affected by pinned state of panels. */
  children?: React.ReactNode;
  /** Content that is always rendered as if panels are in a pinned state. */
  centerContent?: React.ReactNode;
  /** Widget content. */
  widgetContent?: React.ReactNode;
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
  const nineZone = useNineZone();
  const dispatch = useNineZoneDispatch();
  const handleResize = React.useCallback((side: WidgetPanelSide, resizeBy: number) => {
    setCapturedSide(side);
    dispatch({
      type: RESIZE_PANEL,
      side,
      resizeBy,
    });
  }, [dispatch]);
  const handleResizeEnd = React.useCallback(() => {
    setCapturedSide(undefined);
  }, []);
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
        pinnedLeft={nineZone.panels.left.pinned}
        pinnedRight={nineZone.panels.right.pinned}
        pinnedTop={nineZone.panels.top.pinned}
        pinnedBottom={nineZone.panels.bottom.pinned}
      >
        {props.children}
      </WidgetPanelContent>
      <WidgetPanelContent
        pinnedLeft
        pinnedRight
        pinnedTop
        pinnedBottom
      >
        {props.centerContent}
      </WidgetPanelContent>
      {sides.map((side) => {
        const captured = side === capturedSide;
        return (
          <WidgetPanel
            children={props.widgetContent}
            captured={captured}
            key={side}
            onResize={handleResize}
            onResizeEnd={handleResizeEnd}
            side={side}
          />
        );
      })}
      {capturedSide && <WidgetPanelsGripOverlay
        side={capturedSide}
      />}
    </div>
  );
}
