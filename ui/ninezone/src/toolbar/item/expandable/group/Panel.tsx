/*---------------------------------------------------------------------------------------------
* Copyright (c) 2018 - present Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/
/** @module Toolbar */

import * as classnames from "classnames";
import * as React from "react";
import CommonProps from "../../../../utilities/Props";
import "./Panel.scss";

/** Properties of [[Panel]] component. */
export interface PanelProps extends CommonProps {
  /** Panel content. */
  children?: React.ReactNode;
}

/** Basic panel. Used as base for [[Group]] and [[NestedGroup]] components. */
export default class Panel extends React.Component<PanelProps> {
  public render() {
    const className = classnames(
      "nz-toolbar-item-expandable-group-panel",
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
