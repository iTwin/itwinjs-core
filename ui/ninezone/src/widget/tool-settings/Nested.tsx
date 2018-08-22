/*---------------------------------------------------------------------------------------------
|  $Copyright: (c) 2018 Bentley Systems, Incorporated. All rights reserved. $
 *--------------------------------------------------------------------------------------------*/
/** @module ToolSettings */

import * as classnames from "classnames";
import * as React from "react";
import Settings, { SettingsProps } from "./Settings";
import "./Nested.scss";

/** Properties of [[Nested]] component. */
export interface NestedProps extends SettingsProps {
  /** Nested settings label. */
  label?: string;
  /** Back button icon. */
  backButton?: React.ReactNode;
}

/** Nested tool settings component. Used as content of [[ToolSettings]]. */
export default class Nested extends React.Component<NestedProps> {
  public render() {
    const className = classnames(
      "nz-widget-toolSettings-nested",
      this.props.className);

    return (
      <Settings
        className={className}
        style={this.props.style}
      >
        <div className="nz-header">
          <div className="nz-button">
            {this.props.backButton}
          </div>
          <div className="nz-label">
            {this.props.label}
          </div>
        </div>
        {this.props.children}
      </Settings>
    );
  }
}
