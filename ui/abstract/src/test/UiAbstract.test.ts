/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/
import { expect } from "chai";
import TestUtils from "./TestUtils";
import { UiAbstract } from "../ui-abstract/UiAbstract";

describe("UiAbstract", () => {

  beforeEach(() => {
    TestUtils.terminateUiAbstract();
  });

  it("i18n should throw Error without initialize", () => {
    expect(() => UiAbstract.i18n).to.throw(Error);
  });

  it("terminate should run even if no i18n to unregister", () => {
    expect(() => UiAbstract.terminate()).to.not.throw(Error);
  });

  it("i18nNamespace should return UiAbstract", () => {
    expect(UiAbstract.i18nNamespace).to.eq("UiAbstract");
  });

  it("packageName should return ui-abstract", () => {
    expect(UiAbstract.packageName).to.eq("ui-abstract");
  });

  it("translate should return the key (in test environment)", async () => {
    await TestUtils.initializeUiAbstract();
    expect(UiAbstract.translate("test1.test2")).to.eq("test1.test2");
    TestUtils.terminateUiAbstract();
  });

  it("loggerCategory passed null should return 'ui-abstract'", () => {
    expect(UiAbstract.loggerCategory(null)).to.eq("ui-abstract");
  });

});
