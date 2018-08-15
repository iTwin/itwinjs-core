/*---------------------------------------------------------------------------------------------
|  $Copyright: (c) 2018 Bentley Systems, Incorporated. All rights reserved. $
 *--------------------------------------------------------------------------------------------*/
/** @module ToolSettings */

import * as classnames from "classnames";
import * as React from "react";
import CommonProps from "../../../utilities/Props";
import "./NoSettings.scss";

/** Properties of [[NoSettings]] component. */
export interface NoSettingsProps extends CommonProps {
  /** Actual content. */
  children?: React.ReactNode;
}

/** Used as content of [[ToolSettings]] component when there are no settings to display. */
export default class NoSettings extends React.Component<NoSettingsProps> {
  public render() {
    const className = classnames(
      "nz-widget-toolSettings-settings-noSettings",
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
