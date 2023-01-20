/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import { expect } from "chai";
import * as React from "react";
import * as sinon from "sinon";
import { Logger } from "@itwin/core-bentley";
import { DialogChangedEventArgs, ModelessDialog, ModelessDialogManager, ModelessDialogRenderer, UiFramework } from "../../appui-react";
import TestUtils, { userEvent } from "../TestUtils";
import { render, screen } from "@testing-library/react";
import { MockRender } from "@itwin/core-frontend";

describe("ModelessDialogManager", () => {
  let theUserTo: ReturnType<typeof userEvent.setup>;
  const spyMethod = sinon.spy();
  beforeEach(()=>{
    theUserTo = userEvent.setup();
    ModelessDialogManager.closeAll();
    spyMethod.resetHistory();
  });

  function handleModelessDialogChanged(_args: DialogChangedEventArgs) {
    spyMethod();
  }

  before(async () => {
    await TestUtils.initializeUiFramework(true);
    UiFramework.controls.initialize();
    await MockRender.App.startup();

    ModelessDialogManager.onModelessDialogChangedEvent.addListener(handleModelessDialogChanged);
  });

  after(async () => {
    ModelessDialogManager.onModelessDialogChangedEvent.removeListener(handleModelessDialogChanged);
    await MockRender.App.shutdown();
    TestUtils.terminateUiFramework(); // clear out the framework key
  });

  it("ModelessDialogManager methods", () => {
    const dialogId = "Test1";
    const reactNode = <ModelessDialog
      opened={true}
      title="My Title"
      dialogId={dialogId}
    />;

    expect(ModelessDialogManager.dialogCount).to.eq(0);
    ModelessDialogManager.openDialog(reactNode, dialogId);
    expect(spyMethod.calledOnce).to.be.true;

    expect(ModelessDialogManager.activeDialog).to.eq(reactNode);

    expect(ModelessDialogManager.dialogCount).to.eq(1);
    ModelessDialogManager.openDialog(reactNode, dialogId);
    expect(ModelessDialogManager.dialogCount).to.eq(1);

    expect(ModelessDialogManager.dialogs.length).to.eq(1);
    expect(ModelessDialogManager.dialogs[0].reactNode).to.eq(reactNode);

    ModelessDialogManager.update();
    expect(spyMethod.calledTwice).to.be.true;

    ModelessDialogManager.closeDialog(dialogId);
    expect(spyMethod.calledThrice).to.be.true;
    expect(ModelessDialogManager.dialogCount).to.eq(0);
  });

  it("closeDialog should log error if passed a bad id", () => {
    const logSpyMethod = sinon.spy(Logger, "logError");
    ModelessDialogManager.closeDialog("bad");
    logSpyMethod.calledOnce.should.true;
  });

  it("ModelessDialogRenderer component", () => {
    const dialogId = "Test1";
    const reactNode = <ModelessDialog
      opened={true}
      title="My Title"
      dialogId={dialogId}
    />;

    render(<ModelessDialogRenderer />);

    expect(ModelessDialogManager.dialogCount).to.eq(0);
    ModelessDialogManager.openDialog(reactNode, dialogId);
    expect(ModelessDialogManager.dialogCount).to.eq(1);
    expect(screen.getByText("My Title")).to.exist;

    ModelessDialogManager.closeDialog(dialogId);
    expect(ModelessDialogManager.dialogCount).to.eq(0);
    expect(screen.queryByText("My Title")).to.be.null;
  });

  it("ModelessDialogRenderer component with two dialogs", () => {
    const dialogId1 = "Test1";
    const reactNode1 = <ModelessDialog
      opened={true}
      title="My Title"
      dialogId={dialogId1}
    />;

    const dialogId2 = "Test2";
    const reactNode2 = <ModelessDialog
      opened={true}
      title="My Title 2"
      dialogId={dialogId2}
    />;

    render(<ModelessDialogRenderer />);

    expect(ModelessDialogManager.dialogCount).to.eq(0);

    ModelessDialogManager.openDialog(reactNode1, dialogId1);
    expect(ModelessDialogManager.dialogCount).to.eq(1);
    expect(screen.getByText("My Title")).to.exist;

    ModelessDialogManager.openDialog(reactNode2, dialogId2);
    expect(ModelessDialogManager.dialogCount).to.eq(2);
    expect(screen.getByText("My Title")).to.exist;
    expect(screen.getByText("My Title 2")).to.exist;

    ModelessDialogManager.closeDialog(dialogId2);
    expect(ModelessDialogManager.dialogCount).to.eq(1);
    expect(screen.getByText("My Title")).to.exist;
    expect(screen.queryByText("My Title 2")).to.be.null;

    ModelessDialogManager.closeDialog(dialogId1);
    expect(ModelessDialogManager.dialogCount).to.eq(0);
    expect(screen.queryByText("My Title")).to.be.null;
    expect(screen.queryByText("My Title 2")).to.be.null;
  });

  it("ModelessDialogRenderer component with two dialogs closed in FIFO order", () => {
    const dialogId1 = "Test1";
    const reactNode1 = <ModelessDialog
      opened={true}
      title="My Title"
      dialogId={dialogId1}
    />;

    const dialogId2 = "Test2";
    const reactNode2 = <ModelessDialog
      opened={true}
      title="My Title 2"
      dialogId={dialogId2}
    />;

    render(<ModelessDialogRenderer />);

    expect(ModelessDialogManager.dialogCount).to.eq(0);

    ModelessDialogManager.openDialog(reactNode1, dialogId1);
    expect(ModelessDialogManager.dialogCount).to.eq(1);
    expect(ModelessDialogManager.getDialogInfo(dialogId1)).not.to.be.undefined;

    ModelessDialogManager.openDialog(reactNode2, dialogId2);
    expect(ModelessDialogManager.dialogCount).to.eq(2);
    expect(screen.getByText("My Title")).to.exist;
    expect(screen.getByText("My Title 2")).to.exist;

    ModelessDialogManager.closeDialog(dialogId1);
    expect(ModelessDialogManager.dialogCount).to.eq(1);
    expect(screen.queryByText("My Title")).to.be.null;
    expect(screen.getByText("My Title 2")).to.exist;

    ModelessDialogManager.closeDialog(dialogId2);
    expect(ModelessDialogManager.dialogCount).to.eq(0);
    expect(screen.queryByText("My Title")).to.be.null;
    expect(screen.queryByText("My Title 2")).to.be.null;
  });

  it("ModelessDialogRenderer component with two dialogs and bring forward", async () => {
    const dialogId1 = "Test1";
    const reactNode1 = <ModelessDialog
      opened={true}
      title="My Title"
      dialogId={dialogId1}
    />;

    const dialogId2 = "Test2";
    const reactNode2 = <ModelessDialog
      opened={true}
      title="My Title 2"
      dialogId={dialogId2}
    />;

    render(<ModelessDialogRenderer />);

    expect(ModelessDialogManager.dialogCount).to.eq(0);

    ModelessDialogManager.openDialog(reactNode1, dialogId1);
    expect(ModelessDialogManager.dialogCount).to.eq(1);

    ModelessDialogManager.openDialog(reactNode2, dialogId2);
    expect(ModelessDialogManager.dialogCount).to.eq(2);

    expect(ModelessDialogManager.activeDialog).to.eq(reactNode2);

    // Click the 2nd dialog - should stay forward
    await theUserTo.click(screen.getByText("My Title 2"));
    expect(ModelessDialogManager.activeDialog).to.eq(reactNode2);

    // Click the 1st dialog to bring it forward
    await theUserTo.click(screen.getByText("My Title"));
    expect(ModelessDialogManager.activeDialog).to.eq(reactNode1);

    ModelessDialogManager.closeDialog(dialogId1);
    expect(ModelessDialogManager.dialogCount).to.eq(1);

    expect(ModelessDialogManager.activeDialog).to.eq(reactNode2);

    ModelessDialogManager.closeDialog(dialogId2);
    expect(ModelessDialogManager.dialogCount).to.eq(0);
  });

});
