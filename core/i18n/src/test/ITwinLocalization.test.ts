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
    localization = new ITwinLocalization();
    await localization.initialize(["Default", "Test"]);
  });

  // The goal is not to test i18next's interpolation,
  // but just to have some simple tests to make sure the
  // basics work through the ITwinLocalization class.
  // For interpolation options, see: https://www.i18next.com/translation-function/interpolation
  describe("#getLocalizedString", () => {

    describe("Default Namespace", () => {

      it("first level with no substitution", () => {
        assert.equal(localization.getLocalizedString("FirstTrivial"), "First level string (default)");
      });

      it("second level with no substitution", () => {
        assert.equal(localization.getLocalizedString("SecondTrivial.Test1"), "Second level string 1 (default)");
        assert.equal(localization.getLocalizedString("SecondTrivial.Test2"), "Second level string 2 (default)");
      });

      it("first level with substitution", () => {
        assert.equal(localization.getLocalizedString("FirstSubstitution1", { str: "CUSTOM1" }), "First level CUSTOM1 (default)");
        assert.equal(localization.getLocalizedString("FirstSubstitution1", { str: "CUSTOM2" }), "First level CUSTOM2 (default)");
        assert.equal(localization.getLocalizedString("FirstSubstitution2", { str1: "CUSTOM1", str2: "CUSTOM2" }), "First level CUSTOM1 and CUSTOM2 (default)");
      });

      it("second level with substitution", () => {
        assert.equal(localization.getLocalizedString("SecondSubstitution.Test1", { varA: "Variable1", varB: "Variable2" }), "Substitute Variable1 and Variable2 (default)");
        assert.equal(localization.getLocalizedString("SecondSubstitution.Test2", { varA: "Variable1", varB: "Variable2" }), "Reverse substitute Variable2 and Variable1 (default)");
      });

      it("first level missing key doesn't find a value", () => {
        assert.equal(localization.getLocalizedString("MissingKeyString"), "MissingKeyString");
      });

      it("second level missing key doesn't find a value", () => {
        assert.equal(localization.getLocalizedString("SecondTrivial.MissingString"), "SecondTrivial.MissingString");
        assert.equal(localization.getLocalizedString("MissingKeyObject.MissingString"), "MissingKeyObject.MissingString");
      });
    });

    describe("Given Namespace", () => {

      it("first level with no substitution", () => {
        assert.equal(localization.getLocalizedString("Default:FirstTrivial"), "First level string (default)");
        assert.equal(localization.getLocalizedString("Test:FirstTrivial"), "First level string (test)");
      });

      it("second level with no substitution", () => {
        assert.equal(localization.getLocalizedString("Default:SecondTrivial.Test1"), "Second level string 1 (default)");
        assert.equal(localization.getLocalizedString("Default:SecondTrivial.Test2"), "Second level string 2 (default)");
        assert.equal(localization.getLocalizedString("Test:SecondTrivial.Test1"), "Second level string 1 (test)");
        assert.equal(localization.getLocalizedString("Test:SecondTrivial.Test2"), "Second level string 2 (test)");
      });

      it("first level with substitution", () => {
        assert.equal(localization.getLocalizedString("Default:FirstSubstitution1", { str: "CUSTOM1" }), "First level CUSTOM1 (default)");
        assert.equal(localization.getLocalizedString("Default:FirstSubstitution1", { str: "CUSTOM2" }), "First level CUSTOM2 (default)");
        assert.equal(localization.getLocalizedString("Default:FirstSubstitution2", { str1: "CUSTOM1", str2: "CUSTOM2" }), "First level CUSTOM1 and CUSTOM2 (default)");
        assert.equal(localization.getLocalizedString("Test:FirstSubstitution1", { str: "CUSTOM1" }), "First level CUSTOM1 (test)");
        assert.equal(localization.getLocalizedString("Test:FirstSubstitution1", { str: "CUSTOM2" }), "First level CUSTOM2 (test)");
        assert.equal(localization.getLocalizedString("Test:FirstSubstitution2", { str1: "CUSTOM1", str2: "CUSTOM2" }), "First level CUSTOM1 and CUSTOM2 (test)");
      });

      it("second level with substitution", () => {
        assert.equal(localization.getLocalizedString("Default:SecondSubstitution.Test1", { varA: "Variable1", varB: "Variable2" }), "Substitute Variable1 and Variable2 (default)");
        assert.equal(localization.getLocalizedString("Default:SecondSubstitution.Test2", { varA: "Variable1", varB: "Variable2" }), "Reverse substitute Variable2 and Variable1 (default)");
        assert.equal(localization.getLocalizedString("Test:SecondSubstitution.Test1", { varA: "Variable1", varB: "Variable2" }), "Substitute Variable1 and Variable2 (test)");
        assert.equal(localization.getLocalizedString("Test:SecondSubstitution.Test2", { varA: "Variable1", varB: "Variable2" }), "Reverse substitute Variable2 and Variable1 (test)");
      });

      it("first level missing key doesn't find a value", () => {
        assert.equal(localization.getLocalizedString("Default:MissingKeyString"), "MissingKeyString");
        assert.equal(localization.getLocalizedString("Test:MissingKeyString"), "MissingKeyString");
      });

      it("second level missing key doesn't find a value", () => {
        assert.equal(localization.getLocalizedString("Test:SecondTrivial.MissingString"), "SecondTrivial.MissingString");
        assert.equal(localization.getLocalizedString("Test:MissingKeyObject.MissingString"), "MissingKeyObject.MissingString");
      });

      // it.only("returnObjects on string", () => {
      //   assert.equal(localization.getLocalizedString("Test:MyObject.ObjectKey1", { returnObjects: true }), "ObjectValue1");
      // });
      // it.only("returnObjects on object", () => {
      //   assert.throws(() => localization.getLocalizedString("Test:MyObject", { returnObjects: true }), Error)
      // });
      // it.only("returnObjects on missing object", () => {
      //   assert.equal(localization.getLocalizedString("Test:MyMissingObject", { returnObjects: true }), "MyMissingObject");
      // });
      // it.only("returnObjects on missing string", () => {
      //   assert.equal(localization.getLocalizedString("Test:MyMissingObject.MissingObjectValue", { returnObjects: true }), "MyMissingObject.MissingObjectValue");
      // });
      // it.only("returnDetails on string", () => {
      //   assert.equal(localization.getLocalizedString("Test:MyObject.ObjectKey1", { returnDetails: true }), "ObjectValue1");
      // });
      // it.only("returnDetails on object", () => {
      //   assert.equal(localization.getLocalizedString("Test:MyObject", { returnDetails: true }), "not sure");
      // });
      // it.only("returnDetails on missing object", () => {
      //   assert.equal(localization.getLocalizedString("Test:MyObject", { returnDetails: true }), "MyObject");
      // });
      // it.only("returnDetails on missing string", () => {
      //   assert.equal(localization.getLocalizedString("Test:MyObject.MissingObjectValue", { returnDetails: true }), "MissingObjectValue");
      // });
    });

    describe("Nonexisting Namespace", () => {

      it("first level fails", () => {
        assert.equal(localization.getLocalizedString("Nonexisting:FirstTrivial"), "FirstTrivial");
        assert.equal(localization.getLocalizedString("Nonexisting:MissingKeyString"), "MissingKeyString");
      });

      it("second level fails", () => {
        assert.equal(localization.getLocalizedString("Nonexisting:SecondTrivial.Test1"), "SecondTrivial.Test1");
        assert.equal(localization.getLocalizedString("Nonexisting:Missing.String"), "Missing.String");
      });
    });
  })

});

/*** TODO ***/

/* different ways of setting/adding namespaces */
// localization = new ITwinLocalization({
//   initOptions: {
//     defaultNS: "Default"
//   }
// });

// // await localization.initialize(NAMESPACES);

// // await localization.initialize(["Default"]);
// await localization.initialize(["DontExist"]);
// await localization.registerNamespace("Test");

/* localizedstirng options throws error vs doesnt */
// options = { ...options, returnDetails: true };