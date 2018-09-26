/*---------------------------------------------------------------------------------------------
| $Copyright: (c) 2018 Bentley Systems, Incorporated. All rights reserved. $
 *--------------------------------------------------------------------------------------------*/
import * as React from "react";

import { Id64Props, BeDuration } from "@bentley/bentleyjs-core";

import {
  IModelConnection,
  IModelApp,
  ActivityMessageDetails,
  ActivityMessageEndReason,
  NotifyMessageDetails,
  OutputMessagePriority,
  OutputMessageType,
} from "@bentley/imodeljs-frontend";

import { FrontstageProps, FrontstageManager } from "@bentley/ui-framework";
import { GroupButton } from "@bentley/ui-framework";
import { ToolButton, ToolItemDef, CommandItemDef } from "@bentley/ui-framework";
import { ToolWidget } from "@bentley/ui-framework";
import { ZoneState } from "@bentley/ui-framework";
import { WidgetState } from "@bentley/ui-framework";
import { NavigationWidget } from "@bentley/ui-framework";
import { ContentLayoutDef, ContentLayoutProps } from "@bentley/ui-framework";
import { ContentGroup, ContentProps } from "@bentley/ui-framework";
import { ModalDialogManager } from "@bentley/ui-framework";

import Toolbar from "@bentley/ui-ninezone/lib/toolbar/Toolbar";
import Direction from "@bentley/ui-ninezone/lib/utilities/Direction";

import { AppUi } from "../AppUi";
import { TestRadialMenu } from "../dialogs/TestRadialMenu";

import { SampleAppIModelApp } from "../../../frontend/index";

import ViewSelector from "@bentley/ui-framework/lib/pickers/ViewSelector";

import rotateIcon from "../icons/rotate.svg";
import SvgSprite from "@bentley/ui-ninezone/lib/base/SvgSprite";

export class ViewsFrontstage {

  constructor(public viewIds: Id64Props[], private _iModelConnection: IModelConnection) {
  }

