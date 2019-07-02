/*---------------------------------------------------------------------------------------------
* Copyright (c) 2019 Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/
/** @module Toolbar */

import * as classnames from "classnames";
import * as React from "react";
import { CommonProps } from "@bentley/ui-core";

import "./Tool.scss";

/** Properties of [[GroupTool]] component.
 * @alpha
 */
export interface GroupToolProps extends CommonProps {
  /** Additional content, besides icon and label. */
  children?: React.ReactNode;
  /** Tool icon. */
  icon?: React.ReactNode;
  /** Describes if the item is active. */
  isActive?: boolean;
  /** Describes if the item is disabled. */
  isDisabled?: boolean;
  /** Describes if the item is focused. */
  isFocused?: boolean;
  /** Tool label. */
  label?: string;
  /** Function called when the item is clicked. */
  onClick?: () => void;
  /** A Beta badge to draw. */
  betaBadge?: React.ReactNode;
}

/** Tool entry of tool group panel. Used in [[GroupColumn]].
 * @alpha
 */
export class GroupTool extends React.PureComponent<GroupToolProps> {
  public render() {
    const itemClassName = classnames(
      "nz-toolbar-item-expandable-group-tool-item",
      this.props.isActive && "nz-active",
      this.props.isFocused && "nz-focused",
      this.props.isDisabled && "nz-disabled",
      this.props.className);

    return (
      <div
        className={itemClassName}
        style={this.props.style}
        onClick={this._handleClick}
      >
        <div className="nz-icon">
          {this.props.icon}
          {this.props.betaBadge &&
            <div className="nz-beta-badge">
              {this.props.betaBadge}
            </div>
          }
        </div>
        <div className="nz-label">
          {this.props.label}
        </div>
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
