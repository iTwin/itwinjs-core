/*---------------------------------------------------------------------------------------------
* Copyright (c) 2019 Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/
/** @module ToolAssistance */

import * as classnames from "classnames";
import * as React from "react";
import { CommonProps } from "../../utilities/Props";
import "./Content.scss";

/** Properties of [[ToolAssistanceContent]] component. */
export interface ToolAssistanceContentProps extends CommonProps {
  /** Assistance items and separators. I.e.: [[ToolAssistanceItem]], [[ToolAssistanceSeparator]] */
  children?: React.ReactNode;
}

/** Tool assistance. Used as content of [[ToolSettings]] component. */
export class ToolAssistanceContent extends React.PureComponent<ToolAssistanceContentProps> {
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
