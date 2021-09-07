/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import * as React from "react";
import { ContentGroup, CoreTools, Frontstage, FrontstageProps, FrontstageProvider } from "@bentley/ui-framework";

export class ScheduleAnimationFrontstage extends FrontstageProvider {

  public get frontstage(): React.ReactElement<FrontstageProps> {

    const myContentGroup: ContentGroup = new ContentGroup(
      {
        id: "ScheduleAnimation",
        preferredLayoutId: "SingleContent",
        contents: [
          {
            id: "ScheduleAnimation",
            classId: "ScheduleAnimationControl",
          },
        ],
      },
    );

    return (
      <Frontstage id="ScheduleAnimationFrontstage"
        defaultTool={CoreTools.selectElementCommand}
        defaultLayout="SingleContent"
        contentGroup={myContentGroup}
        isInFooterMode={false}
        applicationData={{ key: "value" }}
      />
    );
  }
}
