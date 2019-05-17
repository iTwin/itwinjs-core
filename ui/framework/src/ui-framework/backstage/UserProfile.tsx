/*---------------------------------------------------------------------------------------------
* Copyright (c) 2019 Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/
/** @module Backstage */

import * as React from "react";

import { SignOutModalFrontstage } from "../oidc/SignOut";
import { FrontstageManager } from "../frontstage/FrontstageManager";

import { CommonProps, getUserColor } from "@bentley/ui-core";
import { UserProfile as NZ_UserProfile } from "@bentley/ui-ninezone";
import { AccessToken } from "@bentley/imodeljs-clients";
import { Backstage } from "./Backstage";

/** Properties for the [[Backstage]] React component.
 * @public
 */
export interface UserProfileBackstageItemProps extends CommonProps {
  accessToken: AccessToken;
  onOpenSignOut?: () => void;
}

/** User Profile Backstage React component.
 * @public
 */
export class UserProfileBackstageItem extends React.PureComponent<UserProfileBackstageItemProps> {

  public render(): React.ReactNode | undefined {
    let content: React.ReactNode = null;

    const userInfo = this.props.accessToken.getUserInfo();

    // istanbul ignore else
    if (userInfo) {
      content = (
        <NZ_UserProfile
          color={getUserColor(userInfo.email!.id)}
          initials={this._getInitials(userInfo.profile!.firstName, userInfo.profile!.lastName)}
          onClick={this._onOpenSignOut}
        >
          {this._getFullName(userInfo.profile!.firstName, userInfo.profile!.lastName)}
        </NZ_UserProfile>
      );
    }

    return content;
  }

  private _onOpenSignOut = () => {
    Backstage.hide();
    FrontstageManager.openModalFrontstage(new SignOutModalFrontstage(this.props.accessToken));

    // istanbul ignore else
    if (this.props.onOpenSignOut)
      this.props.onOpenSignOut();
  }

  private _getInitials(firstName: string, lastName: string): string {
    return `${firstName.charAt(0)}${lastName.charAt(0)}`;
  }

  private _getFullName(firstName: string, lastName: string): string {
    return `${firstName} ${lastName}`;
  }
}
