/*---------------------------------------------------------------------------------------------
* Copyright (c) 2019 Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/
/** @module OIDC */

import * as React from "react";
import { SignIn as SignInBase } from "@bentley/ui-components";
import { OidcClientWrapper } from "@bentley/imodeljs-frontend";
import { ClientRequestContext } from "@bentley/bentleyjs-core";

/** Properties for the [[SignIn]] component
 * @public
 */
export interface SignInProps {
  onSignedIn: () => void;
  onRegister?: () => void;
  onOffline?: () => void;
}

/**
 * SignIn React component.
 * `OidcClientWrapper.oidcClient.signIn` is called when the "Sign In" button is pressed,
 * then `props.onSignedIn` is called after sign-in has completed.
 * @public
 */
export class SignIn extends React.Component<SignInProps> {
  constructor(props: SignInProps) {
    super(props);
  }

  public componentDidMount() {
    if (OidcClientWrapper.oidcClient)
      OidcClientWrapper.oidcClient.onUserStateChanged.addListener(this._onUserStateChanged);
  }

  private _onUserStateChanged() {
    if (OidcClientWrapper.oidcClient.isAuthorized && this.props.onSignedIn)
      this.props.onSignedIn();
  }

  public componentWillUnmount() {
    if (OidcClientWrapper.oidcClient)
      OidcClientWrapper.oidcClient.onUserStateChanged.removeListener(this._onUserStateChanged);
  }

  private _onStartSignin = async () => {
    OidcClientWrapper.oidcClient.signIn(new ClientRequestContext()); // tslint:disable-line:no-floating-promises
  }

  public render() {
    return <SignInBase onSignIn={this._onStartSignin} onRegister={this.props.onRegister} onOffline={this.props.onOffline} />;
  }
}
