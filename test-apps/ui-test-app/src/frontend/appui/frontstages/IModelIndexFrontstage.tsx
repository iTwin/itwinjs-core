/*---------------------------------------------------------------------------------------------
| $Copyright: (c) 2019 Bentley Systems, Incorporated. All rights reserved. $
 *--------------------------------------------------------------------------------------------*/
import * as React from "react";
import { CoreTools, ContentGroup, ContentControl, ConfigurableUiManager, ConfigurableCreateInfo,
         FrontstageProvider, FrontstageProps, Frontstage, IModelIndex } from "@bentley/ui-framework";
import { SampleAppIModelApp } from "../../index";
import { Id64String } from "@bentley/bentleyjs-core";

class IModelIndexControl extends ContentControl {
  constructor(info: ConfigurableCreateInfo, options: any) {
    super(info, options);

    const iModelConnection = SampleAppIModelApp.getIModelConnection();
    const accessToken = SampleAppIModelApp.getAccessToken();
    super.reactElement = <IModelIndex iModelConnection={iModelConnection!} accessToken={accessToken!} onOpen={this._onOpen} />;
  }

  private _onOpen = async (viewIds: Id64String[]) => {
    const iModelConnection = SampleAppIModelApp.getIModelConnection()!;
    const contextId = iModelConnection.iModelToken.contextId!;
    const iModelId = iModelConnection.iModelToken.iModelId!;
    await SampleAppIModelApp.openViews(contextId, iModelId, viewIds);
  }
}

ConfigurableUiManager.registerControl("IModelIndexControl", IModelIndexControl);

export class IModelIndexFrontstage extends FrontstageProvider {

  public get frontstage(): React.ReactElement<FrontstageProps> {
    const contentGroup: ContentGroup = new ContentGroup({
        contents: [
          {
            classId: "IModelIndexControl",
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
