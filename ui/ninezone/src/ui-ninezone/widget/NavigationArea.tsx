/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module Widget
 */

import classnames from "classnames";
import * as React from "react";
import { CommonProps, NoChildrenProps } from "@bentley/ui-core";
import "./NavigationArea.scss";
import { ToolbarPanelAlignment } from "../toolbar/Toolbar";

/** Properties of [[NavigationArea]] component.
 * @alpha
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
 * @alpha
 */
export class NavigationArea extends React.PureComponent<NavigationAreaProps> {
  public render() {
    const className = classnames(
      "nz-navigation-widget",
      this.props.className);

    const horizontalToolbar = React.isValidElement(this.props.horizontalToolbar) ? React.cloneElement(this.props.horizontalToolbar, { panelAlignment: ToolbarPanelAlignment.End }) : null;  // ensure proper panel alignment
    const verticalToolbar = React.isValidElement(this.props.verticalToolbar) ? React.cloneElement(this.props.verticalToolbar, { panelAlignment: ToolbarPanelAlignment.End }) : null;  // ensure proper panel alignment

    return (
      <div className={className} style={this.props.style}>
        <div className="nz-horizontal-toolbar-container"
          onMouseEnter={this.props.onMouseEnter}
          onMouseLeave={this.props.onMouseLeave}>
          {horizontalToolbar}
        </div>
        <div className="nz-navigation-aid-container"
          onMouseEnter={this.props.onMouseEnter}
          onMouseLeave={this.props.onMouseLeave}>
          {this.props.navigationAid}
        </div>
        <div className="nz-vertical-toolbar-container"
          onMouseEnter={this.props.onMouseEnter}
          onMouseLeave={this.props.onMouseLeave}>
          {verticalToolbar}
        </div>
      </div>
    );
  }
}
