/*---------------------------------------------------------------------------------------------
* Copyright (c) 2019 Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/
/** @module OIDC */

import * as React from "react";
import { SignIn as SignInBase } from "@bentley/ui-components";
import { OidcClientWrapper } from "@bentley/imodeljs-frontend";
import { ClientRequestContext } from "@bentley/bentleyjs-core";
import { CommonProps } from "@bentley/ui-core";

/** Properties for the [[SignIn]] component
 * @public
 */
export interface SignInProps extends CommonProps {
  /** Handler called after sign-in has completed */
  onSignedIn: () => void;
  /** Handler for the Register link */
  onRegister?: () => void;
  /** Handler for the Offline link */
  onOffline?: () => void;

  /** @internal */
  onStartSignIn?: () => void;
}

/**
 * SignIn React component.
 * `OidcClientWrapper.oidcClient.signIn` is called when the "Sign In" button is pressed,
 * then `props.onSignedIn` is called after sign-in has completed.
 * @public
 */
export class SignIn extends React.PureComponent<SignInProps> {
  constructor(props: SignInProps) {
    super(props);
  }

  public componentDidMount() {
    // istanbul ignore next
    if (OidcClientWrapper.oidcClient)
      OidcClientWrapper.oidcClient.onUserStateChanged.addListener(this._onUserStateChanged);
  }

  private _onUserStateChanged() {
    if (OidcClientWrapper.oidcClient.isAuthorized && this.props.onSignedIn)
      this.props.onSignedIn();
  }

  public componentWillUnmount() {
    // istanbul ignore next
    if (OidcClientWrapper.oidcClient)
      OidcClientWrapper.oidcClient.onUserStateChanged.removeListener(this._onUserStateChanged);
  }

  private _onStartSignin = async () => {
    // istanbul ignore next
    if (OidcClientWrapper.oidcClient)
      OidcClientWrapper.oidcClient.signIn(new ClientRequestContext()); // tslint:disable-line:no-floating-promises

    // istanbul ignore else
    if (this.props.onStartSignIn)
      this.props.onStartSignIn();
  }

  public render() {
    return <SignInBase className={this.props.className} style={this.props.style}
      onSignIn={this._onStartSignin}
      onRegister={this.props.onRegister}
      onOffline={this.props.onOffline} />;
  }
}
