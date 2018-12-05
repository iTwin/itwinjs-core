/*---------------------------------------------------------------------------------------------
* Copyright (c) 2018 Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/
import * as React from "react";

import {
  GroupButton,
  ToolButton,
  ToolWidget,
  ZoneState,
  NavigationWidget,
  Frontstage,
  Zone,
  Widget,
  FrontstageProvider,
  WidgetState,
  FrontstageProps,
  ContentGroup,
  ContentLayoutDef,
} from "@bentley/ui-framework";

import { AppStatusBarWidgetControl } from "../statusbars/AppStatusBar";
import { NavigationTreeWidgetControl } from "../widgets/NavigationTreeWidget";
import { VerticalPropertyGridWidgetControl, HorizontalPropertyGridWidgetControl, HorizontalPropertyGridContentControl } from "../widgets/PropertyGridDemoWidget";
import { TreeExampleContentControl } from "../contentviews/TreeExampleContent";

import { Toolbar } from "@bentley/ui-ninezone";
import { Direction } from "@bentley/ui-ninezone";
import { AppUi } from "../AppUi";
import { AppTools } from "../../tools/ToolSpecifications";

export class Frontstage2 extends FrontstageProvider {

  public get frontstage(): React.ReactElement<FrontstageProps> {
    const contentLayoutDef: ContentLayoutDef = new ContentLayoutDef(
      { // Four Views, two stacked on the left, two stacked on the right.
        descriptionKey: "SampleApp:ContentLayoutDef.FourQuadrants",
        priority: 85,
        verticalSplit: {
          percentage: 0.50,
          left: { horizontalSplit: { percentage: 0.50, top: 0, bottom: 1 } },
          right: { horizontalSplit: { percentage: 0.50, top: 2, bottom: 3 } },
        },
      },
    );

    const myContentGroup: ContentGroup = new ContentGroup(
      {
        contents: [
          {
            classId: "IModelViewport",
            applicationData: { label: "Content 1a", bgColor: "black" },
          },
          {
            classId: TreeExampleContentControl,
            applicationData: { label: "Content 2a", bgColor: "black" },
          },
          {
            classId: "IModelViewport",
            applicationData: { label: "Content 3a", bgColor: "black" },
          },
          {
            classId: HorizontalPropertyGridContentControl,
            applicationData: { label: "Content 4a", bgColor: "black" },
          },
        ],
      },
    );

    return (
      <Frontstage id="Test2"
        defaultToolId="Select" defaultLayout={contentLayoutDef} contentGroup={myContentGroup}
        isInFooterMode={true} applicationData={{ key: "value" }}

        topLeft={
          <Zone
            widgets={[
              <Widget isFreeform={true} element={<FrontstageToolWidget />} />,
            ]}
          />
        }
        topCenter={
          <Zone
            widgets={[
              <Widget isToolSettings={true} />,
            ]}
          />
        }
        topRight={
          <Zone
            widgets={[
              <Widget isFreeform={true} element={<FrontstageNavigationWidget />} />,
            ]}
          />
        }
        centerRight={
          <Zone allowsMerging={true} defaultState={ZoneState.Minimized}
            widgets={[
              <Widget iconSpec="icon-placeholder" labelKey="SampleApp:widgets.NavigationTree" control={NavigationTreeWidgetControl} />,
            ]}
          />
        }
        bottomCenter={
          <Zone defaultState={ZoneState.Open}
            widgets={[
              <Widget isStatusBar={true} iconSpec="icon-placeholder" labelKey="SampleApp:widgets.StatusBar" control={AppStatusBarWidgetControl} />,
            ]}
          />
        }
        bottomRight={
          <Zone allowsMerging={true} defaultState={ZoneState.Minimized}
            widgets={[
              <Widget id="VerticalPropertyGrid" defaultState={WidgetState.Off} iconSpec="icon-placeholder" labelKey="SampleApp:widgets.VerticalPropertyGrid" control={VerticalPropertyGridWidgetControl} />,
              <Widget defaultState={WidgetState.Off} iconSpec="icon-placeholder" labelKey="SampleApp:widgets.HorizontalPropertyGrid" control={HorizontalPropertyGridWidgetControl} />,
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
  private _horizontalToolbar =
    <Toolbar
      expandsTo={Direction.Bottom}
      items={
        <>
          <ToolButton toolId="tool1" iconSpec="icon-placeholder" labelKey="SampleApp:buttons.tool1" execute={AppUi.tool1} />
          <ToolButton toolId="tool2" iconSpec="icon-placeholder" labelKey="SampleApp:buttons.tool2" execute={AppUi.tool2} />
          <GroupButton
            labelKey="SampleApp:buttons.toolGroup"
            iconSpec="icon-placeholder"
            items={[AppTools.tool1, AppTools.tool2]}
            direction={Direction.Bottom}
            itemsInColumn={7}
          />
        </>
      }
    />;

  private _verticalToolbar =
    <Toolbar
      expandsTo={Direction.Right}
      items={
        <>
          <GroupButton
            labelKey="SampleApp:buttons.anotherGroup"
            iconSpec="icon-placeholder"
            items={[AppTools.item3, AppTools.item4, AppTools.item5,
            AppTools.item6, AppTools.item7, AppTools.item8]}
          />
        </>
      }
    />;

  public render() {
    return (
      <ToolWidget
        appButton={AppTools.backstageToggleCommand}
        horizontalToolbar={this._horizontalToolbar}
        verticalToolbar={this._verticalToolbar}
      />
    );
  }
}

/** Define a NavigationWidget with Buttons to display in the TopRight zone.
 */
class FrontstageNavigationWidget extends React.Component {

  private _horizontalToolbar =
    <Toolbar
      expandsTo={Direction.Bottom}
      items={
        <>
          <ToolButton toolId="item5" iconSpec="icon-placeholder" labelKey="SampleApp:buttons.item5" />
          <ToolButton toolId="item6" iconSpec="icon-placeholder" labelKey="SampleApp:buttons.item6" />
          <ToolButton toolId="item7" iconSpec="icon-placeholder" labelKey="SampleApp:buttons.item7" />
        </>
      }
    />;

  private _verticalToolbar =
    <Toolbar
      expandsTo={Direction.Right}
      items={
        <>
          <ToolButton toolId="item8" iconSpec="icon-placeholder" labelKey="SampleApp:buttons.item8" />
        </>
      }
    />;

  public render() {
    return (
      <NavigationWidget
        navigationAidId="StandardRotationNavigationAid"
        horizontalToolbar={this._horizontalToolbar}
        verticalToolbar={this._verticalToolbar}
      />
    );
  }
}
