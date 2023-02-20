/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import { StandardContentLayouts } from "@itwin/appui-abstract";
import { BackstageAppButton, ConfigurableUiManager, ContentGroup, ContentGroupProvider, FrontstageProps, IModelViewportControl, StandardFrontstageProps, StandardFrontstageProvider, UiFramework } from "@itwin/appui-react";
import React from "react";

// __PUBLISH_EXTRACT_START__ Example_Viewport_Frontstage_Group_Provider_1
export class ViewportFrontstageGroupProvider extends ContentGroupProvider {
// __PUBLISH_EXTRACT_END__
  public override async provideContentGroup(_props: FrontstageProps): Promise<ContentGroup> { // eslint-disable-line deprecation/deprecation
    throw new Error("Method not implemented.");
  }

  // eslint-disable-next-line @typescript-eslint/indent
// __PUBLISH_EXTRACT_START__ Example_Viewport_Frontstage_Group_Provider_2
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
// __PUBLISH_EXTRACT_END__

// __PUBLISH_EXTRACT_START__ Example_Register_Viewport_Frontstage
export function registerViewportFrontstage(): void {
  const stageProps: StandardFrontstageProps = {
    id: "example:ViewportFrontstage",
    contentGroupProps: new ViewportFrontstageGroupProvider(),
    cornerButton: <BackstageAppButton />,
    usage: "General",
  };
  UiFramework.frontstages.addFrontstageProvider(new StandardFrontstageProvider(stageProps));
}
// __PUBLISH_EXTRACT_END__
