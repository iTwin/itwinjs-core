/*---------------------------------------------------------------------------------------------
* Copyright (c) 2019 Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/
/** @module OIDC */

import * as React from "react";

import { ClientRequestContext } from "@bentley/bentleyjs-core";
import { IOidcFrontendClient } from "@bentley/imodeljs-clients";
import { CommonProps } from "@bentley/ui-core";
import { SignIn as SignInBase } from "@bentley/ui-components";

/** Properties for the [[SignIn]] component
 * @public
 */
export interface SignInProps extends CommonProps {
  /** Oidc Frontend Client object */
  oidcClient?: IOidcFrontendClient;
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
 * `this.props.oidcClient.signIn` is called when the "Sign In" button is pressed,
 * then `props.onSignedIn` is called after sign-in has completed.
 * @public
 */
export class SignIn extends React.PureComponent<SignInProps> {
  constructor(props: SignInProps) {
    super(props);
  }

  public componentDidMount() {
    // istanbul ignore next
    if (this.props.oidcClient)
      this.props.oidcClient.onUserStateChanged.addListener(this._onUserStateChanged);
  }

  private _onUserStateChanged() {
    // istanbul ignore next
    if (this.props.oidcClient && this.props.oidcClient.isAuthorized && this.props.onSignedIn)
      this.props.onSignedIn();
  }

  public componentWillUnmount() {
    // istanbul ignore next
    if (this.props.oidcClient)
      this.props.oidcClient.onUserStateChanged.removeListener(this._onUserStateChanged);
  }

  private _onStartSignin = async () => {
    // istanbul ignore next
    if (this.props.oidcClient)
      this.props.oidcClient.signIn(new ClientRequestContext()); // tslint:disable-line:no-floating-promises

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
