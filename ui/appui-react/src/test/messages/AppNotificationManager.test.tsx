/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/

import { expect } from "chai";
import * as React from "react";
import * as sinon from "sinon";
import {
  ActivityMessageDetails, ActivityMessageEndReason, MessageBoxIconType, MessageBoxType, MessageBoxValue, NotifyMessageDetails, OutputMessageAlert,
  OutputMessagePriority, OutputMessageType,
} from "@itwin/core-frontend";
import { AppNotificationManager, ElementTooltip, MessageManager, ModalDialogManager, ModalDialogRenderer } from "../../appui-react";
import TestUtils, { mount } from "../TestUtils";

describe("AppNotificationManager", () => {

  before(async () => {
    await TestUtils.initializeUiFramework();
  });

  after(() => {
    TestUtils.terminateUiFramework();
  });

  let notifications: AppNotificationManager;

  beforeEach(() => {
    notifications = new AppNotificationManager();
  });

  it("outputPromptByKey", () => {
    const spyMethod = sinon.spy(MessageManager, "outputPrompt");
    notifications.outputPromptByKey("Framework:tests.label");
    expect(spyMethod.calledOnce).to.be.true;
  });

  it("outputPrompt", () => {
    const spyMethod = sinon.spy(MessageManager, "outputPrompt");
    notifications.outputPrompt("This is a prompt.");
    expect(spyMethod.calledOnce).to.be.true;
  });

  it("outputMessage", () => {
    const spyMethod = sinon.spy(MessageManager, "addMessage");
    const details = new NotifyMessageDetails(OutputMessagePriority.Debug, "A brief message.");
    notifications.outputMessage(details);
    expect(spyMethod.calledOnce).to.be.true;
  });

  it("outputMessage with Alert", () => {
    const spyMethod = sinon.spy(MessageManager, "addMessage");
    const alertBoxMethod = sinon.spy(MessageManager, "showAlertMessageBox");

    const details = new NotifyMessageDetails(OutputMessagePriority.Debug, "A brief message.", "A detailed message.", OutputMessageType.Alert);
    notifications.outputMessage(details);
    expect(spyMethod.calledOnce).to.be.true;
    expect(alertBoxMethod.calledOnce).to.be.true;

    ModalDialogManager.closeDialog();
  });

  it("outputMessage with Alert & Balloon", () => {
    const spyMethod = sinon.spy(MessageManager, "addMessage");
    const alertBoxMethod = sinon.spy(MessageManager, "showAlertMessageBox");

    const details = new NotifyMessageDetails(OutputMessagePriority.Debug, "A brief message.", "A detailed message.", OutputMessageType.Alert, OutputMessageAlert.Balloon);
    notifications.outputMessage(details);
    expect(spyMethod.calledOnce).to.be.true;
    expect(alertBoxMethod.calledOnce).to.be.false;
  });

  it("outputMessage with InputField", () => {
    const spyMethod = sinon.spy(MessageManager, "addMessage");
    const spyMethod2 = sinon.spy(MessageManager, "displayInputFieldMessage");
    const spyMethod3 = sinon.spy(MessageManager, "hideInputFieldMessage");
    const details = new NotifyMessageDetails(OutputMessagePriority.Debug, "A brief message.", "A detailed message.", OutputMessageType.InputField);
    let divElement: HTMLElement | null;
    mount(<div ref={(el) => { divElement = el; }} />);
    details.setInputFieldTypeDetails(divElement!);
    notifications.outputMessage(details);
    expect(spyMethod.calledOnce).to.be.true;
    expect(spyMethod2.calledOnce).to.be.true;
    notifications.closeInputFieldMessage();
    expect(spyMethod3.calledOnce).to.be.true;
  });

  it("outputMessage with InputField but without setInputFieldTypeDetails", () => {
    const spyMethod = sinon.spy(MessageManager, "addMessage");
    const spyMethod2 = sinon.spy(MessageManager, "displayInputFieldMessage");
    const details = new NotifyMessageDetails(OutputMessagePriority.Debug, "A brief message.", "A detailed message.", OutputMessageType.InputField);
    notifications.outputMessage(details);
    expect(spyMethod.calledOnce).to.be.true;
    expect(spyMethod2.called).to.be.false;
  });

  it("openMessageBox", async () => {
    const wrapper = mount(<ModalDialogRenderer />);

    const spyMethod = sinon.spy(MessageManager, "openMessageBox");
    expect(ModalDialogManager.dialogCount).to.eq(0);
    const boxResult = notifications.openMessageBox(MessageBoxType.OkCancel, "Message string", MessageBoxIconType.Information);

    expect(spyMethod.calledOnce).to.be.true;
    expect(ModalDialogManager.dialogCount).to.eq(1);

    wrapper.update();
    wrapper.find("button.dialog-button-ok").simulate("click");
    expect(ModalDialogManager.dialogCount).to.eq(0);

    const boxValue = await boxResult;
    expect(boxValue).to.eq(MessageBoxValue.Ok);
  });

  it("setupActivityMessage", () => {
    const spyMethod = sinon.spy(MessageManager, "setupActivityMessageDetails");
    const details = new ActivityMessageDetails(true, true, true, true);
    notifications.setupActivityMessage(details);
    expect(spyMethod.calledOnce).to.be.true;
  });

  it("outputActivityMessage", () => {
    const spyMethod = sinon.spy(MessageManager, "setupActivityMessageValues");
    notifications.outputActivityMessage("Message text", 50);
    expect(spyMethod.calledOnce).to.be.true;
  });

  it("endActivityMessage", () => {
    const spyMethod = sinon.spy(MessageManager, "endActivityMessage");
    notifications.endActivityMessage(ActivityMessageEndReason.Cancelled);
    notifications.endActivityMessage(ActivityMessageEndReason.Completed);
    expect(spyMethod.calledTwice).to.be.true;
  });

  it("ElementTooltip", () => {
    const showMethod = sinon.spy(ElementTooltip, "showTooltip");
    const hideMethod = sinon.spy(ElementTooltip, "hideTooltip");
    let divElement: HTMLElement | null;
    mount(<div ref={(el) => { divElement = el; }} />);
    notifications.openToolTip(divElement!, "Tooltip message");
    notifications.clearToolTip();
    expect(showMethod.calledOnce).to.be.true;
    expect(hideMethod.calledOnce).to.be.true;
    expect(notifications.isToolTipSupported).to.be.true;
  });

  it("ElementTooltip with a React component", () => {
    const showMethod = sinon.spy(ElementTooltip, "showTooltip");
    const hideMethod = sinon.spy(ElementTooltip, "hideTooltip");
    let divElement: HTMLElement | null;
    mount(<div ref={(el) => { divElement = el; }} />);
    const reactNode = <span>Tooltip message</span>;
    MessageManager.openToolTip(divElement!, { reactNode });
    notifications.clearToolTip();
    expect(showMethod.calledOnce).to.be.true;
    expect(hideMethod.calledOnce).to.be.true;
  });

  it("ActivityMessage with a React component", () => {
    const spyMethod = sinon.spy(MessageManager, "setupActivityMessageValues");
    const reactNode = <span>Activity message</span>;
    MessageManager.outputActivityMessage({ reactNode }, 50);
    expect(spyMethod.calledOnce).to.be.true;
  });

});
