/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import * as sinon from "sinon";
import { expect } from "chai";
import { BeButtonEvent, CompassMode, CurrentState, IModelApp, IModelAppOptions, ItemField, MockRender } from "@bentley/imodeljs-frontend";
import TestUtils from "../TestUtils";
import { FrameworkAccuDraw } from "../../ui-framework/accudraw/FrameworkAccuDraw";
import { AccuDrawUiAdmin } from "@bentley/ui-abstract";

// cspell:ignore dont

describe("FrameworkAccuDraw", () => {
  before(async () => {
    await TestUtils.initializeUiFramework();

    const opts: IModelAppOptions = {};
    opts.accuDraw = new FrameworkAccuDraw();
    await MockRender.App.startup(opts);
  });

  after(async () => {
    await MockRender.App.shutdown();
    TestUtils.terminateUiFramework();
  });

  it("should call onCompassModeChange & emit onAccuDrawSetModeEvent", () => {
    const spy = sinon.spy();
    const remove = AccuDrawUiAdmin.onAccuDrawSetModeEvent.addListener(spy);
    IModelApp.accuDraw.setCompassMode(CompassMode.Polar);
    spy.calledOnce.should.true;
    IModelApp.accuDraw.setCompassMode(CompassMode.Rectangular);
    spy.calledTwice.should.true;
    remove();
  });

  it("should call onFieldLockChange & emit onAccuDrawSetFieldLockEvent", () => {
    const spy = sinon.spy();
    const remove = AccuDrawUiAdmin.onAccuDrawSetFieldLockEvent.addListener(spy);
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

  it("should call onFieldValueChange & emit onAccuDrawSetFieldValueToUiEvent", () => {
    const spy = sinon.spy();
    const remove = AccuDrawUiAdmin.onAccuDrawSetFieldValueToUiEvent.addListener(spy);
    IModelApp.accuDraw.setValueByIndex(ItemField.X_Item, 1.0);
    IModelApp.accuDraw.onFieldValueChange(ItemField.X_Item);
    spy.calledOnce.should.true;
    remove();
  });

  it("should emit onAccuDrawSetFieldFocusEvent", () => {
    const spy = sinon.spy();
    const remove = AccuDrawUiAdmin.onAccuDrawSetFieldFocusEvent.addListener(spy);
    IModelApp.accuDraw.setFocusItem(ItemField.X_Item);
    spy.calledOnce.should.true;
    remove();
  });

  it("should emit onAccuDrawGrabInputFocusEvent", () => {
    const spy = sinon.spy();
    const remove = AccuDrawUiAdmin.onAccuDrawGrabInputFocusEvent.addListener(spy);
    IModelApp.accuDraw.grabInputFocus();
    spy.calledOnce.should.true;
    remove();
  });

  it("should emit onAccuDrawGrabInputFocusEvent", () => {
    expect(IModelApp.accuDraw.hasInputFocus).to.be.false;
  });

  it("should emit onAccuDrawSetFieldValueToUiEvent & onAccuDrawSetFieldFocusEvent", () => {
    const spyValue = sinon.spy();
    const remove = AccuDrawUiAdmin.onAccuDrawSetFieldValueToUiEvent.addListener(spyValue);
    const spyFocus = sinon.spy();
    const removeFocusSpy = AccuDrawUiAdmin.onAccuDrawSetFieldFocusEvent.addListener(spyFocus);

    IModelApp.accuDraw.currentState = CurrentState.Deactivated;
    IModelApp.accuDraw.onMotion(new BeButtonEvent());
    spyValue.called.should.false;
    spyValue.resetHistory();

    IModelApp.accuDraw.currentState = CurrentState.Active;
    IModelApp.accuDraw.onMotion(new BeButtonEvent());
    spyValue.called.should.true;
    spyFocus.called.should.true;
    spyValue.resetHistory();
    spyFocus.resetHistory();

    IModelApp.accuDraw.dontMoveFocus = true;
    IModelApp.accuDraw.onMotion(new BeButtonEvent());
    spyValue.called.should.true;
    spyFocus.called.should.false;

    remove();
    removeFocusSpy();
  });

});
