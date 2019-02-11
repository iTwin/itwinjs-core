/*---------------------------------------------------------------------------------------------
* Copyright (c) 2019 Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/
/** @module ToolSettings */

import * as classnames from "classnames";
import * as React from "react";
import { CommonProps } from "../../utilities/Props";
import "./Settings.scss";

/** Properties of [[ToolSettings]] component. */
export interface ToolSettingsProps extends CommonProps {
  /** Actual content. I.e.: [[Nested]], [[Toggle]], [[ScrollableArea]], [[Overflow]] */
  children?: React.ReactNode;
}

/** Tool Settings React component. */
export class ToolSettings extends React.PureComponent<ToolSettingsProps> {
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
