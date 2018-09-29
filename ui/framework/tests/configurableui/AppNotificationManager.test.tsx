/*---------------------------------------------------------------------------------------------
* Copyright (c) 2018 - present Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/

import * as React from "react";
import { expect } from "chai";
import { mount } from "enzyme";
import * as sinon from "sinon";
import TestUtils from "../TestUtils";
import { AppNotificationManager, MessageManager, ElementTooltip, ModalDialogManager } from "../../src";
import { NotifyMessageDetails, OutputMessagePriority, MessageBoxType, MessageBoxIconType, ActivityMessageDetails, ActivityMessageEndReason } from "@bentley/imodeljs-frontend";

describe("AppNotificationManager", () => {

  before(async () => {
    await TestUtils.initializeUiFramework();
  });

  let notifications: AppNotificationManager;

  beforeEach(() => {
    notifications = new AppNotificationManager();
  });

  afterEach(() => {
    sinon.restore();
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

  it("openMessageBox", () => {
    const spyMethod = sinon.spy(MessageManager, "openMessageBox");
    notifications.openMessageBox(MessageBoxType.OkCancel, "Message string", MessageBoxIconType.Information);
    expect(spyMethod.calledOnce).to.be.true;

    expect(ModalDialogManager.modalDialogCount).to.eq(1);
    ModalDialogManager.closeModalDialog();
    expect(ModalDialogManager.modalDialogCount).to.eq(0);
  });

  it("setupActivityMessage", () => {
    const spyMethod = sinon.spy(MessageManager, "setupActivityMessageDetails");
    const details = new ActivityMessageDetails(true, true, true);
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
  });

});
