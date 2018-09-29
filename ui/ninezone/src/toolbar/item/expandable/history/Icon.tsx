/*---------------------------------------------------------------------------------------------
* Copyright (c) 2018 - present Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
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
    const { className, ...props } = this.props;
    const itemClassName = classnames(
      "nz-toolbar-item-expandable-history-icon",
      className);

    return (
      <Item
        className={itemClassName}
        {...props}
      >
        {this.props.children}
      </Item>
    );
  }
}

export default Icon;
