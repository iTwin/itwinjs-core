/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module Widget
 */

import "./NavigationArea.scss";
import classnames from "classnames";
import * as React from "react";
import type { CommonProps, NoChildrenProps } from "@itwin/core-react";
import { ToolbarPanelAlignment } from "../toolbar/Toolbar";

/** Properties of [[NavigationArea]] component.
 * @internal
 */
export interface NavigationAreaProps extends CommonProps, NoChildrenProps {
  /**
   * Button displayed between horizontal and vertical toolbars.
   * I.e. [[AppButton]] in NavigationArea zone or navigation aid control in Navigation zone.
   */
  navigationAid?: React.ReactNode;
  /** Horizontal toolbar. See [[Toolbar]] */
  horizontalToolbar?: React.ReactNode;
  /** Vertical toolbar. See [[Toolbar]] */
  verticalToolbar?: React.ReactNode;
  /** Handler for mouse enter */
  onMouseEnter?: (event: React.MouseEvent<HTMLElement, MouseEvent>) => void;
  /** Handler for mouse leave */
  onMouseLeave?: (event: React.MouseEvent<HTMLElement, MouseEvent>) => void;
}

/** NavigationArea widget is used in NavigationArea (Zone 1) and Navigation (Zone 3???) zones of 9-Zone UI.
 * @note Should be placed in [[Zone]] component.
 * @internal
 */
export const NavigationArea = React.memo<NavigationAreaProps>(function NavigationArea(props) { // eslint-disable-line @typescript-eslint/naming-convention, no-shadow
  const className = classnames(
    "nz-widget-navigationArea",
    props.className);

  const horizontalToolbar = React.isValidElement(props.horizontalToolbar) ? React.cloneElement(props.horizontalToolbar, { panelAlignment: ToolbarPanelAlignment.End }) : null;  // ensure proper panel alignment
  const verticalToolbar = React.isValidElement(props.verticalToolbar) ? React.cloneElement(props.verticalToolbar, { panelAlignment: ToolbarPanelAlignment.End }) : null;  // ensure proper panel alignment
  const navigationAidArea = props.navigationAid ? (
    <div className="nz-navigation-aid-container"
      onMouseEnter={props.onMouseEnter}
      onMouseLeave={props.onMouseLeave}>
      {props.navigationAid}
    </div>
  ) : props.navigationAid;

  return (
    <div className={className} style={props.style}>
      <div className="nz-horizontal-toolbar-container"
        onMouseEnter={props.onMouseEnter}
        onMouseLeave={props.onMouseLeave}>
        {horizontalToolbar}
      </div>
      {navigationAidArea}
      <div className="nz-vertical-toolbar-container"
        onMouseEnter={props.onMouseEnter}
        onMouseLeave={props.onMouseLeave}>
        {verticalToolbar}
      </div>
    </div>
  );
});
