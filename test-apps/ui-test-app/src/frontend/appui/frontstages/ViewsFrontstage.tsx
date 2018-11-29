/*---------------------------------------------------------------------------------------------
* Copyright (c) 2018 Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/
import * as React from "react";

import { Id64String, BeDuration } from "@bentley/bentleyjs-core";

import {
  IModelConnection,
  IModelApp,
  ActivityMessageDetails,
  ActivityMessageEndReason,
  NotifyMessageDetails,
  OutputMessagePriority,
  OutputMessageType,
  RelativePosition,
} from "@bentley/imodeljs-frontend";

import {
  FrontstageProvider,
  GroupButton,
  ToolButton,
  ToolWidget,
  ZoneState,
  WidgetState,
  NavigationWidget,
  ContentLayoutDef,
  ContentLayoutProps,
  ActionItemButton,
  ContentGroup,
  ContentProps,
  ModalDialogManager,
  ViewSelector,
  ModelSelectorWidgetControl,
  Frontstage,
  Zone,
  Widget,
  GroupItemDef,
  CoreTools,
} from "@bentley/ui-framework";

import Toolbar from "@bentley/ui-ninezone/lib/toolbar/Toolbar";
import Direction from "@bentley/ui-ninezone/lib/utilities/Direction";

import { AppUi } from "../AppUi";
import { TestRadialMenu } from "../dialogs/TestRadialMenu";
import { AppTools } from "../../tools/ToolSpecifications";

import { SampleAppIModelApp } from "../../../frontend/index";

// cSpell:Ignore contentviews statusbars
import { IModelViewportControl } from "../contentviews/IModelViewport";
import { AppStatusBarWidgetControl } from "../statusbars/AppStatusBar";
import { VerticalPropertyGridWidgetControl } from "../widgets/PropertyGridDemoWidget";
import { NavigationTreeWidgetControl } from "../widgets/NavigationTreeWidget";
import { BreadcrumbDemoWidgetControl } from "../widgets/BreadcrumbDemoWidget";

import { FeedbackDemoWidget } from "../widgets/FeedbackWidget";
import { UnifiedSelectionPropertyGridWidgetControl } from "../widgets/UnifiedSelectionPropertyGridWidget";
import { UnifiedSelectionTableWidgetControl } from "../widgets/UnifiedSelectionTableWidget";
// import SvgPath from "@bentley/ui-ninezone/lib/base/SvgPath";

export class ViewsFrontstage extends FrontstageProvider {

  constructor(public viewIds: Id64String[], public iModelConnection: IModelConnection) {
    super();
  }

  public get frontstage() {
    // first find an appropriate layout
    const contentLayoutProps: ContentLayoutProps | undefined = AppUi.findLayoutFromContentCount(this.viewIds.length);
    if (!contentLayoutProps) {
      throw (Error("Could not find layout ContentLayoutProps from number of viewIds: " + this.viewIds.length));
    }

    const contentLayoutDef: ContentLayoutDef = new ContentLayoutDef(contentLayoutProps);

    // create the content props.
    const contentProps: ContentProps[] = [];
    for (const viewId of this.viewIds) {
      const thisContentProps: ContentProps = {
        classId: IModelViewportControl,
        applicationData: { viewId, iModelConnection: this.iModelConnection, rulesetId: "Items" },
      };
      contentProps.push(thisContentProps);
    }
    const myContentGroup: ContentGroup = new ContentGroup({ contents: contentProps });

    return (
      <Frontstage id="ViewsFrontstage"
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
        centerLeft={
          <Zone defaultState={ZoneState.Minimized} allowsMerging={true}
            widgets={[
              <Widget defaultState={WidgetState.Open} iconSpec="icon-placeholder" labelKey="SampleApp:widgets.FeedbackDemo" control={FeedbackDemoWidget} />,
              <Widget iconSpec="icon-placeholder" labelKey="SampleApp:widgets.BreadcrumbDemo" control={BreadcrumbDemoWidgetControl} />,
              <Widget iconSpec="icon-layers" labelKey="SampleApp:widgets.ModelSelector" control={ModelSelectorWidgetControl}
                applicationData={{ iModelConnection: this.iModelConnection }} />,
            ]}
          />
        }
        centerRight={
          <Zone defaultState={ZoneState.Minimized} allowsMerging={true}
            widgets={[
              <Widget iconSpec="icon-placeholder" labelKey="SampleApp:widgets.NavigationTree" control={NavigationTreeWidgetControl}
                applicationData={{ iModelConnection: this.iModelConnection, rulesetId: "Items" }} />,
            ]}
          />
        }
        bottomLeft={
          <Zone defaultState={ZoneState.Minimized} allowsMerging={true}
            widgets={[
              <Widget iconSpec="icon-placeholder" labelKey="SampleApp:widgets.UnifiedSelectionTable" control={UnifiedSelectionTableWidgetControl}
                applicationData={{ iModelConnection: this.iModelConnection, rulesetId: "Items" }} />,
            ]}
          />
        }
        bottomCenter={
          <Zone
            widgets={[
              <Widget isStatusBar={true} iconSpec="icon-placeholder" labelKey="SampleApp:widgets.StatusBar" control={AppStatusBarWidgetControl} />,
            ]}
          />
        }
        bottomRight={
          <Zone defaultState={ZoneState.Minimized} allowsMerging={true}
            widgets={[
              <Widget defaultState={WidgetState.Open} iconSpec="icon-placeholder" labelKey="SampleApp:widgets.UnifiedSelectPropertyGrid"
                control={UnifiedSelectionPropertyGridWidgetControl}
                applicationData={{ iModelConnection: this.iModelConnection, rulesetId: "Items" }} />,
              <Widget id="VerticalPropertyGrid" defaultState={WidgetState.Off} iconSpec="icon-placeholder" labelKey="SampleApp:widgets.VerticalPropertyGrid" control={VerticalPropertyGridWidgetControl} />,
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

  private get _groupItemDef(): GroupItemDef {
    return new GroupItemDef({
      groupId: "nested-group",
      labelKey: "SampleApp:buttons.toolGroup",
      iconSpec: "icon-placeholder",
      items: [AppTools.item1, AppTools.item2, AppTools.item3, AppTools.item4, AppTools.item5,
      AppTools.item6, AppTools.item7, AppTools.item8],
      direction: Direction.Bottom,
      itemsInColumn: 7,
    });
  }

  /** Tool that will start a sample activity and display ActivityMessage.
   */
  private _tool3 = async () => {
    let isCancelled = false;
    let progress = 0;

    const details = new ActivityMessageDetails(true, true, true);
    details.onActivityCancelled = () => {
      isCancelled = true;
    };
    IModelApp.notifications.setupActivityMessage(details);

    while (!isCancelled && progress <= 100) {
      IModelApp.notifications.outputActivityMessage("This is a sample activity message", progress);
      await BeDuration.wait(100);
      progress++;
    }

    const endReason = isCancelled ? ActivityMessageEndReason.Cancelled : ActivityMessageEndReason.Completed;
    IModelApp.notifications.endActivityMessage(endReason);
  }

  /** Tool that will display a pointer message on keyboard presses.
   */
  private _tool4 = () => {
    const details = new NotifyMessageDetails(OutputMessagePriority.Info, "Press an arrow", "Press an arrow and move mouse to dismiss", OutputMessageType.Pointer);
    details.setPointerTypeDetails(IModelApp.viewManager.selectedView!.parentDiv,
      {
        x: window.innerWidth / 2,
        y: window.innerHeight / 2,
      });
    IModelApp.notifications.outputMessage(details);
    document.addEventListener("keyup", this._handleTool4Keypress);
    document.addEventListener("mousemove", this._handleTool4Dismiss);
  }

  private _handleTool4Keypress = (event: any) => {
    const details = new NotifyMessageDetails(OutputMessagePriority.Info, "", "", OutputMessageType.Pointer);
    const viewport = IModelApp.viewManager.selectedView!.parentDiv;
    const midX = window.innerWidth / 2;
    const midY = window.innerHeight / 2;
    switch (event.keyCode) {
      case 37:
        details.briefMessage = "Left pressed";
        details.setPointerTypeDetails(viewport, { x: midX, y: midY }, RelativePosition.Left);
        IModelApp.notifications.outputMessage(details);
        break;
      case 38:
        details.briefMessage = "Up pressed";
        details.setPointerTypeDetails(viewport, { x: midX, y: midY }, RelativePosition.Top);
        IModelApp.notifications.outputMessage(details);
        break;
      case 39:
        details.briefMessage = "Right pressed";
        details.setPointerTypeDetails(viewport, { x: midX, y: midY }, RelativePosition.Right);
        IModelApp.notifications.outputMessage(details);
        break;
      case 40:
        details.briefMessage = "Down pressed";
        details.setPointerTypeDetails(viewport, { x: midX, y: midY }, RelativePosition.Bottom);
        IModelApp.notifications.outputMessage(details);
        break;
    }
  }

  private _handleTool4Dismiss = () => {
    IModelApp.notifications.closePointerMessage();
    document.removeEventListener("keyup", this._handleTool4Keypress);
    document.removeEventListener("mousemove", this._handleTool4Dismiss);
  }

  private radialMenu(): React.ReactNode {
    return (
      <TestRadialMenu
        opened={true} />
    );
  }

  private _horizontalToolbar =
    <Toolbar
      expandsTo={Direction.Bottom}
      items={
        <>
          <ActionItemButton actionItem={CoreTools.selectElementCommand} />
          <ActionItemButton actionItem={AppTools.tool1} />
          <ActionItemButton actionItem={AppTools.tool2} />
          <ActionItemButton actionItem={AppTools.measurePoints} />
          <ActionItemButton actionItem={CoreTools.analysisAnimationCommand} />
          <GroupButton
            labelKey="SampleApp:buttons.toolGroup"
            iconSpec="icon-placeholder"
            items={[AppTools.setLengthFormatMetricCommand, AppTools.setLengthFormatImperialCommand]}
            direction={Direction.Bottom}
            itemsInColumn={4}
          />
        </>
      }
    />;

  private _verticalToolbar =
    <Toolbar
      expandsTo={Direction.Right}
      items={
        <>
          <ActionItemButton actionItem={AppTools.verticalPropertyGridOpenCommand} />
          <ActionItemButton actionItem={AppTools.verticalPropertyGridOffCommand} />
          <ToolButton toolId="tool3" iconSpec="icon-placeholder" labelKey="SampleApp:buttons.tool3" isEnabled={false} execute={this._tool3} />
          <ToolButton toolId="tool4" iconSpec="icon-placeholder" labelKey="SampleApp:buttons.tool4" isVisible={false} execute={this._tool4} />
          <ToolButton toolId="item5" iconSpec="icon-placeholder" labelKey="SampleApp:buttons.outputMessage" execute={() => IModelApp.notifications.outputMessage(new NotifyMessageDetails(OutputMessagePriority.Info, "Test"))} />
          <ToolButton toolId="openRadial" iconSpec="icon-placeholder" labelKey="SampleApp:buttons.openRadial" execute={() => ModalDialogManager.openModalDialog(this.radialMenu())} />
          <GroupButton
            labelKey="SampleApp:buttons.anotherGroup"
            iconSpec="icon-placeholder"
            items={[AppTools.tool1, AppTools.tool2, this._groupItemDef]}
            direction={Direction.Right}
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
          <ActionItemButton actionItem={CoreTools.fitViewCommand} />
          <ActionItemButton actionItem={CoreTools.windowAreaCommand} />
          <ActionItemButton actionItem={CoreTools.zoomViewCommand} />
          <ActionItemButton actionItem={CoreTools.panViewCommand} />
          <ActionItemButton actionItem={CoreTools.rotateViewCommand} />
        </>
      }
    />;

  private _verticalToolbar =
    <Toolbar
      expandsTo={Direction.Left}
      items={
        <>
          <ActionItemButton actionItem={CoreTools.walkViewCommand} />
          <ActionItemButton actionItem={CoreTools.flyViewCommand} />
          <ActionItemButton actionItem={CoreTools.toggleCameraViewCommand} />
          <ViewSelector imodel={SampleAppIModelApp.store.getState().sampleAppState!.currentIModelConnection} />
        </>
      }
    />;

  public render() {
    return (
      <NavigationWidget
        navigationAidId="CubeNavigationAid"
        iModelConnection={SampleAppIModelApp.store.getState().sampleAppState!.currentIModelConnection!}
        horizontalToolbar={this._horizontalToolbar}
        verticalToolbar={this._verticalToolbar}
      />
    );
  }
}
