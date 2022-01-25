/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import { expect } from "chai";
import * as sinon from "sinon";
import { Logger } from "@itwin/core-bentley";
import { MockRender } from "@itwin/core-frontend";
import { UiIModelComponents } from "../imodel-components-react";
import TestUtils from "./TestUtils";

describe("UiIModelComponents", () => {

  beforeEach(() => {
    TestUtils.terminateUiIModelComponents();
  });

  it("i18nNamespace should return 'UiIModelComponents'", () => {
    expect(UiIModelComponents.localizationNamespace).to.eq("UiIModelComponents");
  });

  it("packageName should return 'imodel-components-react'", () => {
    expect(UiIModelComponents.packageName).to.eq("imodel-components-react");
  });

  it("translate should return the key (in test environment)", async () => {
    await TestUtils.initializeUiIModelComponents();
    expect(UiIModelComponents.translate("test1.test2")).to.eq("test1.test2");
    TestUtils.terminateUiIModelComponents();
  });

  it("translate should return blank and log error if UiIModelComponents not initialized", () => {
    const spyLogger = sinon.spy(Logger, "logError");
    expect(UiIModelComponents.translate("xyz")).to.eq("");
    spyLogger.calledOnce.should.true;
    (Logger.logError as any).restore();
  });

  it("calling initialize twice should log", async () => {
    const spyLogger = sinon.spy(Logger, "logInfo");
    expect(UiIModelComponents.initialized).to.be.false;
    await UiIModelComponents.initialize();
    expect(UiIModelComponents.initialized).to.be.true;
    await UiIModelComponents.initialize();
    spyLogger.calledOnce.should.true;
    (Logger.logInfo as any).restore();
  });

  it("calling initialize without I18N will use IModelApp.i18n", async () => {
    await MockRender.App.startup();

    await UiIModelComponents.initialize();
    await MockRender.App.shutdown();
  });

  it("calling loggerCategory without an obj should return packageName", () => {
    const category = UiIModelComponents.loggerCategory(undefined);
    expect(category).to.eq(UiIModelComponents.packageName);
  });

});
