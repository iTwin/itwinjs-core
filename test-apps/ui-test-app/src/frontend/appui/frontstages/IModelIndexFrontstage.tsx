/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import * as React from "react";
import {
  CoreTools, ContentGroup, ContentControl, ConfigurableCreateInfo,
  FrontstageProvider, FrontstageProps, Frontstage, UiFramework,
} from "@bentley/ui-framework";
import { IModelIndex } from "../imodelindex/IModelIndex";
import { SampleAppIModelApp } from "../../index";
import { Id64String } from "@bentley/bentleyjs-core";
import { IModelApp } from "@bentley/imodeljs-frontend";

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
  }
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
