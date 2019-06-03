/*---------------------------------------------------------------------------------------------
* Copyright (c) 2019 Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/
import { expect } from "chai";
import TestUtils from "../TestUtils";
import { MessageManager } from "../../ui-framework";
import { NotifyMessageDetails, OutputMessagePriority, MessageBoxIconType } from "@bentley/imodeljs-frontend";

describe("MessageManager", () => {

  before(async () => {
    await TestUtils.initializeUiFramework();
  });

  it("maxCachedMessages handled correctly", () => {
    const details = new NotifyMessageDetails(OutputMessagePriority.Debug, "A brief message.");

    MessageManager.clearMessages();
    expect(MessageManager.messages.length).to.eq(0);

    for (let i = 0; i < 500; i++) {
      MessageManager.addMessage(details);
    }
    expect(MessageManager.messages.length).to.eq(500);

    MessageManager.addMessage(details);
    expect(MessageManager.messages.length).to.eq(376);

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
  });

});
