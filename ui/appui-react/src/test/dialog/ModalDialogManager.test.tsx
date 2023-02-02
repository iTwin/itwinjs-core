/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import { expect } from "chai";
import * as React from "react";
import * as sinon from "sinon";
import { MessageBoxIconType, MessageBoxType } from "@itwin/core-frontend";
import { DialogChangedEventArgs, ModalDialogManager, ModalDialogRenderer, StandardMessageBox } from "../../appui-react";
import TestUtils, { createStaticInternalPassthroughValidators } from "../TestUtils";
import { render, screen } from "@testing-library/react";
import { InternalModalDialogManager } from "../../appui-react/dialog/InternalModalDialogManager";
/* eslint-disable deprecation/deprecation */

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

    render(<ModalDialogRenderer />);

    expect(ModalDialogManager.dialogCount).to.eq(0);
    ModalDialogManager.openDialog(reactNode);
    expect(ModalDialogManager.dialogCount).to.eq(1);
    expect(screen.getByTestId("core-dialog-root")).to.exist;

    ModalDialogManager.closeDialog();
    expect(ModalDialogManager.dialogCount).to.eq(0);
    expect(screen.queryByTestId("core-dialog-root")).to.be.null;
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

    render(<ModalDialogRenderer />);

    expect(ModalDialogManager.dialogCount).to.eq(0);

    ModalDialogManager.openDialog(reactNode);
    expect(ModalDialogManager.dialogCount).to.eq(1);
    expect(screen.getAllByTestId("core-dialog-root")).to.have.lengthOf(1);

    ModalDialogManager.openDialog(reactNode2);
    expect(ModalDialogManager.dialogCount).to.eq(2);
    expect(screen.getAllByTestId("core-dialog-root")).to.have.lengthOf(2);

    ModalDialogManager.closeDialog();
    expect(ModalDialogManager.dialogCount).to.eq(1);
    expect(screen.getAllByTestId("core-dialog-root")).to.have.lengthOf(1);

    ModalDialogManager.closeDialog();
    expect(ModalDialogManager.dialogCount).to.eq(0);
    expect(screen.queryAllByTestId("core-dialog-root")).to.have.lengthOf(0);
  });

  it("calls Internal static for everything", () => {
    const [validateMethod, validateProp] = createStaticInternalPassthroughValidators(ModalDialogManager, InternalModalDialogManager);

    validateMethod("closeAll");
    validateMethod(["closeDialog", "close"], "id");
    validateMethod(["openDialog", "open"], "", "id", document);
    validateMethod("update");
    validateProp(["activeDialog", "active"]);
    validateProp(["dialogCount", "count"]);
    validateProp("dialogManager");
    validateProp("dialogs");
    validateProp("onModalDialogChangedEvent");
  });

});
