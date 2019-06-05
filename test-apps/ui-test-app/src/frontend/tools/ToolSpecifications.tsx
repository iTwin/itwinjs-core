/*---------------------------------------------------------------------------------------------
* Copyright (c) 2019 Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/
import * as React from "react";

import {
  IModelApp, NotifyMessageDetails, OutputMessagePriority, MessageBoxValue, SelectionTool,
  OutputMessageType, SnapMode, MessageBoxType, MessageBoxIconType, OutputMessageAlert,
} from "@bentley/imodeljs-frontend";
import { MessageSeverity } from "@bentley/ui-core";
import {
  CommandItemDef, ToolItemDef, WidgetState, FrontstageManager, ModalDialogManager, BaseItemState, ContentViewManager, SyncUiEventId, Backstage,
} from "@bentley/ui-framework";
import { SampleAppIModelApp } from "../";
import { Tool1 } from "../tools/Tool1";
import { Tool2 } from "../tools/Tool2";
import { ToolWithSettings } from "../tools/ToolWithSettings";
import { AppSelectTool } from "../tools/AppSelectTool";
import { AnalysisAnimationTool } from "../tools/AnalysisAnimation";

// cSpell:ignore appui
import { TestMessageBox } from "../appui/dialogs/TestMessageBox";
import { AppUi } from "../appui/AppUi";

export class AppTools {
  public static get appSelectElementCommand() {
    return new ToolItemDef({
      toolId: AppSelectTool.toolId,
      iconSpec: "icon-cursor",
      labelKey: "SampleApp:tools.AppSelect.flyover",
      tooltipKey: "SampleApp:tools.AppSelect.description",
      execute: () => { IModelApp.tools.run(AppSelectTool.toolId); },
    });
  }

  public static get tool1() {
    return new ToolItemDef({
      toolId: Tool1.toolId,
      iconSpec: "icon-placeholder",
      label: () => Tool1.flyover,
      tooltip: () => Tool1.description,
      execute: () => {
        IModelApp.tools.run(Tool1.toolId);
      },
    });
  }

  public static get tool2() {
    return new ToolItemDef({
      toolId: Tool2.toolId,
      iconSpec: "icon-placeholder",
      labelKey: "SampleApp:tools.Tool2.flyover",
      tooltipKey: "SampleApp:tools.Tool2.description",
      execute: () => { IModelApp.tools.run(Tool2.toolId); },
    });
  }

  public static get toolWithSettings() {
    return new ToolItemDef({
      toolId: ToolWithSettings.toolId,
      iconSpec: "icon-placeholder",
      labelKey: "SampleApp:tools.ToolWithSettings.flyover",
      tooltipKey: "SampleApp:tools.ToolWithSettings.description",
      execute: async () => {
        // make sure formatting and parsing data are cached before the tool starts.
        await IModelApp.quantityFormatter.loadFormatAndParsingMaps(IModelApp.quantityFormatter.useImperialFormats);
        IModelApp.tools.run(ToolWithSettings.toolId);
      },
    });
  }

  public static get analysisAnimationCommand() {
    return new ToolItemDef({
      toolId: AnalysisAnimationTool.toolId,
      iconSpec: "icon-camera-animation",
      label: () => AnalysisAnimationTool.flyover,
      tooltip: () => AnalysisAnimationTool.description,
      execute: () => { IModelApp.tools.run(AnalysisAnimationTool.toolId); },
      isVisible: false, // default to not show and then allow stateFunc to redefine.
      stateSyncIds: [SyncUiEventId.ActiveContentChanged],
      stateFunc: (currentState: Readonly<BaseItemState>): BaseItemState => {
        const returnState: BaseItemState = { ...currentState };
        const activeContentControl = ContentViewManager.getActiveContentControl();

        if (activeContentControl && activeContentControl.viewport && (undefined !== activeContentControl.viewport.view.analysisStyle))
          returnState.isVisible = true;
        else
          returnState.isVisible = false;
        return returnState;
      },
    });
  }

  // Tool that toggles the backstage
  public static get backstageToggleCommand() {
    return Backstage.backstageToggleCommand;
  }

  public static get item1() {
    return new CommandItemDef({
      commandId: "item1",
      iconSpec: "icon-placeholder",
      labelKey: "SampleApp:buttons.item1",
      applicationData: { key: "value" },
      execute: () => { AppUi.command1(); },
    });
  }

  public static get item2() {
    return new CommandItemDef({
      commandId: "item2",
      iconSpec: "icon-placeholder",
      labelKey: "SampleApp:buttons.item2",
      applicationData: { key: "value" },
      execute: () => { AppUi.command2(); },
    });
  }

  public static get item3() {
    return new CommandItemDef({
      commandId: "item3",
      iconSpec: "icon-placeholder",
      labelKey: "SampleApp:buttons.item3",
      applicationData: { key: "value" },
      execute: () => { IModelApp.tools.run(SelectionTool.toolId); },
    });
  }

  public static get item4() {
    return new CommandItemDef({
      commandId: "item4",
      iconSpec: "icon-placeholder",
      labelKey: "SampleApp:buttons.item4",
      applicationData: { key: "value" },
      execute: () => { IModelApp.tools.run(SelectionTool.toolId); },
    });
  }

  public static get item5() {
    return new CommandItemDef({
      commandId: "item5",
      iconSpec: "icon-placeholder",
      labelKey: "SampleApp:buttons.item5",
      applicationData: { key: "value" },
      execute: () => { IModelApp.tools.run(SelectionTool.toolId); },
    });
  }

  public static get item6() {
    return new CommandItemDef({
      commandId: "item6",
      iconSpec: "icon-placeholder",
      labelKey: "SampleApp:buttons.item6",
      applicationData: { key: "value" },
      execute: () => { IModelApp.tools.run(SelectionTool.toolId); },
    });
  }

  public static get item7() {
    return new CommandItemDef({
      commandId: "item7",
      iconSpec: "icon-placeholder",
      labelKey: "SampleApp:buttons.item7",
      applicationData: { key: "value" },
      execute: () => { IModelApp.tools.run(SelectionTool.toolId); },
    });
  }

  public static get item8() {
    return new CommandItemDef({
      commandId: "item8",
      iconSpec: "icon-placeholder",
      labelKey: "SampleApp:buttons.item8",
      applicationData: { key: "value" },
      execute: () => { IModelApp.tools.run(SelectionTool.toolId); },
    });
  }

  public static get setLengthFormatMetricCommand() {
    return new CommandItemDef({
      commandId: "setLengthFormatMetric",
      iconSpec: "icon-info",
      labelKey: "SampleApp:buttons.setLengthFormatMetric",
      execute: () => {
        IModelApp.quantityFormatter.useImperialFormats = false;
        IModelApp.notifications.outputMessage(new NotifyMessageDetails(OutputMessagePriority.Info, "Set Length Format to Metric"));
      },
    });
  }

  public static get setLengthFormatImperialCommand() {
    return new CommandItemDef({
      commandId: "setLengthFormatImperial",
      iconSpec: "icon-info",
      labelKey: "SampleApp:buttons.setLengthFormatImperial",
      execute: () => {
        IModelApp.quantityFormatter.useImperialFormats = true;
        IModelApp.notifications.outputMessage(new NotifyMessageDetails(OutputMessagePriority.Info, "Set Length Format to Imperial"));
      },
    });
  }

  public static get toggleLengthFormatCommand() {
    return new CommandItemDef({
      commandId: "toggleLengthFormat",
      iconSpec: "icon-info",
      labelKey: "SampleApp:buttons.toggleLengthFormat",
      execute: () => {
        IModelApp.quantityFormatter.useImperialFormats = !IModelApp.quantityFormatter.useImperialFormats;
        IModelApp.notifications.outputMessage(new NotifyMessageDetails(OutputMessagePriority.Info, IModelApp.quantityFormatter.useImperialFormats ? "Set Length Format to Imperial" : "Set Length Format to Metric"));
      },
      stateSyncIds: [SyncUiEventId.ActiveContentChanged],
      stateFunc: (currentState: Readonly<BaseItemState>): BaseItemState => {
        const returnState: BaseItemState = { ...currentState };
        returnState.isVisible = ContentViewManager.isContent3dView(ContentViewManager.getActiveContentControl());
        return returnState;
      },
    });
  }

  public static get toggleHideShowItemsCommand() {
    return new CommandItemDef({
      commandId: "testHideShowItems",
      iconSpec: "icon-info",
      labelKey: "SampleApp:buttons.toggleItemDisplay",
      execute: () => {
        SampleAppIModelApp.setTestProperty(SampleAppIModelApp.getTestProperty() === "HIDE" ? "" : "HIDE");
      },
    });
  }

  private static get _detailedMessage(): HTMLElement {
    const fragment = document.createRange().createContextualFragment("This is a detailed message with a line<br>break and <b>bold</b>, <i>italic</i> and <span class='red-text'>red</span> text.");
    const span = document.createElement("span");
    span.appendChild(fragment);
    return span;
  }

  public static get infoMessageCommand() {
    return new CommandItemDef({
      commandId: "infoMessage",
      iconSpec: "icon-info",
      labelKey: "SampleApp:buttons.informationMessageBox",
      execute: () => IModelApp.notifications.outputMessage(new NotifyMessageDetails(OutputMessagePriority.Info, "This is an info message", this._detailedMessage)),
    });
  }

  public static get warningMessageCommand() {
    return new CommandItemDef({
      commandId: "warningMessage",
      iconSpec: "icon-status-warning",
      labelKey: "SampleApp:buttons.warningMessageBox",
      execute: () => IModelApp.notifications.outputMessage(new NotifyMessageDetails(OutputMessagePriority.Warning, "This is a warning message", this._detailedMessage, OutputMessageType.Sticky)),
    });
  }

  private static get _longMessage(): HTMLElement {
    const div = document.createElement("div");
    const ol = document.createElement("ol");
    let li = document.createElement("li");
    li.appendChild(AppTools._detailedMessage);
    ol.appendChild(li);
    li = document.createElement("li");
    li.appendChild(AppTools._detailedMessage);
    ol.appendChild(li);
    div.appendChild(ol);
    const fragment = document.createRange().createContextualFragment("For more details, <a href='https://www.google.com/' target='_blank'>Google it!</a>");
    div.appendChild(fragment);
    return div;
  }

  public static get errorMessageCommand() {
    return new CommandItemDef({
      commandId: "errorMessage",
      iconSpec: "icon-status-rejected",
      labelKey: "SampleApp:buttons.errorMessageBox",
      execute: () => IModelApp.notifications.outputMessage(new NotifyMessageDetails(OutputMessagePriority.Error,
        "This is an error message", this._longMessage,
        OutputMessageType.Alert, OutputMessageAlert.Dialog)),
    });
  }

  public static get snapInfoMessageCommand() {
    return new CommandItemDef({
      commandId: "infoMessage",
      iconSpec: "icon-info",
      labelKey: "SampleApp:buttons.informationMessageBox",
      execute: () => {
        let displayString = "Current Snap Mode(s):";

        if (SampleAppIModelApp.store.getState().frameworkState) {
          const snapModes = IModelApp.accuSnap.getActiveSnapModes();
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
    });
  }

  private static get _detailMsg() {
    const doc = new DOMParser().parseFromString("<span>This is a description of the alert with lots and lots of words that explains what the user did & what they can do to remedy the situation. <br />For more info, <a href='http://www.google.com' target='_blank'>Google it!</a><span>", "text/html");
    return doc.documentElement;
  }
  public static get warningMessageStickyCommand() {
    return new CommandItemDef({
      commandId: "warningMessage",
      iconSpec: "icon-status-warning",
      labelKey: "SampleApp:buttons.warningMessageBox",
      execute: () => IModelApp.notifications.outputMessage(new NotifyMessageDetails(OutputMessagePriority.Warning, AppTools._warningStr, AppTools._detailMsg, OutputMessageType.Sticky)),
    });
  }

  public static get errorMessageAlertCommand() {
    return new CommandItemDef({
      commandId: "errorMessage",
      iconSpec: "icon-status-error",
      labelKey: "SampleApp:buttons.errorMessageBox",
      execute: () => IModelApp.notifications.outputMessage(new NotifyMessageDetails(OutputMessagePriority.Error, AppTools._errorStr, AppTools._detailMsg, OutputMessageType.Alert)),
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
      iconSpec: "icon-status-error",
      labelKey: "SampleApp:buttons.errorMessageBox",
      execute: () => ModalDialogManager.openDialog(AppTools._messageBox(MessageSeverity.Error, IModelApp.i18n.translate("SampleApp:buttons.errorMessageBox"))),
    });
  }

  public static get successMessageBoxCommand() {
    return new CommandItemDef({
      commandId: "successMessage",
      iconSpec: "icon-status-success",
      labelKey: "SampleApp:buttons.successMessageBox",
      execute: () => ModalDialogManager.openDialog(AppTools._messageBox(MessageSeverity.None, IModelApp.i18n.translate("SampleApp:buttons.successMessageBox"))),
    });
  }

  public static get informationMessageBoxCommand() {
    return new CommandItemDef({
      commandId: "informationMessage",
      iconSpec: "icon-info",
      labelKey: "SampleApp:buttons.informationMessageBox",
      execute: () => ModalDialogManager.openDialog(AppTools._messageBox(MessageSeverity.Information, IModelApp.i18n.translate("SampleApp:buttons.informationMessageBox"))),
    });
  }

  public static get questionMessageBoxCommand() {
    return new CommandItemDef({
      commandId: "questionMessage",
      iconSpec: "icon-help",
      labelKey: "SampleApp:buttons.questionMessageBox",
      execute: () => ModalDialogManager.openDialog(AppTools._messageBox(MessageSeverity.Question, IModelApp.i18n.translate("SampleApp:buttons.questionMessageBox"))),
    });
  }

  public static get warningMessageBoxCommand() {
    return new CommandItemDef({
      commandId: "warningMessage",
      iconSpec: "icon-status-warning",
      labelKey: "SampleApp:buttons.warningMessageBox",
      execute: () => ModalDialogManager.openDialog(AppTools._messageBox(MessageSeverity.Warning, IModelApp.i18n.translate("SampleApp:buttons.warningMessageBox"))),
    });
  }

  public static get openMessageBoxCommand() {
    const textNode = document.createTextNode("This is a box opened using IModelApp.notifications.openMessageBox and using promise/then to process result.");
    const message = document.createElement("div");
    message.appendChild(textNode);
    message.appendChild(this._longMessage);

    return new CommandItemDef({
      commandId: "openMessageBox",
      iconSpec: "icon-info",
      labelKey: "SampleApp:buttons.openMessageBox",
      execute: () => {
        // tslint:disable-next-line:no-floating-promises
        IModelApp.notifications.openMessageBox(MessageBoxType.Ok,
          message,
          MessageBoxIconType.Information)
          .then((value: MessageBoxValue) => { window.alert("Closing message box ... value is " + value); });
      },
    });
  }

  public static get openMessageBoxCommand2() {
    const textNode = document.createTextNode("This is a box opened using IModelApp.notifications.openMessageBox and using async/await to process result.");
    const message = document.createElement("div");
    message.appendChild(textNode);
    message.appendChild(this._longMessage);

    return new CommandItemDef({
      commandId: "openMessageBox2",
      iconSpec: "icon-status-warning",
      labelKey: "SampleApp:buttons.openMessageBox",
      execute: async () => {
        const value: MessageBoxValue = await IModelApp.notifications.openMessageBox(MessageBoxType.YesNo,
          message,
          MessageBoxIconType.Warning);
        window.alert("Closing message box ... value is " + value);
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
      iconSpec: "icon-status-warning",
      labelKey: "SampleApp:buttons.openMessageBox",
      execute: async () => {
        IModelApp.notifications.outputMessage(new NotifyMessageDetails(OutputMessagePriority.Info, AppTools._infoStr));
        IModelApp.notifications.outputMessage(new NotifyMessageDetails(OutputMessagePriority.Warning, AppTools._warningStr));
        IModelApp.notifications.outputMessage(new NotifyMessageDetails(OutputMessagePriority.Error, AppTools._errorStr));
        IModelApp.notifications.outputMessage(new NotifyMessageDetails(OutputMessagePriority.Fatal, AppTools._fatalStr));
      },
    });
  }

  public static get verticalPropertyGridOpenCommand() {
    return new CommandItemDef({
      commandId: "verticalPropertyGridOpen",
      iconSpec: "icon-placeholder",
      labelKey: "SampleApp:buttons.openPropertyGrid",
      execute: async () => {
        const activeFrontstageDef = FrontstageManager.activeFrontstageDef;
        if (activeFrontstageDef) {
          const widgetDef = activeFrontstageDef.findWidgetDef("VerticalPropertyGrid");
          if (widgetDef) {
            widgetDef.setWidgetState(WidgetState.Open);
          }
        }
      },
    });
  }

  public static get verticalPropertyGridOffCommand() {
    return new CommandItemDef({
      commandId: "verticalPropertyGridOff",
      iconSpec: "icon-placeholder",
      labelKey: "SampleApp:buttons.closePropertyGrid",
      execute: async () => {
        const activeFrontstageDef = FrontstageManager.activeFrontstageDef;
        if (activeFrontstageDef) {
          const widgetDef = activeFrontstageDef.findWidgetDef("VerticalPropertyGrid");
          if (widgetDef) {
            widgetDef.setWidgetState(WidgetState.Hidden);
          }
        }
      },
    });
  }
}
