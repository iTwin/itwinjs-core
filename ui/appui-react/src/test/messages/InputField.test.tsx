/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import { expect } from "chai";
import { shallow } from "enzyme";
import * as React from "react";
import { NotifyMessageDetails, OutputMessagePriority, OutputMessageType } from "@itwin/core-frontend";
import { InputFieldMessage, KeyboardShortcutManager, MessageManager } from "../../appui-react";
import TestUtils, { mount } from "../TestUtils";

describe("InputFieldMessage", () => {
  before(async () => {
    await TestUtils.initializeUiFramework();
    KeyboardShortcutManager.closeShortcutsMenu();
  });

  after(() => {
    TestUtils.terminateUiFramework();
  });

  it("should render correctly", () => {
    const sut = shallow(
      <InputFieldMessage />,
    );
    sut.should.matchSnapshot();
  });

  it("should unmount correctly", () => {
    const sut = mount(
      <InputFieldMessage />,
    );
    sut.unmount();
  });

  it("outputMessage with InputField", () => {
    let details = new NotifyMessageDetails(OutputMessagePriority.Error, "Input field message.", "Detailed input field message.", OutputMessageType.InputField);
    const divElement = document.createElement("div");
    details.setInputFieldTypeDetails(divElement);
    const wrapper = mount(<InputFieldMessage showCloseButton />);
    MessageManager.displayInputFieldMessage(details.inputField!, details.briefMessage, details.detailedMessage, details.priority);
    wrapper.update();

    expect(wrapper.find("div.uifw-popup-message-inputField").length).to.eq(1);
    expect(wrapper.find("div.uifw-popup-message-brief").length).to.eq(1);
    expect(wrapper.find("div.uifw-popup-message-detailed").length).to.eq(1);
    expect(wrapper.find("i.icon-status-error").length).to.eq(1);
    expect(wrapper.find("div.uifw-popup-message-close").length).to.eq(1);

    MessageManager.hideInputFieldMessage();
    wrapper.update();
    expect(wrapper.find("div.uifw-popup-message-inputField").length).to.eq(0);

    // Warning icon
    details = new NotifyMessageDetails(OutputMessagePriority.Warning, "Input field message.", "Detailed input field message.", OutputMessageType.InputField);
    details.setInputFieldTypeDetails(divElement);
    MessageManager.displayInputFieldMessage(details.inputField!, details.briefMessage, details.detailedMessage, details.priority);
    wrapper.update();
    expect(wrapper.find("i.icon-status-warning").length).to.eq(1);
    MessageManager.hideInputFieldMessage();

    // Info icon
    details = new NotifyMessageDetails(OutputMessagePriority.Info, "Input field message.", "Detailed input field message.", OutputMessageType.InputField);
    details.setInputFieldTypeDetails(divElement);
    MessageManager.displayInputFieldMessage(details.inputField!, details.briefMessage, details.detailedMessage, details.priority);
    wrapper.update();
    expect(wrapper.find("i.icon-info").length).to.eq(1);
    MessageManager.hideInputFieldMessage();

    // Without an inputFieldElement
    details = new NotifyMessageDetails(OutputMessagePriority.Info, "Input field message.", undefined, OutputMessageType.InputField);
    MessageManager.displayInputFieldMessage(details.inputField!, details.briefMessage, details.detailedMessage, details.priority);
    wrapper.update();
    expect(wrapper.find("div.uifw-popup-message-inputField").length).to.eq(0);
  });

});
