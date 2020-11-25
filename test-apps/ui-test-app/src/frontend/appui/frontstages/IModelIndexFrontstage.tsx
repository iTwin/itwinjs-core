/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import * as React from "react";
import { Id64String } from "@bentley/bentleyjs-core";
import { IModelApp } from "@bentley/imodeljs-frontend";
import {
  ConfigurableCreateInfo, ContentControl, ContentGroup, CoreTools, Frontstage, FrontstageProps, FrontstageProvider, UiFramework,
} from "@bentley/ui-framework";
import { SampleAppIModelApp } from "../../index";
import { IModelIndex } from "../imodelindex/IModelIndex";

class IModelIndexControl extends ContentControl {
  constructor(info: ConfigurableCreateInfo, options: any) {
    super(info, options);

    const iModelConnection = UiFramework.getIModelConnection();
    if (iModelConnection && IModelApp.authorizationClient && IModelApp.authorizationClient.isAuthorized)
      this.reactNode = <IModelIndex iModelConnection={iModelConnection} onOpen={this._onOpen} />;
    else
      this.reactNode = null;
  }

  private _onOpen = async (viewIds: Id64String[]) => {
    const iModelConnection = UiFramework.getIModelConnection();
    if (iModelConnection) {
      const contextId = iModelConnection.contextId!;
      const iModelId = iModelConnection.iModelId!;
      await SampleAppIModelApp.openIModelAndViews(contextId, iModelId, viewIds);
    }
  };
}

export class IModelIndexFrontstage extends FrontstageProvider {

  public get frontstage(): React.ReactElement<FrontstageProps> {
    const contentGroup: ContentGroup = new ContentGroup({
      contents: [
        {
          classId: IModelIndexControl,
        },
      ],
    });

    return (
      <Frontstage id="IModelIndex"
        defaultTool={CoreTools.selectElementCommand}
        defaultLayout="SingleContent"
        contentGroup={contentGroup}
        isInFooterMode={false}
      />
    );
  }
}
