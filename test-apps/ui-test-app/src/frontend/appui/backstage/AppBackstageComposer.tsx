/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/
import * as React from "react";
import { connect } from "react-redux";
import { AccessToken } from "@bentley/imodeljs-clients";
import { UserProfileBackstageItem, BackstageComposer } from "@bentley/ui-framework";
import { RootState } from "../..";

function mapStateToProps(state: RootState) {
  const frameworkState = state.frameworkState;

  if (!frameworkState)
    return undefined;

  return { accessToken: frameworkState.sessionState.accessToken };
}

interface AppBackstageComposerProps {
  /** AccessToken from sign-in */
  accessToken: AccessToken | undefined;
}

export class AppBackstageComposerComponent extends React.PureComponent<AppBackstageComposerProps> {
  public render() {
    return (
      <BackstageComposer
        header={this.props.accessToken && <UserProfileBackstageItem accessToken={this.props.accessToken} />}
      />
    );
  }
}

export const AppBackstageComposer = connect(mapStateToProps)(AppBackstageComposerComponent); // tslint:disable-line:variable-name
