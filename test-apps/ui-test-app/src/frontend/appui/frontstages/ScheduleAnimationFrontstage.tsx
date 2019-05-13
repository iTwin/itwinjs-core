/*---------------------------------------------------------------------------------------------
* Copyright (c) 2019 Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/
import * as React from "react";
import { Frontstage, FrontstageProvider, FrontstageProps, ContentGroup } from "@bentley/ui-framework";
import { AppTools } from "../../tools/ToolSpecifications";

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
        defaultTool={AppTools.appSelectElementCommand}
        defaultLayout="SingleContent"
        contentGroup={myContentGroup}
        isInFooterMode={false}
        applicationData={{ key: "value" }}
      />
    );
  }
}
