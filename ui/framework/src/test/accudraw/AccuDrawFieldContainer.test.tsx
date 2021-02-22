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
import { FrameworkUiAdmin } from "../../ui-framework/uiadmin/FrameworkUiAdmin";

// cspell:ignore uiadmin

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
    opts.uiAdmin = new FrameworkUiAdmin();
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
    IModelApp.accuDraw.setFocusItem(ItemField.X_Item);
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

  it("should emit onAccuDrawSetFieldFocusEvent", async () => {
    const spy = sinon.spy();
    const remove = AccuDrawUiAdmin.onAccuDrawSetFieldFocusEvent.addListener(spy);
    const wrapper = render(<AccuDrawFieldContainer orientation={Orientation.Vertical} />);
    expect(IModelApp.accuDraw.hasInputFocus).to.be.false;

    IModelApp.accuDraw.setCompassMode(CompassMode.Rectangular);
    await TestUtils.flushAsyncOperations();

    IModelApp.accuDraw.setFocusItem(ItemField.X_Item);
    spy.calledOnce.should.true;
    let input = wrapper.queryByTestId("uifw-accudraw-x");
    expect(input).not.to.be.null;
    expect(document.activeElement === input).to.be.true;
    spy.resetHistory();

    IModelApp.accuDraw.setFocusItem(ItemField.Y_Item);
    spy.calledOnce.should.true;
    input = wrapper.queryByTestId("uifw-accudraw-y");
    expect(input).not.to.be.null;
    expect(document.activeElement === input).to.be.true;
    spy.resetHistory();

    input = wrapper.queryByTestId("uifw-accudraw-z");
    expect(input).to.be.null;

    IModelApp.accuDraw.setCompassMode(CompassMode.Polar);
    await TestUtils.flushAsyncOperations();

    IModelApp.accuDraw.setFocusItem(ItemField.ANGLE_Item);
    spy.calledOnce.should.true;
    input = wrapper.queryByTestId("uifw-accudraw-angle");
    expect(input).not.to.be.null;
    expect(document.activeElement === input).to.be.true;
    spy.resetHistory();

    IModelApp.accuDraw.setFocusItem(ItemField.DIST_Item);
    spy.calledOnce.should.true;
    input = wrapper.queryByTestId("uifw-accudraw-distance");
    expect(input).not.to.be.null;
    expect(document.activeElement === input).to.be.true;
    spy.resetHistory();

    await TestUtils.flushAsyncOperations();
    expect(IModelApp.accuDraw.hasInputFocus).to.be.true;

    remove();
  });

  it("should emit onAccuDrawSetFieldFocusEvent and show Z field", async () => {
    const spy = sinon.spy();
    const remove = AccuDrawUiAdmin.onAccuDrawSetFieldFocusEvent.addListener(spy);
    const wrapper = render(<AccuDrawFieldContainer orientation={Orientation.Vertical} showZOverride={true} />);
    expect(IModelApp.accuDraw.hasInputFocus).to.be.false;

    IModelApp.accuDraw.setCompassMode(CompassMode.Rectangular);
    await TestUtils.flushAsyncOperations();

    IModelApp.accuDraw.setFocusItem(ItemField.Z_Item);
    spy.calledOnce.should.true;
    const input = wrapper.queryByTestId("uifw-accudraw-z");
    expect(input).not.to.be.null;
    expect(document.activeElement === input).to.be.true;
    spy.resetHistory();

    await TestUtils.flushAsyncOperations();
    expect(IModelApp.accuDraw.hasInputFocus).to.be.true;

    remove();
  });

  it("should emit onAccuDrawGrabFieldFocusEvent", async () => {
    const spySet = sinon.spy();
    const removeSet = AccuDrawUiAdmin.onAccuDrawSetFieldFocusEvent.addListener(spySet);
    const wrapper = render(<AccuDrawFieldContainer orientation={Orientation.Vertical} />);
    expect(IModelApp.accuDraw.hasInputFocus).to.be.false;

    IModelApp.accuDraw.setCompassMode(CompassMode.Rectangular);
    await TestUtils.flushAsyncOperations();

    IModelApp.accuDraw.setFocusItem(ItemField.X_Item);
    spySet.calledOnce.should.true;
    const input = wrapper.queryByTestId("uifw-accudraw-x");
    expect(input).not.to.be.null;
    expect(document.activeElement === input).to.be.true;

    KeyboardShortcutManager.setFocusToHome();
    expect(document.activeElement === input).to.be.false;

    const spyGrab = sinon.spy();
    const removeGrab = AccuDrawUiAdmin.onAccuDrawGrabInputFocusEvent.addListener(spyGrab);
    IModelApp.accuDraw.grabInputFocus();
    spyGrab.calledOnce.should.true;
    expect(document.activeElement === input).to.be.true;

    removeSet();
    removeGrab();
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
    const fakeTimers = sinon.useFakeTimers();
    const spy = sinon.spy();
    const remove = AccuDrawUiAdmin.onAccuDrawSetFieldValueFromUiEvent.addListener(spy);
    const wrapper = render(<AccuDrawFieldContainer orientation={Orientation.Vertical} />);

    IModelApp.accuDraw.setCompassMode(CompassMode.Rectangular);

    let input = wrapper.queryByTestId("uifw-accudraw-x");
    expect(input).not.to.be.null;
    fireEvent.change(input!, { target: { value: "22.3" } });
    fakeTimers.tick(300);
    spy.calledOnce.should.true;
    spy.resetHistory();

    input = wrapper.queryByTestId("uifw-accudraw-y");
    expect(input).not.to.be.null;
    fireEvent.change(input!, { target: { value: "22.3" } });
    fakeTimers.tick(300);
    spy.calledOnce.should.true;
    spy.resetHistory();

    input = wrapper.queryByTestId("uifw-accudraw-z");
    expect(input).to.be.null;

    IModelApp.accuDraw.setCompassMode(CompassMode.Polar);

    input = wrapper.queryByTestId("uifw-accudraw-angle");
    expect(input).not.to.be.null;
    fireEvent.change(input!, { target: { value: "22.3" } });
    fakeTimers.tick(300);
    spy.calledOnce.should.true;
    spy.resetHistory();

    input = wrapper.queryByTestId("uifw-accudraw-distance");
    expect(input).not.to.be.null;
    fireEvent.change(input!, { target: { value: "22.3" } });
    fakeTimers.tick(300);
    spy.calledOnce.should.true;
    spy.resetHistory();

    remove();
    fakeTimers.restore();
  });

  it("should call onValueChanged & setFieldValueFromUi & show the Z field", () => {
    const fakeTimers = sinon.useFakeTimers();
    const spy = sinon.spy();
    const remove = AccuDrawUiAdmin.onAccuDrawSetFieldValueFromUiEvent.addListener(spy);
    const wrapper = render(<AccuDrawFieldContainer orientation={Orientation.Vertical} showZOverride={true} />);

    IModelApp.accuDraw.setCompassMode(CompassMode.Rectangular);

    const input = wrapper.queryByTestId("uifw-accudraw-z");
    expect(input).not.to.be.null;
    fireEvent.change(input!, { target: { value: "22.3" } });
    fakeTimers.tick(300);
    spy.calledOnce.should.true;
    spy.resetHistory();

    remove();
    fakeTimers.restore();
  });

  it("should set focus to home on Esc", () => {
    const spy = sinon.spy(KeyboardShortcutManager, "setFocusToHome");
    const wrapper = render(<AccuDrawFieldContainer orientation={Orientation.Vertical} />);

    IModelApp.accuDraw.setCompassMode(CompassMode.Rectangular);

    const input = wrapper.queryByTestId("uifw-accudraw-x");
    expect(input).not.to.be.null;
    fireEvent.keyDown(input!, { key: SpecialKey.Escape });
    spy.calledOnce.should.true;

    (KeyboardShortcutManager.setFocusToHome as any).restore();
  });

});
