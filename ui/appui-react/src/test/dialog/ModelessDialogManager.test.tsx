/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import { expect } from "chai";
import * as React from "react";
import * as sinon from "sinon";
import { Logger } from "@itwin/core-bentley";
import { ConfigurableUiManager, DialogChangedEventArgs, ModelessDialog, ModelessDialogManager, ModelessDialogRenderer } from "../../appui-react";
import TestUtils, { mount } from "../TestUtils";

describe("ModelessDialogManager", () => {

  const spyMethod = sinon.spy();

  function handleModelessDialogChanged(_args: DialogChangedEventArgs) {
    spyMethod();
  }

  before(async () => {
    await TestUtils.initializeUiFramework(true);
    ConfigurableUiManager.initialize();

    ModelessDialogManager.onModelessDialogChangedEvent.addListener(handleModelessDialogChanged);
  });

  after(() => {
    ModelessDialogManager.onModelessDialogChangedEvent.removeListener(handleModelessDialogChanged);
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

    const wrapper = mount(<ModelessDialogRenderer />);

    expect(ModelessDialogManager.dialogCount).to.eq(0);
    ModelessDialogManager.openDialog(reactNode, dialogId);
    expect(ModelessDialogManager.dialogCount).to.eq(1);
    wrapper.update();
    expect(wrapper.find(ModelessDialog).length).to.eq(1);

    ModelessDialogManager.closeDialog(dialogId);
    expect(ModelessDialogManager.dialogCount).to.eq(0);
    wrapper.update();
    expect(wrapper.find(ModelessDialog).length).to.eq(0);
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

    const wrapper = mount(<ModelessDialogRenderer />);

    expect(ModelessDialogManager.dialogCount).to.eq(0);

    ModelessDialogManager.openDialog(reactNode1, dialogId1);
    expect(ModelessDialogManager.dialogCount).to.eq(1);
    wrapper.update();
    expect(wrapper.find(ModelessDialog).length).to.eq(1);

    ModelessDialogManager.openDialog(reactNode2, dialogId2);
    expect(ModelessDialogManager.dialogCount).to.eq(2);
    wrapper.update();
    expect(wrapper.find(ModelessDialog).length).to.eq(2);

    ModelessDialogManager.closeDialog(dialogId2);
    expect(ModelessDialogManager.dialogCount).to.eq(1);
    wrapper.update();
    expect(wrapper.find(ModelessDialog).length).to.eq(1);

    ModelessDialogManager.closeDialog(dialogId1);
    expect(ModelessDialogManager.dialogCount).to.eq(0);
    wrapper.update();
    expect(wrapper.find(ModelessDialog).length).to.eq(0);
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

    const wrapper = mount(<ModelessDialogRenderer />);

    expect(ModelessDialogManager.dialogCount).to.eq(0);

    ModelessDialogManager.openDialog(reactNode1, dialogId1);
    expect(ModelessDialogManager.dialogCount).to.eq(1);
    expect(ModelessDialogManager.getDialogInfo(dialogId1)).not.to.be.undefined;

    wrapper.update();
    expect(wrapper.find(ModelessDialog).length).to.eq(1);

    ModelessDialogManager.openDialog(reactNode2, dialogId2);
    expect(ModelessDialogManager.dialogCount).to.eq(2);
    wrapper.update();
    expect(wrapper.find(ModelessDialog).length).to.eq(2);

    ModelessDialogManager.closeDialog(dialogId1);
    expect(ModelessDialogManager.dialogCount).to.eq(1);
    wrapper.update();
    expect(wrapper.find(ModelessDialog).length).to.eq(1);

    ModelessDialogManager.closeDialog(dialogId2);
    expect(ModelessDialogManager.dialogCount).to.eq(0);
    wrapper.update();
    expect(wrapper.find(ModelessDialog).length).to.eq(0);
  });

  it("ModelessDialogRenderer component with two dialogs and bring forward", () => {
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

    const wrapper = mount(<ModelessDialogRenderer />);

    expect(ModelessDialogManager.dialogCount).to.eq(0);

    ModelessDialogManager.openDialog(reactNode1, dialogId1);
    expect(ModelessDialogManager.dialogCount).to.eq(1);
    wrapper.update();
    expect(wrapper.find(ModelessDialog).length).to.eq(1);

    ModelessDialogManager.openDialog(reactNode2, dialogId2);
    expect(ModelessDialogManager.dialogCount).to.eq(2);
    wrapper.update();
    expect(wrapper.find(ModelessDialog).length).to.eq(2);

    expect(ModelessDialogManager.activeDialog).to.eq(reactNode2);

    // Click the 2nd dialog - should stay forward
    wrapper.find(ModelessDialog).at(1).find(".core-dialog-container").simulate("pointerDown");
    expect(ModelessDialogManager.activeDialog).to.eq(reactNode2);
    wrapper.update();

    // Click the 1st dialog to bring it forward
    wrapper.find(ModelessDialog).at(0).find(".core-dialog-container").simulate("pointerDown");
    expect(ModelessDialogManager.activeDialog).to.eq(reactNode1);
    wrapper.update();

    ModelessDialogManager.closeDialog(dialogId1);
    expect(ModelessDialogManager.dialogCount).to.eq(1);
    wrapper.update();
    expect(wrapper.find(ModelessDialog).length).to.eq(1);

    expect(ModelessDialogManager.activeDialog).to.eq(reactNode2);

    ModelessDialogManager.closeDialog(dialogId2);
    expect(ModelessDialogManager.dialogCount).to.eq(0);
    wrapper.update();
    expect(wrapper.find(ModelessDialog).length).to.eq(0);
  });

});
