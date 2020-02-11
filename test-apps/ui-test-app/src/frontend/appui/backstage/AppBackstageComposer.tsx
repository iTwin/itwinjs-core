/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import * as React from "react";
import { connect } from "react-redux";
import { AccessToken } from "@bentley/imodeljs-clients";
import { UserProfileBackstageItem, BackstageComposer } from "@bentley/ui-framework";
import { RootState } from "../..";
import { AppBackstageItemProvider } from "./AppBackstageItemProvider";

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
  private _backstageItemProvider = new AppBackstageItemProvider();

  private get backstageItemProvider(): AppBackstageItemProvider {
    if (!this._backstageItemProvider) {
      this._backstageItemProvider = new AppBackstageItemProvider();
    }
    return this._backstageItemProvider;
  }

  public render() {
    return (
      <BackstageComposer items={this.backstageItemProvider.backstageItems}
        header={this.props.accessToken && <UserProfileBackstageItem accessToken={this.props.accessToken} />}
      />
    );
  }
}

export const AppBackstageComposer = connect(mapStateToProps)(AppBackstageComposerComponent); // tslint:disable-line:variable-name
