/*---------------------------------------------------------------------------------------------
* Copyright (c) 2018 - present Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/
/** @module ToolAssistance */

import * as classnames from "classnames";
import * as React from "react";
import CommonProps from "../../utilities/Props";
import "./Item.scss";

/** Properties of [[ToolAssistanceItem]] component. */
export interface ToolAssistanceItemProps extends CommonProps {
  /** Assistance items and separators. I.e.: [[ToolAssistanceItem]], [[ToolAssistanceSeparator]] */
  children?: React.ReactNode;
}

/** Tool assistance item. Used in [[Assistance]] component. */
export default class ToolAssistanceItem extends React.Component<ToolAssistanceItemProps> {
  public render() {
    const className = classnames(
      "nz-footer-toolAssistance-item",
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
