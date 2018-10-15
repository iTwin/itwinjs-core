/*---------------------------------------------------------------------------------------------
* Copyright (c) 2018 Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/
/** @module ToolSettings */

import * as classnames from "classnames";
import * as React from "react";
import CommonProps from "../../utilities/Props";
import "./Settings.scss";

/** Properties of [[Settings]] component. */
export interface SettingsProps extends CommonProps {
  /** Actual content. I.e.: [[Nested]], [[Toggle]], [[ScrollableArea]], [[ToolSettingsOverflow]] */
  children?: React.ReactNode;
}

/** Tool settings. Used as content of [[ToolSettings]] component. */
export default class Settings extends React.Component<SettingsProps> {
  public render() {
    const className = classnames(
      "nz-widget-toolSettings-settings",
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
