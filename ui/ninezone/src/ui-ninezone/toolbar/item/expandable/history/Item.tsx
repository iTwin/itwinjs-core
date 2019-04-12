/*---------------------------------------------------------------------------------------------
* Copyright (c) 2019 Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/
/** @module Toolbar */

import * as classnames from "classnames";
import * as React from "react";
import { CommonProps } from "@bentley/ui-core";
import "./Item.scss";

/** Properties of [[HistoryItem]] component.
 * @alpha
 */
export interface HistoryItemProps extends CommonProps {
  /** Item content. */
  children?: React.ReactNode;
  /** Describes if the item is active. */
  isActive?: boolean;
  /** Describes if the item is disabled. */
  isDisabled?: boolean;
  /** Function called when the */
  onClick?: () => void;
  /** Title of the item */
  title?: string;
}

/** Basic history item used in [[HistoryTray]] component.
 * @note See [[Icon]] for item with icon.
 * @alpha
 */
export class HistoryItem extends React.PureComponent<HistoryItemProps> {
  public render() {
    const className = classnames(
      "nz-toolbar-item-expandable-history-item",
      this.props.isActive && "nz-active",
      this.props.isDisabled && "nz-disabled",
      this.props.className);

    return (
      <div
        onClick={this._handleClick}
        className={className}
        style={this.props.style}
        title={this.props.title}
      >
        {this.props.children}
      </div>
    );
  }

  private _handleClick = () => {
    if (this.props.isDisabled)
      return;

    this.props.onClick && this.props.onClick();
  }
}
