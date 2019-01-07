/*---------------------------------------------------------------------------------------------
* Copyright (c) 2019 Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/
/** @module Toolbar */

import * as classnames from "classnames";
import * as React from "react";
import { CommonProps } from "../../../../utilities/Props";
import "./Panel.scss";

/** Properties of [[Panel]] component. */
export interface PanelProps extends CommonProps {
  /** Panel content. */
  children?: React.ReactNode;
}

/** Basic panel used in [[ExpandableItem]]. Used as base in [[Group]] and [[NestedGroup]] components. */
export class Panel extends React.PureComponent<PanelProps> {
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
