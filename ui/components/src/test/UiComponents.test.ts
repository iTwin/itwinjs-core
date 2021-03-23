/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import { expect } from "chai";
import * as sinon from "sinon";
import { Logger } from "@bentley/bentleyjs-core";
import { IModelApp, MockRender } from "@bentley/imodeljs-frontend";
import { UiComponents } from "../ui-components.js";
import TestUtils from "./TestUtils.js";

describe("UiComponents", () => {

  beforeEach(() => {
    TestUtils.terminateUiComponents();
  });

  it("i18n should throw Error without initialize", () => {
    expect(() => UiComponents.i18n).to.throw(Error);
  });

  it("i18nNamespace should return UiComponents", () => {
    expect(UiComponents.i18nNamespace).to.eq("UiComponents");
  });

  it("packageName should return ui-components", () => {
    expect(UiComponents.packageName).to.eq("ui-components");
  });

  it("translate should return the key (in test environment)", async () => {
    await TestUtils.initializeUiComponents();
    expect(UiComponents.translate("test1.test2")).to.eq("test1.test2");
    TestUtils.terminateUiComponents();
  });

  it("translate should return blank and log error if UiComponents not initialized", () => {
    const spyLogger = sinon.spy(Logger, "logError");
    expect(UiComponents.translate("xyz")).to.eq("");
    spyLogger.calledOnce.should.true;
    (Logger.logError as any).restore();
  });

  it("calling initialize twice should log", async () => {
    const spyLogger = sinon.spy(Logger, "logInfo");
    expect(UiComponents.initialized).to.be.false;
    await UiComponents.initialize(TestUtils.i18n);
    expect(UiComponents.initialized).to.be.true;
    await UiComponents.initialize(TestUtils.i18n);
    spyLogger.calledOnce.should.true;
    (Logger.logInfo as any).restore();
  });

  it("calling initialize without I18N will use IModelApp.i18n", async () => {
    await MockRender.App.startup();

    await UiComponents.initialize();
    expect(UiComponents.i18n).to.eq(IModelApp.i18n);

    await MockRender.App.shutdown();
  });

  it("calling loggerCategory without an obj should return packageName", () => {
    const category = UiComponents.loggerCategory(undefined);
    expect(category).to.eq(UiComponents.packageName);
  });

});
