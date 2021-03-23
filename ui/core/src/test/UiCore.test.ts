/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import { expect } from "chai";
import * as sinon from "sinon";
import { Logger } from "@bentley/bentleyjs-core";
import { UiCore } from "../ui-core/UiCore.js";
import TestUtils from "./TestUtils.js";

describe("UiCore", () => {

  beforeEach(() => {
    TestUtils.terminateUiCore();
  });

  it("i18n should throw Error without initialize", () => {
    expect(() => UiCore.i18n).to.throw(Error);
  });

  it("terminate should run even if no i18n to unregister", () => {
    expect(() => UiCore.terminate()).to.not.throw(Error);
  });

  it("i18nNamespace should return UiCore", () => {
    expect(UiCore.i18nNamespace).to.eq("UiCore");
  });

  it("packageName should return ui-core", () => {
    expect(UiCore.packageName).to.eq("ui-core");
  });

  it("translate should return the key (in test environment)", async () => {
    await TestUtils.initializeUiCore();
    expect(UiCore.translate("test1.test2")).to.eq("test1.test2");
    TestUtils.terminateUiCore();
  });

  it("translate should return blank and log error if UiCore not initialized", () => {
    const spyLogger = sinon.spy(Logger, "logError");
    expect(UiCore.translate("xyz")).to.eq("");
    spyLogger.calledOnce.should.true;
    (Logger.logError as any).restore();
  });

  it("loggerCategory passed null should return 'ui-core'", () => {
    expect(UiCore.loggerCategory(null)).to.eq("ui-core");
  });

  it("calling initialize twice should log", async () => {
    const spyLogger = sinon.spy(Logger, "logInfo");
    expect(UiCore.initialized).to.be.false;
    await UiCore.initialize(TestUtils.i18n);
    expect(UiCore.initialized).to.be.true;
    await UiCore.initialize(TestUtils.i18n);
    spyLogger.calledOnce.should.true;
    (Logger.logInfo as any).restore();
  });

});
