/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import * as React from "react";
import { Frontstage, FrontstageProvider, FrontstageProps, ContentGroup, CoreTools } from "@bentley/ui-framework";

export class ScheduleAnimationFrontstage extends FrontstageProvider {

  public get frontstage(): React.ReactElement<FrontstageProps> {

    const myContentGroup: ContentGroup = new ContentGroup(
      {
        contents: [
          {
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
