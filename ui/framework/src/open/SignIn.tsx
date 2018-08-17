import * as React from "react";
import { connect } from "react-redux";
import { AccessToken } from "@bentley/imodeljs-clients";
import { OpenIModelActions } from "../openimodel/state";
import { UiFramework } from "../UiFramework";
import { CSSProperties } from "react";
import * as classnames from "classnames";
import "./SignIn.scss";
import { OverallContentPage, OverallContentActions } from "../overallcontent/state";

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
   showRegisterNow: boolean;
   showCredentials: boolean;
   firstName?: string;
   lastName?: string;
   workEmail?: string;
   username?: string;
   password?: string;
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
  private defaultUsername: string = "Regular.IModelJsTestUser@mailinator.com";
  private defaultPassword: string = "Regular@iMJs";

  constructor(props: SignInProps, context?: any) {
    super(props, context);
    this.state = {
      showRegisterNow: false,
      showCredentials: false,
      isSigningIn: false};
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

  private handleSignInDefaultCredentials() {
    this.attemptSignIn(this.defaultUsername, this.defaultPassword);
  }

  private handleSignInWithCredentials = (): void => {
    this.attemptSignIn(this.state.username!, this.state.password!);
  }

  private handleRegisterNow = (): void => {
    // TODO: not implemented yet!
    alert ("Registering " + "\"" + this.state.firstName + " " +
          this.state.lastName + "\"" + "\n\nNot implemented yet!");
  }

  private handleWorkOffline = (): void => {
    this.props.setOverallPage(OverallContentPage.ConfigurableUIPage);
  }

  private onRegisterShow = () => {
    this.setState(Object.assign({}, this.state, { showRegisterNow: true }));
  }

  private onCredentialsShow = () => {
    this.setState(Object.assign({}, this.state, { showCredentials: true }));
  }

  private onRegisterCancel = () => {
    this.setState(Object.assign({}, this.state, { showRegisterNow: false }));
  }

  private onCredentialsCancel = () => {
    this.setState(Object.assign({}, this.state, { showCredentials: false }));
  }

  private setWorkEmail(event: any): void {
    this.setState(Object.assign({}, this.state, { workEmail: event.target.value }));
  }

  private setFirstName(event: any): void {
    this.setState(Object.assign({}, this.state, { firstName: event.target.value }));
  }

  private setLastName(event: any): void {
    this.setState(Object.assign({}, this.state, { lastName: event.target.value }));
  }

  private setUserName(event: any): void {
    this.setState(Object.assign({}, this.state, { username: event.target.value }));
  }

  private setPassword(event: any): void {
    this.setState(Object.assign({}, this.state, { password: event.target.value }));
  }

  private renderProfileImage(text: string) {
    if (this.state.isSigningIn) {
      return (
        <div className="signin-top-image-container">
          <div className="signin-spinner"><i /><i /><i /><i /><i /><i /></div>
          <h3 className="signin-header">Signing in to your Bentley account...</h3>
        </div>
      );
    } else {
      return (
        <div className="signin-top-image-container">
          <svg className="signin-profile" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 48 48"><defs><linearGradient id="0" x1="13.594" y1="37.09" x2="12.689" y2="-12.665" gradientUnits="userSpaceOnUse"><stop stop-color="#566069"/><stop offset="1" stop-color="#6c7884"/></linearGradient></defs><path d="m16.428 15.744c-.159-.052-1.164-.505-.536-2.414h-.009c1.637-1.686 2.888-4.399 2.888-7.07 0-4.107-2.731-6.26-5.905-6.26-3.176 0-5.892 2.152-5.892 6.26 0 2.682 1.244 5.406 2.891 7.088.642 1.684-.506 2.309-.746 2.396-2.238.724-8.325 4.332-8.229 9.586h24.05c.107-5.02-4.708-8.279-8.513-9.586m21.817305-3.079196a25.329718 25.329718 0 0 1 -25.329718 25.329718 25.329718 25.329718 0 0 1 -25.329718 -25.329718 25.329718 25.329718 0 0 1 25.329718 -25.329718 25.329718 25.329718 0 0 1 25.329718 25.329718" fill="url(#0)" transform="matrix(.94749 0 0 .94749 11.759 12.01)"/></svg>
          <h3 className="signin-header">{text}</h3>
        </div>
       );
    }
  }

  private renderRegisterForm() {
    let divStyle: CSSProperties = {display: "block"};
    if (this.state.showCredentials) {
      divStyle = {display: "none" };
    }
    return (
      <form style={divStyle} action="javascript:void(0)" onSubmit={this.handleRegisterNow.bind(this)}>
        <div className="signin-form-content">
          <div className="signin-register-title">
            <span className="signin-form-close" title="Close" onClick={this.onRegisterCancel}>&times;</span>
            <h3>Create your profile</h3>
          </div>
          <div className="signin-control-group">
            <label>Work Email</label>
            <input required placeholder="Enter work email" id="login-name" value={this.state.workEmail!} onChange={this.setWorkEmail.bind(this)} type="email" />
          </div>
          <div className="signin-control-group">
            <label>First Name</label>
            <input required placeholder="Enter first name" id="first-name" value={this.state.firstName!} onChange={this.setFirstName.bind(this)} type="text" />
          </div>
          <div className="signin-control-group">
            <label>Last Name</label>
            <input required placeholder="Enter last name" id="last-name" value={this.state.lastName!} onChange={this.setLastName.bind(this)} type="text" />
          </div>
          <button type="submit" className="signin-action-button">Register Now</button>
        </div>
      </form>
    );
  }

  /* TODO: remove Credentials form when OIDC is supported */
  private renderCredentialsForm() {
    let divStyle: CSSProperties = {display: "none"};
    if (this.state.showCredentials) {
      divStyle = {display: "block"};
    }
    return (
      <form style={divStyle} action="javascript:void(0)" onSubmit={this.handleSignInWithCredentials.bind(this)}>
        <div className="signin-form-content">
          {this.renderProfileImage("Enter your credentials")}
          <span className="signin-form-close" title="Close" onClick={this.onCredentialsCancel}>&times;</span>
          <div className="signin-control-group">
            <label>Username</label>
            <input required placeholder="Enter username" id="username" value={this.state.username} onChange={this.setUserName.bind(this)} type="text" />
          </div>
          <div className="signin-control-group">
            <label>Password</label>
            <input required placeholder="Enter password" id="password" value={this.state.password} onChange={this.setPassword.bind(this)} type="password" />
          </div>
          <button type="submit" className="signin-action-button">Sign in</button>
        </div>
      </form>
    );
  }

  public render() {
    const loginClassName = classnames("signin-content", (this.state.showRegisterNow || this.state.showCredentials) && "signin-content-scroll");
    const signinButtonClassName = classnames("signin-button", this.state.isSigningIn && "signin-button-disabled");
    return (
       <div className="signin">
          <div id="signin-content" className={loginClassName}>
            <div className="signin-oidc-container">
              {this.renderProfileImage("Please sign in to access your Bentley Services.")}
              <button type="button" onClick={this.handleSignInDefaultCredentials.bind(this)} className={signinButtonClassName}>Sign In</button>
              <span className="signin-credentials-link">
                <a onClick={this.onCredentialsShow}>Enter credentials?</a>
                <a onClick={this.handleWorkOffline}>Work Offline?</a>
              </span>
              <div className="signin-register-div">
                <p>New User?<a onClick={this.onRegisterShow}>Register Now</a></p>
              </div>
            </div>
            {this.renderRegisterForm()}
            {this.state.showCredentials && this.renderCredentialsForm()}
          </div>
        </div>
    );
  }
}

// tslint:disable-next-line:variable-name
export const SignInPage = connect(mapStateToProps, mapDispatch)(SignInPageComponent);
