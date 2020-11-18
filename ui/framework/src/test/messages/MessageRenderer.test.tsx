/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import { expect } from "chai";
import * as sinon from "sinon";
import * as React from "react";
import { ActivityMessageDetails, ActivityMessageEndReason, NotifyMessageDetails, OutputMessagePriority, OutputMessageType } from "@bentley/imodeljs-frontend";
import { Message, MessageButton, MessageHyperlink, MessageProgress } from "@bentley/ui-ninezone";
import { ActivityMessage, AppNotificationManager, MessageManager, MessageRenderer, StickyMessage, ToastMessage } from "../../ui-framework";
import { mount, TestUtils } from "../TestUtils";

describe("MessageRenderer", () => {

  let notifications: AppNotificationManager;

  before(async () => {
    await TestUtils.initializeUiFramework();

    notifications = new AppNotificationManager();
  });

  after(() => {
    TestUtils.terminateUiFramework();
  });

  beforeEach(() => {
    MessageManager.activeMessageManager.initialize();
  });

  it("Renderer should render a Toast  message", () => {
    const wrapper = mount(<MessageRenderer />);

    const details = new NotifyMessageDetails(OutputMessagePriority.Info, "Message", "Details", OutputMessageType.Toast);
    notifications.outputMessage(details);
    wrapper.update();

    expect(wrapper.find(ToastMessage).length).to.eq(1);
    expect(wrapper.find(Message).length).to.eq(1);

    wrapper.unmount();
  });

  it("Renderer should render a Sticky  message", () => {
    const wrapper = mount(<MessageRenderer />);

    const details = new NotifyMessageDetails(OutputMessagePriority.Info, "Message", "Details", OutputMessageType.Sticky);
    notifications.outputMessage(details);
    wrapper.update();

    expect(wrapper.find(StickyMessage).length).to.eq(1);
    expect(wrapper.find(Message).length).to.eq(1);

    wrapper.unmount();
  });

  it("Sticky message should close on button click", () => {
    const fakeTimers = sinon.useFakeTimers();
    const spy = sinon.spy();
    const wrapper = mount(<MessageRenderer closeMessage={spy} />);

    const details = new NotifyMessageDetails(OutputMessagePriority.Error, "A brief message.", "A detailed message.", OutputMessageType.Sticky);
    notifications.outputMessage(details);
    wrapper.update();

    expect(wrapper.find(MessageButton).length).to.eq(1);

    wrapper.find(MessageButton).simulate("click");
    fakeTimers.tick(1000);
    fakeTimers.restore();
    wrapper.update();
    expect(wrapper.find(Message).length).to.eq(0);
    spy.calledOnce.should.true;

    wrapper.unmount();
  });

  it("Renderer should render an Activity message", () => {
    const wrapper = mount(<MessageRenderer cancelActivityMessage={() => { }} dismissActivityMessage={() => { }} />);

    const details = new ActivityMessageDetails(true, true, false);
    notifications.setupActivityMessage(details);
    notifications.outputActivityMessage("Message text", 50);
    wrapper.update();

    expect(wrapper.find(ActivityMessage).length).to.eq(1);
    expect(wrapper.find(Message).length).to.eq(1);
    expect(wrapper.find(MessageProgress).length).to.eq(1);

    notifications.endActivityMessage(ActivityMessageEndReason.Completed);
    wrapper.update();
    expect(wrapper.find(ActivityMessage).length).to.eq(0);
    expect(wrapper.find(Message).length).to.eq(0);

    wrapper.unmount();
  });

  it("Activity message should be canceled", () => {
    const spy = sinon.spy();
    const wrapper = mount(<MessageRenderer cancelActivityMessage={spy} dismissActivityMessage={() => { }} />);

    const details = new ActivityMessageDetails(true, true, true);
    notifications.setupActivityMessage(details);
    notifications.outputActivityMessage("Message text", 50);
    wrapper.update();

    expect(wrapper.find(ActivityMessage).length).to.eq(1);
    expect(wrapper.find(Message).length).to.eq(1);

    wrapper.find(MessageHyperlink).simulate("click");
    wrapper.update();

    expect(wrapper.find(ActivityMessage).length).to.eq(0);
    expect(wrapper.find(Message).length).to.eq(0);
    spy.calledOnce.should.true;

    wrapper.unmount();
  });

  it("Activity message should be dismissed & restored", () => {
    const spy = sinon.spy();
    const wrapper = mount(<MessageRenderer cancelActivityMessage={() => { }} dismissActivityMessage={spy} />);

    const details = new ActivityMessageDetails(true, true, true);
    notifications.setupActivityMessage(details);
    notifications.outputActivityMessage("Message text", 50);
    wrapper.update();
    expect(wrapper.find(ActivityMessage).length).to.eq(1);
    expect(wrapper.find(Message).length).to.eq(1);

    wrapper.find(MessageButton).simulate("click");
    wrapper.update();
    expect(wrapper.find(ActivityMessage).length).to.eq(0);
    expect(wrapper.find(Message).length).to.eq(0);
    spy.calledOnce.should.true;

    notifications.outputActivityMessage("Message text", 60);
    wrapper.update();
    expect(wrapper.find(ActivityMessage).length).to.eq(0);

    MessageManager.setupActivityMessageValues("Test message text", 75, true);   // restore
    wrapper.update();
    expect(wrapper.find(ActivityMessage).length).to.eq(1);
    expect(wrapper.find(Message).length).to.eq(1);

    wrapper.unmount();
  });

  it("Renderer should clear messages", () => {
    const wrapper = mount(<MessageRenderer />);

    const details = new NotifyMessageDetails(OutputMessagePriority.Info, "A brief message.", "A detailed message.", OutputMessageType.Sticky);
    notifications.outputMessage(details);
    wrapper.update();

    expect(wrapper.find(Message).length).to.eq(1);

    MessageManager.clearMessages();
    wrapper.update();
    expect(wrapper.find(Message).length).to.eq(0);
    wrapper.unmount();
  });

});
