/*---------------------------------------------------------------------------------------------
* Copyright (c) 2018 Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/
/** @module OpenIModel */

import * as React from "react";
import { FrontstageManager, ModalFrontstageInfo } from "../configurableui/FrontstageManager";
import { UserProfile, AccessToken } from "@bentley/imodeljs-clients";
import { getUserColor } from "@bentley/bwc/lib/index";
import { UiFramework } from "../UiFramework";
import "./SignOut.scss";

/** Modal frontstage displaying sign out form. */
export class SignOutModalFrontstage implements ModalFrontstageInfo {
  public title: string = UiFramework.i18n.translate("UiFramework:userProfile.userprofile");
  private _signOut = UiFramework.i18n.translate("UiFramework:userProfile.signout");
  private _signOutPrompt = UiFramework.i18n.translate("UiFramework:userProfile.signoutprompt");
  private _userProfile: UserProfile | undefined = undefined;

  constructor(accessToken?: AccessToken) {
    if (accessToken) {
      this._userProfile = accessToken.getUserProfile();
    }
  }

  private _getInitials(): string {
    let initials: string = "";
    if (this._userProfile) {
      if (this._userProfile.firstName.length > 0)
        initials += this._userProfile.firstName[0];
      if (this._userProfile.lastName.length > 0)
        initials += this._userProfile.lastName[0];
    }

    return initials;
  }

  private _getFullName(): string {
    let name: string = "";
    if (this._userProfile) {
      name = this._userProfile.firstName + " " + this._userProfile.lastName;
    }

    return name;
  }

  private _onSignOut = () => {
    FrontstageManager.closeModalFrontstage();
    UiFramework.userManager.removeUser();
  }

  public get content(): React.ReactNode {
    const initials = this._getInitials();
    const fullName = this._getFullName();
    const email = (this._userProfile) ? this._userProfile.email : "";
    const organization = (this._userProfile) ? this._userProfile.organization : "";
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
