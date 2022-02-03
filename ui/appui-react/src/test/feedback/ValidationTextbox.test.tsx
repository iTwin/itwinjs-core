/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import { expect } from "chai";
import type { HTMLAttributes, ReactWrapper} from "enzyme";
import { shallow } from "enzyme";
import * as React from "react";
import * as sinon from "sinon";
import { MessageManager, ValidationTextbox } from "../../appui-react";
import TestUtils, { mount } from "../TestUtils";

describe("ValidationTextbox", () => {
  before(async () => {
    await TestUtils.initializeUiFramework();
  });

  after(() => {
    TestUtils.terminateUiFramework();
  });

  const onValueChanged = sinon.spy();
  const onEnterPressed = sinon.spy();
  const onEscPressed = sinon.spy();
  let simpleBox: ReactWrapper<any, any>;
  let simpleInput: ReactWrapper<HTMLAttributes, any>;
  let box: ReactWrapper<any, any>;
  let input: ReactWrapper<HTMLAttributes, any>;

  beforeEach(async () => {
    onValueChanged.resetHistory();
    onEnterPressed.resetHistory();
    onEscPressed.resetHistory();
    box = mount(
      <ValidationTextbox
        onValueChanged={onValueChanged}
        onEnterPressed={onEnterPressed}
        onEscPressed={onEscPressed}
        errorText="Error"
      />,
    );
    input = box.find("input");

    simpleBox = mount(
      <ValidationTextbox
        placeholder="Placeholder"
        size={12}
        errorText="Error"
      />,
    );
    simpleInput = simpleBox.find("input");
  });

  it("should render correctly", () => {
    shallow(
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
    input.simulate("keyUp", { key: "Escape" });
    expect(onEscPressed.called).to.be.true;
  });

  it("should manage enter press", () => {
    input.simulate("keyUp", { key: "Enter" });
    expect(onEnterPressed.called).to.be.true;
  });
});
