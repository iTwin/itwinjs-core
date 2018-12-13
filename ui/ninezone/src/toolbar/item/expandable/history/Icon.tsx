/*---------------------------------------------------------------------------------------------
* Copyright (c) 2018 Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/
/** @module Toolbar */

import * as classnames from "classnames";
import * as React from "react";
import { HistoryItem, HistoryItemProps } from "./Item";
import "./Icon.scss";

/**
 * History item with icon. Used in [[Tray]] component.
 * @note See [[HistoryItem]] for basic history item.
 */
export class HistoryIcon extends React.PureComponent<HistoryItemProps> {
  public render() {
    const { className, ...props } = this.props;
    const itemClassName = classnames(
      "nz-toolbar-item-expandable-history-icon",
      className);

    return (
      <HistoryItem
        className={itemClassName}
        {...props}
      >
        {this.props.children}
      </HistoryItem>
    );
  }
}
