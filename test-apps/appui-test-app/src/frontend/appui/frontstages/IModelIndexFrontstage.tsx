/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import * as React from "react";
import { Id64String } from "@itwin/core-bentley";
import { IModelApp } from "@itwin/core-frontend";
import {
  ConfigurableCreateInfo, ContentControl, ContentGroup, CoreTools, Frontstage, FrontstageProps, FrontstageProvider, UiFramework,
} from "@itwin/appui-react";
import { SampleAppIModelApp } from "../../index";
import { IModelIndex } from "../imodelindex/IModelIndex";
import { StageUsage, StandardContentLayouts } from "@itwin/appui-abstract";

class IModelIndexControl extends ContentControl {
  constructor(info: ConfigurableCreateInfo, options: any) {
    super(info, options);

    const iModelConnection = UiFramework.getIModelConnection();
    if (iModelConnection && IModelApp.authorizationClient)
      this.reactNode = <IModelIndex iModelConnection={iModelConnection} onOpen={this._onOpen} />;
    else
      this.reactNode = null;
  }

  private _onOpen = async (viewIds: Id64String[]) => {
    const iModelConnection = UiFramework.getIModelConnection();
    if (iModelConnection) {
      const iTwinId = iModelConnection.iTwinId!;
      const iModelId = iModelConnection.iModelId!;
      await SampleAppIModelApp.openIModelAndViews(iTwinId, iModelId, viewIds);
    }
  };
}

export class IModelIndexFrontstage extends FrontstageProvider {
  public static stageId = "ui-test-app:IModelIndex";
  public get id(): string {
    return IModelIndexFrontstage.stageId;
  }

  public get frontstage(): React.ReactElement<FrontstageProps> {
    const contentGroup: ContentGroup = new ContentGroup({
      id: "imodelIndexGroup",
      layout: StandardContentLayouts.singleView,
      contents: [
        {
          id: "imodelIndexView",
          classId: IModelIndexControl,
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
