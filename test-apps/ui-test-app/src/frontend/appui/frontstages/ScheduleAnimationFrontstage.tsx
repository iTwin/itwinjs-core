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

  public get frontstage(): React.ReactElement<FrontstageProps> {

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
      <Frontstage id={this.id}
        defaultTool={CoreTools.selectElementCommand}
        contentGroup={myContentGroup}
        isInFooterMode={false}
        applicationData={{ key: "value" }}
      />
    );
  }
}
