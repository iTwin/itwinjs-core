/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import * as React from "react";
import { isFrontendAuthorizationClient } from "@bentley/frontend-authorization-client";
import { IModelApp } from "@bentley/imodeljs-frontend";
import {
  ConfigurableCreateInfo, ContentControl, ContentGroup, CoreTools, Frontstage, FrontstageProps, FrontstageProvider,
} from "@bentley/ui-framework";
import { SignIn } from "../oidc/SignIn";
import { SampleAppIModelApp } from "../../index";
import { StageUsage, StandardContentLayouts } from "@bentley/ui-abstract";

class SignInControl extends ContentControl {
  constructor(info: ConfigurableCreateInfo, options: any) {
    super(info, options);

    const client = IModelApp.authorizationClient;
    if (isFrontendAuthorizationClient(client))
      this.reactNode = <SignIn onOffline={this._onWorkOffline} onRegister={this._onRegister} />;
    else
      this.reactNode = null;
  }

  // user chose to work offline from the sign in page
  private _onWorkOffline = async () => {
    await SampleAppIModelApp.handleWorkOffline();
  };

  private _onRegister = () => {
    window.open("https://www.itwinjs.org/getting-started/#developer-registration", "_blank");
  };
}

export class SignInFrontstage extends FrontstageProvider {
  public get id(): string {
    return "SignIn";
  }

  public get frontstage(): React.ReactElement<FrontstageProps> {
    const contentGroup: ContentGroup = new ContentGroup({
      id: "sign-in-stage",
      layout: StandardContentLayouts.singleView,
      contents: [
        {
          id: "sign-in",
          classId: SignInControl,
        },
      ],
    });

    return (
      <Frontstage id={this.id}
        defaultTool={CoreTools.selectElementCommand}
        contentGroup={contentGroup}
        isInFooterMode={false}
        usage={StageUsage.Private}
      />
    );
  }
}
