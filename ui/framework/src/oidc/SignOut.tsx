/*---------------------------------------------------------------------------------------------
* Copyright (c) 2018 Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/
import * as React from "react";
import { FrontstageManager, ModalFrontstageInfo  } from "../configurableui/FrontstageManager";
import { UiFramework } from "../UiFramework";
import "./SignOut.scss";

/** Modal frontstage displaying sign out form. */
export class SignOutModalFrontstage implements ModalFrontstageInfo {
  public title: string = UiFramework.i18n.translate("UiFramework:signin.signout");
  private _signOutPrompt = UiFramework.i18n.translate("UiFramework:signin.signoutprompt");
  private _yesText = UiFramework.i18n.translate("UiFramework:buttons.yes");
  private _noText = UiFramework.i18n.translate("UiFramework:buttons.no");

  private _onSignOut = () => {
    FrontstageManager.closeModalFrontstage();
  }

  public get content(): React.ReactNode {
    return (
      <div className="signout">
        <span>{this.title}</span>
        <span>{this._signOutPrompt}</span>
        <div className="signout-footer">
          <button onClick={this._onSignOut}>{this._yesText}</button>
          <button onClick={() => FrontstageManager.closeModalFrontstage()}>{this._noText}</button>
        </div>
      </div>
    );
  }
}
