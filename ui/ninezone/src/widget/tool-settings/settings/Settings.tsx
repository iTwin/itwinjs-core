/*---------------------------------------------------------------------------------------------
|  $Copyright: (c) 2018 Bentley Systems, Incorporated. All rights reserved. $
 *--------------------------------------------------------------------------------------------*/
/** @module ToolSettings */

import * as classnames from "classnames";
import * as React from "react";
import Props from "../../../utilities/Props";
import "./Settings.scss";

export default class Settings extends React.Component<Props> {
  public render() {
    const className = classnames(
      "nz-widget-toolSettings-settings-settings",
      this.props.className);

    return (
      <div
        className={className}
        style={this.props.style}
      >
        {this.props.children}
      </div>
    );
  }
}
