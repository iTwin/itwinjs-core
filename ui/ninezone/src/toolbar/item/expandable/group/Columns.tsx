/*---------------------------------------------------------------------------------------------
* Copyright (c) 2018 Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/
/** @module Toolbar */

import * as classnames from "classnames";
import * as React from "react";
import CommonProps from "../../../../utilities/Props";
import "./Columns.scss";

/** Properties of [[Columns]] component. */
export interface ColumnsProps extends CommonProps {
  /** Actual columns. I.e. [[Column]] */
  children?: React.ReactNode;
}

/** Columns of tool group. Used in [[Group]], [[NestedGroup]] components. */
export default class Columns extends React.Component<ColumnsProps> {
  public render() {
    const className = classnames(
      "nz-toolbar-item-expandable-group-columns",
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
