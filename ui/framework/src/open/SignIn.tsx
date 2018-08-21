import * as React from "react";
import { connect } from "react-redux";
import { AccessToken } from "@bentley/imodeljs-clients";
import { OpenIModelActions } from "../openimodel/state";
import { UiFramework } from "../UiFramework";
import * as classnames from "classnames";
import { OverallContentPage, OverallContentActions } from "../overallcontent/state";
import "./SignIn.scss";

/************************************************************************
 * SignInDialog - OIDC sign-in dialog.
 * 1. OIDC is not working, so using IMS sign-in for now.
 * 2. Default credentials are used from Protogist sample.
 * 3. "Register Now" has not been implemented yet.
 * 4. Upon a successful sign-in, onSuccess() is called if defined.
 ***********************************************************************/

export interface SignInProps {
  loggedIn: boolean;
  setOverallPage: (page: OverallContentPage | number) => any;
  setLoggedIn: (loggedIn: boolean, accessToken: AccessToken) => any;
}

interface SignInState {
  isSigningIn: boolean;
}

function mapStateToProps(state: any) {
  return {
    loggedIn: state.frameworkState.openIModelState.loggedIn,
  };
}

const mapDispatch = {
  setLoggedIn: OpenIModelActions.setLoggedIn,
  setOverallPage: OverallContentActions.setOverallPage,
};

class SignInPageComponent extends React.Component<SignInProps, SignInState> {
  // tslint:disable-next-line:naming-convention
  private defaultUsername: string = "Regular.IModelJsTestUser@mailinator.com";
  // tslint:disable-next-line:naming-convention
  private defaultPassword: string = "Regular@iMJs";

  constructor(props: SignInProps, context?: any) {
    super(props, context);
    this.state = { isSigningIn: false };
  }

  private async attemptSignIn(username: string, password: string) {
    this.setState(Object.assign({}, this.state, { isSigningIn: true }));
    // tslint:disable-next-line:no-console
    console.log("Attempting login with userName", username, "password", password);
    try {
      const accessToken: AccessToken = await UiFramework.loginServices.imsLogin(username, password);
      this.props.setLoggedIn(true, accessToken);
      // if (this.props.onSuccess) {
      //  this.props.onSuccess (accessToken);
    } catch (e) {
      alert(JSON.stringify(e));
      this.setState(Object.assign({}, this.state, { isSigningIn: false }));
    }
  }

  private onSignInClick() {
    this.attemptSignIn(this.defaultUsername, this.defaultPassword);
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
          <span className="icon icon-bentley-systems" />
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
