/*---------------------------------------------------------------------------------------------
* Copyright (c) 2018 - present Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/
import * as React from "react";
import * as classnames from "classnames";
import "./SignIn.scss";

/************************************************************************
 * SignInDialog - OIDC sign-in dialog.
 ***********************************************************************/

export interface SignInProps {
  onSignIn?: () => void;
  onOffline?: () => void;
}

interface SignInState {
  isSigningIn: boolean;
}

/**
 * SignIn component
 */
export class SignIn extends React.Component<SignInProps, SignInState> {
  constructor(props: SignInProps, context?: any) {
    super(props, context);
    this.state = { isSigningIn: false };
  }

  private onSignInClick(e: Event) {
    e.preventDefault();
    this.setState(Object.assign({}, this.state, { isSigningIn: true }));
    if (this.props.onSignIn)
      this.props.onSignIn();
  }

  private onRegisterShow() {
  }

  public render() {
    const signinButtonClassName = classnames("signin-button", this.state.isSigningIn && "signin-button-disabled");
    return (
      <div className="signin2">
        <div className="signin-content">
          <span className="icon icon-placeholder" />
          <span className="prompt">Please sign in to access your Bentley Services.</span>
          <button className={signinButtonClassName} type="button" onClick={this.onSignInClick.bind(this)}>Sign In</button>
          <span className="signin-register-div">Don't have a profile?<a onClick={this.onRegisterShow}>Register</a></span>
          <a className="signin-offline" onClick={this.props.onOffline}>Work Offline?</a>
        </div>
      </div>
    );
  }
}
