/*---------------------------------------------------------------------------------------------
* Copyright (c) 2018 Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/
import * as React from "react";
import { connect } from "react-redux";

import { SampleAppIModelApp, RootState, SampleAppUiActionId } from "..";

import {
  Backstage,
  FrontstageLaunchBackstageItem,
  SeparatorBackstageItem,
  BackstageCloseEventArgs,
} from "@bentley/ui-framework";

import { Tool } from "@bentley/imodeljs-frontend";

// Tool that shows the backstage
export class BackstageShow extends Tool {
  public static toolId = "SampleApp.BackstageShow";

  public run(): boolean {
    // dispatch the action
    SampleAppIModelApp.store.dispatch({ type: SampleAppUiActionId.showBackstage });
    return true;
  }
}

// Tool that hides the backstage
export class BackstageHide extends Tool {
  public static toolId = "SampleApp.BackstageHide";

  public run(): boolean {
    // dispatch the action
    SampleAppIModelApp.store.dispatch({ type: SampleAppUiActionId.hideBackstage });
    return true;
  }
}

export interface AppBackstageProps {
  isVisible: boolean;
  className?: string;
  style?: React.CSSProperties;
}

function mapStateToProps(state: RootState) {
  return { isVisible: state.sampleAppState!.backstageVisible };
}

class AppBackstage extends React.Component<AppBackstageProps> {

  constructor(props?: any, context?: any) {
    super(props, context);
  }

  public componentDidMount() {
    Backstage.onBackstageCloseEventEvent.addListener(this._handleBackstageCloseEventEvent);
  }

  public componentWillUnmount() {
    Backstage.onBackstageCloseEventEvent.removeListener(this._handleBackstageCloseEventEvent);
  }

  private _handleBackstageCloseEventEvent = (_args: BackstageCloseEventArgs) => {
    new BackstageHide().run();
  }

  private _handleOnClose() {
    new BackstageHide().run();
  }

  public render(): React.ReactNode {

    return (
      <Backstage isVisible={this.props.isVisible} onClose={this._handleOnClose} accessToken={SampleAppIModelApp.store.getState().frameworkState!.overallContentState.accessToken} >
        <FrontstageLaunchBackstageItem frontstageId="Test1" labelKey="SampleApp:backstage.testFrontstage1" iconSpec="icon icon-placeholder" />
        <FrontstageLaunchBackstageItem frontstageId="Test2" labelKey="SampleApp:backstage.testFrontstage2" iconSpec="icon icon-placeholder" />
        <FrontstageLaunchBackstageItem frontstageId="Test3" labelKey="SampleApp:backstage.testFrontstage3" iconSpec="icon icon-placeholder" />
        <FrontstageLaunchBackstageItem frontstageId="Test4" labelKey="SampleApp:backstage.testFrontstage4" iconSpec="icon icon-placeholder" />
        <SeparatorBackstageItem />
        <FrontstageLaunchBackstageItem frontstageId="ViewsFrontstage" labelKey="Views Frontstage" iconSpec="icon-placeholder" />
      </Backstage>
    );
  }
}

// makes a <Connect> react component
export default connect(mapStateToProps)(AppBackstage);
