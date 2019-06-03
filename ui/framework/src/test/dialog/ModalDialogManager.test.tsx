/*---------------------------------------------------------------------------------------------
* Copyright (c) 2019 Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/
import * as React from "react";
import { mount } from "enzyme";
import * as sinon from "sinon";
import { expect } from "chai";

import TestUtils from "../TestUtils";
import { StandardMessageBox, ModalDialogManager, DialogChangedEventArgs, ModalDialogRenderer } from "../../ui-framework";
import { MessageBoxIconType, MessageBoxType } from "@bentley/imodeljs-frontend";

describe("ModalDialogManager", () => {

  const spyMethod = sinon.spy();

  function handleModalDialogChanged(_args: DialogChangedEventArgs) {
    spyMethod();
  }

  before(async () => {
    await TestUtils.initializeUiFramework(true);

    ModalDialogManager.onModalDialogChangedEvent.addListener(handleModalDialogChanged);
  });

  after(() => {
    ModalDialogManager.onModalDialogChangedEvent.removeListener(handleModalDialogChanged);
    TestUtils.terminateUiFramework(); // clear out the framework key
  });

  it("ModalDialogManager methods", () => {
    const reactNode = <StandardMessageBox
      opened={false}
      title="My Title"
      iconType={MessageBoxIconType.Critical}
      messageBoxType={MessageBoxType.YesNoCancel}
    />;

    expect(ModalDialogManager.dialogCount).to.eq(0);
    ModalDialogManager.openDialog(reactNode);
    expect(spyMethod.calledOnce).to.be.true;

    expect(ModalDialogManager.activeDialog).to.eq(reactNode);

    expect(ModalDialogManager.dialogCount).to.eq(1);

    expect(ModalDialogManager.dialogs.length).to.eq(1);
    expect(ModalDialogManager.dialogs[0].reactNode).to.eq(reactNode);

    ModalDialogManager.update();
    expect(spyMethod.calledTwice).to.be.true;

    ModalDialogManager.closeDialog(reactNode);
    expect(spyMethod.calledThrice).to.be.true;
    expect(ModalDialogManager.dialogCount).to.eq(0);
  });

  it("ModalDialogRenderer component", () => {
    const reactNode = <StandardMessageBox
      opened={false}
      title="My Title"
      iconType={MessageBoxIconType.Critical}
      messageBoxType={MessageBoxType.YesNoCancel}
    />;

    const wrapper = mount(<ModalDialogRenderer />);

    expect(ModalDialogManager.dialogCount).to.eq(0);
    ModalDialogManager.openDialog(reactNode);
    expect(ModalDialogManager.dialogCount).to.eq(1);
    wrapper.update();
    expect(wrapper.find(StandardMessageBox).length).to.eq(1);

    ModalDialogManager.closeDialog();
    expect(ModalDialogManager.dialogCount).to.eq(0);
    wrapper.update();
    expect(wrapper.find(StandardMessageBox).length).to.eq(0);

    wrapper.unmount();
  });

  it("ModalDialogRenderer component with two dialogs", () => {
    const reactNode = <StandardMessageBox
      opened={false}
      title="My Title"
      iconType={MessageBoxIconType.Critical}
      messageBoxType={MessageBoxType.YesNoCancel}
    />;
    const reactNode2 = <StandardMessageBox
      opened={false}
      title="My Title 2"
      iconType={MessageBoxIconType.Critical}
      messageBoxType={MessageBoxType.YesNoCancel}
    />;

    const wrapper = mount(<ModalDialogRenderer />);

    expect(ModalDialogManager.dialogCount).to.eq(0);

    ModalDialogManager.openDialog(reactNode);
    expect(ModalDialogManager.dialogCount).to.eq(1);
    wrapper.update();
    expect(wrapper.find(StandardMessageBox).length).to.eq(1);

    ModalDialogManager.openDialog(reactNode2);
    expect(ModalDialogManager.dialogCount).to.eq(2);
    wrapper.update();
    expect(wrapper.find(StandardMessageBox).length).to.eq(2);

    ModalDialogManager.closeDialog();
    expect(ModalDialogManager.dialogCount).to.eq(1);
    wrapper.update();
    expect(wrapper.find(StandardMessageBox).length).to.eq(1);

    ModalDialogManager.closeDialog();
    expect(ModalDialogManager.dialogCount).to.eq(0);
    wrapper.update();
    expect(wrapper.find(StandardMessageBox).length).to.eq(0);

    wrapper.unmount();
  });

});
