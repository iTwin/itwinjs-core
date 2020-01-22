/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module Toolbar
 */

import * as classnames from "classnames";
import * as React from "react";
import { CommonProps } from "@bentley/ui-core";
import "./Item.scss";

// tslint:disable: deprecation

/** Properties of [[HistoryItem]] component.
 * @alpha
 * @deprecated History tray removed from design standard.
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
 * @deprecated History tray removed from design standard.
 */
export class HistoryItem extends React.PureComponent<HistoryItemProps> { // tslint:disable-line: deprecation
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
