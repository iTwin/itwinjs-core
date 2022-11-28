/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import * as React from "react";
import { ContentGroup, CoreTools, Frontstage, FrontstageProps, FrontstageProvider } from "@itwin/appui-react";
import { StandardContentLayouts } from "@itwin/appui-abstract";

export class ScheduleAnimationFrontstage extends FrontstageProvider {
  public static stageId = "ui-test-app:ScheduleAnimationFrontstage";

  public get id(): string {
    return ScheduleAnimationFrontstage.stageId;
  }

  public get frontstage(): React.ReactElement<FrontstageProps> { // eslint-disable-line deprecation/deprecation

    const myContentGroup: ContentGroup = new ContentGroup(
      {
        id: "ScheduleAnimation",
        layout: StandardContentLayouts.singleView,
        contents: [
          {
            id: "ScheduleAnimation",
            classId: "ScheduleAnimationControl",
          },
        ],
      },
    );

    return (
      <Frontstage id={this.id} // eslint-disable-line deprecation/deprecation
        defaultTool={CoreTools.selectElementCommand}
        contentGroup={myContentGroup}
        applicationData={{ key: "value" }}
      />
    );
  }
}
