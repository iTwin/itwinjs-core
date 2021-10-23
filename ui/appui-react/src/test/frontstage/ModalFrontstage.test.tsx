/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import { expect } from "chai";
import * as React from "react";
import * as sinon from "sinon";
import { FrontstageManager, ModalFrontstage, ModalFrontstageInfo } from "../../appui-react";
import TestUtils, { mount } from "../TestUtils";

const navigationBackSpy = sinon.spy();
const closeModalSpy = sinon.spy();

function renderModalFrontstage(isOpen: boolean): React.ReactElement<any> {
  const activeModalFrontstage: ModalFrontstageInfo | undefined = FrontstageManager.activeModalFrontstage;
  if (!activeModalFrontstage) {
    throw (Error);
  }

  const { title, content, appBarRight } = activeModalFrontstage;

  return (
    <ModalFrontstage
      isOpen={isOpen}
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

  after(() => {
    TestUtils.terminateUiFramework();
  });

  it("openModalFrontstage, updateModalFrontstage & closeModalFrontstage", () => {
    const modalFrontstage = new TestModalFrontstage();

    const changedEventSpy = sinon.spy();
    const closedEventSpy = sinon.spy();
    const removeListener = FrontstageManager.onModalFrontstageChangedEvent.addListener(changedEventSpy);
    const removeListener2 = FrontstageManager.onModalFrontstageClosedEvent.addListener(closedEventSpy);

    FrontstageManager.openModalFrontstage(modalFrontstage);
    expect(changedEventSpy.calledOnce).to.be.true;

    mount(renderModalFrontstage(false));

    const wrapper = mount(renderModalFrontstage(true));
    expect(wrapper.find("div.uifw-modal-frontstage").length).to.eq(1);

    const backButton = wrapper.find("button.nz-toolbar-button-back");
    expect(backButton.length).to.eq(1);

    FrontstageManager.updateModalFrontstage();
    expect(changedEventSpy.calledTwice).to.be.true;

    backButton.simulate("click");
    expect(navigationBackSpy.calledOnce).to.be.true;
    expect(closeModalSpy.calledOnce).to.be.true;

    FrontstageManager.closeModalFrontstage();
    expect(changedEventSpy.calledThrice).to.be.true;
    expect(closedEventSpy.calledOnce).to.be.true;

    removeListener();
    removeListener2();
  });

});
