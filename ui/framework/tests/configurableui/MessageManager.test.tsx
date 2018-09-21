/*---------------------------------------------------------------------------------------------
|  $Copyright: (c) 2018 Bentley Systems, Incorporated. All rights reserved. $
 *--------------------------------------------------------------------------------------------*/
import { expect } from "chai";
import TestUtils from "../TestUtils";
import { MessageManager } from "../../src";
import { NotifyMessageDetails, OutputMessagePriority } from "@bentley/imodeljs-frontend";

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

});
