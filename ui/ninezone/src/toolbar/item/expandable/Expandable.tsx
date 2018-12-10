/*---------------------------------------------------------------------------------------------
* Copyright (c) 2018 Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/
/** @module Toolbar */

import * as classnames from "classnames";
import * as React from "react";
import { CommonProps } from "../../../utilities/Props";
import { WithExpandableItemProps } from "../../../toolbar/Toolbar";
import "./Expandable.scss";

/** Properties of [[ExpandableItem]] component. */
export interface ExpandableItemProps extends CommonProps, WithExpandableItemProps {
  /** Describes if item is active. */
  isActive?: boolean;
  /** Describes if item is disabled. */
  isDisabled?: boolean;
  /** Function called when history tray should be extended or shrank. */
  onIsHistoryExtendedChange?: (isExtended: boolean) => void;
}

/** Expandable toolbar item. */
export class ExpandableItem extends React.PureComponent<ExpandableItemProps> {
  public render() {
    const className = classnames(
      "nz-toolbar-item-expandable-expandable",
      this.props.isActive && "nz-is-active",
      this.props.isDisabled && "nz-is-disabled",
      this.props.className);

    return (
      <div
        onMouseEnter={this._handleMouseEnter}
        onMouseLeave={this._handleMouseLeave}
        className={className}
        style={this.props.style}
      >
        {this.props.children}
        <div className="nz-triangle" />
      </div>
    );
  }

  private _handleMouseEnter = () => {
    this.props.onIsHistoryExtendedChange && this.props.onIsHistoryExtendedChange(true);
  }

  private _handleMouseLeave = () => {
    this.props.onIsHistoryExtendedChange && this.props.onIsHistoryExtendedChange(false);
  }
}
