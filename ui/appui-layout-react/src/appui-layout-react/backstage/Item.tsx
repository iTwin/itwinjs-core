/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module Backstage
 */

import "./Item.scss";
import classnames from "classnames";
import * as React from "react";
import type { CommonProps } from "@itwin/core-react";
import type { SafeAreaInsets} from "../utilities/SafeAreaInsets";
import { SafeAreaInsetsHelpers } from "../utilities/SafeAreaInsets";

/** Properties of [[BackstageItem]] component.
 * @internal
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
  /** Describes respected safe area insets. */
  safeAreaInsets?: SafeAreaInsets;
  /** Backstage item subtitle. */
  subtitle?: string;
  /** A badge to draw. */
  badge?: React.ReactNode;
}

/** Item in the [[Backstage]].
* @internal
 */
export class BackstageItem extends React.PureComponent<BackstageItemProps> {
  public override render() {
    const className = classnames(
      "nz-backstage-item",
      this.props.isActive && "nz-active",
      this.props.isDisabled && "nz-disabled",
      this.props.safeAreaInsets && SafeAreaInsetsHelpers.getCssClassNames(this.props.safeAreaInsets),
      this.props.className);

    return (
      // eslint-disable-next-line jsx-a11y/click-events-have-key-events
      <li
        data-item-id={this.props.itemId}
        data-item-type="backstage-item"
        className={className}
        onClick={this.props.onClick}
        style={this.props.style}
        role="menuitem"
      >
        <div className="nz-icon">{this.props.icon}</div>
        {this.props.badge &&
          <div className="nz-badge">
            {this.props.badge}
          </div>
        }
        <div>
          <span>{this.props.children}</span>
          {this.props.subtitle && <span>{this.props.subtitle}</span>}
        </div>
      </li>
    );
  }
}
