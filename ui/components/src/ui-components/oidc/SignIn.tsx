/*---------------------------------------------------------------------------------------------
* Copyright (c) 2019 Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/
/** @module OIDC */

import * as React from "react";
import classnames from "classnames";

import { UiComponents } from "../UiComponents";
import { CommonProps } from "@bentley/ui-core";

import "./SignIn.scss";

/************************************************************************
 * SignInDialog - OIDC sign-in dialog.
 ***********************************************************************/

/** Properties for the [[SignIn]] component
 * @public
 */
export interface SignInProps extends CommonProps {
  /** Handler for clicking the Sign-In button */
  onSignIn: () => void;
  /** Handler for clicking the Register link */
  onRegister?: () => void;
  /** Handler for clicking the Offline link */
  onOffline?: () => void;
}

/** @internal */
interface SignInState {
  isSigningIn: boolean;
  prompt: string;
  signInButton: string;
  profilePrompt: string;
  registerAnchor: string;
  offlineButton: string;
}

/**
 * SignIn React presentational component
 * @public
 */
export class SignIn extends React.PureComponent<SignInProps, SignInState> {

  constructor(props: SignInProps) {
    super(props);

    this.state = {
      isSigningIn: false,
      prompt: UiComponents.i18n.translate("UiComponents:signIn.prompt"),
      signInButton: UiComponents.i18n.translate("UiComponents:signIn.signInButton"),
      profilePrompt: UiComponents.i18n.translate("UiComponents:signIn.profilePrompt"),
      registerAnchor: UiComponents.i18n.translate("UiComponents:signIn.register"),
      offlineButton: UiComponents.i18n.translate("UiComponents:signIn.offlineButton"),
    };
  }

  private _onSignInClick = (e: React.MouseEvent<HTMLButtonElement>) => {
    e.preventDefault();
    this.setState({ isSigningIn: true });
    this.props.onSignIn();
  }

  public render() {
    return (
      <div className={classnames("components-signin", this.props.className)} style={this.props.style}>
        <div className="components-signin-content">
          <span className="icon icon-user" />
          <span className="components-signin-prompt">{this.state.prompt}</span>
          <button className="components-signin-button" type="button" disabled={this.state.isSigningIn} onClick={this._onSignInClick}>{this.state.signInButton}</button>
          {this.props.onRegister !== undefined &&
            <span className="components-signin-register">{this.state.profilePrompt}<a onClick={this.props.onRegister}>{this.state.registerAnchor}</a></span>
          }
          {this.props.onOffline !== undefined &&
            <a className="components-signin-offline" onClick={this.props.onOffline}>{this.state.offlineButton}</a>
          }
        </div>
      </div>
    );
  }
}
