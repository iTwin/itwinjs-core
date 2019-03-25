/*---------------------------------------------------------------------------------------------
| $Copyright: (c) 2019 Bentley Systems, Incorporated. All rights reserved. $
 *--------------------------------------------------------------------------------------------*/
import * as React from "react";
import { CoreTools, ContentGroup, ContentControl, ConfigurableUiManager, ConfigurableCreateInfo,
         FrontstageProvider, FrontstageProps, Frontstage, SignIn } from "@bentley/ui-framework";
import { AccessToken } from "@bentley/imodeljs-clients";
import { SampleAppIModelApp } from "../../index";

class SignInControl extends ContentControl {
  constructor(info: ConfigurableCreateInfo, options: any) {
    super(info, options);

    super.reactElement = <SignIn onOffline={this._onWorkOffline} onSignIn={this._onSignIn}/>;
  }

  // user chose to work offline from the sign in page
  private _onWorkOffline = async () => {
    await SampleAppIModelApp.handleWorkOffline();
  }

  // called after the user has signed in (or access token is still valid)
  private _onSignIn = async (accessToken: AccessToken) => {
    // store the AccessToken in the sample app store
    SampleAppIModelApp.setAccessToken(accessToken, true);
    // set the default imodel frontstage
    await SampleAppIModelApp.showFrontstage ("DefaultIModel");
  }
}

ConfigurableUiManager.registerControl("SignInControl", SignInControl);

export class SignInFrontstage extends FrontstageProvider {

  public get frontstage(): React.ReactElement<FrontstageProps> {
    const contentGroup: ContentGroup = new ContentGroup({
        contents: [
          {
            classId: "SignInControl",
          },
        ],
      });

    return (
      <Frontstage id="SignIn"
        defaultTool={CoreTools.selectElementCommand}
        defaultLayout="SingleContent"
        contentGroup={contentGroup}
        isInFooterMode={false}
        />
    );
  }
}
