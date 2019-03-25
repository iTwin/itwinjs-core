/*---------------------------------------------------------------------------------------------
* Copyright (c) 2019 Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/
/** @module OIDC */

import * as React from "react";
import { ClientRequestContext } from "@bentley/bentleyjs-core";
import { OidcClientWrapper } from "@bentley/imodeljs-frontend";
import { AccessToken } from "@bentley/imodeljs-clients";
import "./SignIn.scss";

/************************************************************************
 * SignInDialog - OIDC sign-in dialog.
 ***********************************************************************/

/** Properties for the [[SignIn]] component */
export interface SignInProps {
  onOffline?: () => void;
  accessToken?: AccessToken;
  onSignIn: (accessToken: AccessToken) => void;
}

interface SignInState {
  isSigningIn: boolean;
}

/**
 * SignIn React component
 */
export class SignIn extends React.Component<SignInProps, SignInState> {
  constructor(props: SignInProps, context?: any) {
    super(props, context);

    this.state = { isSigningIn: false };
  }

  public componentDidMount() {
    OidcClientWrapper.oidcClient.getAccessToken(new ClientRequestContext()) // tslint:disable-line:no-floating-promises
      .then((accessToken: AccessToken | undefined) => { this._setOrClearAccessToken (accessToken); });
    OidcClientWrapper.oidcClient.onUserStateChanged.addListener(this._setOrClearAccessToken);
  }

  private _onSignInClick = async (e: React.MouseEvent<HTMLButtonElement>) => {
    e.preventDefault();
    this.setState(Object.assign({}, this.state, { isSigningIn: true }));
    await OidcClientWrapper.oidcClient.signIn(new ClientRequestContext());
  }

  private _setOrClearAccessToken = (accessToken: AccessToken | undefined) => {
    if (accessToken)
      this.props.onSignIn(accessToken);
  }

  private _onRegisterShow = () => {
  }

  public render() {
    return (
      <div className="signin">
        <div className="signin-content">
          <span className="icon icon-user" />
          <span className="prompt">Please sign in to access your Bentley Services.</span>
          <button className="signin-button" type="button" disabled={this.state.isSigningIn} onClick={this._onSignInClick}>Sign In</button>
          <span className="signin-register-div">Don't have a profile?<a onClick={this._onRegisterShow}>Register</a></span>
          <a className="signin-offline" onClick={this.props.onOffline}>Work Offline?</a>
        </div>
      </div>
    );
  }
}
