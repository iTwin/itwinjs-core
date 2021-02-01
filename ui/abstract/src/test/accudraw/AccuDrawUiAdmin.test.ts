/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import { expect } from "chai";
import * as sinon from "sinon";

import { AccuDrawField, AccuDrawMode, AccuDrawUiAdmin } from "../../ui-abstract/accudraw/AccuDrawUiAdmin";

describe("AccuDrawUiAdmin", () => {

  let accuDrawUiAdmin: AccuDrawUiAdmin;

  before(() => {
    accuDrawUiAdmin = new AccuDrawUiAdmin();
  });

  it("setFieldValueToUi should emit AccuDrawSetFieldValueToUiEvent", () => {
    const spy = sinon.spy();
    const remove = AccuDrawUiAdmin.onAccuDrawSetFieldValueToUiEvent.addListener(spy);
    accuDrawUiAdmin.setFieldValueToUi(AccuDrawField.Angle, 1.0, "1.0");
    spy.calledOnce.should.true;
    remove();
  });

  it("setFieldValueFromUi should emit AccuDrawSetFieldValueFromUiEvent", () => {
    const spy = sinon.spy();
    const remove = AccuDrawUiAdmin.onAccuDrawSetFieldValueFromUiEvent.addListener(spy);
    accuDrawUiAdmin.setFieldValueFromUi(AccuDrawField.Angle, "1.0");
    spy.calledOnce.should.true;
    remove();
  });

  it("setFieldFocus should emit AccuDrawSetFieldFocusEvent", () => {
    const spy = sinon.spy();
    const remove = AccuDrawUiAdmin.onAccuDrawSetFieldFocusEvent.addListener(spy);
    accuDrawUiAdmin.setFieldFocus(AccuDrawField.Angle);
    spy.calledOnce.should.true;
    remove();
  });

  it("setFieldLock should emit AccuDrawSetFieldLockEvent", () => {
    const spy = sinon.spy();
    const remove = AccuDrawUiAdmin.onAccuDrawSetFieldLockEvent.addListener(spy);
    accuDrawUiAdmin.setFieldLock(AccuDrawField.Angle, true);
    spy.calledOnce.should.true;
    remove();
  });

  it("setMode should emit AccuDrawSetModeEvent", () => {
    const spy = sinon.spy();
    const remove = AccuDrawUiAdmin.onAccuDrawSetModeEvent.addListener(spy);
    accuDrawUiAdmin.setMode(AccuDrawMode.Rectangular);
    spy.calledOnce.should.true;
    remove();
  });

  it("grabInputFocus should emit AccuDrawGrabInputFocusEvent", () => {
    const spy = sinon.spy();
    const remove = AccuDrawUiAdmin.onAccuDrawGrabInputFocusEvent.addListener(spy);
    accuDrawUiAdmin.grabInputFocus();
    spy.calledOnce.should.true;
    remove();
  });

  it("hasInputFocus should return false", () => {
    expect(accuDrawUiAdmin.hasInputFocus).to.be.false;
  });

});
