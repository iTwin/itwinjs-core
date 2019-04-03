/*---------------------------------------------------------------------------------------------
* Copyright (c) 2019 Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/
/** @module OIDC */

import * as React from "react";
import "./SignIn.scss";
import UiComponents from "../UiComponents";

/************************************************************************
 * SignInDialog - OIDC sign-in dialog.
 ***********************************************************************/

/** Properties for the [[SignIn]] component
 * @public
 */
export interface SignInProps {
  onSignIn: () => void;
  onOffline?: () => void;
}

/** @internal */
interface SignInState {
  isSigningIn: boolean;
}

/**
 * SignIn React presentational component
 * @public
 */
export class SignIn extends React.PureComponent<SignInProps, SignInState> {
  private _prompt = UiComponents.i18n.translate("UiComponents:signIn.prompt");
  private _signInButton = UiComponents.i18n.translate("UiComponents:signIn.signInButton");
  private _offlineButton = UiComponents.i18n.translate("UiComponents:signIn.offlineButton");

  constructor(props: SignInProps) {
    super(props);

    this.state = { isSigningIn: false };
  }

  private _onSignInClick = (e: React.MouseEvent<HTMLButtonElement>) => {
    e.preventDefault();
    this.setState({ isSigningIn: true });
    this.props.onSignIn();
  }

  public render() {
    const displayOffline = (this.props.onOffline !== undefined);

    return (
      <div className="components-signin">
        <div className="components-signin-content">
          <span className="icon icon-user" />
          <span className="components-signin-prompt">{this._prompt}</span>
          <button className="components-signin-button" type="button" disabled={this.state.isSigningIn} onClick={this._onSignInClick}>{this._signInButton}</button>
          {displayOffline &&
            <a className="components-signin-offline" onClick={this.props.onOffline}>{this._offlineButton}</a>
          }
        </div>
      </div>
    );
  }
}
