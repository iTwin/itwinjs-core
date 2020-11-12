/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import * as React from "react";
import { IModelApp } from "@bentley/imodeljs-frontend";
import {
  ConfigurableCreateInfo, ContentControl, ContentGroup, CoreTools, Frontstage, FrontstageProps, FrontstageProvider, IModelInfo,
} from "@bentley/ui-framework";
import { SampleAppIModelApp } from "../../index";
import { IModelOpen } from "../imodelopen/IModelOpen";

class IModelOpenControl extends ContentControl {
  constructor(info: ConfigurableCreateInfo, options: any) {
    super(info, options);

    if (IModelApp.authorizationClient && IModelApp.authorizationClient.isAuthorized)
      this.reactNode = <IModelOpen onIModelSelected={this._onOpenIModel} />;
    else
      this.reactNode = null;
  }

  // called when an imodel has been selected on the IModelOpen
  private _onOpenIModel = async (iModelInfo: IModelInfo) => {
    await SampleAppIModelApp.showIModelIndex(iModelInfo.projectInfo.wsgId, iModelInfo.wsgId);
  };
}

export class IModelOpenFrontstage extends FrontstageProvider {

  public get frontstage(): React.ReactElement<FrontstageProps> {
    const contentGroup: ContentGroup = new ContentGroup({
      contents: [
        {
          classId: IModelOpenControl,
        },
      ],
    });

    return (
      <Frontstage id="IModelOpen"
        defaultTool={CoreTools.selectElementCommand}
        defaultLayout="SingleContent"
        contentGroup={contentGroup}
        isInFooterMode={false}
      />
    );
  }
}
