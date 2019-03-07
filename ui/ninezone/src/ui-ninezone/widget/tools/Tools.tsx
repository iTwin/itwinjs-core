/*---------------------------------------------------------------------------------------------
* Copyright (c) 2019 Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/
/** @module Widget */

import * as classnames from "classnames";
import * as React from "react";
import { CommonProps, NoChildrenProps } from "../../utilities/Props";
import "./Tools.scss";

/** Properties of [[Tools]] component. */
export interface ToolsProps extends CommonProps, NoChildrenProps {
  /**
   * Button displayed between horizontal and vertical toolbars.
   * I.e. [[AppButton]] in Tools zone or navigation aid control in Navigation zone.
   */
  button?: React.ReactNode;
  /** Horizontal toolbar. See [[Toolbar]] */
  horizontalToolbar?: React.ReactNode;
  /**
   * True if this widget is used in Navigation zone.
   * Controls how the toolbars and button are aligned.
   */
  isNavigation?: boolean;
  /** Vertical toolbar. See [[Toolbar]] */
  verticalToolbar?: React.ReactNode;
  /** Pass true to reduce the distance between toolbars when [[ToolsProps.button]] is not provided. */
  preserveSpace?: boolean;
}

/**
 * Tools widget is used in Tools (Zone 1) and Navigation (Zone 3) zones of 9-Zone UI.
 * @note Should be placed in [[Zone]] component.
 */
export class Tools extends React.PureComponent<ToolsProps> {
  public render() {
    const singleToolbar = (this.props.verticalToolbar && !this.props.horizontalToolbar) ||
      (!this.props.verticalToolbar && this.props.horizontalToolbar);
    const noGap = singleToolbar && !this.props.button;
    const reducedGap = !singleToolbar && !this.props.button && this.props.preserveSpace;
    const className = classnames(
      "nz-widget-tools",
      noGap && "nz-no-gap",
      reducedGap && "nz-reduced-gap",
      this.props.isNavigation && "nz-is-navigation",
      this.props.className);

    return (
      <div className={className} style={this.props.style}>
        <div className="nz-app-button">
          {this.props.button}
        </div>
        <div className="nz-horizontal-toolbar">
          {this.props.horizontalToolbar}
        </div>
        <div className="nz-vertical-toolbar">
          {this.props.verticalToolbar}
        </div>
      </div>
    );
  }
}
