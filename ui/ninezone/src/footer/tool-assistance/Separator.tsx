/*---------------------------------------------------------------------------------------------
* Copyright (c) 2018 Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/
/** @module ToolAssistance */

import * as classnames from "classnames";
import * as React from "react";
import CommonProps from "../../utilities/Props";
import "./Separator.scss";

/** Properties of [[ToolAssistanceSeparator]] component. */
export interface ToolAssistanceSeparatorProps extends CommonProps {
  /** Label of separator. */
  label?: string;
}

/** Assistance item separator. Used in [[ToolAssistance]] component. */
export default class ToolAssistanceSeparator extends React.Component<ToolAssistanceSeparatorProps> {
  public render() {
    const className = classnames(
      "nz-footer-toolAssistance-separator",
      this.props.className);

    return (
      <div
        className={className}
        style={this.props.style}
      >
        <div className="nz-label">
          {this.props.label}
        </div>
        <div className="nz-separator" />
      </div>
    );
  }
}
