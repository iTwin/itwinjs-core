/*---------------------------------------------------------------------------------------------
* Copyright (c) 2018 Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/
/** @module Backstage */

import * as React from "react";
import CommonProps, { NoChildrenProps } from "../utilities/Props";
import { getUserColor } from "@bentley/bwc/lib/index";
import "./UserProfile.scss";

/** Properties of [[UserProfile]] component. */
export interface UserProfileProps extends CommonProps, NoChildrenProps {
  /** User first name */
  firstName: string;
  /** User last name */
  lastName: string;
  /** User email */
  email: string;
  /** Function called when the item is clicked. */
  onClick?: () => void;
}

/** UserProfile component of 9-zone UI app. */
export default class UserProfile extends React.Component<UserProfileProps> {

  private _getInitials(): string {
    let initials: string = "";
    if (this.props.firstName.length > 0)
      initials += this.props.firstName[0];
    if (this.props.lastName.length > 0)
      initials += this.props.lastName[0];
    return initials;
  }

  private _getFullName(): string {
    return this.props.firstName + " " + this.props.lastName;
  }

  public render() {
    const color = getUserColor(this.props.email);
    return (
      <div className="nz-backstage-userprofile" onClick={this.props.onClick}>
        <span style={{ backgroundColor: color }}>{this._getInitials()}</span>
        <span>{this._getFullName()}</span>
      </div>
    );
  }
}
