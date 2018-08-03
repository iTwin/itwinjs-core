/*---------------------------------------------------------------------------------------------
|  $Copyright: (c) 2018 Bentley Systems, Incorporated. All rights reserved. $
 *--------------------------------------------------------------------------------------------*/
/** @module ToolSettings */

import * as classnames from "classnames";
import * as React from "react";
import BackButton from "../../../toolbar/button/Back";  // todo: should not use this
import Settings, { SettingsProps } from "./Settings";
import "./Nested.scss";

/** Properties of [[Nested]] component. */
export interface NestedProps extends SettingsProps {
  /** Nested settings label. */
  label?: string;
  /** Function called when back button is clicked. */
  onBackButtonClick?: () => void;
}

/** Nested tool settings component. Used as content of [[ToolSettings]]. */
export default class Nested extends React.Component<NestedProps> {
  public render() {
    const className = classnames(
      "nz-widget-toolSettings-settings-nested",
      this.props.className);

    return (
      <Settings
        className={className}
        style={this.props.style}
      >
        <div className="nz-header">
          <BackButton
            className="nz-button"
            onClick={this.props.onBackButtonClick}
          />
          <div className="nz-label">
            {this.props.label}
          </div>
        </div>
        {this.props.children}
      </Settings>
    );
  }
}
