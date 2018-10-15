/*---------------------------------------------------------------------------------------------
* Copyright (c) 2018 Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/
import * as React from "react";
import { expect } from "chai";
import * as enzyme from "enzyme";
import * as sinon from "sinon";
import TestUtils from "../TestUtils";
import { MessageManager } from "../../src/configurableui";
import ValidationTextbox, { ValidationTextboxProps } from "../../src/feedback/ValidationTextbox";

describe("ValidationTextbox", () => {
  before(async () => {
    await TestUtils.initializeUiFramework();
  });

  const onValueChanged = sinon.spy();
  const onEnterPressed = sinon.spy();
  const onEscPressed = sinon.spy();
  let simpleBox: enzyme.ReactWrapper<ValidationTextboxProps, any>;
  let simpleInput: enzyme.ReactWrapper<enzyme.HTMLAttributes, any>;
  let box: enzyme.ReactWrapper<ValidationTextboxProps, any>;
  let input: enzyme.ReactWrapper<enzyme.HTMLAttributes, any>;

  beforeEach(async () => {
    onValueChanged.resetHistory();
    onEnterPressed.resetHistory();
    onEscPressed.resetHistory();
    box = enzyme.mount(
      <ValidationTextbox
        onValueChanged={onValueChanged}
        onEnterPressed={onEnterPressed}
        onEscPressed={onEscPressed}
        errorText="Error"
      />,
    );
    input = box.find("input");

    simpleBox = enzyme.mount(
      <ValidationTextbox
        placeholder="Placeholder"
        size={12}
        errorText="Error"
      />,
    );
    simpleInput = simpleBox.find("input");
  });

  it("should render correctly", () => {
    enzyme.shallow(
      <ValidationTextbox />,
    ).should.matchSnapshot();
  });

  it("should use onValueChanged function provided", () => {
    input.simulate("change");
    expect(onValueChanged.called).to.be.true;
  });

  it("should use default value check if none provided", () => {
    simpleInput.simulate("change");
    expect(onValueChanged.called).to.be.false;
  });

  it("should hide message when value is valid", () => {
    const hideMessage = sinon.spy(MessageManager, "hideInputFieldMessage");
    simpleInput.simulate("change", { target: { value: "test" } });
    expect(hideMessage.called).to.be.true;
  });

  it("should show message when value is invalid", () => {
    const showMessage = sinon.spy(MessageManager, "displayInputFieldMessage");
    simpleInput.simulate("change", { target: { value: "" } });
    expect(showMessage.called).to.be.true;
  });

  it("should manage escape press", () => {
    input.simulate("keyUp", { key: "Esc", keyCode: 27 });
    expect(onEscPressed.called).to.be.true;
  });

  it("should manage enter press", () => {
    input.simulate("keyUp", { key: "Enter", keyCode: 13 });
    expect(onEnterPressed.called).to.be.true;
  });
});
