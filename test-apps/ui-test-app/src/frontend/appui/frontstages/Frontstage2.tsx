/*---------------------------------------------------------------------------------------------
| $Copyright: (c) 2018 Bentley Systems, Incorporated. All rights reserved. $
 *--------------------------------------------------------------------------------------------*/
import { FrontstageProps } from "@bentley/ui-framework";
import { ZoneState } from "@bentley/ui-framework";
import { WidgetState } from "@bentley/ui-framework";

export class Frontstage2 {

  public defineProps(): FrontstageProps {
    const frontstageProps: FrontstageProps = {
      id: "Test2",
      defaultToolId: "PlaceLine",
      defaultLayout: "FourQuadrants",
      contentGroup: "TestContentGroup2",
      defaultContentId: "TestContent1",

      topLeft: {
        defaultState: ZoneState.Open,
        allowsMerging: false,
        widgetProps: [
          {
            classId: "ToolWidget",
            defaultState: WidgetState.Open,
            isFreeform: true,
            iconClass: "icon-home",
            labelKey: "SampleApp:Test.my-label",
            appButtonId: "SampleApp.BackstageToggle",
            horizontalIds: ["tool1", "tool2", "my-group1"],
            verticalIds: ["item4", "my-group2"],
          },
        ],
      },
      topCenter: {
        defaultState: ZoneState.Open,
        allowsMerging: false,
        widgetProps: [
          {
            defaultState: WidgetState.Open,
            isFreeform: false,
            iconClass: "icon-home",
            labelKey: "SampleApp:Test.my-label",
            isToolSettings: true,
          },
        ],
      },
      topRight: {
        defaultState: ZoneState.Open,
        allowsMerging: false,
        widgetProps: [
          {
            classId: "NavigationWidget",
            defaultState: WidgetState.Open,
            isFreeform: true,
            iconClass: "my-icon",
            labelKey: "SampleApp:Test.my-label",
            navigationAidId: "StandardRotationNavigationAid",
            horizontalIds: ["item5", "item6", "item7", "item8"],
          },
        ],
      },
      centerRight: {
        defaultState: ZoneState.Open,
        allowsMerging: true,
        widgetProps: [
          {
            classId: "NavigationTreeWidget",
            defaultState: WidgetState.Open,
            iconClass: "icon-placeholder",
            labelKey: "SampleApp:Test.my-label",
          },
          {
            classId: "HorizontalPropertyGridDemoWidget",
            defaultState: WidgetState.Open,
            iconClass: "icon-placeholder",
            labelKey: "SampleApp:Test.my-label",
          },
        ],
      },
      bottomCenter: {
        defaultState: ZoneState.Open,
        allowsMerging: false,
        widgetProps: [
          {
            classId: "AppStatusBar",
            defaultState: WidgetState.Open,
            iconClass: "icon-placeholder",
            labelKey: "SampleApp:Test.my-label",
            isFreeform: false,
            isStatusBar: true,
          },
        ],
      },
      bottomRight: {
        defaultState: ZoneState.Open,
        allowsMerging: true,
        widgetProps: [
          {
            classId: "VerticalPropertyGridDemoWidget",
            defaultState: WidgetState.Open,
            iconClass: "icon-placeholder",
            labelKey: "SampleApp:Test.my-label",
          },
        ],
      },
    };

    return frontstageProps;
  }
}
