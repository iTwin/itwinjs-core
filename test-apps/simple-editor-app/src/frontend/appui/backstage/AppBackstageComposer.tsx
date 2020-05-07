/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import * as React from "react";
import { connect } from "react-redux";
import { UserInfo } from "@bentley/itwin-client";
import { BackstageComposer, UserProfileBackstageItem } from "@bentley/ui-framework";
import { RootState } from "../..";
import { AppBackstageItemProvider } from "./AppBackstageItemProvider";

function mapStateToProps(state: RootState) {
  const frameworkState = state.frameworkState;

  if (!frameworkState)
    return undefined;

  return { userInfo: frameworkState.sessionState.userInfo };
}

interface AppBackstageComposerProps {
  /** UserInfo from sign-in */
  userInfo: UserInfo | undefined;
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
        header={this.props.userInfo && <UserProfileBackstageItem userInfo={this.props.userInfo} />}
      />
    );
  }
}

export const AppBackstageComposer = connect(mapStateToProps)(AppBackstageComposerComponent); // tslint:disable-line:variable-name
