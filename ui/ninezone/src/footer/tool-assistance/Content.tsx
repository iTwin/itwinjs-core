/*---------------------------------------------------------------------------------------------
* Copyright (c) 2018 - present Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/
/** @module ToolAssistance */

import * as classnames from "classnames";
import * as React from "react";
import CommonProps from "../../utilities/Props";
import "./Content.scss";

/** Properties of [[TabSeparator]] component. */
export interface ToolAssistanceContentProps extends CommonProps {
  /** Assistance items and separators. I.e.: [[AssistanceItem]], [[Separator]] */
  children?: React.ReactNode;
}

/** Tool assistance. Used as content of [[ToolSettings]] component. */
export default class ToolAssistanceContent extends React.Component<ToolAssistanceContentProps> {
  public render() {
    const className = classnames(
      "nz-footer-toolAssistance-content",
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
