/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import * as React from "react";
import { AccessToken } from "@bentley/bentleyjs-core";
import { IModelApp } from "@bentley/imodeljs-frontend";
import { StageUsage, StandardContentLayouts } from "@bentley/ui-abstract";
import {
  ConfigurableCreateInfo, ContentControl, ContentGroup, CoreTools, Frontstage, FrontstageProps, FrontstageProvider, IModelInfo,
} from "@bentley/ui-framework";
import { SampleAppIModelApp } from "../../index";
import { IModelOpen } from "../imodelopen/IModelOpen";

class IModelOpenControl extends ContentControl {
  constructor(info: ConfigurableCreateInfo, options: any) {
    super(info, options);

    if (IModelApp.authorizationClient)
      this.reactNode = <IModelOpen getAccessToken={this._getAccessToken} onIModelSelected={this._onOpenIModel} />;
  }

  // called when an imodel has been selected on the IModelOpen
  private _onOpenIModel = async (iModelInfo: IModelInfo) => {
    await SampleAppIModelApp.showIModelIndex(iModelInfo.iTwinId, iModelInfo.wsgId);
  };

  private _getAccessToken = async (): Promise<AccessToken | undefined> => {
    if (IModelApp.authorizationClient)
      return IModelApp.authorizationClient.getAccessToken();

    return undefined;
  };
}

export class IModelOpenFrontstage extends FrontstageProvider {
  public get id(): string {
    return "IModelOpen";
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
        usage={StageUsage.Private}
      />
    );
  }
}
