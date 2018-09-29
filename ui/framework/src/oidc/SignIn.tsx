/*---------------------------------------------------------------------------------------------
* Copyright (c) 2018 - present Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/
import * as React from "react";
import { connect } from "react-redux";
import * as classnames from "classnames";
import { OverallContentPage, OverallContentActions } from "../overallcontent/state";
import { UiFramework } from "../UiFramework";
import "./SignIn.scss";

/************************************************************************
 * SignInDialog - OIDC sign-in dialog.
 * 1. OIDC is not working, so using IMS sign-in for now.
 * 2. Default credentials are used from Protogist sample.
 * 3. "Register Now" has not been implemented yet.
 * 4. Upon a successful sign-in, onSuccess() is called if defined.
 ***********************************************************************/

export interface SignInProps {
  setOverallPage: (page: OverallContentPage | number) => any;
}

interface SignInState {
  isSigningIn: boolean;
}

function mapStateToProps(_state: any) {
  return {};
}

const mapDispatch = {
  setOverallPage: OverallContentActions.setOverallPage,
};

class SignInPageComponent extends React.Component<SignInProps, SignInState> {
  constructor(props: SignInProps, context?: any) {
    super(props, context);
    this.state = { isSigningIn: false };
  }

  private onSignInClick(e: Event) {
    e.preventDefault();
    this.setState(Object.assign({}, this.state, { isSigningIn: true }));
    UiFramework.userManager.signinRedirect();
  }

  private onOfflineClick() {
    this.props.setOverallPage(OverallContentPage.ConfigurableUIPage);
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
          <a className="signin-offline" onClick={this.onOfflineClick.bind(this)}>Work Offline?</a>
        </div>
      </div>
    );
  }
}

// tslint:disable-next-line:variable-name
export const SignInPage = connect(mapStateToProps, mapDispatch)(SignInPageComponent);
