/*---------------------------------------------------------------------------------------------
* Copyright (c) 2018 Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/
import * as React from "react";

import {
  IModelApp, NotifyMessageDetails, OutputMessagePriority, MessageBoxValue, SelectionTool,
  OutputMessageType, SnapMode, MessageBoxType, MessageBoxIconType, FitViewTool, WindowAreaTool,
  PanViewTool, RotateViewTool, ViewToggleCameraTool, WalkViewTool, FlyViewTool, ZoomViewTool,
} from "@bentley/imodeljs-frontend";
import { MessageSeverity } from "@bentley/ui-core";
import { CommandItemDef, ToolItemDef, WidgetState, FrontstageManager, ModalDialogManager } from "@bentley/ui-framework";
import { SampleAppIModelApp, RootState } from "../";
import { TestMessageBox } from "../appui/dialogs/TestMessageBox";

export class AppTools {
  public static get tool1() {
    return new ToolItemDef({
      toolId: "tool1",
      iconClass: "icon-placeholder",
      labelKey: "SampleApp:buttons.tool1",
      applicationData: { key: "value" },
      commandHandler: {
        execute: () => {
          IModelApp.tools.run(SelectionTool.toolId);
        },
      },
    });
  }

  // Tool that toggles the backstage
  public static get backstageToggleCommand() {
    return new CommandItemDef({
      commandId: "SampleApp.BackstageToggle",
      iconClass: "icon-home",
      labelKey: "SampleApp:tools.",
      commandHandler: {
        execute: () => {
          const state: RootState = SampleAppIModelApp.store.getState();
          const action: string = (state.sampleAppState!.backstageVisible) ? "SampleApp:BACKSTAGEHIDE" : "SampleApp:BACKSTAGESHOW";
          SampleAppIModelApp.store.dispatch({ type: action });
        },
      },
    });
  }

  public static get fitViewCommand() {
    return new CommandItemDef({
      commandId: FitViewTool.toolId,
      iconClass: "icon-fit-to-view",
      labelKey: "SampleApp:tools.fitView",
      commandHandler: {
        execute: () => {
          IModelApp.tools.run(FitViewTool.toolId, IModelApp.viewManager.selectedView, true);
        },
      },
    });
  }

  public static get windowAreaCommand() {
    return new CommandItemDef({
      commandId: WindowAreaTool.toolId,
      iconClass: "icon-window-area",
      labelKey: "SampleApp:tools.windowArea",
      commandHandler: {
        execute: () => {
          IModelApp.tools.run(WindowAreaTool.toolId, IModelApp.viewManager.selectedView);
        },
      },
    });
  }

  public static get zoomViewCommand() {
    return new CommandItemDef({
      commandId: ZoomViewTool.toolId,
      iconClass: "icon-zoom",
      labelKey: "SampleApp:tools.zoom",
      commandHandler: {
        execute: () => {
          IModelApp.tools.run(ZoomViewTool.toolId, IModelApp.viewManager.selectedView);
        },
      },
    });
  }

  public static get panViewCommand() {
    return new CommandItemDef({
      commandId: PanViewTool.toolId,
      iconClass: "icon-hand-2",
      labelKey: "SampleApp:tools.pan",
      commandHandler: {
        execute: () => {
          IModelApp.tools.run(PanViewTool.toolId, IModelApp.viewManager.selectedView);
        },
      },
    });
  }

  public static get rotateViewCommand() {
    return new CommandItemDef({
      commandId: RotateViewTool.toolId,
      iconClass: "icon-rotate",
      labelKey: "SampleApp:tools.rotate",
      commandHandler: {
        execute: () => {
          IModelApp.tools.run(RotateViewTool.toolId, IModelApp.viewManager.selectedView);
        },
      },
    });
  }

  public static get toggleCameraViewCommand() {
    return new CommandItemDef({
      commandId: ViewToggleCameraTool.toolId,
      iconClass: "icon-camera",
      labelKey: "SampleApp:tools.toggleCamera",
      commandHandler: {
        execute: () => {
          IModelApp.tools.run(ViewToggleCameraTool.toolId, IModelApp.viewManager.selectedView);
        },
      },
    });
  }

  public static get flyViewCommand() {
    return new CommandItemDef({
      commandId: FlyViewTool.toolId,
      iconClass: "icon-airplane",
      labelKey: "SampleApp:tools.fly",
      commandHandler: {
        execute: () => {
          IModelApp.tools.run(FlyViewTool.toolId, IModelApp.viewManager.selectedView);
        },
      },
    });
  }

  public static get walkViewCommand() {
    return new CommandItemDef({
      commandId: WalkViewTool.toolId,
      iconClass: "icon-walk",
      labelKey: "SampleApp:tools.walk",
      commandHandler: {
        execute: () => {
          IModelApp.tools.run(WalkViewTool.toolId, IModelApp.viewManager.selectedView);
        },
      },
    });
  }

  public static get tool2() {
    return new CommandItemDef({
      commandId: "tool2",
      iconClass: "icon-placeholder",
      labelKey: "SampleApp:buttons.tool2",
      applicationData: { key: "value" },
      commandHandler: {
        execute: () => {
          IModelApp.tools.run(SelectionTool.toolId);
        },
      },
    });
  }

  public static get item1() {
    return new CommandItemDef({
      commandId: "item1",
      iconClass: "icon-placeholder",
      labelKey: "SampleApp:buttons.item1",
      applicationData: { key: "value" },
      commandHandler: {
        execute: () => {
          IModelApp.tools.run(SelectionTool.toolId);
        },
      },
    });
  }

  public static get item2() {
    return new CommandItemDef({
      commandId: "item2",
      iconClass: "icon-placeholder",
      labelKey: "SampleApp:buttons.item2",
      applicationData: { key: "value" },
      commandHandler: {
        execute: () => {
          IModelApp.tools.run(SelectionTool.toolId);
        },
      },
    });
  }

  public static get item3() {
    return new CommandItemDef({
      commandId: "item3",
      iconClass: "icon-placeholder",
      labelKey: "SampleApp:buttons.item3",
      applicationData: { key: "value" },
      commandHandler: {
        execute: () => {
          IModelApp.tools.run(SelectionTool.toolId);
        },
      },
    });
  }

  public static get item4() {
    return new CommandItemDef({
      commandId: "item4",
      iconClass: "icon-placeholder",
      labelKey: "SampleApp:buttons.item4",
      applicationData: { key: "value" },
      commandHandler: {
        execute: () => {
          IModelApp.tools.run(SelectionTool.toolId);
        },
      },
    });
  }

  public static get item5() {
    return new CommandItemDef({
      commandId: "item5",
      iconClass: "icon-placeholder",
      labelKey: "SampleApp:buttons.item5",
      applicationData: { key: "value" },
      commandHandler: {
        execute: () => {
          IModelApp.tools.run(SelectionTool.toolId);
        },
      },
    });
  }

  public static get item6() {
    return new CommandItemDef({
      commandId: "item6",
      iconClass: "icon-placeholder",
      labelKey: "SampleApp:buttons.item6",
      applicationData: { key: "value" },
      commandHandler: {
        execute: () => {
          IModelApp.tools.run(SelectionTool.toolId);
        },
      },
    });
  }

  public static get item7() {
    return new CommandItemDef({
      commandId: "item7",
      iconClass: "icon-placeholder",
      labelKey: "SampleApp:buttons.item7",
      applicationData: { key: "value" },
      commandHandler: {
        execute: () => {
          IModelApp.tools.run(SelectionTool.toolId);
        },
      },
    });
  }

  public static get item8() {
    return new CommandItemDef({
      commandId: "item8",
      iconClass: "icon-placeholder",
      labelKey: "SampleApp:buttons.item8",
      applicationData: { key: "value" },
      commandHandler: {
        execute: () => {
          IModelApp.tools.run(SelectionTool.toolId);
        },
      },
    });
  }

  public static get setLengthFormatMetricCommand() {
    return new CommandItemDef({
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
  }

  public static get setLengthFormatImperialCommand() {
    return new CommandItemDef({
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
  }

  public static get infoMessageCommand() {
    return new CommandItemDef({
      commandId: "infoMessage",
      iconClass: "icon-info",
      labelKey: "SampleApp:buttons.informationMessageBox",
      commandHandler: {
        execute: () => IModelApp.notifications.outputMessage(new NotifyMessageDetails(OutputMessagePriority.Info, "This is an info message")),
      },
    });
  }

  public static get warningMessageCommand() {
    return new CommandItemDef({
      commandId: "warningMessage",
      iconClass: "icon-status-warning",
      labelKey: "SampleApp:buttons.warningMessageBox",
      commandHandler: {
        execute: () => IModelApp.notifications.outputMessage(new NotifyMessageDetails(OutputMessagePriority.Warning, "This is a warning message", undefined, OutputMessageType.Sticky)),
      },
    });
  }

  public static get errorMessageCommand() {
    return new CommandItemDef({
      commandId: "errorMessage",
      iconClass: "icon-status-rejected",
      labelKey: "SampleApp:buttons.errorMessageBox",
      commandHandler: {
        execute: () => IModelApp.notifications.outputMessage(new NotifyMessageDetails(OutputMessagePriority.Error, "This is an error message", undefined, OutputMessageType.Alert)),
      },
    });
  }

  public static get snapInfoMessageCommand() {
    return new CommandItemDef({
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
  }

  private static _detailMsg = "This is a description of the alert with lots and lots of words that explains what the user did & what they can do to remedy the situation."; // <br />Hello <a href=\"http://www.google.com\">Google!</a>
  public static get warningMessageStickyCommand() {
    return new CommandItemDef({
      commandId: "warningMessage",
      iconClass: "icon-status-warning",
      labelKey: "SampleApp:buttons.warningMessageBox",
      commandHandler: {
        execute: () => IModelApp.notifications.outputMessage(new NotifyMessageDetails(OutputMessagePriority.Warning, AppTools._warningStr, AppTools._detailMsg, OutputMessageType.Sticky)),
      },
    });
  }

  public static get errorMessageAlertCommand() {
    return new CommandItemDef({
      commandId: "errorMessage",
      iconClass: "icon-status-error",
      labelKey: "SampleApp:buttons.errorMessageBox",
      commandHandler: {
        execute: () => IModelApp.notifications.outputMessage(new NotifyMessageDetails(OutputMessagePriority.Error, AppTools._errorStr, AppTools._detailMsg, OutputMessageType.Alert)),
      },
    });
  }

  private static _messageBox = (severity: MessageSeverity, title: string): React.ReactNode => {
    return (
      <TestMessageBox
        opened={true}
        severity={severity}
        title={title}
      />
    );
  }

  public static get errorMessageBoxCommand() {
    return new CommandItemDef({
      commandId: "errorMessage",
      iconClass: "icon-status-error",
      labelKey: "SampleApp:buttons.errorMessageBox",
      commandHandler: {
        execute: () => ModalDialogManager.openModalDialog(AppTools._messageBox(MessageSeverity.Error, IModelApp.i18n.translate("SampleApp:buttons.errorMessageBox"))),
      },
    });
  }

  public static get successMessageBoxCommand() {
    return new CommandItemDef({
      commandId: "successMessage",
      iconClass: "icon-status-success",
      labelKey: "SampleApp:buttons.successMessageBox",
      commandHandler: {
        execute: () => ModalDialogManager.openModalDialog(AppTools._messageBox(MessageSeverity.None, IModelApp.i18n.translate("SampleApp:buttons.successMessageBox"))),
      },
    });
  }

  public static get informationMessageBoxCommand() {
    return new CommandItemDef({
      commandId: "informationMessage",
      iconClass: "icon-info",
      labelKey: "SampleApp:buttons.informationMessageBox",
      commandHandler: {
        execute: () => ModalDialogManager.openModalDialog(AppTools._messageBox(MessageSeverity.Information, IModelApp.i18n.translate("SampleApp:buttons.informationMessageBox"))),
      },
    });
  }

  public static get questionMessageBoxCommand() {
    return new CommandItemDef({
      commandId: "questionMessage",
      iconClass: "icon-help",
      labelKey: "SampleApp:buttons.questionMessageBox",
      commandHandler: {
        execute: () => ModalDialogManager.openModalDialog(AppTools._messageBox(MessageSeverity.Question, IModelApp.i18n.translate("SampleApp:buttons.questionMessageBox"))),
      },
    });
  }

  public static get warningMessageBoxCommand() {
    return new CommandItemDef({
      commandId: "warningMessage",
      iconClass: "icon-status-warning",
      labelKey: "SampleApp:buttons.warningMessageBox",
      commandHandler: {
        execute: () => ModalDialogManager.openModalDialog(AppTools._messageBox(MessageSeverity.Warning, IModelApp.i18n.translate("SampleApp:buttons.warningMessageBox"))),
      },
    });
  }

  public static get openMessageBoxCommand() {
    return new CommandItemDef({
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
  }

  public static get openMessageBoxCommand2() {
    return new CommandItemDef({
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
  }

  private static _infoStr = "This is an info message with more text than will fit.";
  private static _warningStr = "This is a warning message with more text than will fit.";
  private static _errorStr = "This is an error message with more text than will fit.";
  private static _fatalStr = "This is a fatal message with more text than will fit.";

  public static get addMessageCommand() {
    return new CommandItemDef({
      commandId: "addMessage",
      iconClass: "icon-status-warning",
      labelKey: "SampleApp:buttons.openMessageBox",
      commandHandler: {
        execute: async () => {
          IModelApp.notifications.outputMessage(new NotifyMessageDetails(OutputMessagePriority.Info, AppTools._infoStr));
          IModelApp.notifications.outputMessage(new NotifyMessageDetails(OutputMessagePriority.Warning, AppTools._warningStr));
          IModelApp.notifications.outputMessage(new NotifyMessageDetails(OutputMessagePriority.Error, AppTools._errorStr));
          IModelApp.notifications.outputMessage(new NotifyMessageDetails(OutputMessagePriority.Fatal, AppTools._fatalStr));
        },
      },
    });
  }

  public static get verticalPropertyGridOpenCommand() {
    return new CommandItemDef({
      commandId: "verticalPropertyGridOpen",
      iconClass: "icon-placeholder",
      labelKey: "SampleApp:buttons.tool1",
      commandHandler: {
        execute: async () => {
          const activeFrontstageDef = FrontstageManager.activeFrontstageDef;
          if (activeFrontstageDef) {
            const widgetDef = activeFrontstageDef.findWidgetDef("VerticalPropertyGrid");
            if (widgetDef) {
              widgetDef.setWidgetState(WidgetState.Open);
            }
          }
        },
      },
    });
  }

  public static get verticalPropertyGridOffCommand() {
    return new CommandItemDef({
      commandId: "verticalPropertyGridOff",
      iconClass: "icon-placeholder",
      labelKey: "SampleApp:buttons.tool1",
      commandHandler: {
        execute: async () => {
          const activeFrontstageDef = FrontstageManager.activeFrontstageDef;
          if (activeFrontstageDef) {
            const widgetDef = activeFrontstageDef.findWidgetDef("VerticalPropertyGrid");
            if (widgetDef) {
              widgetDef.setWidgetState(WidgetState.Off);
            }
          }
        },
      },
    });
  }

}
