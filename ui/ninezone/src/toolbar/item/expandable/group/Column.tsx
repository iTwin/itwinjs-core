/*---------------------------------------------------------------------------------------------
|  $Copyright: (c) 2018 Bentley Systems, Incorporated. All rights reserved. $
 *--------------------------------------------------------------------------------------------*/
/** @module Toolbar */

import * as classnames from "classnames";
import * as React from "react";

import Props from "../../../../utilities/Props";

import "./Column.scss";

export default class Column extends React.Component<Props> {
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
