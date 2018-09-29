/*---------------------------------------------------------------------------------------------
* Copyright (c) 2018 - present Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/
import * as React from "react";
import { mount } from "enzyme";
import { expect } from "chai";
import * as sinon from "sinon";

import TestUtils from "../TestUtils";
import { ModalFrontstageInfo, FrontstageManager, ModalFrontstage } from "../../src";

const navigationBackSpy = sinon.spy();
const closeModalSpy = sinon.spy();

function renderModalFrontstage(): React.ReactElement<any> {
  const activeModalFrontstage: ModalFrontstageInfo | undefined = FrontstageManager.activeModalFrontstage;
  if (!activeModalFrontstage) {
    throw (Error);
  }

  const { title, content, appBarRight } = activeModalFrontstage;

  return (
    <ModalFrontstage
      isOpen={true}
      title={title}
      navigateBack={navigationBackSpy}
      closeModal={closeModalSpy}
      appBarRight={appBarRight}
    >
      {content}
    </ModalFrontstage>
  );
}

class TestModalFrontstage implements ModalFrontstageInfo {
  public title: string = "Test Modal Frontstage";

  public get content(): React.ReactNode {
    return (
      <div />
    );
  }

  public get appBarRight(): React.ReactNode {
    return (
      <input type="text" defaultValue="Hello" />
    );
  }
}

describe("ModalFrontstage", () => {

  before(async () => {
    await TestUtils.initializeUiFramework();
  });

  it("openModalFrontstage, updateModalFrontstage & closeModalFrontstage", () => {
    const modalFrontstage = new TestModalFrontstage();

    const changedEventSpy = sinon.spy();
    const removeListener = FrontstageManager.onModalFrontstageChangedEvent.addListener(changedEventSpy);

    FrontstageManager.openModalFrontstage(modalFrontstage);
    expect(changedEventSpy.calledOnce).to.be.true;

    const wrapper = mount(renderModalFrontstage());
    expect(wrapper.find("div.modal-frontstage").length).to.eq(1);

    const backButton = wrapper.find("div.nz-toolbar-button-back");
    expect(backButton.length).to.eq(1);

    FrontstageManager.updateModalFrontstage();
    expect(changedEventSpy.calledTwice).to.be.true;

    backButton.simulate("click");
    expect(navigationBackSpy.calledOnce).to.be.true;
    expect(closeModalSpy.calledOnce).to.be.true;

    FrontstageManager.closeModalFrontstage();
    expect(changedEventSpy.calledThrice).to.be.true;

    removeListener();
  });

});
