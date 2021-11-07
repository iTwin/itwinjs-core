/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import { expect } from "chai";
import * as React from "react";
import * as sinon from "sinon";
import { MessageBoxIconType, NotifyMessageDetails, OutputMessagePriority } from "@itwin/core-frontend";
import { MessageSeverity } from "@itwin/appui-abstract";
import { UnderlinedButton } from "@itwin/core-react";
import { MessageManager, ReactNotifyMessageDetails } from "../../appui-react";
import TestUtils from "../TestUtils";

describe("MessageManager", () => {

  before(async () => {
    await TestUtils.initializeUiFramework();
  });

  after(() => {
    TestUtils.terminateUiFramework();
  });

  it("maxCachedMessages handled correctly", () => {
    const clearSpy = sinon.spy();
    MessageManager.onMessagesUpdatedEvent.addListener(clearSpy);
    MessageManager.clearMessages();
    expect(MessageManager.messages.length).to.eq(0);
    clearSpy.calledOnce.should.true;

    for (let i = 0; i < 500; i++) {
      const details = new NotifyMessageDetails(OutputMessagePriority.Debug, `A brief message - ${i}.`);
      MessageManager.addMessage(details);
    }
    expect(MessageManager.messages.length).to.eq(500);

    clearSpy.resetHistory();
    const details2 = new NotifyMessageDetails(OutputMessagePriority.Debug, `A brief message.`);
    MessageManager.addMessage(details2);
    expect(MessageManager.messages.length).to.eq(376);
    clearSpy.calledTwice.should.true;

    const newMax = 375;
    MessageManager.setMaxCachedMessages(newMax);
    expect(MessageManager.messages.length).to.be.lessThan(newMax);
  });

  it("maxDisplayedStickyMessages handled correctly", () => {
    MessageManager.maxDisplayedStickyMessages = 5;
    expect(MessageManager.maxDisplayedStickyMessages).to.eq(5);
  });

  it("getIconType should return proper icon type", () => {
    let details = new NotifyMessageDetails(OutputMessagePriority.Info, "A brief message.");
    expect(MessageManager.getIconType(details)).to.eq(MessageBoxIconType.Information);

    details = new NotifyMessageDetails(OutputMessagePriority.Warning, "A brief message.");
    expect(MessageManager.getIconType(details)).to.eq(MessageBoxIconType.Warning);

    details = new NotifyMessageDetails(OutputMessagePriority.Error, "A brief message.");
    expect(MessageManager.getIconType(details)).to.eq(MessageBoxIconType.Critical);

    details = new NotifyMessageDetails(OutputMessagePriority.Fatal, "A brief message.");
    expect(MessageManager.getIconType(details)).to.eq(MessageBoxIconType.Critical);

    details = new NotifyMessageDetails(OutputMessagePriority.None, "A brief message.");
    expect(MessageManager.getIconType(details)).to.eq(MessageBoxIconType.NoSymbol);
  });

  it("getSeverity should return proper severity", () => {
    let details = new NotifyMessageDetails(OutputMessagePriority.Info, "A brief message.");
    expect(MessageManager.getSeverity(details)).to.eq(MessageSeverity.Information);

    details = new NotifyMessageDetails(OutputMessagePriority.Warning, "A brief message.");
    expect(MessageManager.getSeverity(details)).to.eq(MessageSeverity.Warning);

    details = new NotifyMessageDetails(OutputMessagePriority.Error, "A brief message.");
    expect(MessageManager.getSeverity(details)).to.eq(MessageSeverity.Error);

    details = new NotifyMessageDetails(OutputMessagePriority.Fatal, "A brief message.");
    expect(MessageManager.getSeverity(details)).to.eq(MessageSeverity.Fatal);

    details = new NotifyMessageDetails(OutputMessagePriority.None, "A brief message.");
    expect(MessageManager.getSeverity(details)).to.eq(MessageSeverity.None);
  });

  it("non-duplicate message should be added to Message Center", () => {
    MessageManager.clearMessages();
    expect(MessageManager.messages.length).to.eq(0);

    const details1 = new NotifyMessageDetails(OutputMessagePriority.Debug, "A brief message.");
    MessageManager.addMessage(details1);
    expect(MessageManager.messages.length).to.eq(1);

    const details2 = new NotifyMessageDetails(OutputMessagePriority.Error, "Another brief message.");
    MessageManager.addMessage(details2);
    expect(MessageManager.messages.length).to.eq(2);
  });

  it("duplicate message should not be added to Message Center", () => {
    MessageManager.clearMessages();
    expect(MessageManager.messages.length).to.eq(0);

    const details1 = new NotifyMessageDetails(OutputMessagePriority.Debug, "A brief message.");
    MessageManager.addMessage(details1);
    expect(MessageManager.messages.length).to.eq(1);

    const details2 = new NotifyMessageDetails(OutputMessagePriority.Debug, "A brief message.");
    MessageManager.addMessage(details2);
    expect(MessageManager.messages.length).to.eq(1);
  });

  it("React based message should be supported", () => {
    MessageManager.clearMessages();
    expect(MessageManager.messages.length).to.eq(0);

    const reactNode = (<span>For more details, <UnderlinedButton>click here</UnderlinedButton>.</span>);
    const details1 = new ReactNotifyMessageDetails(OutputMessagePriority.Debug, "A brief message.", { reactNode });
    MessageManager.outputMessage(details1);
    expect(MessageManager.messages.length).to.eq(1);
  });

  it("openMessageCenter raises OpenMessageCenterEvent", () => {
    const onOpenMessageCenterEventSpy = sinon.spy();
    MessageManager.onOpenMessageCenterEvent.addOnce(onOpenMessageCenterEventSpy);

    MessageManager.openMessageCenter();
    expect(onOpenMessageCenterEventSpy.callCount).to.eq(1);
  });

});
