/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/

import { assert } from "chai";
import { Localization } from "@itwin/core-common";
import { ITwinLocalization } from "../ITwinLocalization";

describe("ITwinLocalization", () => {

  let localization: Localization;
  let germanLocalization: Localization;

  describe("#initialize", () => {

    describe("with default namespace provided in constructor", () => {
      let itwinLocalization: ITwinLocalization;
      before(() => {
        itwinLocalization = new ITwinLocalization({ initOptions: { defaultNS: "Default" } });
      });

      it("default namespace set when initialized with empty array", async () => {
        await itwinLocalization.initialize([]);
        assert.equal(itwinLocalization.i18next.options.defaultNS, "Default");
      });

      it("default namespace not overridden by one namespace", async () => {
        await itwinLocalization.initialize(["Test"]);
        assert.equal(itwinLocalization.i18next.options.defaultNS, "Default");
      });

      it("default namespace not overridden by two namespaces", async () => {
        await itwinLocalization.initialize(["NotExist", "Test"]);
        assert.equal(itwinLocalization.i18next.options.defaultNS, "Default");
      });

      it("duplicate namespace value does not break default namespace", async () => {
        await itwinLocalization.initialize(["Default"]);
        assert.equal(itwinLocalization.i18next.options.defaultNS, "Default");
      });

      it("default namespace is in list of all namespaces initalized with empty array", async () => {
        await itwinLocalization.initialize([]);
        assert.isTrue(itwinLocalization.i18next.options.ns?.includes("Default"));
      });

      it("default namespace is in list of all namespaces", async () => {
        await itwinLocalization.initialize(["Test"]);
        assert.isTrue(itwinLocalization.i18next.options.ns?.includes("Default"));
      });
    });
  });

  // The goal is not to test i18next's interpolation,
  // but just to have some simple tests to make sure the
  // basics work through the ITwinLocalization class.
  // For interpolation options, see: https://www.i18next.com/translation-function/interpolation
  describe("#getLocalizedString", () => {

    before(async () => {
      localization = new ITwinLocalization();
      await localization.initialize(["Default", "Test"]);

      germanLocalization = new ITwinLocalization({ initOptions: { lng: "de" } });
      await germanLocalization.initialize(["Default", "Test"]);
    });

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

    describe("Default Namespace (German)", () => {

      it("first level with no substitution", () => {
        assert.equal(germanLocalization.getLocalizedString("FirstTrivial"), "First level string (default german)");
      });

      it("second level with no substitution", () => {
        assert.equal(germanLocalization.getLocalizedString("SecondTrivial.Test1"), "Second level string 1 (default german)");
        assert.equal(germanLocalization.getLocalizedString("SecondTrivial.Test2"), "Second level string 2 (default german)");
      });

      it("first level with substitution", () => {
        assert.equal(germanLocalization.getLocalizedString("FirstSubstitution1", { str: "CUSTOM1" }), "First level CUSTOM1 (default german)");
        assert.equal(germanLocalization.getLocalizedString("FirstSubstitution1", { str: "CUSTOM2" }), "First level CUSTOM2 (default german)");
        assert.equal(germanLocalization.getLocalizedString("FirstSubstitution2", { str1: "CUSTOM1", str2: "CUSTOM2" }), "First level CUSTOM1 and CUSTOM2 (default german)");
      });

      it("second level with substitution", () => {
        assert.equal(germanLocalization.getLocalizedString("SecondSubstitution.Test1", { varA: "Variable1", varB: "Variable2" }), "Substitute Variable1 and Variable2 (default german)");
        assert.equal(germanLocalization.getLocalizedString("SecondSubstitution.Test2", { varA: "Variable1", varB: "Variable2" }), "Reverse substitute Variable2 and Variable1 (default german)");
      });

      it("first level missing key doesn't find a value", () => {
        assert.equal(germanLocalization.getLocalizedString("MissingKeyString"), "MissingKeyString");
      });

      it("second level missing key doesn't find a value", () => {
        assert.equal(germanLocalization.getLocalizedString("SecondTrivial.MissingString"), "SecondTrivial.MissingString");
        assert.equal(germanLocalization.getLocalizedString("MissingKeyObject.MissingString"), "MissingKeyObject.MissingString");
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
    });

    describe("Given Namespace (German)", () => {

      it("first level with no substitution", () => {
        assert.equal(germanLocalization.getLocalizedString("Default:FirstTrivial"), "First level string (default german)");
        assert.equal(germanLocalization.getLocalizedString("Test:FirstTrivial"), "First level string (german)");
      });

      it("second level with no substitution", () => {
        assert.equal(germanLocalization.getLocalizedString("Default:SecondTrivial.Test1"), "Second level string 1 (default german)");
        assert.equal(germanLocalization.getLocalizedString("Default:SecondTrivial.Test2"), "Second level string 2 (default german)");
        assert.equal(germanLocalization.getLocalizedString("Test:SecondTrivial.Test1"), "Second level string 1 (german)");
        assert.equal(germanLocalization.getLocalizedString("Test:SecondTrivial.Test2"), "Second level string 2 (german)");
      });

      it("first level with substitution", () => {
        assert.equal(germanLocalization.getLocalizedString("Default:FirstSubstitution1", { str: "CUSTOM1" }), "First level CUSTOM1 (default german)");
        assert.equal(germanLocalization.getLocalizedString("Default:FirstSubstitution1", { str: "CUSTOM2" }), "First level CUSTOM2 (default german)");
        assert.equal(germanLocalization.getLocalizedString("Default:FirstSubstitution2", { str1: "CUSTOM1", str2: "CUSTOM2" }), "First level CUSTOM1 and CUSTOM2 (default german)");
        assert.equal(germanLocalization.getLocalizedString("Test:FirstSubstitution1", { str: "CUSTOM1" }), "First level CUSTOM1 (german)");
        assert.equal(germanLocalization.getLocalizedString("Test:FirstSubstitution1", { str: "CUSTOM2" }), "First level CUSTOM2 (german)");
        assert.equal(germanLocalization.getLocalizedString("Test:FirstSubstitution2", { str1: "CUSTOM1", str2: "CUSTOM2" }), "First level CUSTOM1 and CUSTOM2 (german)");
      });

      it("second level with substitution", () => {
        assert.equal(germanLocalization.getLocalizedString("Default:SecondSubstitution.Test1", { varA: "Variable1", varB: "Variable2" }), "Substitute Variable1 and Variable2 (default german)");
        assert.equal(germanLocalization.getLocalizedString("Default:SecondSubstitution.Test2", { varA: "Variable1", varB: "Variable2" }), "Reverse substitute Variable2 and Variable1 (default german)");
        assert.equal(germanLocalization.getLocalizedString("Test:SecondSubstitution.Test1", { varA: "Variable1", varB: "Variable2" }), "Substitute Variable1 and Variable2 (german)");
        assert.equal(germanLocalization.getLocalizedString("Test:SecondSubstitution.Test2", { varA: "Variable1", varB: "Variable2" }), "Reverse substitute Variable2 and Variable1 (german)");
      });

      it("first level missing key doesn't find a value", () => {
        assert.equal(germanLocalization.getLocalizedString("Default:MissingKeyString"), "MissingKeyString");
        assert.equal(germanLocalization.getLocalizedString("Test:MissingKeyString"), "MissingKeyString");
      });

      it("second level missing key doesn't find a value", () => {
        assert.equal(germanLocalization.getLocalizedString("Test:SecondTrivial.MissingString"), "SecondTrivial.MissingString");
        assert.equal(germanLocalization.getLocalizedString("Test:MissingKeyObject.MissingString"), "MissingKeyObject.MissingString");
      });
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

    // Test a few options to make sure they get passed through correctly
    describe("With Options", () => {

      it("returnDetails throws error", () => {
        assert.throws(() => { localization.getLocalizedString("X", { returnDetails: true }) }, "Translation key must map to a string, but the given options will result in an object");
      });

      it("returnObjects throws error", () => {
        assert.throws(() => { localization.getLocalizedString("X", { returnObjects: true }) }, "Translation key must map to a string, but the given options will result in an object");
      });

      it("returnDetails and returnObjects throws error", () => {
        assert.throws(() => { localization.getLocalizedString("X", { returnDetails: true, returnObjects: true }) }, "Translation key must map to a string, but the given options will result in an object");
      });

      it("default value", () => {
        assert.equal(localization.getLocalizedString("Missing", { defaultValue: "default" }), "default");
      });

      it("override fallback language", () => {
        // Doesn't fallback to English
        assert.equal(germanLocalization.getLocalizedString("OnlyEnglish", { fallbackLng: "de" }), "OnlyEnglish");
      });

      it("set namespace", () => {
        assert.equal(localization.getLocalizedString("FirstTrivial", { ns: "Test" }), "First level string (test)");
        assert.equal(localization.getLocalizedString("FirstSubstitution1", { str: "CUSTOM1", ns: "Test" }), "First level CUSTOM1 (test)");
      });

      /*
      // TODO: Look into these to see if these work as expected
      // localization = new ITwinLocalization({ initOptions: { supportedLngs: ["en", "de"] } });

      it("override language", () => {
        assert.equal(localization.getLocalizedString("Test:FirstTrivial", { lng: "de" }), "First level string (german)");
      });

      it("override languages", () => {
        assert.equal(localization.getLocalizedString("Test:FirstTrivial", { lngs: ["de"] }), "First level string (german)");
      });

      it("fallback language to german", () => {
        assert.equal(localization.getLocalizedString("OnlyGerman", { fallbackLng: "de" }), "Hallo");
      });
      */
    });
  });

});
