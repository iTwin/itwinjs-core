/*---------------------------------------------------------------------------------------------
* Copyright (c) 2019 Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/
/** @module Backstage */

import * as classnames from "classnames";
import * as React from "react";
import { CommonProps } from "@bentley/ui-core";
import { SafeAreaInsets, SafeAreaInsetsHelpers } from "../utilities/SafeAreaInsets";
import "./UserProfile.scss";

/** Properties of [[UserProfile]] component.
 * @beta
 */
export interface UserProfileProps extends CommonProps {
  /** User name. */
  children?: string;
  /** Color of initials circle (CSS value). */
  color?: string;
  /** User initials. */
  initials?: string;
  /** Function called when the profile is clicked. */
  onClick?: () => void;
  /** Describes respected safe area insets. */
  safeAreaInsets?: SafeAreaInsets;
}

/** User profile component used in [[Backstage]] header.
 * @beta
 */
export class UserProfile extends React.PureComponent<UserProfileProps> {
  public render() {
    const className = classnames(
      "nz-backstage-userProfile",
      this.props.safeAreaInsets && SafeAreaInsetsHelpers.getCssClassNames(this.props.safeAreaInsets),
      this.props.className);

    return (
      <div
        className={className}
        onClick={this.props.onClick}
        style={this.props.style}
      >
        <span style={{ backgroundColor: this.props.color }}>{this.props.initials}</span>
        <span>{this.props.children}</span>
      </div>
    );
  }
}
