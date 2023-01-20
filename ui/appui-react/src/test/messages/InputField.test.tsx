/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import { expect } from "chai";
import * as React from "react";
import { NotifyMessageDetails, OutputMessagePriority, OutputMessageType } from "@itwin/core-frontend";
import { InputFieldMessage, MessageManager, UiFramework } from "../../appui-react";
import TestUtils, { childStructure } from "../TestUtils";
import { render, screen } from "@testing-library/react";

describe("InputFieldMessage", () => {
  before(async () => {
    await TestUtils.initializeUiFramework();
    UiFramework.keyboardShortcuts.closeShortcutsMenu();
  });

  after(() => {
    TestUtils.terminateUiFramework();
  });

  it("outputMessage with InputField", () => {
    let details = new NotifyMessageDetails(OutputMessagePriority.Error, "Input field message.", "Detailed input field message.", OutputMessageType.InputField);
    const divElement = document.createElement("div");
    details.setInputFieldTypeDetails(divElement);
    render(<InputFieldMessage showCloseButton />);
    MessageManager.displayInputFieldMessage(details.inputField!, details.briefMessage, details.detailedMessage, details.priority);

    expect(screen.getByText("Input field message.")).to.exist;

    expect(screen.getByRole("dialog")).to.satisfy(childStructure("i.icon-status-error"));

    MessageManager.hideInputFieldMessage();

    expect(screen.queryByText("Input field message.")).to.be.null;

    // Warning icon
    details = new NotifyMessageDetails(OutputMessagePriority.Warning, "Input field message.", "Detailed input field message.", OutputMessageType.InputField);
    details.setInputFieldTypeDetails(divElement);
    MessageManager.displayInputFieldMessage(details.inputField!, details.briefMessage, details.detailedMessage, details.priority);

    expect(screen.getByRole("dialog")).to.satisfy(childStructure("i.icon-status-warning"));

    MessageManager.hideInputFieldMessage();

    // Info icon
    details = new NotifyMessageDetails(OutputMessagePriority.Info, "Input field message.", "Detailed input field message.", OutputMessageType.InputField);
    details.setInputFieldTypeDetails(divElement);
    MessageManager.displayInputFieldMessage(details.inputField!, details.briefMessage, details.detailedMessage, details.priority);

    expect(screen.getByRole("dialog")).to.satisfy(childStructure("i.icon-info"));

    MessageManager.hideInputFieldMessage();

    // Without an inputFieldElement
    details = new NotifyMessageDetails(OutputMessagePriority.Info, "Input field message.", undefined, OutputMessageType.InputField);
    MessageManager.displayInputFieldMessage(details.inputField!, details.briefMessage, details.detailedMessage, details.priority);

    expect(screen.queryByText("Input field message.")).to.be.null;
  });

});
