/*---------------------------------------------------------------------------------------------
* Copyright (c) 2019 Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module WidgetPanels
 */

import "./Expander.scss";
import classnames from "classnames";
import * as React from "react";
import { PanelSide, panelSides } from "./Panel";
import { NineZoneDispatchContext, PanelsStateContext } from "../base/NineZone";

/** @internal */
export interface WidgetPanelExpanderProps {
  side: PanelSide;
}

/** Component that is used to auto-expand unpinned widget panel.
 * @internal
 */
export function WidgetPanelExpander({ side }: WidgetPanelExpanderProps) {
  const dispatch = React.useContext(NineZoneDispatchContext);
  const className = classnames(
    "nz-widgetPanels-expander",
    `nz-${side}`,
  );
  return (
    <div
      className={className}
      onMouseOverCapture={() => {
        dispatch({
          side,
          collapsed: false,
          type: "PANEL_SET_COLLAPSED",
        });
      }}
    />
  );
}

/** @internal */
export function WidgetPanelExpanders() {
  const panels = React.useContext(PanelsStateContext);
  return (
    <>
      {panelSides.map((side) => {
        const panel = panels[side];
        return !panel.pinned && panel.collapsed && <WidgetPanelExpander key={side} side={side} />;
      })}
    </>
  );
}
