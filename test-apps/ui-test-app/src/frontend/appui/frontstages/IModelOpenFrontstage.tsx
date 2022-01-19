/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import * as React from "react";
import { AccessToken } from "@itwin/core-bentley";
import { IModelApp } from "@itwin/core-frontend";
import { StageUsage, StandardContentLayouts } from "@itwin/appui-abstract";
import {
  ConfigurableCreateInfo, ContentControl, ContentGroup, CoreTools, Frontstage, FrontstageProps, FrontstageProvider,
} from "@itwin/appui-react";
import { SampleAppIModelApp } from "../../index";
import { IModelOpen } from "../imodelopen/IModelOpen";

class IModelOpenControl extends ContentControl {
  constructor(info: ConfigurableCreateInfo, options: any) {
    super(info, options);

    if (IModelApp.authorizationClient)
      this.reactNode = <IModelOpen getAccessToken={this._getAccessToken} onIModelSelected={this._onOpenIModel} />;
  }

  // called when an imodel has been selected on the IModelOpen
  private _onOpenIModel = async (arg: { iTwinId: string, id: string }) => {
    await SampleAppIModelApp.showIModelIndex(arg.iTwinId, arg.id);
  };

  private _getAccessToken = async (): Promise<AccessToken> => {
    return IModelApp.getAccessToken();
  };
}

export class IModelOpenFrontstage extends FrontstageProvider {
  public static stageId = "ui-test-app:IModelOpen";
  public get id(): string {
    return IModelOpenFrontstage.stageId;
  }

  public get frontstage(): React.ReactElement<FrontstageProps> {
    const contentGroup: ContentGroup = new ContentGroup({
      id: "imodelIndexGroup",
      layout: StandardContentLayouts.singleView,
      contents: [
        {
          id: "imodel-open",
          classId: IModelOpenControl,
        },
      ],
    });

    return (
      <Frontstage id={this.id}
        defaultTool={CoreTools.selectElementCommand}
        contentGroup={contentGroup}
        isInFooterMode={false}
        isIModelIndependent={true}
        usage={StageUsage.Private}
      />
    );
  }
}
