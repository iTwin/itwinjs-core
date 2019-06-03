/*---------------------------------------------------------------------------------------------
* Copyright (c) 2019 Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/
/** @module OIDC */

import * as React from "react";

import { ClientRequestContext } from "@bentley/bentleyjs-core";
import { UserInfo, AccessToken } from "@bentley/imodeljs-clients";
import { getUserColor } from "@bentley/ui-core";

import { FrontstageManager, ModalFrontstageInfo } from "../frontstage/FrontstageManager";
import { UiFramework } from "../UiFramework";

import "./SignOut.scss";

// cSpell:Ignore userprofile signoutprompt

/** Modal frontstage displaying sign out form.
 * @public
 */
export class SignOutModalFrontstage implements ModalFrontstageInfo {
  public title: string = UiFramework.translate("userProfile.userprofile");
  private _signOut = UiFramework.translate("userProfile.signout");
  private _signOutPrompt = UiFramework.translate("userProfile.signoutprompt");
  private _userInfo: UserInfo | undefined = undefined;
  private _handleSignOut?: () => void;

  constructor(accessToken: AccessToken, onSignOut?: () => void) {
    this._userInfo = accessToken.getUserInfo();
    this._handleSignOut = onSignOut;
  }

  private _getInitials(): string {
    let initials: string = "";

    // istanbul ignore else
    if (this._userInfo && this._userInfo.profile) {
      // istanbul ignore else
      if (this._userInfo.profile.firstName.length > 0)
        initials += this._userInfo.profile.firstName[0];
      // istanbul ignore else
      if (this._userInfo.profile.lastName.length > 0)
        initials += this._userInfo.profile.lastName[0];
    }

    return initials;
  }

  private _getFullName(): string {
    let name: string = "";
    // istanbul ignore else
    if (this._userInfo) {
      name = this._userInfo.profile!.firstName + " " + this._userInfo.profile!.lastName;
    }

    return name;
  }

  private _onSignOut = async () => {
    FrontstageManager.closeModalFrontstage();

    // istanbul ignore next
    if (UiFramework.oidcClient)
      UiFramework.oidcClient.signOut(new ClientRequestContext()); // tslint:disable-line:no-floating-promises

    // istanbul ignore else
    if (this._handleSignOut)
      this._handleSignOut();
  }

  public get content(): React.ReactNode {
    const initials = this._getInitials();
    const fullName = this._getFullName();
    const email = (this._userInfo && this._userInfo.email && typeof this._userInfo.email.id === "string") ? this._userInfo.email.id : /* istanbul ignore next */ "";
    const organization = (this._userInfo && this._userInfo.organization) ? this._userInfo.organization.name : /* istanbul ignore next */ "";
    const color = getUserColor(email);
    return (
      <div className="user-profile">
        <div className="profile-info">
          <span className="circle" style={{ backgroundColor: color }}>{initials}</span>
          <span>{fullName}</span>
          <span>{email}</span>
          <span>{organization}</span>
        </div>
        <div className="user-profile-separator" />
        <div className="signout">
          <span>{this._signOut}</span>
          <span>{this._signOutPrompt}</span>
          <button onClick={this._onSignOut}>{this._signOut}</button>
        </div>
      </div>
    );
  }
}
