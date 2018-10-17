/*---------------------------------------------------------------------------------------------
* Copyright (c) 2018 Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/
import * as React from "react";

import {
  IModelApp,
  NotifyMessageDetails,
  OutputMessagePriority,
  OutputMessageType,
  MessageBoxType,
  MessageBoxIconType,
  MessageBoxValue,
} from "@bentley/imodeljs-frontend";

import { SnapMode } from "@bentley/imodeljs-frontend";
import { SampleAppIModelApp } from "../..";
import { MessageSeverity } from "@bentley/ui-core";

import {
  FrontstageProps,
  FrontstageManager,
  GroupButton,
  ToolButton, ToolItemDef, CommandButton, CommandItemDef,
  ToolWidget,
  ZoneState,
  WidgetState,
  NavigationWidget,
  ContentGroup,
  ModalDialogManager,
  FrontstageDef,
} from "@bentley/ui-framework";

import { AppStatusBarWidgetControl } from "../statusbars/AppStatusBar";
import { NavigationTreeWidgetControl } from "../widgets/NavigationTreeWidget";
import { VerticalPropertyGridWidgetControl, HorizontalPropertyGridWidgetControl } from "../widgets/PropertyGridDemoWidget";
import { BreadcrumbDemoWidgetControl } from "../widgets/BreadcrumbDemoWidget";
import { TableDemoWidgetControl } from "../widgets/TableDemoWidget";
import { TreeDemoWidgetControl } from "../widgets/TreeDemoWidget";

import Toolbar from "@bentley/ui-ninezone/lib/toolbar/Toolbar";
import Direction from "@bentley/ui-ninezone/lib/utilities/Direction";

import { TestModalDialog } from "../dialogs/TestModalDialog";
import { TestMessageBox } from "../dialogs/TestMessageBox";
import { TestRadialMenu } from "../dialogs/TestRadialMenu";

export class Frontstage4 extends FrontstageDef {

  constructor() {
    super();
    this.initializeFromProps(this.defineProps());
  }

  public defineProps(): FrontstageProps {
    const myContentGroup: ContentGroup = new ContentGroup(
      {
        contents: [
          {
            classId: "CubeContent",
          },
        ],
      },
    );

    const frontstageProps: FrontstageProps = {
      id: "Test4",
      defaultToolId: "PlaceLine",
      defaultLayout: "SingleContent",
      contentGroup: myContentGroup,
      defaultContentId: "TestContent1",
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
            classId: NavigationTreeWidgetControl,
            defaultState: WidgetState.Open,
            iconClass: "icon-placeholder",
            labelKey: "SampleApp:Test.my-label",
          },
          {
            classId: BreadcrumbDemoWidgetControl,
            defaultState: WidgetState.Open,
            iconClass: "icon-placeholder",
            labelKey: "SampleApp:Test.my-label",
          },
          {
            classId: TreeDemoWidgetControl,
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
        defaultState: ZoneState.Minimized,
        allowsMerging: true,
        widgetProps: [
          {
            id: "VerticalPropertyGrid",
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
          {
            classId: TableDemoWidgetControl,
            defaultState: WidgetState.Open,
            iconClass: "icon-placeholder",
            labelKey: "SampleApp:Test.my-label",
          },
        ],
      },
    };

    return frontstageProps;
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
        widgetDef.setWidgetState(WidgetState.Off);
      }
    }
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

    const infoStr = "This is an info message with more text than will fit.";
    const warningStr = "This is a warning message with more text than will fit.";
    const errorStr = "This is an error message with more text than will fit.";
    const fatalStr = "This is a fatal message with more text than will fit.";

    const commandHandler1 = {
      messageId: "", parameters: null,
      execute: () => {
        IModelApp.notifications.outputMessage(new NotifyMessageDetails(OutputMessagePriority.Info, infoStr));
        IModelApp.notifications.outputMessage(new NotifyMessageDetails(OutputMessagePriority.Warning, warningStr));
        IModelApp.notifications.outputMessage(new NotifyMessageDetails(OutputMessagePriority.Error, errorStr));
        IModelApp.notifications.outputMessage(new NotifyMessageDetails(OutputMessagePriority.Fatal, fatalStr));
      },
    };

    const infoMessageCommand = new CommandItemDef({
      commandId: "infoMessage",
      iconClass: "icon-info",
      labelKey: "SampleApp:buttons.informationMessageBox",
      commandHandler: {
        execute: () => {
          let displayString = "Current Snap Mode(s):";

          if (SampleAppIModelApp.store.getState().frameworkState) {
            const snapModes = SampleAppIModelApp.accuSnap.getActiveSnapModes();
            for (const mode of snapModes) {
              if (mode === SnapMode.Bisector) displayString += " Bisector";
              if (mode === SnapMode.Center) displayString += " Center";
              if (mode === SnapMode.Intersection) displayString += " Intersection";
              if (mode === SnapMode.MidPoint) displayString += " MidPoint";
              if (mode === SnapMode.Nearest) displayString += " Nearest";
              if (mode === SnapMode.NearestKeypoint) displayString += " NearestKeypoint";
              if (mode === SnapMode.Origin) displayString += " Origin";
            }
          }

          IModelApp.notifications.outputMessage(new NotifyMessageDetails(OutputMessagePriority.Info, displayString));
        },
      },
    });

    const detailMsg = "This is a description of the alert with lots and lots of words that explains what the user did & what they can do to remedy the situation."; // <br/>Hello <a href=\"http://www.google.com\">Google!</a>
    const warningMessageCommand = new CommandItemDef({
      commandId: "warningMessage",
      iconClass: "icon-status-warning",
      labelKey: "SampleApp:buttons.warningMessageBox",
      commandHandler: {
        execute: () => IModelApp.notifications.outputMessage(new NotifyMessageDetails(OutputMessagePriority.Warning, warningStr, detailMsg, OutputMessageType.Sticky)),
      },
    });
    const errorMessageCommand = new CommandItemDef({
      commandId: "errorMessage",
      iconClass: "icon-status-error",
      labelKey: "SampleApp:buttons.errorMessageBox",
      commandHandler: {
        execute: () => IModelApp.notifications.outputMessage(new NotifyMessageDetails(OutputMessagePriority.Error, errorStr, detailMsg, OutputMessageType.Alert)),
      },
    });

    const horizontalToolbar =
      <Toolbar
        expandsTo={Direction.Bottom}
        items={
          <>
            <ToolButton toolId="tool1" iconClass="icon-placeholder" labelKey="SampleApp:buttons.tool1" execute={this._tool1} />
            <ToolButton toolId="tool2" iconClass="icon-placeholder" labelKey="SampleApp:buttons.tool2" execute={this._tool2} />
            <GroupButton
              labelKey="SampleApp:buttons.toolGroup"
              iconClass="icon-placeholder"
              items={[myToolItem1, "tool2", infoMessageCommand, warningMessageCommand, errorMessageCommand, "item6", "item7", "item8"]}
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
            <ToolButton toolId="tool1" iconClass="icon-placeholder" labelKey="SampleApp:buttons.tool1" />
            <ToolButton toolId="tool2" iconClass="icon-placeholder" labelKey="SampleApp:buttons.tool2" />
            <GroupButton
              labelKey="SampleApp:buttons.anotherGroup"
              iconClass="icon-placeholder"
              items={[myToolItem1, "tool2", "item3", "item4", "item5", "item6", "item7", "item8"]}
              direction={Direction.Right}
            />
            <CommandButton commandId="addMessage" iconClass="icon-placeholder" commandHandler={commandHandler1} />
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

  private modalDialog(): React.ReactNode {
    return (
      <TestModalDialog
        opened={true}
      />
    );
  }

  private messageBox(severity: MessageSeverity, title: string): React.ReactNode {
    return (
      <TestMessageBox
        opened={true}
        severity={severity}
        title={title}
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
            <ToolButton toolId="item6" iconClass="icon-placeholder" labelKey="SampleApp:buttons.item6" />
            <ToolButton toolId="item5" iconClass="icon-placeholder" labelKey="SampleApp:buttons.item5" />
            <ToolButton toolId="openDialog" iconClass="icon-placeholder" execute={() => ModalDialogManager.openModalDialog(this.modalDialog())} />
            <ToolButton toolId="openRadial" iconClass="icon-placeholder" execute={() => ModalDialogManager.openModalDialog(this.radialMenu())} />
          </>
        }
      />;

    const errorMessageCommand = new CommandItemDef({
      commandId: "errorMessage",
      iconClass: "icon-status-error",
      labelKey: "SampleApp:buttons.errorMessageBox",
      commandHandler: {
        execute: () => ModalDialogManager.openModalDialog(this.messageBox(MessageSeverity.Error, IModelApp.i18n.translate("SampleApp:buttons.errorMessageBox"))),
      },
    });
    const successMessageCommand = new CommandItemDef({
      commandId: "successMessage",
      iconClass: "icon-status-success",
      labelKey: "SampleApp:buttons.successMessageBox",
      commandHandler: {
        execute: () => ModalDialogManager.openModalDialog(this.messageBox(MessageSeverity.None, IModelApp.i18n.translate("SampleApp:buttons.successMessageBox"))),
      },
    });
    const informationMessageCommand = new CommandItemDef({
      commandId: "informationMessage",
      iconClass: "icon-info",
      labelKey: "SampleApp:buttons.informationMessageBox",
      commandHandler: {
        execute: () => ModalDialogManager.openModalDialog(this.messageBox(MessageSeverity.Information, IModelApp.i18n.translate("SampleApp:buttons.informationMessageBox"))),
      },
    });
    const questionMessageCommand = new CommandItemDef({
      commandId: "questionMessage",
      iconClass: "icon-help",
      labelKey: "SampleApp:buttons.questionMessageBox",
      commandHandler: {
        execute: () => ModalDialogManager.openModalDialog(this.messageBox(MessageSeverity.Question, IModelApp.i18n.translate("SampleApp:buttons.questionMessageBox"))),
      },
    });
    const warningMessageCommand = new CommandItemDef({
      commandId: "warningMessage",
      iconClass: "icon-status-warning",
      labelKey: "SampleApp:buttons.warningMessageBox",
      commandHandler: {
        execute: () => ModalDialogManager.openModalDialog(this.messageBox(MessageSeverity.Warning, IModelApp.i18n.translate("SampleApp:buttons.warningMessageBox"))),
      },
    });
    const openMessageBoxCommand = new CommandItemDef({
      commandId: "openMessageBox",
      iconClass: "icon-info",
      labelKey: "SampleApp:buttons.openMessageBox",
      commandHandler: {
        execute: () => {
          IModelApp.notifications.openMessageBox(MessageBoxType.Ok, "This is a box opened using IModelApp.notifications.openMessageBox and using promise/then to process result.", MessageBoxIconType.Information)
            .then((value: MessageBoxValue) => { window.alert("Closing message box ... value is " + value); });
        },
      },
    });
    const openMessageBoxCommand2 = new CommandItemDef({
      commandId: "openMessageBox2",
      iconClass: "icon-status-warning",
      labelKey: "SampleApp:buttons.openMessageBox",
      commandHandler: {
        execute: async () => {
          const value: MessageBoxValue = await IModelApp.notifications.openMessageBox(MessageBoxType.YesNo, "This is a box opened using IModelApp.notifications.openMessageBox and using async/await to process result.", MessageBoxIconType.Warning);
          window.alert("Closing message box ... value is " + value);
        },
      },
    });

    const verticalToolbar =
      <Toolbar
        expandsTo={Direction.Left}
        items={
          <>
            <ToolButton toolId="item8" iconClass="icon-placeholder" labelKey="SampleApp:buttons.item8" />
            <ToolButton toolId="item7" iconClass="icon-placeholder" labelKey="SampleApp:buttons.item7" />
            <GroupButton
              labelKey="SampleApp:buttons.toolGroup"
              iconClass="icon-placeholder"
              items={[successMessageCommand, informationMessageCommand, questionMessageCommand, warningMessageCommand, errorMessageCommand, openMessageBoxCommand, openMessageBoxCommand2]}
              direction={Direction.Left}
              itemsInColumn={7}
            />
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
