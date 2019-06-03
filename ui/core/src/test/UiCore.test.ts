/*---------------------------------------------------------------------------------------------
* Copyright (c) 2019 Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/
import { expect } from "chai";
import TestUtils from "./TestUtils";
import { UiCore } from "../ui-core/UiCore";

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

  it("loggerCategory passed null should return 'ui-core'", () => {
    expect(UiCore.loggerCategory(null)).to.eq("ui-core");
  });

});
