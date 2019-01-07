/*---------------------------------------------------------------------------------------------
* Copyright (c) 2019 Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/
import { expect } from "chai";
import TestUtils from "./TestUtils";
import { UiFramework } from "../ui-framework";
import { DefaultIModelServices } from "../clientservices/DefaultIModelServices";
import { DefaultProjectServices } from "../clientservices/DefaultProjectServices";

describe("UiFramework", () => {

  beforeEach(() => {
    TestUtils.terminateUiFramework();
  });

  it("store should throw Error without initialize", () => {
    expect(() => UiFramework.store).to.throw(Error);
  });

  it("i18n should throw Error without initialize", () => {
    expect(() => UiFramework.i18n).to.throw(Error);
  });

  it("projectServices should throw Error without initialize", () => {
    expect(() => UiFramework.projectServices).to.throw(Error);
  });

  it("iModelServices should throw Error without initialize", () => {
    expect(() => UiFramework.iModelServices).to.throw(Error);
  });

  it("projectServices & iModelServices should return defaults", async () => {
    await TestUtils.initializeUiFramework(true);
    expect(UiFramework.projectServices).to.be.instanceOf(DefaultProjectServices);
    expect(UiFramework.iModelServices).to.be.instanceOf(DefaultIModelServices);
    expect(UiFramework.frameworkStateKey).to.equal("testDifferentFrameworkKey");
    TestUtils.terminateUiFramework();
  });

  it("test default frameworkState key", async () => {
    await TestUtils.initializeUiFramework();
    expect(UiFramework.projectServices).to.be.instanceOf(DefaultProjectServices);
    expect(UiFramework.iModelServices).to.be.instanceOf(DefaultIModelServices);
    expect(UiFramework.frameworkStateKey).to.equal("frameworkState");
    TestUtils.terminateUiFramework();
  });

});
