/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import * as React from "react";
import {
  IModelApp, MessageBoxIconType, MessageBoxType, MessageBoxValue, NotifyMessageDetails, OutputMessageAlert, OutputMessagePriority, OutputMessageType,
  SnapMode,
} from "@bentley/imodeljs-frontend";
import { CommonStatusBarItem, UiItemsManager, UiItemsProvider } from "@bentley/ui-abstract";
import { MessageSeverity } from "@bentley/ui-core";
import { Backstage, CommandItemDef, ModalDialogManager, SyncUiEventDispatcher, ToolItemDef } from "@bentley/ui-framework";
import { SampleAppIModelApp } from "../../";
import { TestMessageBox } from "../../appui/dialogs/TestMessageBox";
import { DeleteElementTool } from "./DeleteElementTool";
import { MoveElementTool } from "./MoveElementTool";
import { PlaceBlockTool } from "./PlaceBlockTool";
import { PlaceLineStringTool } from "./PlaceLineStringTool";

// cSpell:ignore appuiprovider

// Sample UI items provider that dynamically adds ui items
class AppItemsProvider implements UiItemsProvider {
  public readonly id = "AnotherStatusBarItemProvider";
  public static readonly syncEventId = "appuiprovider:dynamic-item-visibility-changed";

  public static toggleStatusBarItem() {
    SyncUiEventDispatcher.dispatchImmediateSyncUiEvent(AppItemsProvider.syncEventId);
  }

  public provideStatusBarItems(_stageId: string, _stageUsage: string): CommonStatusBarItem[] {
    const statusBarItems: CommonStatusBarItem[] = [];
    return statusBarItems;
  }
}

UiItemsManager.register(new AppItemsProvider());

export class EditTools {
  public static get deleteElementTool() {
    return new ToolItemDef({
      toolId: DeleteElementTool.toolId,
      iconSpec: "icon-delete",
      labelKey: "SampleApp:tools.DeleteElement.flyover",
      tooltipKey: "SampleApp:tools.DeleteElement.description",
      execute: () => {
        IModelApp.tools.run(DeleteElementTool.toolId);
      },
    });
  }

  public static get moveElementTool() {
    return new ToolItemDef({
      toolId: MoveElementTool.toolId,
      iconSpec: "icon-move",
      labelKey: "SampleApp:tools.MoveElement.flyover",
      tooltipKey: "SampleApp:tools.MoveElement.description",
      execute: () => {
        IModelApp.tools.run(MoveElementTool.toolId);
      },
    });
  }

  public static get placeLineStringTool() {
    return new ToolItemDef({
      toolId: PlaceLineStringTool.toolId,
      iconSpec: "icon-line",
      labelKey: "SampleApp:tools.PlaceLineString.flyover",
      tooltipKey: "SampleApp:tools.PlaceLineString.description",
      execute: () => {
        IModelApp.tools.run(PlaceLineStringTool.toolId);
      },
    });
  }

  public static get placeBlockTool() {
    return new ToolItemDef({
      toolId: PlaceBlockTool.toolId,
      iconSpec: "icon-select-box",
      labelKey: "SampleApp:tools.PlaceBlockTool.flyover",
      tooltipKey: "SampleApp:tools.PlaceBlockTool.description",
      execute: async () => {
        IModelApp.tools.run(PlaceBlockTool.toolId);
      },
    });
  }

