/*---------------------------------------------------------------------------------------------
|  $Copyright: (c) 2018 Bentley Systems, Incorporated. All rights reserved. $
 *--------------------------------------------------------------------------------------------*/
/** @module Toolbar */

import * as classnames from "classnames";
import * as React from "react";
import Item, { HistoryItemProps } from "./Item";
import "./Icon.scss";

/**
 * History item with icon. Used in [[Tray]] component.
 * @note See [[HistoryItem]] for basic history item.
 */
export class Icon extends React.Component<HistoryItemProps> {
  public render() {
    const className = classnames(
      "nz-toolbar-item-expandable-history-icon",
      this.props.className);

    return (
      <Item
        className={className}
        style={this.props.style}
        isActive={this.props.isActive}
        onClick={this.props.onClick}
      >
        {this.props.children}
      </Item>
    );
  }
}

export default Icon;
