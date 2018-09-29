/*---------------------------------------------------------------------------------------------
* Copyright (c) 2018 - present Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/
import * as React from "react";
import { mount } from "enzyme";
import * as sinon from "sinon";
import { expect } from "chai";

import TestUtils from "../TestUtils";
import { StandardMessageBox, ModalDialogManager, ModalDialogChangedEventArgs, ModalDialogRenderer } from "../../src";
import { MessageBoxIconType, MessageBoxType } from "@bentley/imodeljs-frontend";

describe("StandardMessageBox", () => {

  const spyMethod = sinon.spy();

  function handleModalDialogChanged(_args: ModalDialogChangedEventArgs) {
    spyMethod();
  }

  before(async () => {
    await TestUtils.initializeUiFramework();

    ModalDialogManager.onModalDialogChangedEvent.addListener(handleModalDialogChanged);
  });

  after(() => {
    ModalDialogManager.onModalDialogChangedEvent.removeListener(handleModalDialogChanged);
  });

  it("ModalDialogManager methods", () => {
    const reactNode = <StandardMessageBox
      opened={false}
      title="My Title"
      iconType={MessageBoxIconType.Critical}
      messageBoxType={MessageBoxType.YesNoCancel}
    />;

    ModalDialogManager.openModalDialog(reactNode);
    expect(spyMethod.calledOnce).to.be.true;

    expect(ModalDialogManager.activeModalDialog).to.eq(reactNode);

    expect(ModalDialogManager.modalDialogCount).to.eq(1);

    expect(ModalDialogManager.modalDialogs.length).to.eq(1);
    expect(ModalDialogManager.modalDialogs[0]).to.eq(reactNode);

    ModalDialogManager.updateModalDialog();
    expect(spyMethod.calledTwice).to.be.true;

    ModalDialogManager.closeModalDialog();
    expect(spyMethod.calledThrice).to.be.true;
  });

  it("ModalDialogRenderer component", () => {
    const reactNode = <StandardMessageBox
      opened={false}
      title="My Title"
      iconType={MessageBoxIconType.Critical}
      messageBoxType={MessageBoxType.YesNoCancel}
    />;

    const wrapper = mount(<ModalDialogRenderer />);

    ModalDialogManager.openModalDialog(reactNode);
    wrapper.update();
    ModalDialogManager.closeModalDialog();
    wrapper.update();

    wrapper.unmount();
  });

});
