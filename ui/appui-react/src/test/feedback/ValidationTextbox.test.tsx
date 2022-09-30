/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import { render, screen } from "@testing-library/react";
import { expect } from "chai";
import * as React from "react";
import * as sinon from "sinon";
import { MessageManager, ValidationTextbox } from "../../appui-react";
import TestUtils, { userEvent } from "../TestUtils";

describe("ValidationTextbox", () => {
  let theUserTo: ReturnType<typeof userEvent.setup>;
  beforeEach(()=>{
    theUserTo = userEvent.setup();
  });

  before(async () => {
    await TestUtils.initializeUiFramework();
  });

  after(() => {
    TestUtils.terminateUiFramework();
  });

  const onValueChanged = sinon.spy();
  const onEnterPressed = sinon.spy();
  const onEscPressed = sinon.spy();

  beforeEach(async () => {
    onValueChanged.resetHistory();
    onEnterPressed.resetHistory();
    onEscPressed.resetHistory();
  });

  it("should render correctly", () => {
    render(<ValidationTextbox />);

    expect(screen.getByRole("textbox")).to.exist;
  });

  it("should use onValueChanged function provided", async () => {
    render(
      <ValidationTextbox
        onValueChanged={onValueChanged}
        onEnterPressed={onEnterPressed}
        onEscPressed={onEscPressed}
        errorText="Error"
      />,
    );
    await theUserTo.type(screen.getByRole("textbox"), "a");
    expect(onValueChanged.called).to.be.true;
  });

  it("should use default value check if none provided", async () => {
    render(
      <ValidationTextbox
        placeholder="Placeholder"
        size={12}
        errorText="Error"
      />,
    );
    await theUserTo.type(screen.getByRole("textbox"), "t");
    expect(screen.getByRole<HTMLInputElement>("textbox").value).to.eq("t");
  });

  it("should hide message when value is valid", async () => {
    render(
      <ValidationTextbox
        placeholder="Placeholder"
        size={12}
        errorText="Error"
      />,
    );
    const hideMessage = sinon.spy(MessageManager, "hideInputFieldMessage");
    await theUserTo.type(screen.getByRole("textbox"), "test");
    expect(hideMessage.called).to.be.true;
  });

  it("should show message when value is invalid", async () => {
    render(
      <ValidationTextbox
        placeholder="Placeholder"
        size={12}
        errorText="Error"
      />,
    );
    const showMessage = sinon.spy(MessageManager, "displayInputFieldMessage");
    await theUserTo.type(screen.getByRole("textbox"), "t[Backspace]");
    expect(showMessage.called).to.be.true;
  });

  it("should manage escape press", async () => {
    render(
      <ValidationTextbox
        onValueChanged={onValueChanged}
        onEnterPressed={onEnterPressed}
        onEscPressed={onEscPressed}
        errorText="Error"
      />,
    );
    await theUserTo.type(screen.getByRole("textbox"), "[Escape]");
    expect(onEscPressed.called).to.be.true;
  });

  it("should manage enter press", async () => {
    render(
      <ValidationTextbox
        onValueChanged={onValueChanged}
        onEnterPressed={onEnterPressed}
        onEscPressed={onEscPressed}
        errorText="Error"
      />,
    );
    await theUserTo.type(screen.getByRole("textbox"), "[Enter]");
    expect(onEnterPressed.called).to.be.true;
  });
});
