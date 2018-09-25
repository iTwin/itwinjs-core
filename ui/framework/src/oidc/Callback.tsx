/*---------------------------------------------------------------------------------------------
|  $Copyright: (c) 2018 Bentley Systems, Incorporated. All rights reserved. $
 *--------------------------------------------------------------------------------------------*/
import * as React from "react";
import { connect } from "react-redux";
import { CallbackComponent } from "redux-oidc";
import { OverallContentPage, OverallContentActions } from "../overallcontent/state";
import { UiFramework } from "../UiFramework";

export interface CallbackProps {
  setOverallPage: (page: OverallContentPage | number) => any;
}

// tslint:disable-next-line:no-empty-interface
interface CallbackState {
}

function mapStateToProps(_state: any) {
  return {};
}

const mapDispatch = {
  setOverallPage: OverallContentActions.setOverallPage,
};

class CallbackPageComponent extends React.Component<CallbackProps, CallbackState> {
  constructor(props: CallbackProps, context?: any) {
    super(props, context);
    this.state = {};
  }

  private onSuccess() {
    console.log("Login success!!!"); // tslint:disable-line:no-console
    window.location.replace("/");
  }

  private onError() {
    console.log("Error logging in!!!"); // tslint:disable-line:no-console
  }

  public render() {
    return (
      <CallbackComponent
        userManager={UiFramework.userManager}
        successCallback={this.onSuccess.bind(this)}
        errorCallback={this.onError.bind(this)}
      >
        <div>Redirecting...</div>
      </CallbackComponent>
    );
  }
}

// tslint:disable-next-line:variable-name
export const CallbackPage = connect(mapStateToProps, mapDispatch)(CallbackPageComponent);
