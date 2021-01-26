/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import { cleanup, fireEvent, render } from "@testing-library/react";
import { expect } from "chai";
import * as React from "react";
import * as sinon from "sinon";
import { AccuDrawField, SpecialKey } from "@bentley/ui-abstract";
import { AccuDrawInputField } from "../../ui-framework/accudraw/AccuDrawInputField";
import { KeyboardShortcutManager } from "../../ui-framework/keyboardshortcut/KeyboardShortcut";
import { TestUtils } from "../TestUtils";
import { IModelApp, IModelAppOptions, ItemField, MockRender } from "@bentley/imodeljs-frontend";
import { FrameworkAccuDraw } from "../../ui-framework/accudraw/FrameworkAccuDraw";
import { FrameworkUiAdmin } from "../../ui-framework/uiadmin/FrameworkUiAdmin";

// cspell:ignore uiadmin

describe("AccuDrawInputField", () => {

  it("should render with lock", () => {
    const value = "1.23";
    const spyChanged = sinon.spy();
    const wrapper = render(<AccuDrawInputField initialValue={value} isLocked={true} field={AccuDrawField.X} id="x" onValueChanged={spyChanged} />);
    const icon = wrapper.container.querySelector(".icon-lock");
    expect(icon).not.to.be.null;
  });

  it("should call onValueChanged on change", () => {
    const value = "1.23";
    const spyMethod = sinon.spy();
    const wrapper = render(<AccuDrawInputField initialValue={value} isLocked={false} field={AccuDrawField.X} id="x" onValueChanged={spyMethod} />);
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
    const value = "1.23";
    const spyMethod = sinon.spy();
    const wrapper = render(<AccuDrawInputField initialValue={value} isLocked={false} field={AccuDrawField.X} id="x" onValueChanged={spyMethod} valueChangedDelay={10} />);
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
    const value = "1.23";

    const spyEsc = sinon.spy();
    const spyChanged = sinon.spy();
    const wrapper = render(<AccuDrawInputField initialValue={value} onEscPressed={spyEsc} isLocked={false} field={AccuDrawField.X} id="x" onValueChanged={spyChanged} />);
    const input = wrapper.container.querySelector("input");
    expect(input).not.to.be.null;
    fireEvent.keyDown(input!, { key: SpecialKey.Escape });
    spyEsc.calledOnce.should.be.true;
  });

  it("should call onEnterPressed on Enter", () => {
    const value = "1.23";

    const spyEnter = sinon.spy();
    const spyChanged = sinon.spy();
    const wrapper = render(<AccuDrawInputField initialValue={value} onEnterPressed={spyEnter} isLocked={false} field={AccuDrawField.X} id="x" onValueChanged={spyChanged} />);
    const input = wrapper.container.querySelector("input");
    expect(input).not.to.be.null;
    fireEvent.keyDown(input!, { key: SpecialKey.Enter });
    spyEnter.calledOnce.should.be.true;
  });

  it("should call KeyboardShortcutManager.processKey on a letter", () => {
    const value = "1.23";

    const spyMethod = sinon.spy(KeyboardShortcutManager, "processKey");
    const spyChanged = sinon.spy();
    const wrapper = render(<AccuDrawInputField initialValue={value} isLocked={false} field={AccuDrawField.X} id="x" onValueChanged={spyChanged} />);
    const input = wrapper.container.querySelector("input");
    expect(input).not.to.be.null;
    fireEvent.keyDown(input!, { key: "a" });
    spyMethod.calledOnce.should.be.true;
    fireEvent.keyDown(input!, { key: "1" });
    spyMethod.calledTwice.should.not.be.true;
    (KeyboardShortcutManager.processKey as any).restore();
  });

  describe("requires fake IModelApp & timers", () => {
    const sandbox = sinon.createSandbox();

    before(async () => {
      await TestUtils.initializeUiFramework();

      const opts: IModelAppOptions = {};
      opts.accuDraw = new FrameworkAccuDraw();
      opts.uiAdmin = new FrameworkUiAdmin();
      await MockRender.App.startup(opts);
    });

    after(async () => {
      await MockRender.App.shutdown();

      TestUtils.terminateUiFramework();
    });

    afterEach(() => {
      sandbox.restore();
      afterEach(cleanup);
    });

    it("should update value when calling onFieldValueChange", () => {
      const fakeTimers = sandbox.useFakeTimers();
      const value = "1.23";
      const spyMethod = sinon.spy();
      const wrapper = render(<AccuDrawInputField initialValue={value} isLocked={false} field={AccuDrawField.X} id="x" onValueChanged={spyMethod} />);
      const input = wrapper.container.querySelector("input");
      expect(input).not.to.be.null;
      expect((input as HTMLInputElement).value).to.eq("1.23");
      IModelApp.accuDraw.setFocusItem(ItemField.X_Item);
      fakeTimers.tick(250);
      IModelApp.accuDraw.setValueByIndex(ItemField.X_Item, 30.48);
      IModelApp.accuDraw.onFieldValueChange(ItemField.X_Item);
      fakeTimers.tick(250);
      expect((input as HTMLInputElement).value).to.eq("100'-0\"");
      spyMethod.called.should.be.false;
    });

  });

});
