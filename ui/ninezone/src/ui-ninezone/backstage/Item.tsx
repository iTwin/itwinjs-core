/*---------------------------------------------------------------------------------------------
* Copyright (c) 2019 Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/
/** @module Backstage */

import * as classnames from "classnames";
import * as React from "react";
import { CommonProps } from "@bentley/ui-core";
import "./Item.scss";

/** Properties of [[BackstageItem]] component.
 * @beta
 */
export interface BackstageItemProps extends CommonProps {
  /** Backstage item label. */
  children?: string;
  /** Backstage item icon. */
  icon?: React.ReactNode;
  /** Describes if the item is active. */
  isActive?: boolean;
  /** Describes if the item is disabled. */
  isDisabled?: boolean;
  /** Function called when item is clicked. */
  onClick?: () => void;
  /** Backstage item subtitle. */
  subtitle?: string;
}

/** Item in the [[Backstage]].
 * @beta
 */
export class BackstageItem extends React.PureComponent<BackstageItemProps> {
  public render() {
    const className = classnames(
      "nz-backstage-item",
      this.props.isActive && "nz-active",
      this.props.isDisabled && "nz-disabled",
      this.props.className);

    return (
      <li
        className={className}
        onClick={this.props.onClick}
        style={this.props.style}
      >
        <div className="nz-icon">{this.props.icon}</div>
        <div>
          <span>{this.props.children}</span>
          {this.props.subtitle !== undefined && <span>{this.props.subtitle}</span>}
        </div>
      </li>
    );
  }
}
