/*---------------------------------------------------------------------------------------------
| $Copyright: (c) 2019 Bentley Systems, Incorporated. All rights reserved. $
 *--------------------------------------------------------------------------------------------*/
import * as React from "react";
import {
  CoreTools, ContentGroup, ContentControl, ConfigurableCreateInfo,
  FrontstageProvider, FrontstageProps, Frontstage, SignIn,
} from "@bentley/ui-framework";
import { SampleAppIModelApp } from "../../index";

class SignInControl extends ContentControl {
  constructor(info: ConfigurableCreateInfo, options: any) {
    super(info, options);

    this.reactElement = <SignIn onOffline={this._onWorkOffline} onSignedIn={SampleAppIModelApp.onSignedIn} />;
  }

  // user chose to work offline from the sign in page
  private _onWorkOffline = async () => {
    await SampleAppIModelApp.handleWorkOffline();
  }
}

export class SignInFrontstage extends FrontstageProvider {

  public get frontstage(): React.ReactElement<FrontstageProps> {
    const contentGroup: ContentGroup = new ContentGroup({
      contents: [
        {
          classId: SignInControl,
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
