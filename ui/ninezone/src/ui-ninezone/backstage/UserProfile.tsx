/*---------------------------------------------------------------------------------------------
* Copyright (c) 2019 Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/
/** @module Backstage */

import * as React from "react";
import { CommonProps } from "@bentley/ui-core";
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
}

/** User profile component used in [[Backstage]] header.
 * @beta
 */
export class UserProfile extends React.PureComponent<UserProfileProps> {
  public render() {
    return (
      <div
        className="nz-backstage-userProfile"
        onClick={this.props.onClick}
        style={this.props.style}
      >
        <span style={{ backgroundColor: this.props.color }}>{this.props.initials}</span>
        <span>{this.props.children}</span>
      </div>
    );
  }
}
