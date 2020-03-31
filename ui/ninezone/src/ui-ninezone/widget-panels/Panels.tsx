/*---------------------------------------------------------------------------------------------
* Copyright (c) 2019 Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module WidgetPanels
 */

import classnames from "classnames";
import * as React from "react";
import { CommonProps } from "@bentley/ui-core";
import { CenterContent } from "./CenterContent";
import { CursorOverlay } from "./CursorOverlay";
import { WidgetPanel, panelSides } from "./Panel";
import { PanelsStateContext } from "../base/NineZone";
import { FloatingTab } from "../widget/FloatingTab";
import { AppContent } from "./AppContent";
import { WidgetContentRenderers } from "../widget/ContentRenderer";
import "./Panels.scss";

/** Properties of [[WidgetPanels]] component.
 * @internal
 */
export interface WidgetPanelsProps extends CommonProps {
  /** Content that is affected by pinned state of panels. */
  children?: React.ReactNode;
  /** Content that is always rendered as if panels are in a pinned state. */
  centerContent?: React.ReactNode;
}

/** Component that displays widget panels.
 * @internal
 */
export const WidgetPanels = React.memo<WidgetPanelsProps>(function WidgetPanels(props) { // tslint:disable-line: variable-name no-shadowed-variable
  return (
    <ContentNodeContext.Provider value={props.children}>
      <CenterContentNodeContext.Provider value={props.centerContent}>
        <WidgetPanelsComponent
          className={props.className}
          style={props.style}
        />
      </CenterContentNodeContext.Provider>
    </ContentNodeContext.Provider >
  );
});

/** @internal */
const WidgetPanelsComponent = React.memo<CommonProps>(function WidgetPanelsComponent(props) { // tslint:disable-line: variable-name no-shadowed-variable
  const panels = React.useContext(PanelsStateContext);
  const className = classnames(
    "nz-widgetPanels-panels",
    props.className,
  );
  return (
    <div
      className={className}
      style={props.style}
    >
      <WidgetContentRenderers />
      <AppContent />
      <CenterContent />
      {panelSides.map((side) => {
        const panel = panels[side];
        return (
          <WidgetPanel
            key={side}
            panel={panel}
            spanBottom={panels.bottom.span}
            spanTop={panels.top.span}
          />
        );
      })}
      <FloatingTab />
      <CursorOverlay />
    </div>
  );
});

/** @internal */
export const ContentNodeContext = React.createContext<React.ReactNode>(null); // tslint:disable-line: variable-name
ContentNodeContext.displayName = "nz:ContentNodeContext";

/** @internal */
export const CenterContentNodeContext = React.createContext<React.ReactNode>(null); // tslint:disable-line: variable-name
CenterContentNodeContext.displayName = "nz:CenterContentNodeContext";
