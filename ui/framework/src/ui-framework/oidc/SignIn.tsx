/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module OIDC
 */

import * as React from "react";

import { ClientRequestContext, isElectronRenderer } from "@bentley/bentleyjs-core";
import { IOidcFrontendClient } from "@bentley/imodeljs-clients";
import { CommonProps } from "@bentley/ui-core";
import { SignIn as SignInBase } from "@bentley/ui-components";
import { UiFramework } from "../UiFramework";

/** Properties for the [[SignIn]] component
 * @public
 */
export interface SignInProps extends CommonProps {
  /** Oidc Frontend Client object */
  oidcClient?: IOidcFrontendClient;
  /** Handler called after sign-in has completed */
  onSignedIn?: () => void;
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
    const isAuthorized = this.props.oidcClient && this.props.oidcClient.isAuthorized;
    if (isAuthorized)
      this.props.oidcClient!.onUserStateChanged.addListener(this._onUserStateChanged);
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

    /*
     * Note: In the case of electron, the signin happens in a disconnected web browser. We therefore show
     * a message to direc the user to the browser. Also, since we cannot capture the errors in the browser,
     * to clear the state of the signin UI, we instead allow signin button to be clicked multiple times.
     * See https://authguidance.com/2018/01/11/desktop-apps-overview/ for the pattern
     */
    let disableSignInOnClick = true;
    let signingInMessage: string | undefined;
    if (isElectronRenderer) {
      disableSignInOnClick = false;
      const signingInMessageStringId = `UiFramework:signIn.signingInMessage`;
      signingInMessage = UiFramework.i18n.translate(signingInMessageStringId);
    }

    return <SignInBase className={this.props.className} style={this.props.style}
      onSignIn={this._onStartSignin}
      onRegister={this.props.onRegister}
      onOffline={this.props.onOffline}
      disableSignInOnClick={disableSignInOnClick}
      signingInMessage={signingInMessage}
    />;
  }
}
