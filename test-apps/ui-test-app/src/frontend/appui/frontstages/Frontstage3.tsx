/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import * as React from "react";
import { StandardContentLayouts, WidgetState } from "@itwin/appui-abstract";
import {
  ActionItemButton, ContentGroup, CoreTools, Frontstage, FrontstageProps, FrontstageProvider, GroupButton, IModelViewportControl,
  NavigationWidget, ToolButton, ToolWidget, UiFramework, Widget, Zone, ZoneLocation, ZoneState,
} from "@itwin/appui-react";
import { Direction, Toolbar } from "@itwin/appui-layout-react";
import { AppTools } from "../../tools/ToolSpecifications";
import { IModelViewportControl as App_IModelViewport } from "../contentviews/IModelViewport";
import { SmallStatusBarWidgetControl } from "../statusbars/SmallStatusBar";
import { NavigationTreeWidgetControl } from "../widgets/NavigationTreeWidget";
import { HorizontalPropertyGridWidgetControl, VerticalPropertyGridWidgetControl } from "../widgets/PropertyGridDemoWidget";
import { TableDemoWidgetControl } from "../widgets/TableDemoWidget";
import { ReactTableDemoContentControl } from "../table-demo/ReactTableDemo";

/* eslint-disable react/jsx-key, deprecation/deprecation */

export class Frontstage3 extends FrontstageProvider {
  public get id(): string {
    return "Test3";
  }

  private getDefaultViewState = () => {
    return UiFramework.getDefaultViewState()?.clone();
  };

  public get frontstage(): React.ReactElement<FrontstageProps> {

    const myContentGroup: ContentGroup = new ContentGroup(
      {
        id: "ui-test-app:Frontstage3ContentGroup",
        layout: StandardContentLayouts.fourQuadrants,
        contents: [
          {
            id: "imodelView1",
            classId: IModelViewportControl.id,
            applicationData: { viewState: UiFramework.getDefaultViewState, iModelConnection: UiFramework.getIModelConnection },
          },
          {
            id: "reactTableView",
            classId: ReactTableDemoContentControl,
          },
          {
            id: "imodelView2",
            classId: App_IModelViewport.id,
            applicationData: { viewState: this.getDefaultViewState, iModelConnection: UiFramework.getIModelConnection },
          },
          {
            id: "oldTableView",
            classId: "TableExampleContent",
          },
        ],
      },
    );

    return (
      <Frontstage
        id={this.id}
        defaultTool={CoreTools.selectElementCommand}
        contentGroup={myContentGroup}
        isInFooterMode={true}
        contentManipulationTools={
          <Zone
            widgets={[
              <Widget isFreeform={true} element={this.getToolWidget()} />,
            ]}
          />
        }
        toolSettings={
          <Zone
            widgets={[
              <Widget isToolSettings={true} />,
            ]}
          />
        }
        viewNavigationTools={
          <Zone
            widgets={[
              <Widget isFreeform={true} element={this.getNavigationWidget()} />,
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
        bottomLeft={
          <Zone allowsMerging={true} defaultState={ZoneState.Minimized}
            widgets={[
              <Widget iconSpec="icon-placeholder" labelKey="SampleApp:widgets.TableDemo" control={TableDemoWidgetControl} />,
            ]}
          />
        }
        statusBar={
          <Zone defaultState={ZoneState.Open}
            widgets={[
              <Widget isStatusBar={true} control={SmallStatusBarWidgetControl} />,
            ]}
          />
        }
        bottomRight={
          <Zone allowsMerging={true} defaultState={ZoneState.Minimized} mergeWithZone={ZoneLocation.CenterRight}
            widgets={[
              <Widget id="VerticalPropertyGrid" defaultState={WidgetState.Hidden} iconSpec="icon-placeholder" labelKey="SampleApp:widgets.VerticalPropertyGrid" control={VerticalPropertyGridWidgetControl} />,
              <Widget defaultState={WidgetState.Open} iconSpec="icon-placeholder" labelKey="SampleApp:widgets.HorizontalPropertyGrid" control={HorizontalPropertyGridWidgetControl} />,
            ]}
          />
        }
      // bottomPanel={
      //   <StagePanel
      //     widgets={[
      //       <Widget iconSpec="icon-placeholder" label="Large Table" control={TableExampleWidgetControl} />,
      //     ]}
      //   />
      // }
      />
    );
  }

  /** Define a ToolWidget with Buttons to display in the TopLeft zone.
   */
  private getToolWidget(): React.ReactNode {

    const horizontalToolbar =
      <Toolbar
        expandsTo={Direction.Bottom}
        items={
          <>
            <ActionItemButton actionItem={AppTools.item1} />
            <ActionItemButton actionItem={AppTools.item2} />
            <GroupButton
              labelKey="SampleApp:buttons.toolGroup"
              iconSpec="icon-placeholder"
              items={[AppTools.tool1, AppTools.tool2, AppTools.infoMessageCommand, AppTools.warningMessageCommand, AppTools.errorMessageCommand, AppTools.noIconMessageCommand, AppTools.item6, AppTools.item7, AppTools.item8]}
              direction={Direction.Bottom}
              itemsInColumn={5}
            />
          </>
        }
      />;

    const verticalToolbar =
      <Toolbar
        expandsTo={Direction.Right}
        items={
          <>
            <ToolButton toolId={AppTools.tool1.id} iconSpec={AppTools.tool1.iconSpec} labelKey={AppTools.tool1.label} execute={AppTools.tool1.execute} />
            <ToolButton toolId={AppTools.tool2.id} iconSpec={AppTools.tool2.iconSpec} labelKey={AppTools.tool2.label} execute={AppTools.tool2.execute} />
            <GroupButton
              labelKey="SampleApp:buttons.toolGroup"
              iconSpec="icon-placeholder"
              items={[AppTools.successMessageBoxCommand, AppTools.informationMessageBoxCommand, AppTools.questionMessageBoxCommand, AppTools.warningMessageBoxCommand, AppTools.errorMessageBoxCommand, AppTools.openMessageBoxCommand, AppTools.openMessageBoxCommand2]}
              direction={Direction.Right}
              itemsInColumn={7}
            />
          </>
        }
      />;

    return (
      <ToolWidget
        appButton={AppTools.backstageToggleCommand}
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
            <ToolButton toolId={AppTools.item5.id} iconSpec={AppTools.item5.iconSpec} labelKey={AppTools.item5.label} execute={AppTools.item5.execute} />
            <ToolButton toolId={AppTools.item6.id} iconSpec={AppTools.item6.iconSpec} labelKey={AppTools.item6.label} execute={AppTools.item6.execute} />
            <GroupButton
              labelKey="SampleApp:buttons.toolGroup"
              iconSpec="icon-placeholder"
              items={[AppTools.infoMessageCommand, AppTools.warningMessageCommand, AppTools.errorMessageCommand]}
              direction={Direction.Bottom}
              itemsInColumn={4}
            />
          </>
        }
      />;

    const verticalToolbar =
      <Toolbar
        expandsTo={Direction.Right}
        items={
          <>
            <ToolButton toolId={AppTools.item7.id} iconSpec={AppTools.item7.iconSpec} labelKey={AppTools.item7.label} execute={AppTools.item7.execute} />
            <ToolButton toolId={AppTools.item8.id} iconSpec={AppTools.item8.iconSpec} labelKey={AppTools.item8.label} execute={AppTools.item8.execute} />
          </>
        }
      />;

    return (
      <NavigationWidget
        navigationAidId="CubeNavigationAid"
        horizontalToolbar={horizontalToolbar}
        verticalToolbar={verticalToolbar}
      />
    );
  }
}
