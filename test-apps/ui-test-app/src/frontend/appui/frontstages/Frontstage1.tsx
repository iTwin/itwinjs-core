/*---------------------------------------------------------------------------------------------
* Copyright (c) 2018 Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/
import * as React from "react";

import {
  FrontstageProps,
  GroupButton,
  ToolButton,
  ToolWidget,
  ZoneState,
  WidgetState,
  NavigationWidget,
  FrontstageDef,
} from "@bentley/ui-framework";

import { AppStatusBarWidgetControl } from "../statusbars/AppStatusBar";
import { NavigationTreeWidgetControl } from "../widgets/NavigationTreeWidget";
import { VerticalPropertyGridWidgetControl, HorizontalPropertyGridWidgetControl } from "../widgets/PropertyGridDemoWidget";

import Toolbar from "@bentley/ui-ninezone/lib/toolbar/Toolbar";
import Direction from "@bentley/ui-ninezone/lib/utilities/Direction";

export class Frontstage1 extends FrontstageDef {

  constructor() {
    super();
    this.initializeFromProps(this.defineProps());
  }

  public defineProps(): FrontstageProps {
    const frontstageProps: FrontstageProps = {
      id: "Test1",
      defaultToolId: "PlaceLine",
      defaultLayout: "TwoHalvesVertical",
      contentGroup: "TestContentGroup1",
      defaultContentId: "TestContent1",
      isInFooterMode: false,
      applicationData: { key: "value" },

      topLeft: {
        defaultState: ZoneState.Open,
        allowsMerging: false,
        applicationData: { key: "value" },
        widgetProps: [
          {
            defaultState: WidgetState.Open,
            isFreeform: true,
            applicationData: { key: "value" },
            reactElement: this.getToolWidget(),
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
            isToolSettings: true,
          },
        ],
      },
      topRight: {
        defaultState: ZoneState.Open,
        allowsMerging: false,
        widgetProps: [
          {
            defaultState: WidgetState.Open,
            isFreeform: true,
            reactElement: this.getNavigationWidget(),
          },
        ],
      },
      centerRight: {
        defaultState: ZoneState.Open,
        allowsMerging: true,
        widgetProps: [
          {
            classId: NavigationTreeWidgetControl,
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
            classId: AppStatusBarWidgetControl,
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
            classId: VerticalPropertyGridWidgetControl,
            defaultState: WidgetState.Open,
            iconClass: "icon-placeholder",
            labelKey: "SampleApp:Test.my-label",
          },
          {
            classId: HorizontalPropertyGridWidgetControl,
            defaultState: WidgetState.Open,
            iconClass: "icon-placeholder",
            labelKey: "SampleApp:Test.my-label",
          },
        ],
      },
    };

    return frontstageProps;
  }

  /** Define a ToolWidget with Buttons to display in the TopLeft zone.
   */
  private getToolWidget(): React.ReactNode {
    const horizontalToolbar =
      <Toolbar
        expandsTo={Direction.Bottom}
        items={
          <>
            <ToolButton toolId="tool1" iconClass="icon-placeholder" labelKey="SampleApp:buttons.tool1" />
            <ToolButton toolId="tool2" iconClass="icon-placeholder" labelKey="SampleApp:buttons.tool2" />
            <GroupButton
              labelKey="SampleApp:buttons.toolGroup"
              iconClass="icon-placeholder"
              items={["tool1", "tool2", "item3", "item4", "item5", "item6", "item7", "item8", "tool1", "tool2", "item3", "item4", "item5", "item6", "item7", "item8"]}
              direction={Direction.Bottom}
              itemsInColumn={7}
            />
          </>
        }
      />;

    const verticalToolbar =
      <Toolbar
        expandsTo={Direction.Right}
        items={
          <>
            <ToolButton toolId="tool1" iconClass="icon-placeholder" labelKey="SampleApp:buttons.tool1" />
            <ToolButton toolId="tool2" iconClass="icon-placeholder" labelKey="SampleApp:buttons.tool2" />
            <GroupButton
              labelKey="SampleApp:buttons.anotherGroup"
              iconClass="icon-placeholder"
              items={["tool1", "tool2", "item3", "item4", "item5", "item6", "item7", "item8"]}
            />
          </>
        }
      />;

    return (
      <ToolWidget
        appButtonId="SampleApp.BackstageToggle"
        horizontalToolbar={horizontalToolbar}
        verticalToolbar={verticalToolbar}
      />
    );
  }

  /** Define a NavigationWidget with Buttons to display in the TopRight zone.
   */
  private getNavigationWidget(): React.ReactNode {

    const horizontalToolbar =
      <Toolbar
        expandsTo={Direction.Bottom}
        items={
          <>
            <ToolButton toolId="item5" iconClass="icon-placeholder" labelKey="SampleApp:buttons.item5" />
            <ToolButton toolId="item6" iconClass="icon-placeholder" labelKey="SampleApp:buttons.item6" />
          </>
        }
      />;

    const verticalToolbar =
      <Toolbar
        expandsTo={Direction.Right}
        items={
          <>
            <ToolButton toolId="item7" iconClass="icon-placeholder" labelKey="SampleApp:buttons.item7" />
            <ToolButton toolId="item8" iconClass="icon-placeholder" labelKey="SampleApp:buttons.item8" />
          </>
        }
      />;

    return (
      <NavigationWidget
        navigationAidId="StandardNavigationNavigationAid"
        horizontalToolbar={horizontalToolbar}
        verticalToolbar={verticalToolbar}
      />
    );
  }
}