  // Tool that toggles the backstage
  public static get backstageToggleCommand() {
    // eslint-disable-next-line deprecation/deprecation
    return Backstage.backstageToggleCommand;
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

  public static get noIconMessageCommand() {
    return new CommandItemDef({
      commandId: "noIconMessage",
      iconSpec: "icon-status-success-hollow",
      labelKey: "SampleApp:buttons.noIconMessageBox",
      execute: () => IModelApp.notifications.outputMessage(new NotifyMessageDetails(OutputMessagePriority.None, "This message has no icon", this._detailedMessage)),
    });
  }

  private static get _longMessage(): HTMLElement {
    const div = document.createElement("div");
    const ol = document.createElement("ol");
    let li = document.createElement("li");
    li.appendChild(EditTools._detailedMessage);
    ol.appendChild(li);
    li = document.createElement("li");
    li.appendChild(EditTools._detailedMessage);
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
      execute: () => IModelApp.notifications.outputMessage(new NotifyMessageDetails(OutputMessagePriority.Warning, EditTools._warningStr, EditTools._detailMsg, OutputMessageType.Sticky)),
    });
  }

  public static get errorMessageAlertCommand() {
    return new CommandItemDef({
      commandId: "errorMessage",
      iconSpec: "icon-status-error",
      labelKey: "SampleApp:buttons.errorMessageBox",
      execute: () => IModelApp.notifications.outputMessage(new NotifyMessageDetails(OutputMessagePriority.Error, EditTools._errorStr, EditTools._detailMsg, OutputMessageType.Alert)),
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
  };

  public static get errorMessageBoxCommand() {
    return new CommandItemDef({
      commandId: "errorMessage",
      iconSpec: "icon-status-error",
      labelKey: "SampleApp:buttons.errorMessageBox",
      execute: () => ModalDialogManager.openDialog(EditTools._messageBox(MessageSeverity.Error, IModelApp.i18n.translate("SampleApp:buttons.errorMessageBox"))),
    });
  }

  public static get successMessageBoxCommand() {
    return new CommandItemDef({
      commandId: "successMessage",
      iconSpec: "icon-status-success",
      labelKey: "SampleApp:buttons.successMessageBox",
      execute: () => ModalDialogManager.openDialog(EditTools._messageBox(MessageSeverity.None, IModelApp.i18n.translate("SampleApp:buttons.successMessageBox"))),
    });
  }

  public static get informationMessageBoxCommand() {
    return new CommandItemDef({
      commandId: "informationMessage",
      iconSpec: "icon-info",
      labelKey: "SampleApp:buttons.informationMessageBox",
      execute: () => ModalDialogManager.openDialog(EditTools._messageBox(MessageSeverity.Information, IModelApp.i18n.translate("SampleApp:buttons.informationMessageBox"))),
    });
  }

  public static get questionMessageBoxCommand() {
    return new CommandItemDef({
      commandId: "questionMessage",
      iconSpec: "icon-help",
      labelKey: "SampleApp:buttons.questionMessageBox",
      execute: () => ModalDialogManager.openDialog(EditTools._messageBox(MessageSeverity.Question, IModelApp.i18n.translate("SampleApp:buttons.questionMessageBox"))),
    });
  }

  public static get warningMessageBoxCommand() {
    return new CommandItemDef({
      commandId: "warningMessage",
      iconSpec: "icon-status-warning",
      labelKey: "SampleApp:buttons.warningMessageBox",
      execute: () => ModalDialogManager.openDialog(EditTools._messageBox(MessageSeverity.Warning, IModelApp.i18n.translate("SampleApp:buttons.warningMessageBox"))),
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
        // eslint-disable-next-line @typescript-eslint/no-floating-promises
        IModelApp.notifications.openMessageBox(MessageBoxType.Ok,
          message,
          MessageBoxIconType.Information)
          .then((value: MessageBoxValue) => { window.alert(`Closing message box ... value is ${value}`); });
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
        window.alert(`Closing message box ... value is ${value}`);
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
        IModelApp.notifications.outputMessage(new NotifyMessageDetails(OutputMessagePriority.Info, EditTools._infoStr));
        IModelApp.notifications.outputMessage(new NotifyMessageDetails(OutputMessagePriority.Warning, EditTools._warningStr));
        IModelApp.notifications.outputMessage(new NotifyMessageDetails(OutputMessagePriority.Error, EditTools._errorStr));
        IModelApp.notifications.outputMessage(new NotifyMessageDetails(OutputMessagePriority.Fatal, EditTools._fatalStr));
      },
    });
  }
}
