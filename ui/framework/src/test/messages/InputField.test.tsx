/*---------------------------------------------------------------------------------------------
* Copyright (c) 2019 Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/
import * as React from "react";
import * as enzyme from "enzyme";
import { expect } from "chai";
import TestUtils from "../TestUtils";
import { InputFieldMessage, KeyboardShortcutManager, MessageManager } from "../../ui-framework";
import { NotifyMessageDetails, OutputMessagePriority, OutputMessageType } from "@bentley/imodeljs-frontend";

describe("InputFieldMessage", () => {
  before(async () => {
    await TestUtils.initializeUiFramework();
    KeyboardShortcutManager.closeShortcutsMenu();
  });

  it("should render correctly", () => {
    const sut = enzyme.shallow(
      <InputFieldMessage />,
    );
    sut.should.matchSnapshot();
    sut.unmount();
  });

  it("should unmount correctly", () => {
    const sut = enzyme.mount(
      <InputFieldMessage />,
    );
    sut.unmount();
  });

  it("outputMessage with InputField", () => {
    let details = new NotifyMessageDetails(OutputMessagePriority.Error, "Input field message.", "Detailed input field message.", OutputMessageType.InputField);
    const divElement = document.createElement("div");
    details.setInputFieldTypeDetails(divElement);
    const wrapper = enzyme.mount(<InputFieldMessage showCloseButton />);
    MessageManager.displayInputFieldMessage(details.inputField!, details.briefMessage, details.detailedMessage, details.priority);
    wrapper.update();

    expect(wrapper.find("div.uifw-popup-message-inputField").length).to.eq(1);
    expect(wrapper.find("div.uifw-popup-message-brief").length).to.eq(1);
    expect(wrapper.find("div.uifw-popup-message-detailed").length).to.eq(1);
    expect(wrapper.find("div.icon-status-error").length).to.eq(1);
    expect(wrapper.find("div.uifw-popup-message-close").length).to.eq(1);

    MessageManager.hideInputFieldMessage();
    wrapper.update();
    expect(wrapper.find("div.uifw-popup-message-inputField").length).to.eq(0);

    // Warning icon
    details = new NotifyMessageDetails(OutputMessagePriority.Warning, "Input field message.", "Detailed input field message.", OutputMessageType.InputField);
    details.setInputFieldTypeDetails(divElement);
    MessageManager.displayInputFieldMessage(details.inputField!, details.briefMessage, details.detailedMessage, details.priority);
    wrapper.update();
    expect(wrapper.find("div.icon-status-warning").length).to.eq(1);
    MessageManager.hideInputFieldMessage();

    // Info icon
    details = new NotifyMessageDetails(OutputMessagePriority.Info, "Input field message.", "Detailed input field message.", OutputMessageType.InputField);
    details.setInputFieldTypeDetails(divElement);
    MessageManager.displayInputFieldMessage(details.inputField!, details.briefMessage, details.detailedMessage, details.priority);
    wrapper.update();
    expect(wrapper.find("div.icon-info").length).to.eq(1);
    MessageManager.hideInputFieldMessage();

    // Without an inputFieldElement
    details = new NotifyMessageDetails(OutputMessagePriority.Info, "Input field message.", undefined, OutputMessageType.InputField);
    MessageManager.displayInputFieldMessage(details.inputField!, details.briefMessage, details.detailedMessage, details.priority);
    wrapper.update();
    expect(wrapper.find("div.uifw-popup-message-inputField").length).to.eq(0);

    wrapper.unmount();
  });

});
