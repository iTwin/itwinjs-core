/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import * as React from "react";
import {
  BackstageAppButton, BackstageManager, ConfigurableCreateInfo, ContentControl, ContentGroup,
  ContentToolWidgetComposer, FrontstageConfig, FrontstageProps, FrontstageProvider, UiFramework,
} from "@itwin/appui-react";
import { StandardContentLayouts } from "@itwin/appui-abstract";

// __PUBLISH_EXTRACT_START__ Example_Custom_Content_Control
class CustomContentControl extends ContentControl {
  constructor(info: ConfigurableCreateInfo, options: any) {
    super(info, options);

    this.reactNode = (
      <h1 style={{
        height: "100%",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
      }}>
        Custom content!
      </h1>
    );
  }
}
// __PUBLISH_EXTRACT_END__

// __PUBLISH_EXTRACT_START__ Example_Custom_Frontstage_Provider_1
export class CustomFrontstageProvider extends FrontstageProvider {
  public override get id(): string {
    return "example:CustomFrontstage";
  }
  // eslint-disable-next-line @typescript-eslint/indent
// __PUBLISH_EXTRACT_END__
  public override get frontstage(): React.ReactElement<FrontstageProps> { // eslint-disable-line deprecation/deprecation
    throw new Error("`frontstageConfig` should be used instead.");
  }
  // eslint-disable-next-line @typescript-eslint/indent
// __PUBLISH_EXTRACT_START__ Example_Custom_Frontstage_Provider_2
  public override frontstageConfig(): FrontstageConfig {
    const id = this.id;
    const contentGroup = new ContentGroup({
      id: "test-group",
      layout: StandardContentLayouts.singleView,
      contents: [{id: "custom-content", classId: CustomContentControl }],
    });
    return {
      id,
      version: 1,
      contentGroup,
      contentManipulation: {
        id: `${id}-contentManipulationTools`,
        element: <ContentToolWidgetComposer
          cornerButton={
            <BackstageAppButton label="Toggle Backstage" icon="icon-bentley-systems"
              execute={() => BackstageManager.getBackstageToggleCommand().execute()} />
          }
        />,
      },
    };
  }
}
// __PUBLISH_EXTRACT_END__

export function registerCustomFrontstage(): void {
  UiFramework.frontstages.addFrontstageProvider(new CustomFrontstageProvider());
}