  public defineProps(): FrontstageProps | undefined {
    // first find an appropriate layout
    const contentLayoutProps: ContentLayoutProps | undefined = AppUi.findLayoutFromContentCount(this.viewIds.length);
    if (!contentLayoutProps)
      return undefined;
    const contentLayoutDef: ContentLayoutDef = new ContentLayoutDef(contentLayoutProps);

    // create the content props.
    const contentProps: ContentProps[] = [];
    for (const viewId of this.viewIds) {
      const thisContentProps: ContentProps = {
        classId: "IModelViewport",
        applicationData: { viewId, iModelConnection: this._iModelConnection },
      };
      contentProps.push(thisContentProps);
    }
    const myContentGroup: ContentGroup = new ContentGroup({ contents: contentProps });

    const frontstageProps: FrontstageProps = {
      id: "ViewsFrontstage",
      defaultToolId: "PlaceLine",
      defaultLayout: contentLayoutDef,
      contentGroup: myContentGroup,
      isInFooterMode: true,
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
        defaultState: ZoneState.Minimized,
        allowsMerging: true,
        widgetProps: [
          {
            classId: "NavigationTreeWidget",
            defaultState: WidgetState.Open,
            iconClass: "icon-placeholder",
            labelKey: "SampleApp:Test.my-label",
          },
          {
            classId: "BreadcrumbDemoWidget",
            defaultState: WidgetState.Open,
            iconClass: "icon-placeholder",
            labelKey: "SampleApp:Test.my-label",
          },
          {
            classId: "ModelSelectorWidget",
            defaultState: WidgetState.Open,
            iconClass: "icon-3d-cube",
            labelKey: "SampleApp:Test.my-label",
            applicationData: { iModel: SampleAppIModelApp.store.getState().sampleAppState!.currentIModelConnection },
          },
        ],
      },
      bottomLeft: {
        defaultState: ZoneState.Minimized,
        allowsMerging: true,
        widgetProps: [
          {
            classId: "FeedbackWidget",
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
        defaultState: ZoneState.Minimized,
        allowsMerging: true,
        widgetProps: [
          {
            id: "VerticalPropertyGrid",
            classId: "VerticalPropertyGridDemoWidget",
            defaultState: WidgetState.Off,
            iconClass: "icon-placeholder",
            labelKey: "SampleApp:Test.my-label",
          },
          {
            classId: "HorizontalPropertyGridDemoWidget",
            defaultState: WidgetState.Off,
            iconClass: "icon-placeholder",
            labelKey: "SampleApp:Test.my-label",
          },
        ],
      },
    };

    return frontstageProps;
  }

  private _fitToViewCommand = () => {
    IModelApp.tools.run("View.Fit", IModelApp.viewManager.selectedView, true);
  }

  private _windowAreaCommand = () => {
    IModelApp.tools.run("View.WindowArea", IModelApp.viewManager.selectedView);
  }

  private _toggleCameraCommand = () => {
    IModelApp.tools.run("View.ToggleCamera", IModelApp.viewManager.selectedView);
  }

  private _walkCommand = () => {
    IModelApp.tools.run("View.Walk", IModelApp.viewManager.selectedView);
  }

  private _rotateCommand = () => {
    IModelApp.tools.run("View.Rotate", IModelApp.viewManager.selectedView);
  }

  private _measurePointsCommand = () => {
    IModelApp.tools.run("Measure.Points", IModelApp.viewManager.selectedView);
  }

  private _tool1 = () => {
    const activeFrontstageDef = FrontstageManager.activeFrontstageDef;
    if (activeFrontstageDef) {
      const widgetDef = activeFrontstageDef.findWidgetDef("VerticalPropertyGrid");
      if (widgetDef) {
        widgetDef.setWidgetState(WidgetState.Open);
      }
    }
  }

  private _tool2 = () => {
    const activeFrontstageDef = FrontstageManager.activeFrontstageDef;
    if (activeFrontstageDef) {
      const widgetDef = activeFrontstageDef.findWidgetDef("VerticalPropertyGrid");
      if (widgetDef) {
        const widgetControl = widgetDef.widgetControl;
        if (widgetControl)
          widgetControl.setWidgetState(WidgetState.Off);
      }
    }
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
    const midX = window.innerWidth / 2;
    const midY = window.innerHeight / 2;
    const offset = 200;
    switch (event.keyCode) {
      case 37:
        details.briefMessage = "Left pressed";
        details.setPointerTypeDetails(IModelApp.viewManager.selectedView!.parentDiv, { x: midX - offset, y: midY });
        IModelApp.notifications.outputMessage(details);
        break;
      case 38:
        details.briefMessage = "Up pressed";
        details.setPointerTypeDetails(IModelApp.viewManager.selectedView!.parentDiv, { x: midX, y: midY - offset });
        IModelApp.notifications.outputMessage(details);
        break;
      case 39:
        details.briefMessage = "Right pressed";
        details.setPointerTypeDetails(IModelApp.viewManager.selectedView!.parentDiv, { x: midX + offset, y: midY });
        IModelApp.notifications.outputMessage(details);
        break;
      case 40:
        details.briefMessage = "Down pressed";
        details.setPointerTypeDetails(IModelApp.viewManager.selectedView!.parentDiv, { x: midX, y: midY + offset });
        IModelApp.notifications.outputMessage(details);
        break;
    }
  }

  private _handleTool4Dismiss = () => {
    IModelApp.notifications.closePointerMessage();
    document.removeEventListener("keyup", this._handleTool4Keypress);
    document.removeEventListener("mousemove", this._handleTool4Dismiss);
  }

  private rotateSvgIcon(): React.ReactNode {
    return (
      <SvgSprite src={rotateIcon} />
    );
  }

  /** Define a ToolWidget with Buttons to display in the TopLeft zone.
   */
  private getToolWidget(): React.ReactNode {
    const myToolItem1 = new ToolItemDef({
      toolId: "tool1",
      iconClass: "icon-placeholder",
      labelKey: "SampleApp:buttons.tool1",
      applicationData: { key: "value" },
    });

    const setLengthFormatMetricCommand = new CommandItemDef({
      commandId: "setLengthFormatMetric",
      iconClass: "icon-info",
      labelKey: "SampleApp:buttons.setLengthFormatMetric",
      commandHandler: {
        execute: () => {
          IModelApp.quantityFormatter.useImperialFormats = false;
          IModelApp.notifications.outputMessage(new NotifyMessageDetails(OutputMessagePriority.Info, "Set Length Format to Metric"));
        },
      },
    });

    const setLengthFormatImperialCommand = new CommandItemDef({
      commandId: "setLengthFormatImperial",
      iconClass: "icon-info",
      labelKey: "SampleApp:buttons.setLengthFormatImperial",
      commandHandler: {
        execute: () => {
          IModelApp.quantityFormatter.useImperialFormats = true;
          IModelApp.notifications.outputMessage(new NotifyMessageDetails(OutputMessagePriority.Info, "Set Length Format to Imperial"));
        },
      },
    });

    const horizontalToolbar =
      <Toolbar
        expandsTo={Direction.Bottom}
        items={
          <>
            <ToolButton toolId="Select" iconClass="icon-zoom" />
            <ToolButton toolId="fitToView" iconClass="icon-fit-to-view" execute={this._fitToViewCommand} />
            <ToolButton toolId="windowArea" iconClass="icon-window-area" execute={this._windowAreaCommand} />
            <ToolButton toolId="toggleCamera" iconClass="icon-camera" execute={this._toggleCameraCommand} />
            <ToolButton toolId="walk" iconClass="icon-walk" execute={this._walkCommand} />
            <ToolButton toolId="rotate" iconElement={this.rotateSvgIcon()} execute={this._rotateCommand} />
            <ToolButton toolId="measure" iconClass="icon-measure-distance" execute={this._measurePointsCommand} />
            <GroupButton
              labelKey="SampleApp:buttons.toolGroup"
              iconClass="icon-placeholder"
              items={[setLengthFormatMetricCommand, setLengthFormatImperialCommand]}
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
            <ToolButton toolId="tool1" iconClass="icon-placeholder" labelKey="SampleApp:buttons.tool1" isEnabled={false} execute={this._tool1} />
            <ToolButton toolId="tool2" iconClass="icon-placeholder" labelKey="SampleApp:buttons.tool2" isEnabled={false} execute={this._tool2} />
            <ToolButton toolId="tool3" iconClass="icon-placeholder" labelKey="SampleApp:buttons.tool3" isVisible={false} execute={this._tool3} />
            <ToolButton toolId="tool4" iconClass="icon-placeholder" labelKey="SampleApp:buttons.tool4" isVisible={false} execute={this._tool4} />
            <ToolButton toolId="openRadial" iconClass="icon-placeholder" execute={() => ModalDialogManager.openModalDialog(this.radialMenu())} />
            <GroupButton
              labelKey="SampleApp:buttons.anotherGroup"
              iconClass="icon-placeholder"
              items={[myToolItem1, "tool2", "item3", "item4", "item5", "item6", "item7", "item8"]}
              direction={Direction.Right}
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

  private radialMenu(): React.ReactNode {
    return (
      <TestRadialMenu
        opened={true} />
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
            <ToolButton toolId="item5" iconClass="icon-placeholder" labelKey="SampleApp:buttons.item5" execute={() => IModelApp.notifications.outputMessage(new NotifyMessageDetails(OutputMessagePriority.Info, "Test"))} />
            <ToolButton toolId="item6" iconClass="icon-placeholder" labelKey="SampleApp:buttons.item6" />
            <ViewSelector imodel={SampleAppIModelApp.store.getState().sampleAppState!.currentIModelConnection} />
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
        navigationAidId="CubeNavigationAid"
        horizontalToolbar={horizontalToolbar}
        verticalToolbar={verticalToolbar}
      />
    );
  }
}
