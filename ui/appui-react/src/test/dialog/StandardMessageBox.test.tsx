/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import { expect } from "chai";
import * as React from "react";
import * as sinon from "sinon";
import { MessageBoxIconType, MessageBoxType } from "@itwin/core-frontend";
import { render, screen } from "@testing-library/react";
import { StandardMessageBox } from "../../appui-react";
import TestUtils, { childStructure, userEvent } from "../TestUtils";

describe("StandardMessageBox", () => {
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

  it("OK button & NoSymbol", async () => {
    const spyMethod = sinon.spy();

    const reactNode = <StandardMessageBox
      opened={true}
      title="My Title"
      iconType={MessageBoxIconType.NoSymbol}
      messageBoxType={MessageBoxType.Ok}
      onResult={spyMethod}
    />;

    const {container} = render(reactNode);
    expect(container.querySelector(".icon.core-message-box-icon")?.classList.length).to.eq(2);

    await theUserTo.click(screen.getByRole("button", {name: "dialog.ok"}));
    expect(spyMethod.calledOnce).to.be.true;
  });

  it("OK/Cancel buttons & Information", async () => {
    const spyMethod = sinon.spy();

    const reactNode = <StandardMessageBox
      opened={true}
      title="My Title"
      iconType={MessageBoxIconType.Information}
      messageBoxType={MessageBoxType.OkCancel}
      onResult={spyMethod}
    />;

    render(reactNode);
    expect(screen.getByTestId("core-dialog-container")).to.satisfy(childStructure(".icon.core-message-box-icon.icon-info.core-message-box-information"));

    await theUserTo.click(screen.getByRole("button", {name: "dialog.ok"}));
    expect(spyMethod.calledOnce).to.be.true;
  });

  it("Yes/No buttons & Question", async () => {
    const spyMethod = sinon.spy();

    const reactNode = <StandardMessageBox
      opened={true}
      title="My Title"
      iconType={MessageBoxIconType.Question}
      messageBoxType={MessageBoxType.YesNo}
      onResult={spyMethod}
    />;

    render(reactNode);
    expect(screen.getByTestId("core-dialog-container")).to.satisfy(childStructure(".icon.core-message-box-icon.icon-help.core-message-box-question"));

    await theUserTo.click(screen.getByRole("button", {name: "dialog.yes"}));
    expect(spyMethod.calledOnce).to.be.true;
  });

  it("MediumAlert & Question", async () => {
    const spyMethod = sinon.spy();
    const reactNode = <StandardMessageBox
      opened={true}
      title="My Title"
      iconType={MessageBoxIconType.Warning}
      messageBoxType={MessageBoxType.MediumAlert}
      onResult={spyMethod}
    />;
    render(reactNode);
    expect(screen.getByTestId("core-dialog-container")).to.satisfy(childStructure(".icon.core-message-box-icon.icon-status-warning.core-message-box-warning"));

    await theUserTo.click(screen.getByRole("button", {name: "dialog.cancel"}));
    expect(spyMethod.calledOnce).to.be.true;
  });

  it("YesNoCancel & Critical", async () => {
    const spyMethod = sinon.spy();
    const reactNode = <StandardMessageBox
      opened={true}
      title="My Title"
      iconType={MessageBoxIconType.Critical}
      messageBoxType={MessageBoxType.YesNoCancel}
      onResult={spyMethod}
    />;
    render(reactNode);
    expect(screen.getByTestId("core-dialog-container")).to.satisfy(childStructure(".icon.core-message-box-icon.icon-status-error.core-message-box-error"));

    await theUserTo.click(screen.getByRole("button", {name: "dialog.no"}));
    expect(spyMethod.calledOnce).to.be.true;
  });

  it("YesNoCancel & Warning", async () => {
    const spyMethod = sinon.spy();
    const reactNode = <StandardMessageBox
      opened={true}
      title="My Title"
      iconType={MessageBoxIconType.Warning}
      messageBoxType={MessageBoxType.YesNoCancel}
      onResult={spyMethod}
    />;
    render(reactNode);
    expect(screen.getByTestId("core-dialog-container")).to.satisfy(childStructure(".icon.core-message-box-icon.icon-status-warning.core-message-box-warning"));

    await theUserTo.click(screen.getByRole("button", {name: "dialog.cancel"}));
    expect(spyMethod.calledOnce).to.be.true;
  });

  it("should close on Esc key", async () => {
    const spyOnEscape = sinon.spy();
    const reactNode = <StandardMessageBox
      opened={true}
      title="My Title"
      iconType={MessageBoxIconType.Success}
      messageBoxType={MessageBoxType.Ok}
      onResult={spyOnEscape}
    />;
    render(reactNode);

    await theUserTo.type(screen.getByText("My Title"), "[Escape]");
    spyOnEscape.calledOnce.should.true;
  });

});
