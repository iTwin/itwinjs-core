/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import { StandardContentLayouts } from "@itwin/appui-abstract";
import { BackstageAppButton, ConfigurableUiManager, ContentGroup, ContentGroupProvider, FrontstageProps, IModelViewportControl, StandardFrontstageProps, StandardFrontstageProvider, UiFramework } from "@itwin/appui-react";
import React from "react";

export class ViewportFrontstageGroupProvider extends ContentGroupProvider {
  public override async provideContentGroup(_props: FrontstageProps): Promise<ContentGroup> {
    throw new Error("Method not implemented.");
  }

  public override async contentGroup(): Promise<ContentGroup> {
    return new ContentGroup({
      id: "content-group",
      layout: StandardContentLayouts.singleView,
      contents: [
        {
          id: "viewport",
          classId: IModelViewportControl,
          applicationData: {
            viewState: UiFramework.getDefaultViewState,
            iModelConnection: UiFramework.getIModelConnection,
          },
        },
      ],
    });
  }
}

export function registerViewportFrontstage(): void {
  const stageProps: StandardFrontstageProps = {
    id: "example:ViewportFrontstage",
    contentGroupProps: new ViewportFrontstageGroupProvider(),
    cornerButton: <BackstageAppButton />,
    usage: "General",
  };
  ConfigurableUiManager.addFrontstageProvider(new StandardFrontstageProvider(stageProps));
}

