/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/

import { assert } from "chai";
import { Localization } from "@itwin/core-common";
import { ITwinLocalization } from "../ITwinLocalization"

const NAMESPACES = [
  "Test"
];

describe("ITwinLocalization", () => {

  var localization: Localization;

  // before(async () => {});
  // beforeEach(async () => {});
  // after(async () => {});
  // afterEach(async () => {});

  before(async () => {
    // localization = new ITwinLocalization({ urlTemplate: `${window.location.origin}/locales/{{lng}}/{{ns}}.json` });
    localization = new ITwinLocalization();

    // await localization.initialize(NAMESPACES);

    await localization.initialize(["DontExist"]);
    await localization.registerNamespace("Test");

  });

  describe("#getLocalizedString", () => {

    describe("given namespace", () => {

      it("localization with no substitution", () => {
        assert.equal(localization.getLocalizedString("Test:Trivial.Test1"), "Localized Trivial Test 1");
        assert.equal(localization.getLocalizedString("Test:Trivial.Test2"), "Localized Trivial Test 2");
      });

      it("localization with substitution", () => {
        assert.equal(localization.getLocalizedString("Test:Substitution.Test1", { varA: "Variable1", varB: "Variable2" }), "Substitute Variable1 and Variable2");
        assert.equal(localization.getLocalizedString("Test:Substitution.Test2", { varA: "Variable1", varB: "Variable2" }), "Reverse substitute Variable2 and Variable1");
      });

      it("localization on missing key", () => {
        assert.equal(localization.getLocalizedString("Test:Trivial.Test3"), "Trivial.Test3");
      });

    });
    // it("Localization with no substitution", () => {
    //   // Custom namespace
    //   //  "TrivialTest.Test1" exists as a key in TestApp.json
    //   assert.equal(IModelApp.localization.getLocalizedString("TestApp:TrivialTests.Test1"), "Localized Trivial Test 1");
    //   assert.equal(IModelApp.localization.getLocalizedString("TestApp:TrivialTests.Test2"), "Localized Trivial Test 2");

    //   // Default namespace (iModelJs)
    //   assert.equal(IModelApp.localization.getLocalizedString("LocateFailure.NoElements"), "No Elements Found", "message from default (iModelJs) namespace");
    // });

    // it("Localization when there is no key", () => {
    //   // Custom namespace
    //   //  "TrivialTest.Test3" does NOT exist as a key in TestApp.json
    //   assert.equal(IModelApp.localization.getLocalizedString("TestApp:TrivialTests.Test3"), "TrivialTests.Test3");

    //   // Default namespace (iModelJs)
    //   assert.equal(IModelApp.localization.getLocalizedString("IDontExist.Test1"), "IDontExist.Test1");
    // });

    // it("Localization with variable substitution", () => { // Properly substitute the values in localized strings with interpolations
    //   // Custom namespace
    //   assert.equal(IModelApp.localization.getLocalizedString("TestApp:SubstitutionTests.Test1", { varA: "Variable1", varB: "Variable2" }), "Substitute Variable1 and Variable2");
    //   assert.equal(IModelApp.localization.getLocalizedString("TestApp:SubstitutionTests.Test2", { varA: "Variable1", varB: "Variable2" }), "Reverse substitute Variable2 and Variable1");

    //   // Default namespace (iModelJs)
    //   assert.equal(IModelApp.localization.getLocalizedString("Errors.Status", { status: "test" }), "Status: test");
    //   assert.equal(IModelApp.localization.getLocalizedString("ExtensionErrors.Success", { extensionName: "testExtension" }), "Extension 'testExtension' loaded");
    // });
  })

  it("test 1", () => {
    assert.isTrue(true);
    return;
  });

});
