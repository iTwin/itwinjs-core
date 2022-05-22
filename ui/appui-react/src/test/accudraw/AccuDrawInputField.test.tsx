/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import { fireEvent, render } from "@testing-library/react";
import { expect } from "chai";
import * as React from "react";
import * as sinon from "sinon";
import { SpecialKey } from "@itwin/appui-abstract";
import { AccuDrawInputField } from "../../appui-react/accudraw/AccuDrawInputField";
import { KeyboardShortcutManager } from "../../appui-react/keyboardshortcut/KeyboardShortcut";
import { TestUtils } from "../TestUtils";
import { IModelApp, IModelAppOptions, ItemField, MockRender } from "@itwin/core-frontend";
import { FrameworkAccuDraw } from "../../appui-react/accudraw/FrameworkAccuDraw";
import { FrameworkUiAdmin } from "../../appui-react/uiadmin/FrameworkUiAdmin";

// cspell:ignore uiadmin

function requestNextAnimation() { }

describe("AccuDrawInputField", () => {
  const rnaDescriptorToRestore = Object.getOwnPropertyDescriptor(IModelApp, "requestNextAnimation")!;
  const sandbox = sinon.createSandbox();

  before(async () => {
    // Avoid requestAnimationFrame exception during test by temporarily replacing function that calls it.
    // Tried replacing window.requestAnimationFrame first but that did not work.
    Object.defineProperty(IModelApp, "requestNextAnimation", {
      get: () => requestNextAnimation,
    });

    await TestUtils.initializeUiFramework();

    const opts: IModelAppOptions = {};
    opts.accuDraw = new FrameworkAccuDraw();
    opts.uiAdmin = new FrameworkUiAdmin();
    await MockRender.App.startup(opts);
  });

  after(async () => {
    await MockRender.App.shutdown();

    Object.defineProperty(IModelApp, "requestNextAnimation", rnaDescriptorToRestore);

    TestUtils.terminateUiFramework();
  });

  afterEach(() => {
    sandbox.restore();

  });

  it("should render with lock", () => {
    const spyChanged = sinon.spy();
    const wrapper = render(<AccuDrawInputField isLocked={true} field={ItemField.X_Item} id="x" onValueChanged={spyChanged} />);
    const icon = wrapper.container.querySelector(".icon-lock");
    expect(icon).not.to.be.null;
  });

  it("should call onValueChanged on change", () => {
    const spyMethod = sinon.spy();
    const wrapper = render(<AccuDrawInputField isLocked={false} field={ItemField.X_Item} id="x" onValueChanged={spyMethod} />);
    const input = wrapper.container.querySelector("input");
    expect(input).not.to.be.null;
    fireEvent.change(input!, { target: { value: "22.3" } });
    expect((input as HTMLInputElement).value).to.eq("22.3");
    fireEvent.keyDown(input!, { key: SpecialKey.Enter });
    spyMethod.calledOnce.should.be.true;
    fireEvent.change(input!, { target: { value: "22.3" } });  // Test no value change
    expect((input as HTMLInputElement).value).to.eq("22.3");
    fireEvent.keyDown(input!, { key: SpecialKey.Enter });
    spyMethod.calledOnce.should.be.true;
  });

  it("should call onValueChanged on change after delay", async () => {
    const fakeTimers = sinon.useFakeTimers();
    const spyMethod = sinon.spy();
    const wrapper = render(<AccuDrawInputField isLocked={false} field={ItemField.X_Item} id="x" onValueChanged={spyMethod} valueChangedDelay={10} />);
    const input = wrapper.container.querySelector("input");
    expect(input).not.to.be.null;
    fireEvent.change(input!, { target: { value: "22.3" } });
    expect((input as HTMLInputElement).value).to.eq("22.3");
    fireEvent.keyDown(input!, { key: SpecialKey.Enter });
    spyMethod.called.should.not.be.true;

    fakeTimers.tick(20);
    spyMethod.calledOnce.should.be.true;
    fakeTimers.restore();
  });

  it("should call onEscPressed on ESC", () => {
    const spyEsc = sinon.spy();
    const spyChanged = sinon.spy();
    const wrapper = render(<AccuDrawInputField onEscPressed={spyEsc} isLocked={false} field={ItemField.X_Item} id="x" onValueChanged={spyChanged} />);
    const input = wrapper.container.querySelector("input");
    expect(input).not.to.be.null;
    fireEvent.keyDown(input!, { key: SpecialKey.Escape });
    spyEsc.calledOnce.should.be.true;
  });

  it("should call onEnterPressed on Enter", () => {
    const spyEnter = sinon.spy();
    const spyChanged = sinon.spy();
    const wrapper = render(<AccuDrawInputField onEnterPressed={spyEnter} isLocked={false} field={ItemField.X_Item} id="x" onValueChanged={spyChanged} />);
    const input = wrapper.container.querySelector("input");
    expect(input).not.to.be.null;
    fireEvent.keyDown(input!, { key: SpecialKey.Enter });
    spyEnter.calledOnce.should.be.true;
  });

  it("should call KeyboardShortcutManager.processKey on a letter", () => {
    const spyMethod = sinon.spy(KeyboardShortcutManager, "processKey");
    const spyChanged = sinon.spy();
    const wrapper = render(<AccuDrawInputField isLocked={false} field={ItemField.X_Item} id="x" onValueChanged={spyChanged} />);
    const input = wrapper.container.querySelector("input");
    expect(input).not.to.be.null;
    fireEvent.keyDown(input!, { key: "a" });
    spyMethod.calledOnce.should.be.true;
    fireEvent.keyDown(input!, { key: "1" });
    spyMethod.calledTwice.should.not.be.true;
    (KeyboardShortcutManager.processKey as any).restore();
  });

  it("should update value when calling onFieldValueChange", () => {
    const fakeTimers = sandbox.useFakeTimers();
    const spyMethod = sinon.spy();
    const wrapper = render(<AccuDrawInputField isLocked={false} field={ItemField.X_Item} id="x" onValueChanged={spyMethod} />);
    const input = wrapper.container.querySelector("input");
    expect(input).not.to.be.null;
    IModelApp.accuDraw.setFocusItem(ItemField.X_Item);
    fakeTimers.tick(250);
    IModelApp.accuDraw.setValueByIndex(ItemField.X_Item, 30.48);
    IModelApp.accuDraw.onFieldValueChange(ItemField.X_Item);
    fakeTimers.tick(250);
    expect((input as HTMLInputElement).value).to.eq("100'-0\"");
    spyMethod.called.should.be.false;
  });

});
