/*---------------------------------------------------------------------------------------------
|  $Copyright: (c) 2018 Bentley Systems, Incorporated. All rights reserved. $
 *--------------------------------------------------------------------------------------------*/
/** @module OpenIModel */

import * as React from "react";
import { connect } from "react-redux";
import { AccessToken } from "@bentley/imodeljs-clients";
import { OpenIModelActions } from "./state";
import { UiFramework } from "../UiFramework";
import { CSSProperties } from "react";
import { OverallContentPage, OverallContentActions } from "../overallcontent/state";

export interface LoginProps {
  loggedIn: boolean;
  setOverallPage: (page: OverallContentPage | number) => any;
  setLoggedIn: (loggedIn: boolean, accessToken: AccessToken) => any;
}

interface LoginState {
  userName?: string;
  password?: string;
  useDefaultPending?: boolean;
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

// Note: this entire UI is temporary. It needs to be replaced with the OpenConnectId workflow.
class LoginPageComponent extends React.Component<LoginProps, LoginState> {

  public readonly state: Readonly<LoginState> = { userName: "", password: "", useDefaultPending: false };

  private async attemptLogin() {
    // tslint:disable-next-line:no-console
    console.log("Attempting login with userName", this.state.userName, "password", this.state.password);
    try {
      const accessToken: AccessToken = await UiFramework.loginServices.imsLogin(this.state.userName!, this.state.password!);
      this.props.setLoggedIn(true, accessToken);
      this.setState(Object.assign({}, this.state, { useDefaultPending: false }));
      // set the token into the global state.
    } catch (e) {
      alert(JSON.stringify(e));
    }
  }

  private setUserName(event: any): void {
    this.setState(Object.assign({}, this.state, { userName: event.target.value }));
  }

  private setPassword(event: any): void {
    this.setState(Object.assign({}, this.state, { password: event.target.value }));
  }

  private passwordKeyDown(event: any): void {
    // tslint:disable-next-line:no-console
    if (("Enter" === event.key) && ("" !== this.state.userName) && ("" !== this.state.password))
      this.attemptLogin();
  }

  private setDefaultCredentials(_event: any) {
    this.setState(Object.assign({}, this.state, { userName: "Regular.IModelJsTestUser@mailinator.com", password: "Regular@iMJs", useDefaultPending: true }),
      () => { this.attemptLogin(); });
  }

  private gotoContent(_event: any) {
    this.props.setOverallPage(OverallContentPage.ConfigurableUIPage);
  }

  // since this is all temporary, it sets style here rather than using a style sheet.
  public render() {
    const canLogin: boolean = this.state.userName! !== "" && this.state.password !== "";
    const labelStyle: CSSProperties = {
      marginLeft: "10px",
      marginRight: "10px",
      marginTop: "5px",
      marginBottom: "5px",
      width: "20em",
    };
    const inputStyle: CSSProperties = {
      marginLeft: "10px",
      marginRight: "10px",
      marginTop: "5px",
      marginBottom: "5px",
      width: "40em",
    };
    const buttonStyle: CSSProperties = {
      marginLeft: "10px",
      marginRight: "10px",
      marginTop: "5px",
      marginBottom: "15px",
      width: "160px",
      cursor: this.state.useDefaultPending! ? "wait" : "default",
    };
    const loginButtonStyle: CSSProperties = {
      marginLeft: "90px",
      marginRight: "10px",
      marginTop: "5px",
      marginBottom: "15px",
      width: "90px",
    };
    const paraStyle: CSSProperties = {
      marginLeft: "30px",
    };
    return (
      <div>
        <p style={paraStyle}>Please login to access IModels</p>
        <form action="javascript:void(0)">
          <table>
            <tbody>
              <tr>
                <td>
                  <label htmlFor="userName" style={labelStyle}>Username:</label>
                </td>
                <td>
                  <input id="userName" style={inputStyle} value={this.state.userName!} onChange={this.setUserName.bind(this)} type="text" placeholder="Username" />
                </td>
              </tr>
              <tr>
                <td>
                  <label htmlFor="password" style={labelStyle}>Password:</label>
                </td>
                <td>
                  <input id="password" style={inputStyle} type="password" value={this.state.password!} onChange={this.setPassword.bind(this)} onKeyDown={this.passwordKeyDown.bind(this)} placeholder="Password" />
                </td>
              </tr>
            </tbody>
          </table>
          <button disabled={!canLogin || this.props.loggedIn} style={loginButtonStyle} onClick={this.attemptLogin.bind(this)} >Login</button>
          <button disabled={this.props.loggedIn} onClick={this.setDefaultCredentials.bind(this)} style={buttonStyle}>Use default credentials</button>
          <button onClick={this.gotoContent.bind(this)} style={buttonStyle}>Content</button>
        </form>
      </div >
    );
  }
}

// tslint:disable-next-line:variable-name
export const LoginPage = connect(mapStateToProps, mapDispatch)(LoginPageComponent);
