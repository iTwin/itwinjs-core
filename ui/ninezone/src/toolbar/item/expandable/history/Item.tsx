/*---------------------------------------------------------------------------------------------
|  $Copyright: (c) 2018 Bentley Systems, Incorporated. All rights reserved. $
 *--------------------------------------------------------------------------------------------*/
/** @module Toolbar */

import * as classnames from "classnames";
import * as React from "react";

import CommonProps from "../../../../utilities/Props";
import "./Item.scss";

export interface HistoryItemProps extends CommonProps {
  isActive?: boolean;
  isDisabled?: boolean;
  name?: string;
  onClick?: () => void;
}

export default class HistoryItem extends React.Component<HistoryItemProps> {
  public render() {
    const className = classnames(
      "nz-toolbar-item-expandable-history-item",
      this.props.isActive && "nz-is-active",
      this.props.isDisabled && "nz-is-disabled",
      this.props.className);

    return (
      <div
        onClick={this.props.onClick}
        className={className}
        style={this.props.style}
      >
        {this.props.children}
      </div>
    );
  }
}
