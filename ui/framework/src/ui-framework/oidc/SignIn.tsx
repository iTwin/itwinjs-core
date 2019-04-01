/*---------------------------------------------------------------------------------------------
* Copyright (c) 2019 Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/
/** @module OIDC */

import * as React from "react";
import { ClientRequestContext } from "@bentley/bentleyjs-core";
import { OidcClientWrapper } from "@bentley/imodeljs-frontend";
import "./SignIn.scss";

/************************************************************************
 * SignInDialog - OIDC sign-in dialog.
 ***********************************************************************/

/** Properties for the [[SignIn]] component
 * @public
 */
export interface SignInProps {
  onOffline?: () => void;
  onSignedIn: () => void;
}

interface SignInState {
  isSigningIn: boolean;
}

/**
 * SignIn React component
 * @public
 */
export class SignIn extends React.Component<SignInProps, SignInState> {
  constructor(props: SignInProps, context?: any) {
    super(props, context);

    this.state = { isSigningIn: false };
  }

  private _onSignInClick = async (e: React.MouseEvent<HTMLButtonElement>) => {
    e.preventDefault();
    this.setState(Object.assign({}, this.state, { isSigningIn: true }));
    await OidcClientWrapper.oidcClient.signIn(new ClientRequestContext());
    this.props.onSignedIn();
  }

  public render() {
    return (
      <div className="signin">
        <div className="signin-content">
          <span className="icon icon-user" />
          <span className="prompt">Please sign in to access your Bentley Services.</span>
          <button className="signin-button" type="button" disabled={this.state.isSigningIn} onClick={this._onSignInClick}>Sign In</button>
          <a className="signin-offline" onClick={this.props.onOffline}>Work Offline?</a>
        </div>
      </div>
    );
  }
}
