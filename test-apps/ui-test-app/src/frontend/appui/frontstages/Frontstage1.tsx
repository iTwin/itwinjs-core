/*---------------------------------------------------------------------------------------------
* Copyright (c) 2019 Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/
import * as React from "react";

import {
  GroupButton,
  ToolButton,
  ToolWidget,
  ZoneState,
  WidgetState,
  NavigationWidget,
  Frontstage,
  Zone,
  Widget,
  FrontstageProvider,
  FrontstageProps,
  ZoneLocation,
  ActionItemButton,
  CommandItemDef,
  FrontstageManager,
  CoreTools,
  ContentLayoutManager,
  StagePanel,
} from "@bentley/ui-framework";

import { AppStatusBarWidgetControl } from "../statusbars/AppStatusBar";
// import { NavigationTreeWidgetControl } from "../widgets/NavigationTreeWidget";
import { VerticalPropertyGridWidgetControl, HorizontalPropertyGridWidgetControl } from "../widgets/PropertyGridDemoWidget";

import { Toolbar, Direction } from "@bentley/ui-ninezone";
import { AppTools } from "../../tools/ToolSpecifications";
import { NestedFrontstage1 } from "./NestedFrontstage1";

export class Frontstage1 extends FrontstageProvider {

  public get frontstage(): React.ReactElement<FrontstageProps> {
    return (
      <Frontstage id="Test1"
        defaultTool={AppTools.appSelectElementCommand}
        defaultLayout="TwoHalvesVertical"
        contentGroup="TestContentGroup1"
        defaultContentId="TestContent1"
        isInFooterMode={true}
        applicationData={{ key: "value" }}
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
        /** The HorizontalPropertyGrid in zone 9 should be merged across zones 6 & 9 and take up the height of both zones initially.
         *  The zones can be resized manually to take up the full height.
         */
        centerRight={
          <Zone defaultState={ZoneState.Open} allowsMerging={true} mergeWithZone={ZoneLocation.BottomRight}
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
          <Zone defaultState={ZoneState.Open} allowsMerging={true}
            widgets={[
              <Widget defaultState={WidgetState.Open} iconSpec="icon-placeholder" labelKey="SampleApp:widgets.HorizontalPropertyGrid" control={HorizontalPropertyGridWidgetControl} fillZone={true} />,
              <Widget id="VerticalPropertyGrid" defaultState={WidgetState.Hidden} iconSpec="icon-placeholder" labelKey="SampleApp:widgets.VerticalPropertyGrid" control={VerticalPropertyGridWidgetControl} />,
            ]}
          />
        }

        topMostPanel={
          <StagePanel size="64px"
            widgets={[
              <Widget element={<h2>TopMost panel</h2>} />,
            ]}
          />
        }
        topPanel={
          <StagePanel size="64px"
            widgets={[
              <Widget element={<h2>Top panel</h2>} />,
            ]}
          />
        }
        leftPanel={
          <StagePanel size="100px"
            widgets={[
              <Widget element={<h2>Left panel</h2>} />,
            ]}
          />
        }
        rightPanel={
          <StagePanel size="100px"
            widgets={[
              <Widget element={<h2>Right panel</h2>} />,
            ]}
          />
        }
        bottomPanel={
          <StagePanel size="64px"
            widgets={[
              <Widget element={<h2>Bottom panel</h2>} />,
            ]}
          />
        }
        bottomMostPanel={
          <StagePanel size="64px"
            widgets={[
              <Widget element={<h2>BottomMost panel</h2>} />,
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
  /** Command that opens a nested Frontstage */
  private get _openNestedFrontstage1() {
    return new CommandItemDef({
      iconSpec: "icon-placeholder",
      labelKey: "SampleApp:buttons.openNestedFrontstage1",
      execute: async () => {
        const frontstageProvider = new NestedFrontstage1();
        const frontstageDef = frontstageProvider.initializeDef();
        await FrontstageManager.openNestedFrontstage(frontstageDef);
      },
    });
  }

  /** Command that opens switches the content layout */
  private get _switchLayout() {
    return new CommandItemDef({
      iconSpec: "icon-placeholder",
      labelKey: "SampleApp:buttons.switchLayout",
      execute: async () => {
        const activeFrontstageDef = FrontstageManager.activeFrontstageDef;
        if (activeFrontstageDef) {
          const contentLayout = ContentLayoutManager.findLayout("TwoHalvesHorizontal");
          if (contentLayout && activeFrontstageDef.contentGroup) {
            ContentLayoutManager.setActiveLayout(contentLayout, activeFrontstageDef.contentGroup);
          }
        }
      },
    });
  }

  private _horizontalToolbar =
    <Toolbar
      expandsTo={Direction.Bottom}
      items={
        <>
          <ActionItemButton actionItem={AppTools.appSelectElementCommand} />
          <ActionItemButton actionItem={AppTools.item1} />
          <ActionItemButton actionItem={AppTools.item2} />
          <ActionItemButton actionItem={this._openNestedFrontstage1} />
          <ActionItemButton actionItem={this._switchLayout} />
        </>
      }
    />;

  private _verticalToolbar =
    <Toolbar
      expandsTo={Direction.Right}
      items={
        <>
          <ActionItemButton actionItem={CoreTools.rotateViewCommand} />
          <ToolButton toolId={AppTools.tool1.id} iconSpec={AppTools.tool1.iconSpec!} labelKey={AppTools.tool1.label} execute={AppTools.tool1.execute} />
          <ToolButton toolId={AppTools.tool2.id} iconSpec={AppTools.tool2.iconSpec!} labelKey={AppTools.tool2.label} execute={AppTools.tool2.execute} />
          <GroupButton
            labelKey="SampleApp:buttons.anotherGroup"
            iconSpec="icon-placeholder"
            items={[AppTools.tool1, AppTools.tool2, AppTools.item3, AppTools.item4, AppTools.item5,
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
          <ToolButton toolId={AppTools.item5.id} iconSpec={AppTools.item5.iconSpec!} labelKey={AppTools.item5.label} execute={AppTools.item5.execute} />
          <ToolButton toolId={AppTools.item6.id} iconSpec={AppTools.item6.iconSpec!} labelKey={AppTools.item6.label} execute={AppTools.item6.execute} />
        </>
      }
    />;

  private _verticalToolbar =
    <Toolbar
      expandsTo={Direction.Right}
      items={
        <>
          <ToolButton toolId={AppTools.item7.id} iconSpec={AppTools.item7.iconSpec!} labelKey={AppTools.item7.label} execute={AppTools.item7.execute} />
          <ToolButton toolId={AppTools.item8.id} iconSpec={AppTools.item8.iconSpec!} labelKey={AppTools.item8.label} execute={AppTools.item8.execute} />
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
