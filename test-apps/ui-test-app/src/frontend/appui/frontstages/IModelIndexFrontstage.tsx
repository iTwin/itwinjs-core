/*---------------------------------------------------------------------------------------------
* Copyright (c) 2019 Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/
import * as React from "react";
import {
  CoreTools, ContentGroup, ContentControl, ConfigurableCreateInfo,
  FrontstageProvider, FrontstageProps, Frontstage,
} from "@bentley/ui-framework";
import { IModelIndex } from "../imodelindex/IModelIndex";
import { SampleAppIModelApp } from "../../index";
import { Id64String } from "@bentley/bentleyjs-core";

class IModelIndexControl extends ContentControl {
  constructor(info: ConfigurableCreateInfo, options: any) {
    super(info, options);

    const iModelConnection = SampleAppIModelApp.getIModelConnection();
    const accessToken = SampleAppIModelApp.getAccessToken();
    this.reactElement = <IModelIndex iModelConnection={iModelConnection!} accessToken={accessToken!} onOpen={this._onOpen} />;
  }

  private _onOpen = async (viewIds: Id64String[]) => {
    const iModelConnection = SampleAppIModelApp.getIModelConnection()!;
    const contextId = iModelConnection.iModelToken.contextId!;
    const iModelId = iModelConnection.iModelToken.iModelId!;
    await SampleAppIModelApp.openIModelAndViews(contextId, iModelId, viewIds);
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
