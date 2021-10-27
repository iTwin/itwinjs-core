/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import * as React from "react";
import {
  ContentGroup, CoreTools, Frontstage, FrontstageProps, FrontstageProvider, NestedFrontstage, ToolWidget, Widget, Zone,
} from "@itwin/appui-react";
import { StandardContentLayouts } from "@itwin/appui-abstract";

export class NestedAnimationStage extends FrontstageProvider {
  public get id(): string {
    return "NestedAnimationStage";
  }

  public get frontstage(): React.ReactElement<FrontstageProps> {
    const myContentGroup: ContentGroup = new ContentGroup(
      {
        id: "ScheduleAnimation",
        layout: StandardContentLayouts.singleView,
        contents: [
          {
            id: "ScheduleAnimationView",
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
        contentManipulationTools={
          <Zone
            widgets={[
              <Widget isFreeform={true} element={<FrontstageToolWidget />} />, // eslint-disable-line react/jsx-key
            ]}
          />
        }
      />
    );
  }
}

/** Define a ToolWidget with Buttons to display in the TopLeft zone.
 */
class FrontstageToolWidget extends React.Component {
  public override render() {
    return (
      // eslint-disable-next-line deprecation/deprecation
      <ToolWidget
        appButton={NestedFrontstage.backToPreviousFrontstageCommand}
      />
    );
  }
}
