/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import { fireEvent, render } from "@testing-library/react";
import { expect } from "chai";
import * as sinon from "sinon";
import * as React from "react";
import { CompassMode, IModelApp, IModelAppOptions, ItemField, MockRender } from "@bentley/imodeljs-frontend";
import { AccuDrawUiAdmin, SpecialKey } from "@bentley/ui-abstract";
import { Orientation } from "@bentley/ui-core";
import TestUtils from "../TestUtils";
import { FrameworkAccuDraw } from "../../ui-framework/accudraw/FrameworkAccuDraw";
import { AccuDrawFieldContainer } from "../../ui-framework/accudraw/AccuDrawFieldContainer";
import { KeyboardShortcutManager } from "../../ui-framework/keyboardshortcut/KeyboardShortcut";

function requestNextAnimation() { }

describe("AccuDrawFieldContainer", () => {
  const rnaDescriptorToRestore = Object.getOwnPropertyDescriptor(IModelApp, "requestNextAnimation")!;

  before(async () => {
    // Avoid requestAnimationFrame exception during test by temporarily replacing function that calls it.
    // Tried replacing window.requestAnimationFrame first but that did not work.
    Object.defineProperty(IModelApp, "requestNextAnimation", {
      get: () => requestNextAnimation,
    });

    await TestUtils.initializeUiFramework();

    const opts: IModelAppOptions = {};
    opts.accuDraw = new FrameworkAccuDraw();
    await MockRender.App.startup(opts);
  });

  after(async () => {
    await MockRender.App.shutdown();

    Object.defineProperty(IModelApp, "requestNextAnimation", rnaDescriptorToRestore);

    TestUtils.terminateUiFramework();
  });

  it("should render Vertical", () => {
    IModelApp.accuDraw.setCompassMode(CompassMode.Rectangular);
    render(<AccuDrawFieldContainer orientation={Orientation.Vertical} />);
  });

  it("should render Horizontal", () => {
    IModelApp.accuDraw.setCompassMode(CompassMode.Rectangular);
    render(<AccuDrawFieldContainer orientation={Orientation.Horizontal} />);
  });

  it("should emit onAccuDrawSetFieldValueToUiEvent", () => {
    const spy = sinon.spy();
    const remove = AccuDrawUiAdmin.onAccuDrawSetFieldValueToUiEvent.addListener(spy);
    render(<AccuDrawFieldContainer orientation={Orientation.Vertical} />);
    IModelApp.accuDraw.onFieldValueChange(ItemField.X_Item);
    spy.calledOnce.should.true;
    spy.resetHistory();
    IModelApp.accuDraw.onFieldValueChange(ItemField.Y_Item);
    spy.calledOnce.should.true;
    spy.resetHistory();
    IModelApp.accuDraw.onFieldValueChange(ItemField.Z_Item);
    spy.calledOnce.should.true;
    spy.resetHistory();
    IModelApp.accuDraw.onFieldValueChange(ItemField.ANGLE_Item);
    spy.calledOnce.should.true;
    spy.resetHistory();
    IModelApp.accuDraw.onFieldValueChange(ItemField.DIST_Item);
    spy.calledOnce.should.true;
    spy.resetHistory();
    remove();
  });

  it("should emit onAccuDrawSetFieldLockEvent", () => {
    const spy = sinon.spy();
    const remove = AccuDrawUiAdmin.onAccuDrawSetFieldLockEvent.addListener(spy);
    render(<AccuDrawFieldContainer orientation={Orientation.Vertical} />);
    IModelApp.accuDraw.setFieldLock(ItemField.X_Item, true);
    spy.calledOnce.should.true;
    spy.resetHistory();
    IModelApp.accuDraw.setFieldLock(ItemField.Y_Item, true);
    spy.calledOnce.should.true;
    spy.resetHistory();
    IModelApp.accuDraw.setFieldLock(ItemField.Z_Item, true);
    spy.calledOnce.should.true;
    spy.resetHistory();
    IModelApp.accuDraw.setFieldLock(ItemField.ANGLE_Item, true);
    spy.calledOnce.should.true;
    spy.resetHistory();
    IModelApp.accuDraw.setFieldLock(ItemField.DIST_Item, true);
    spy.calledOnce.should.true;
    spy.resetHistory();
    remove();
  });

  it("should emit onAccuDrawSetFieldFocusEvent", () => {
    const spy = sinon.spy();
    const remove = AccuDrawUiAdmin.onAccuDrawSetFieldFocusEvent.addListener(spy);
    render(<AccuDrawFieldContainer orientation={Orientation.Vertical} />);
    IModelApp.accuDraw.setFocusItem(ItemField.X_Item);
    spy.calledOnce.should.true;
    remove();
  });

  it("should emit onAccuDrawSetModeEvent", () => {
    const spy = sinon.spy();
    const remove = AccuDrawUiAdmin.onAccuDrawSetModeEvent.addListener(spy);
    render(<AccuDrawFieldContainer orientation={Orientation.Vertical} />);
    IModelApp.accuDraw.setCompassMode(CompassMode.Polar);
    spy.calledOnce.should.true;
    IModelApp.accuDraw.setCompassMode(CompassMode.Rectangular);
    spy.calledTwice.should.true;
    remove();
  });

  it("should call onValueChanged & setFieldValueFromUi", () => {
    const spy = sinon.spy();
    const remove = AccuDrawUiAdmin.onAccuDrawSetFieldValueFromUiEvent.addListener(spy);
    const wrapper = render(<AccuDrawFieldContainer orientation={Orientation.Vertical} />);

    IModelApp.accuDraw.setCompassMode(CompassMode.Rectangular);

    let input = wrapper.container.querySelector("input#uifw-accudraw-x");
    expect(input).not.to.be.null;
    fireEvent.change(input!, { target: { value: "22.3" } });
    fireEvent.keyDown(input!, { key: SpecialKey.Enter });
    spy.calledOnce.should.true;
    spy.resetHistory();

    input = wrapper.container.querySelector("input#uifw-accudraw-y");
    expect(input).not.to.be.null;
    fireEvent.change(input!, { target: { value: "22.3" } });
    fireEvent.keyDown(input!, { key: SpecialKey.Enter });
    spy.calledOnce.should.true;
    spy.resetHistory();

    input = wrapper.container.querySelector("input#uifw-accudraw-z");
    expect(input).not.to.be.null;
    fireEvent.change(input!, { target: { value: "22.3" } });
    fireEvent.keyDown(input!, { key: SpecialKey.Enter });
    spy.calledOnce.should.true;
    spy.resetHistory();

    IModelApp.accuDraw.setCompassMode(CompassMode.Polar);

    input = wrapper.container.querySelector("input#uifw-accudraw-angle");
    expect(input).not.to.be.null;
    fireEvent.change(input!, { target: { value: "22.3" } });
    fireEvent.keyDown(input!, { key: SpecialKey.Enter });
    spy.calledOnce.should.true;
    spy.resetHistory();

    input = wrapper.container.querySelector("input#uifw-accudraw-distance");
    expect(input).not.to.be.null;
    fireEvent.change(input!, { target: { value: "22.3" } });
    fireEvent.keyDown(input!, { key: SpecialKey.Enter });
    spy.calledOnce.should.true;
    spy.resetHistory();

    remove();
  });

  it("should set focus to home on Esc", () => {
    const spy = sinon.spy(KeyboardShortcutManager, "setFocusToHome");
    const wrapper = render(<AccuDrawFieldContainer orientation={Orientation.Vertical} />);

    IModelApp.accuDraw.setCompassMode(CompassMode.Rectangular);

    const input = wrapper.container.querySelector("input#uifw-accudraw-x");
    expect(input).not.to.be.null;
    fireEvent.keyDown(input!, { key: SpecialKey.Escape });
    spy.calledOnce.should.true;

    (KeyboardShortcutManager.setFocusToHome as any).restore();
  });

});
