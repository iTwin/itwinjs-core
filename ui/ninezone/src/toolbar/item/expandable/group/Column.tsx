/*---------------------------------------------------------------------------------------------
* Copyright (c) 2018 Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/
/** @module Toolbar */

import * as classnames from "classnames";
import * as React from "react";
import CommonProps from "../../../../utilities/Props";
import "./Column.scss";

/** Properties of [[Column]] component. */
export interface ColumnProps extends CommonProps {
  /** Actual content. I.e. tool items: [[Expander]], [[Tool]] */
  children?: React.ReactNode;
}

/** Tool group column. Used in [[Group]], [[NestedGroup]] components. */
export default class Column extends React.Component<ColumnProps> {
  public render() {
    const className = classnames(
      "nz-toolbar-item-expandable-group-column",
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
