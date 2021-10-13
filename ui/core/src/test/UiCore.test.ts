/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import { expect } from "chai";
import * as sinon from "sinon";
import { Logger } from "@itwin/core-bentley";
import { UiCore } from "../core-react/UiCore";
import TestUtils from "./TestUtils";

describe("UiCore", () => {

  beforeEach(() => {
    TestUtils.terminateUiCore();
  });

  it("i18n should throw Error without initialize", () => {
    expect(() => UiCore.localization).to.throw(Error);
  });

  it("terminate should run even if no i18n to unregister", () => {
    expect(() => UiCore.terminate()).to.not.throw(Error);
  });

  it("i18nNamespace should return UiCore", () => {
    expect(UiCore.localizationNamespace).to.eq("UiCore");
  });

  it("packageName should return core-react", () => {
    expect(UiCore.packageName).to.eq("core-react");
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

  it("loggerCategory passed null should return 'core-react'", () => {
    expect(UiCore.loggerCategory(null)).to.eq("core-react");
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
