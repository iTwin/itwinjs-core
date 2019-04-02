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
  onOffline?: () => void;
  onSignedIn: () => void;
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

  private _onStartSignin = async () => {
    await OidcClientWrapper.oidcClient.signIn(new ClientRequestContext());
    this.props.onSignedIn();
  }

  public render() {
    return <SignInBase onSignIn={this._onStartSignin} onOffline={this.props.onOffline} />;
  }
}
