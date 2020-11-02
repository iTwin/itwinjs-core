/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module WidgetPanels
 */

import "./Panels.scss";
import classnames from "classnames";
import * as React from "react";
import { CommonProps } from "@bentley/ui-core";
import { PanelsStateContext } from "../base/NineZone";
import { WidgetContentRenderers } from "../widget/ContentRenderer";
import { AppContent } from "./AppContent";
import { CenterContent } from "./CenterContent";
import { useCursor } from "./CursorOverlay";
import { panelSides, WidgetPanel } from "./Panel";
import { WidgetPanelExpanders } from "./Expander";

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
export const WidgetPanels = React.memo<WidgetPanelsProps>(function WidgetPanels(props) { // eslint-disable-line @typescript-eslint/naming-convention, no-shadow
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
const WidgetPanelsComponent = React.memo<CommonProps>(function WidgetPanelsComponent(props) { // eslint-disable-line @typescript-eslint/naming-convention, no-shadow
  const panels = React.useContext(PanelsStateContext);
  useCursor();
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
      <WidgetPanelExpanders />
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
    </div>
  );
});

/** @internal */
export const ContentNodeContext = React.createContext<React.ReactNode>(null); // eslint-disable-line @typescript-eslint/naming-convention
ContentNodeContext.displayName = "nz:ContentNodeContext";

/** @internal */
export const CenterContentNodeContext = React.createContext<React.ReactNode>(null); // eslint-disable-line @typescript-eslint/naming-convention
CenterContentNodeContext.displayName = "nz:CenterContentNodeContext";
