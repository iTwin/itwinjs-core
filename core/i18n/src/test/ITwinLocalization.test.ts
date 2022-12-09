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

  describe("#constructor", () => {

    let itwinLocalization: ITwinLocalization;

    it("set default namespace", async () => {
      itwinLocalization = new ITwinLocalization({ initOptions: { defaultNS: "Default" } });
      await itwinLocalization.initialize([]);

      assert.equal(itwinLocalization.i18next.options.defaultNS, "Default");
      assert.equal(itwinLocalization.getLocalizedString("FirstTrivial"), "First level string (default)");
    });

    it("set default language as english", async () => {
      itwinLocalization = new ITwinLocalization({ initOptions: { defaultNS: "Default", lng: "en" } });
      await itwinLocalization.initialize([]);

      assert.equal(itwinLocalization.i18next.options.lng, "en");
      assert.equal(itwinLocalization.getLocalizedString("FirstTrivial"), "First level string (default)");
    });

    it("set default language as NOT english", async () => {
      itwinLocalization = new ITwinLocalization({ initOptions: { defaultNS: "Default", lng: "de" } });
      await itwinLocalization.initialize([]);

      assert.equal(itwinLocalization.i18next.options.lng, "de");
      assert.equal(itwinLocalization.getLocalizedString("FirstTrivial"), "First level string (default german)");
    });

    it("set fallback language as NOT english", async () => {
      itwinLocalization = new ITwinLocalization({ initOptions: { defaultNS: "Default", fallbackLng: "de" } });
      await itwinLocalization.initialize([]);

      assert.equal(itwinLocalization.i18next.options.fallbackLng, "de");
      assert.equal(itwinLocalization.getLocalizedString("OnlyGerman"), "Hallo");
    });
  });

  describe("#initialize", () => {
    let itwinLocalization: ITwinLocalization;

    it("cannot fetch from unregistered namespaces", async () => {
      localization = new ITwinLocalization();
      await localization.initialize([]);
      assert.equal(localization.getEnglishString("Default", "FirstTrivial"), "FirstTrivial");
      assert.equal(localization.getLocalizedString("Test:FirstTrivial"), "FirstTrivial");
    });

    describe("with no default namespace predefined", () => {

      before(() => {
        itwinLocalization = new ITwinLocalization();
      });

      it("no default namespace set when initialized with empty array", async () => {
        await itwinLocalization.initialize([]);

        assert.equal(itwinLocalization.i18next.options.defaultNS, undefined);
      });

      it("initialize with single namespace", async () => {
        await itwinLocalization.initialize(["Test"]);

        assert.equal(itwinLocalization.i18next.options.defaultNS, "Test");
        assert.isTrue(itwinLocalization.i18next.options.ns?.includes("Test"));
        assert.equal(itwinLocalization.getLocalizedString("Test:FirstTrivial"), "First level string (test)");
      });

      it("initialize with two namespaces recognizes both namespaces", async () => {
        await itwinLocalization.initialize(["Default", "Test"]);

        assert.isTrue(itwinLocalization.i18next.options.ns?.includes("Default"));
        assert.isTrue(itwinLocalization.i18next.options.ns?.includes("Test"));
        assert.equal(itwinLocalization.getLocalizedString("Default:FirstTrivial"), "First level string (default)");
        assert.equal(itwinLocalization.getLocalizedString("Test:FirstTrivial"), "First level string (test)");
      });

      it("initialize with two namespaces sets first as default", async () => {
        await itwinLocalization.initialize(["Default", "Test"]);

        assert.equal(itwinLocalization.i18next.options.defaultNS, "Default");
        assert.equal(itwinLocalization.getLocalizedString("FirstTrivial"), "First level string (default)");
      });

      it("initialize with duplicate namespace values does not break anything", async () => {
        await itwinLocalization.initialize(["Default", "Default"]);

        assert.equal(itwinLocalization.i18next.options.defaultNS, "Default");
        assert.isTrue(itwinLocalization.i18next.options.ns?.includes("Default"));
        assert.equal(itwinLocalization.getLocalizedString("FirstTrivial"), "First level string (default)");
        assert.equal(itwinLocalization.getLocalizedString("Default:FirstTrivial"), "First level string (default)");
      });
    });

    describe("with default namespace", () => {

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

  describe("#getLocalizedKeys", () => {

    before(async () => {
      localization = new ITwinLocalization();
      await localization.initialize(["Default", "Test"]);

      germanLocalization = new ITwinLocalization({ initOptions: { lng: "de" } });
      await germanLocalization.initialize(["Default", "Test"]);
    });

    it("no substitution", () => {
      assert.equal(localization.getLocalizedKeys("MyString"), "MyString");
    });

    describe("Default Namespace", () => {

      it("first level string", () => {
        assert.equal(localization.getLocalizedKeys("hi %{FirstTrivial}"), "hi First level string (default)");
        assert.equal(germanLocalization.getLocalizedKeys("hi %{FirstTrivial}"), "hi First level string (default german)");
      });

      it("second level string", () => {
        assert.equal(localization.getLocalizedKeys("%{SecondTrivial.Test1}"), "Second level string 1 (default)");
        assert.equal(localization.getLocalizedKeys("bye %{SecondTrivial.Test2}"), "bye Second level string 2 (default)");
        assert.equal(germanLocalization.getLocalizedKeys("%{SecondTrivial.Test1}"), "Second level string 1 (default german)");
        assert.equal(germanLocalization.getLocalizedKeys("bye %{SecondTrivial.Test2}"), "bye Second level string 2 (default german)");
      });

      it("first level string with keys", () => {
        assert.equal(localization.getLocalizedKeys("%{FirstSubstitution1}"), "First level {{str}} (default)");
        assert.equal(localization.getLocalizedKeys("bye %{FirstSubstitution2}"), "bye First level {{str1}} and {{str2}} (default)");
        assert.equal(germanLocalization.getLocalizedKeys("%{FirstSubstitution1}"), "First level {{str}} (default german)");
        assert.equal(germanLocalization.getLocalizedKeys("bye %{FirstSubstitution2}"), "bye First level {{str1}} and {{str2}} (default german)");
      });

      it("second level string with keys", () => {
        assert.equal(localization.getLocalizedKeys("%{SecondSubstitution.Test1}"), "Substitute {{varA}} and {{varB}} (default)");
        assert.equal(localization.getLocalizedKeys("hi %{SecondSubstitution.Test2}"), "hi Reverse substitute {{varB}} and {{varA}} (default)");
        assert.equal(germanLocalization.getLocalizedKeys("%{SecondSubstitution.Test1}"), "Substitute {{varA}} and {{varB}} (default german)");
        assert.equal(germanLocalization.getLocalizedKeys("hi %{SecondSubstitution.Test2}"), "hi Reverse substitute {{varB}} and {{varA}} (default german)");
      });

      it("first level missing key doesn't find a value", () => {
        assert.equal(localization.getLocalizedKeys("no %{MissingKeyString}"), "no MissingKeyString");
        assert.equal(localization.getLocalizedKeys("no %{MissingKeyString}"), "no MissingKeyString");
      });

      it("second level missing key doesn't find a value", () => {
        assert.equal(localization.getLocalizedKeys("hi %{SecondTrivial.MissingString}"), "hi SecondTrivial.MissingString");
        assert.equal(localization.getLocalizedKeys("%{MissingKeyObject.MissingString}"), "MissingKeyObject.MissingString");
      });
    });

    describe("Given Namespace", () => {

      it("first level string", () => {
        assert.equal(localization.getLocalizedKeys("hi %{Default:FirstTrivial}"), "hi First level string (default)");
        assert.equal(localization.getLocalizedKeys("hi %{Test:FirstTrivial}"), "hi First level string (test)");
      });

      it("second level string", () => {
        assert.equal(localization.getLocalizedKeys("%{Default:SecondTrivial.Test1}"), "Second level string 1 (default)");
        assert.equal(localization.getLocalizedKeys("bye %{Default:SecondTrivial.Test2}"), "bye Second level string 2 (default)");
        assert.equal(localization.getLocalizedKeys("%{Test:SecondTrivial.Test1}"), "Second level string 1 (test)");
        assert.equal(localization.getLocalizedKeys("bye %{Test:SecondTrivial.Test2}"), "bye Second level string 2 (test)");
      });

      it("first level string with keys", () => {
        assert.equal(localization.getLocalizedKeys("%{Default:FirstSubstitution1}"), "First level {{str}} (default)");
        assert.equal(localization.getLocalizedKeys("bye %{Default:FirstSubstitution2}"), "bye First level {{str1}} and {{str2}} (default)");
        assert.equal(localization.getLocalizedKeys("%{Test:FirstSubstitution1}"), "First level {{str}} (test)");
        assert.equal(localization.getLocalizedKeys("bye %{Test:FirstSubstitution2}"), "bye First level {{str1}} and {{str2}} (test)");
      });

      it("second level string with keys", () => {
        assert.equal(localization.getLocalizedKeys("%{Default:SecondSubstitution.Test1}"), "Substitute {{varA}} and {{varB}} (default)");
        assert.equal(localization.getLocalizedKeys("hi %{Default:SecondSubstitution.Test2}"), "hi Reverse substitute {{varB}} and {{varA}} (default)");
        assert.equal(localization.getLocalizedKeys("%{Test:SecondSubstitution.Test1}"), "Substitute {{varA}} and {{varB}} (test)");
        assert.equal(localization.getLocalizedKeys("hi %{Test:SecondSubstitution.Test2}"), "hi Reverse substitute {{varB}} and {{varA}} (test)");
      });

      it("first level missing key doesn't find a value", () => {
        assert.equal(localization.getLocalizedKeys("no %{Default:MissingKeyString}"), "no MissingKeyString");
        assert.equal(localization.getLocalizedKeys("no %{Test:MissingKeyString}"), "no MissingKeyString");
      });

      it("second level missing key doesn't find a value", () => {
        assert.equal(localization.getLocalizedKeys("hi %{Default:SecondTrivial.MissingString}"), "hi SecondTrivial.MissingString");
        assert.equal(localization.getLocalizedKeys("%{Default:MissingKeyObject.MissingString}"), "MissingKeyObject.MissingString");
        assert.equal(localization.getLocalizedKeys("hi %{Test:SecondTrivial.MissingString}"), "hi SecondTrivial.MissingString");
        assert.equal(localization.getLocalizedKeys("%{Test:MissingKeyObject.MissingString}"), "MissingKeyObject.MissingString");
      });
    });

    describe("Nonexisting Namespace", () => {

      it("first level fails", () => {
        assert.equal(localization.getLocalizedKeys("%{Nonexisting:FirstTrivial}"), "FirstTrivial");
        assert.equal(localization.getLocalizedKeys("%{Nonexisting:MissingKeyString}"), "MissingKeyString");
      });

      it("second level fails", () => {
        assert.equal(localization.getLocalizedKeys("%{Nonexisting:SecondTrivial.Test1}"), "SecondTrivial.Test1");
        assert.equal(localization.getLocalizedKeys("%{Nonexisting:Missing.String}"), "Missing.String");
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

      it("first level with no substitution with fallback keys", () => {
        assert.equal(localization.getLocalizedString(["FirstTrivial", "NotExist"]), "First level string (default)");
        assert.equal(localization.getLocalizedString(["NotExist", "FirstTrivial"]), "First level string (default)");
      });

      it("more than two fallback keys succeeds", () => {
        assert.equal(localization.getLocalizedString(["FirstTrivial", "NotExist1", "NotExist2"]), "First level string (default)");
        assert.equal(localization.getLocalizedString(["NotExist1", "FirstTrivial", "NotExist2"]), "First level string (default)");
        assert.equal(localization.getLocalizedString(["NotExist1", "NotExist2", "FirstTrivial"]), "First level string (default)");
        assert.equal(localization.getLocalizedString(["1", "2", "3", "4", "5", "FirstTrivial"]), "First level string (default)");
      });

      it("second level with no substitution", () => {
        assert.equal(localization.getLocalizedString("SecondTrivial.Test1"), "Second level string 1 (default)");
        assert.equal(localization.getLocalizedString("SecondTrivial.Test2"), "Second level string 2 (default)");
      });

      it("second level with no substitution with fallback keys", () => {
        assert.equal(localization.getLocalizedString(["NotExist", "SecondTrivial.Test1"]), "Second level string 1 (default)");
        assert.equal(localization.getLocalizedString(["SecondTrivial.Test2", "NotExist"]), "Second level string 2 (default)");
      });

      it("first level with substitution", () => {
        assert.equal(localization.getLocalizedString("FirstSubstitution1", { str: "CUSTOM1" }), "First level CUSTOM1 (default)");
        assert.equal(localization.getLocalizedString("FirstSubstitution1", { str: "CUSTOM2" }), "First level CUSTOM2 (default)");
        assert.equal(localization.getLocalizedString("FirstSubstitution2", { str1: "CUSTOM1", str2: "CUSTOM2" }), "First level CUSTOM1 and CUSTOM2 (default)");
      });

      it("first level with substitution with fallback keys", () => {
        assert.equal(localization.getLocalizedString(["NotExist", "FirstSubstitution1"], { str: "CUSTOM1" }), "First level CUSTOM1 (default)");
        assert.equal(localization.getLocalizedString(["FirstSubstitution1", "NotExist"], { str: "CUSTOM2" }), "First level CUSTOM2 (default)");
        assert.equal(localization.getLocalizedString(["NotExist", "FirstSubstitution2"], { str1: "CUSTOM1", str2: "CUSTOM2" }), "First level CUSTOM1 and CUSTOM2 (default)");
      });

      it("second level with substitution", () => {
        assert.equal(localization.getLocalizedString("SecondSubstitution.Test1", { varA: "Variable1", varB: "Variable2" }), "Substitute Variable1 and Variable2 (default)");
        assert.equal(localization.getLocalizedString("SecondSubstitution.Test2", { varA: "Variable1", varB: "Variable2" }), "Reverse substitute Variable2 and Variable1 (default)");
      });

      it("second level with substitution with fallback keys", () => {
        assert.equal(localization.getLocalizedString(["NotExist", "SecondSubstitution.Test1"], { varA: "Variable1", varB: "Variable2" }), "Substitute Variable1 and Variable2 (default)");
        assert.equal(localization.getLocalizedString(["SecondSubstitution.Test2", "NotExist"], { varA: "Variable1", varB: "Variable2" }), "Reverse substitute Variable2 and Variable1 (default)");
      });

      it("first level missing key doesn't find a value", () => {
        assert.equal(localization.getLocalizedString("MissingKeyString"), "MissingKeyString");
      });

      it("first level missing all keys doesn't find a value", () => {
        assert.equal(localization.getLocalizedString(["MissingKeyString", "MissingString2"]), "MissingString2");
      });

      it("second level missing key doesn't find a value", () => {
        assert.equal(localization.getLocalizedString("SecondTrivial.MissingString"), "SecondTrivial.MissingString");
        assert.equal(localization.getLocalizedString(["NotExist", "MissingKeyObject.MissingString"]), "MissingKeyObject.MissingString");
      });

      it("read from en-US fallback", () => {
        assert.equal(localization.getLocalizedString("OnlyEnglishUS"), "HelloUS");
      });
    });

    describe("Default Namespace (German)", () => {

      it("first level with no substitution", () => {
        assert.equal(germanLocalization.getLocalizedString("FirstTrivial"), "First level string (default german)");
      });

      it("first level with no substitution with fallback keys", () => {
        assert.equal(germanLocalization.getLocalizedString(["FirstTrivial", "NotExist"]), "First level string (default german)");
        assert.equal(germanLocalization.getLocalizedString(["NotExist", "FirstTrivial"]), "First level string (default german)");
      });

      it("second level with no substitution", () => {
        assert.equal(germanLocalization.getLocalizedString("SecondTrivial.Test1"), "Second level string 1 (default german)");
        assert.equal(germanLocalization.getLocalizedString("SecondTrivial.Test2"), "Second level string 2 (default german)");
      });

      it("second level with no substitution with fallback keys", () => {
        assert.equal(germanLocalization.getLocalizedString(["NotExist", "SecondTrivial.Test1"]), "Second level string 1 (default german)");
        assert.equal(germanLocalization.getLocalizedString(["SecondTrivial.Test2", "NotExist"]), "Second level string 2 (default german)");
      });

      it("first level with substitution", () => {
        assert.equal(germanLocalization.getLocalizedString("FirstSubstitution1", { str: "CUSTOM1" }), "First level CUSTOM1 (default german)");
        assert.equal(germanLocalization.getLocalizedString("FirstSubstitution1", { str: "CUSTOM2" }), "First level CUSTOM2 (default german)");
        assert.equal(germanLocalization.getLocalizedString("FirstSubstitution2", { str1: "CUSTOM1", str2: "CUSTOM2" }), "First level CUSTOM1 and CUSTOM2 (default german)");
      });

      it("first level with substitution with fallback keys", () => {
        assert.equal(germanLocalization.getLocalizedString(["NotExist", "FirstSubstitution1"], { str: "CUSTOM1" }), "First level CUSTOM1 (default german)");
        assert.equal(germanLocalization.getLocalizedString(["FirstSubstitution1", "NotExist"], { str: "CUSTOM2" }), "First level CUSTOM2 (default german)");
        assert.equal(germanLocalization.getLocalizedString(["NotExist", "FirstSubstitution2"], { str1: "CUSTOM1", str2: "CUSTOM2" }), "First level CUSTOM1 and CUSTOM2 (default german)");
      });

      it("second level with substitution", () => {
        assert.equal(germanLocalization.getLocalizedString("SecondSubstitution.Test1", { varA: "Variable1", varB: "Variable2" }), "Substitute Variable1 and Variable2 (default german)");
        assert.equal(germanLocalization.getLocalizedString("SecondSubstitution.Test2", { varA: "Variable1", varB: "Variable2" }), "Reverse substitute Variable2 and Variable1 (default german)");
      });

      it("second level with substitution with fallback keys", () => {
        assert.equal(germanLocalization.getLocalizedString(["NotExist", "SecondSubstitution.Test1"], { varA: "Variable1", varB: "Variable2" }), "Substitute Variable1 and Variable2 (default german)");
        assert.equal(germanLocalization.getLocalizedString(["SecondSubstitution.Test2", "NotExist"], { varA: "Variable1", varB: "Variable2" }), "Reverse substitute Variable2 and Variable1 (default german)");
      });

      it("first level missing key doesn't find a value", () => {
        assert.equal(germanLocalization.getLocalizedString("MissingKeyString"), "MissingKeyString");
      });

      it("first level missing all keys doesn't find a value", () => {
        assert.equal(germanLocalization.getLocalizedString(["MissingKeyString", "MissingString2"]), "MissingString2");
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

      it("first level with no substitution with fallback keys", () => {
        assert.equal(localization.getLocalizedString(["Default:FirstTrivial", "Not:NotExist"]), "First level string (default)");
        assert.equal(localization.getLocalizedString(["Default:NotExist", "Test:FirstTrivial"]), "First level string (test)");
      });

      it("second level with no substitution", () => {
        assert.equal(localization.getLocalizedString("Default:SecondTrivial.Test1"), "Second level string 1 (default)");
        assert.equal(localization.getLocalizedString("Default:SecondTrivial.Test2"), "Second level string 2 (default)");
        assert.equal(localization.getLocalizedString("Test:SecondTrivial.Test1"), "Second level string 1 (test)");
        assert.equal(localization.getLocalizedString("Test:SecondTrivial.Test2"), "Second level string 2 (test)");
      });

      it("second level with no substitution with fallback keys", () => {
        assert.equal(localization.getLocalizedString(["Test:NotExist", "Default:SecondTrivial.Test1"]), "Second level string 1 (default)");
        assert.equal(localization.getLocalizedString(["Test:SecondTrivial.Test2", "NotExist"]), "Second level string 2 (test)");
      });

      it("first level with substitution", () => {
        assert.equal(localization.getLocalizedString("Default:FirstSubstitution1", { str: "CUSTOM1" }), "First level CUSTOM1 (default)");
        assert.equal(localization.getLocalizedString("Default:FirstSubstitution1", { str: "CUSTOM2" }), "First level CUSTOM2 (default)");
        assert.equal(localization.getLocalizedString("Default:FirstSubstitution2", { str1: "CUSTOM1", str2: "CUSTOM2" }), "First level CUSTOM1 and CUSTOM2 (default)");
        assert.equal(localization.getLocalizedString("Test:FirstSubstitution1", { str: "CUSTOM1" }), "First level CUSTOM1 (test)");
        assert.equal(localization.getLocalizedString("Test:FirstSubstitution1", { str: "CUSTOM2" }), "First level CUSTOM2 (test)");
        assert.equal(localization.getLocalizedString("Test:FirstSubstitution2", { str1: "CUSTOM1", str2: "CUSTOM2" }), "First level CUSTOM1 and CUSTOM2 (test)");
      });

      it("first level with substitution with fallback keys", () => {
        assert.equal(localization.getLocalizedString(["Test:NotExist", "Default:FirstSubstitution1"], { str: "CUSTOM1" }), "First level CUSTOM1 (default)");
        assert.equal(localization.getLocalizedString(["Test:FirstSubstitution1", "Default:NotExist"], { str: "CUSTOM2" }), "First level CUSTOM2 (test)");
        assert.equal(localization.getLocalizedString(["Test:NotExist", "Default:FirstSubstitution2"], { str1: "CUSTOM1", str2: "CUSTOM2" }), "First level CUSTOM1 and CUSTOM2 (default)");
      });

      it("second level with substitution", () => {
        assert.equal(localization.getLocalizedString("Default:SecondSubstitution.Test1", { varA: "Variable1", varB: "Variable2" }), "Substitute Variable1 and Variable2 (default)");
        assert.equal(localization.getLocalizedString("Default:SecondSubstitution.Test2", { varA: "Variable1", varB: "Variable2" }), "Reverse substitute Variable2 and Variable1 (default)");
        assert.equal(localization.getLocalizedString("Test:SecondSubstitution.Test1", { varA: "Variable1", varB: "Variable2" }), "Substitute Variable1 and Variable2 (test)");
        assert.equal(localization.getLocalizedString("Test:SecondSubstitution.Test2", { varA: "Variable1", varB: "Variable2" }), "Reverse substitute Variable2 and Variable1 (test)");
      });

      it("second level with substitution with fallback keys", () => {
        assert.equal(localization.getLocalizedString(["Test:NotExist", "Default:SecondSubstitution.Test1"], { varA: "Variable1", varB: "Variable2" }), "Substitute Variable1 and Variable2 (default)");
        assert.equal(localization.getLocalizedString(["Test:SecondSubstitution.Test2", "Default:NotExist"], { varA: "Variable1", varB: "Variable2" }), "Reverse substitute Variable2 and Variable1 (test)");
      });

      it("first level missing key doesn't find a value", () => {
        assert.equal(localization.getLocalizedString("Default:MissingKeyString"), "MissingKeyString");
        assert.equal(localization.getLocalizedString("Test:MissingKeyString"), "MissingKeyString");
      });

      it("second level missing key doesn't find a value", () => {
        assert.equal(localization.getLocalizedString("Test:SecondTrivial.MissingString"), "SecondTrivial.MissingString");
        assert.equal(localization.getLocalizedString("Test:MissingKeyObject.MissingString"), "MissingKeyObject.MissingString");
      });

      it("read from en-US fallback", () => {
        assert.equal(localization.getLocalizedString("Default:OnlyEnglishUS"), "HelloUS");
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

      it("fallback key fails", () => {
        assert.equal(localization.getLocalizedString(["Nonexisting:FirstTrivial", "NotExist"]), "NotExist");
        assert.equal(localization.getLocalizedString(["NotExist", "Nonexisting:Missing.String"]), "Missing.String");
      });
    });

    // Test a few options to make sure they get passed through correctly
    describe("With Options", () => {

      it("returnDetails throws error", () => {
        assert.throws(() => {
          localization.getLocalizedString("X", { returnDetails: true });
        }, "Translation key must map to a string, but the given options will result in an object");
      });

      it("returnObjects throws error", () => {
        assert.throws(() => {
          localization.getLocalizedString("X", { returnObjects: true });
        }, "Translation key must map to a string, but the given options will result in an object");
      });

      it("returnDetails and returnObjects throws error", () => {
        assert.throws(() => {
          localization.getLocalizedString("X", { returnDetails: true, returnObjects: true });
        }, "Translation key must map to a string, but the given options will result in an object");
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
    });
  });

  describe("#getLocalizedString with namespace passed in as an option", () => {

    before(async () => {
      localization = new ITwinLocalization();
      await localization.initialize(["Default", "Test"]);

      germanLocalization = new ITwinLocalization({ initOptions: { lng: "de" } });
      await germanLocalization.initialize(["Default", "Test"]);
    });

    describe("Keys Without Namespaces", () => {

      it("first level with no substitution", () => {
        assert.equal(localization.getLocalizedString("FirstTrivial", { ns: "Default" }), "First level string (default)");
        assert.equal(localization.getLocalizedString("FirstTrivial", { ns: "Test" }), "First level string (test)");
      });

      it("first level with no substitution with fallback keys", () => {
        assert.equal(localization.getLocalizedString(["FirstTrivial", "NotExist"], { ns: "Default" }), "First level string (default)");
        assert.equal(localization.getLocalizedString(["NotExist", "FirstTrivial"], { ns: "Test" }), "First level string (test)");
      });

      it("second level with no substitution", () => {
        assert.equal(localization.getLocalizedString("SecondTrivial.Test1", { ns: "Default" }), "Second level string 1 (default)");
        assert.equal(localization.getLocalizedString("SecondTrivial.Test2", { ns: "Default" }), "Second level string 2 (default)");
        assert.equal(localization.getLocalizedString("SecondTrivial.Test1", { ns: "Test" }), "Second level string 1 (test)");
        assert.equal(localization.getLocalizedString("SecondTrivial.Test2", { ns: "Test" }), "Second level string 2 (test)");
      });

      it("second level with no substitution with fallback keys", () => {
        assert.equal(localization.getLocalizedString(["NotExist", "SecondTrivial.Test1"], { ns: "Default" }), "Second level string 1 (default)");
        assert.equal(localization.getLocalizedString(["SecondTrivial.Test2", "NotExist"], { ns: "Test" }), "Second level string 2 (test)");
      });

      it("first level with substitution", () => {
        assert.equal(localization.getLocalizedString("FirstSubstitution1", { ns: "Default", str: "CUSTOM1" }), "First level CUSTOM1 (default)");
        assert.equal(localization.getLocalizedString("FirstSubstitution1", { ns: "Default", str: "CUSTOM2" }), "First level CUSTOM2 (default)");
        assert.equal(localization.getLocalizedString("FirstSubstitution2", { ns: "Default", str1: "CUSTOM1", str2: "CUSTOM2" }), "First level CUSTOM1 and CUSTOM2 (default)");
        assert.equal(localization.getLocalizedString("FirstSubstitution1", { ns: "Test", str: "CUSTOM1" }), "First level CUSTOM1 (test)");
        assert.equal(localization.getLocalizedString("FirstSubstitution1", { ns: "Test", str: "CUSTOM2" }), "First level CUSTOM2 (test)");
        assert.equal(localization.getLocalizedString("FirstSubstitution2", { ns: "Test", str1: "CUSTOM1", str2: "CUSTOM2" }), "First level CUSTOM1 and CUSTOM2 (test)");
      });

      it("first level with substitution with fallback keys", () => {
        assert.equal(localization.getLocalizedString(["NotExist", "FirstSubstitution1"], { ns: "Default", str: "CUSTOM1" }), "First level CUSTOM1 (default)");
        assert.equal(localization.getLocalizedString(["FirstSubstitution1", "NotExist"], { ns: "Test", str: "CUSTOM2" }), "First level CUSTOM2 (test)");
        assert.equal(localization.getLocalizedString(["NotExist", "FirstSubstitution2"], { ns: "Test", str1: "CUSTOM1", str2: "CUSTOM2" }), "First level CUSTOM1 and CUSTOM2 (test)");
      });

      it("second level with substitution", () => {
        assert.equal(localization.getLocalizedString("SecondSubstitution.Test1", { ns: "Default", varA: "Variable1", varB: "Variable2" }), "Substitute Variable1 and Variable2 (default)");
        assert.equal(localization.getLocalizedString("SecondSubstitution.Test2", { ns: "Default", varA: "Variable1", varB: "Variable2" }), "Reverse substitute Variable2 and Variable1 (default)");
        assert.equal(localization.getLocalizedString("SecondSubstitution.Test1", { ns: "Test", varA: "Variable1", varB: "Variable2" }), "Substitute Variable1 and Variable2 (test)");
        assert.equal(localization.getLocalizedString("SecondSubstitution.Test2", { ns: "Test", varA: "Variable1", varB: "Variable2" }), "Reverse substitute Variable2 and Variable1 (test)");
      });

      it("second level with substitution with fallback keys", () => {
        assert.equal(localization.getLocalizedString(["NotExist", "SecondSubstitution.Test1"], { ns: "Default", varA: "Variable1", varB: "Variable2" }), "Substitute Variable1 and Variable2 (default)");
        assert.equal(localization.getLocalizedString(["SecondSubstitution.Test2", "NotExist"], { ns: "Test", varA: "Variable1", varB: "Variable2" }), "Reverse substitute Variable2 and Variable1 (test)");
      });

      it("first level missing key doesn't find a value", () => {
        assert.equal(localization.getLocalizedString("MissingKeyString", { ns: "Default" }), "MissingKeyString");
        assert.equal(localization.getLocalizedString("MissingKeyString", { ns: "Test" }), "MissingKeyString");
      });

      it("second level missing key doesn't find a value", () => {
        assert.equal(localization.getLocalizedString("SecondTrivial.MissingString", { ns: "Test" }), "SecondTrivial.MissingString");
        assert.equal(localization.getLocalizedString("MissingKeyObject.MissingString", { ns: "Test" }), "MissingKeyObject.MissingString");
      });
    });

    describe("Keys Without Namespaces (German)", () => {

      it("first level with no substitution", () => {
        assert.equal(germanLocalization.getLocalizedString("FirstTrivial", { ns: "Default" }), "First level string (default german)");
        assert.equal(germanLocalization.getLocalizedString("FirstTrivial", { ns: "Test" }), "First level string (german)");
      });

      it("second level with no substitution", () => {
        assert.equal(germanLocalization.getLocalizedString("SecondTrivial.Test1", { ns: "Default" }), "Second level string 1 (default german)");
        assert.equal(germanLocalization.getLocalizedString("SecondTrivial.Test2", { ns: "Default" }), "Second level string 2 (default german)");
        assert.equal(germanLocalization.getLocalizedString("SecondTrivial.Test1", { ns: "Test" }), "Second level string 1 (german)");
        assert.equal(germanLocalization.getLocalizedString("SecondTrivial.Test2", { ns: "Test" }), "Second level string 2 (german)");
      });

      it("first level with substitution", () => {
        assert.equal(germanLocalization.getLocalizedString("FirstSubstitution1", { ns: "Default", str: "CUSTOM1" }), "First level CUSTOM1 (default german)");
        assert.equal(germanLocalization.getLocalizedString("FirstSubstitution1", { ns: "Default", str: "CUSTOM2" }), "First level CUSTOM2 (default german)");
        assert.equal(germanLocalization.getLocalizedString("FirstSubstitution2", { ns: "Default", str1: "CUSTOM1", str2: "CUSTOM2" }), "First level CUSTOM1 and CUSTOM2 (default german)");
        assert.equal(germanLocalization.getLocalizedString("FirstSubstitution1", { ns: "Test", str: "CUSTOM1" }), "First level CUSTOM1 (german)");
        assert.equal(germanLocalization.getLocalizedString("FirstSubstitution1", { ns: "Test", str: "CUSTOM2" }), "First level CUSTOM2 (german)");
        assert.equal(germanLocalization.getLocalizedString("FirstSubstitution2", { ns: "Test", str1: "CUSTOM1", str2: "CUSTOM2" }), "First level CUSTOM1 and CUSTOM2 (german)");
      });

      it("second level with substitution", () => {
        assert.equal(germanLocalization.getLocalizedString("SecondSubstitution.Test1", { ns: "Default", varA: "Variable1", varB: "Variable2" }), "Substitute Variable1 and Variable2 (default german)");
        assert.equal(germanLocalization.getLocalizedString("SecondSubstitution.Test2", { ns: "Default", varA: "Variable1", varB: "Variable2" }), "Reverse substitute Variable2 and Variable1 (default german)");
        assert.equal(germanLocalization.getLocalizedString("SecondSubstitution.Test1", { ns: "Test", varA: "Variable1", varB: "Variable2" }), "Substitute Variable1 and Variable2 (german)");
        assert.equal(germanLocalization.getLocalizedString("SecondSubstitution.Test2", { ns: "Test", varA: "Variable1", varB: "Variable2" }), "Reverse substitute Variable2 and Variable1 (german)");
      });

      it("first level missing key doesn't find a value", () => {
        assert.equal(germanLocalization.getLocalizedString("MissingKeyString", { ns: "Default" }), "MissingKeyString");
        assert.equal(germanLocalization.getLocalizedString("MissingKeyString", { ns: "Test" }), "MissingKeyString");
      });

      it("second level missing key doesn't find a value", () => {
        assert.equal(germanLocalization.getLocalizedString("SecondTrivial.MissingString", { ns: "Test" }), "SecondTrivial.MissingString");
        assert.equal(germanLocalization.getLocalizedString("MissingKeyObject.MissingString", { ns: "Test" }), "MissingKeyObject.MissingString");
      });
    });

    describe("Keys With Namespaces", () => {

      it("key with same namespace works", () => {
        assert.equal(localization.getLocalizedString("Default:FirstTrivial", { ns: "Default" }), "First level string (default)");
        assert.equal(localization.getLocalizedString("Test:SecondTrivial.Test1", { ns: "Test" }), "Second level string 1 (test)");
      });

      it("key with different namespace overrides given namespace", () => {
        assert.equal(localization.getLocalizedString("Test:FirstTrivial", { ns: "Default" }), "First level string (test)");
        assert.equal(localization.getLocalizedString("Default:FirstTrivial", { ns: "Test" }), "First level string (default)");
      });

      it("key with same namespace works with fallback keys", () => {
        assert.equal(localization.getLocalizedString(["NotExist:FirstTrivial", "Default:FirstTrivial"], { ns: "Default" }), "First level string (default)");
        assert.equal(localization.getLocalizedString(["NotExist:FirstTrivial", "Test:FirstTrivial"], { ns: "Test" }), "First level string (test)");
      });

      it("key with different namespace overrides given namespace with fallback keys", () => {
        assert.equal(localization.getLocalizedString(["NotExist:FirstTrivial", "Test:FirstTrivial"], { ns: "Default" }), "First level string (test)");
        assert.equal(localization.getLocalizedString(["NotExist:FirstTrivial", "Default:FirstTrivial"], { ns: "Test" }), "First level string (default)");
      });

      it("missing key does not find a value", () => {
        assert.equal(germanLocalization.getLocalizedString("Default:MissingKeyString", { ns: "Default" }), "MissingKeyString");
        assert.equal(germanLocalization.getLocalizedString(["Missing1", "MissingKeyObject.MissingString"], { ns: "Test" }), "MissingKeyObject.MissingString");
      });
    });

    describe("Nonexisting Namespace", () => {

      it("first level fails", () => {
        assert.equal(localization.getLocalizedString("FirstTrivial", { ns: "Nonexisting" }), "FirstTrivial");
        assert.equal(localization.getLocalizedString("MissingKeyString", { ns: "Nonexisting" }), "MissingKeyString");
      });

      it("second level fails", () => {
        assert.equal(localization.getLocalizedString("SecondTrivial.Test1", { ns: "Nonexisting" }), "SecondTrivial.Test1");
        assert.equal(localization.getLocalizedString("Missing.String", { ns: "Nonexisting" }), "Missing.String");
      });

      it("empty string namespace falls back to default namespace", () => {
        assert.equal(localization.getLocalizedString("FirstTrivial", { ns: "" }), "First level string (default)");
        assert.equal(localization.getLocalizedString("SecondTrivial.Test1", { ns: "" }), "Second level string 1 (default)");
      });

      it("fallback key fails", () => {
        assert.equal(localization.getLocalizedString(["FirstTrivial", "NotExist"], { ns: "Nonexisting" }), "NotExist");
        assert.equal(localization.getLocalizedString(["NotExist", "Missing.String"], { ns: "Nonexisting" }), "Missing.String");
      });

      it("use key with valid namespace instead", () => {
        assert.equal(localization.getLocalizedString("Default:FirstTrivial", { ns: "Nonexisting" }), "First level string (default)");
        assert.equal(localization.getLocalizedString("Test:FirstTrivial", { ns: "Nonexisting" }), "First level string (test)");
      });

      it("providing key with invalid namespace fails", () => {
        assert.equal(localization.getLocalizedString("Nonexisting2:FirstTrivial", { ns: "Nonexisting1" }), "FirstTrivial");
      });
    });

    // Test a few options to make sure they get passed through correctly
    describe("With Options", () => {

      it("returnDetails throws error", () => {
        assert.throws(() => {
          localization.getLocalizedString("X", { ns: "Default", returnDetails: true });
        }, "Translation key must map to a string, but the given options will result in an object");
      });

      it("returnObjects throws error", () => {
        assert.throws(() => {
          localization.getLocalizedString("X", { ns: "Default", returnObjects: true });
        }, "Translation key must map to a string, but the given options will result in an object");
      });

      it("returnDetails and returnObjects throws error", () => {
        assert.throws(() => {
          localization.getLocalizedString("X", { ns: "Default", returnDetails: true, returnObjects: true });
        }, "Translation key must map to a string, but the given options will result in an object");
      });

      it("default value", () => {
        assert.equal(localization.getLocalizedString("Missing", { ns: "Default", defaultValue: "default" }), "default");
      });

      it("override fallback language", () => {
        // Doesn't fallback to English
        assert.equal(germanLocalization.getLocalizedString("OnlyEnglish", { ns: "Default", fallbackLng: "de" }), "OnlyEnglish");
      });
    });
  });

  describe("#getEnglishString", () => {

    before(async () => {
      localization = new ITwinLocalization();
      await localization.initialize(["Default", "Test"]);

      germanLocalization = new ITwinLocalization({ initOptions: { lng: "de" } });
      await germanLocalization.initialize(["Default", "Test"]);
    });

    describe("Given Namespace", () => {

      it("first level with no substitution", () => {
        assert.equal(localization.getEnglishString("Default", "FirstTrivial"), "First level string (default)");
        assert.equal(localization.getEnglishString("Test", "FirstTrivial"), "First level string (test)");
      });

      it("first level with no substitution with fallback keys", () => {
        assert.equal(localization.getEnglishString("Default", ["FirstTrivial", "NotExist"]), "First level string (default)");
        assert.equal(localization.getEnglishString("Test", ["NotExist", "FirstTrivial"]), "First level string (test)");
      });

      it("second level with no substitution", () => {
        assert.equal(localization.getEnglishString("Default", "SecondTrivial.Test1"), "Second level string 1 (default)");
        assert.equal(localization.getEnglishString("Default", "SecondTrivial.Test2"), "Second level string 2 (default)");
        assert.equal(localization.getEnglishString("Test", "SecondTrivial.Test1"), "Second level string 1 (test)");
        assert.equal(localization.getEnglishString("Test", "SecondTrivial.Test2"), "Second level string 2 (test)");
      });

      it("second level with no substitution with fallback keys", () => {
        assert.equal(localization.getEnglishString("Default", ["NotExist", "SecondTrivial.Test1"]), "Second level string 1 (default)");
        assert.equal(localization.getEnglishString("Test", ["SecondTrivial.Test2", "NotExist"]), "Second level string 2 (test)");
      });

      it("first level with substitution", () => {
        assert.equal(localization.getEnglishString("Default", "FirstSubstitution1", { str: "CUSTOM1" }), "First level CUSTOM1 (default)");
        assert.equal(localization.getEnglishString("Default", "FirstSubstitution1", { str: "CUSTOM2" }), "First level CUSTOM2 (default)");
        assert.equal(localization.getEnglishString("Default", "FirstSubstitution2", { str1: "CUSTOM1", str2: "CUSTOM2" }), "First level CUSTOM1 and CUSTOM2 (default)");
        assert.equal(localization.getEnglishString("Test", "FirstSubstitution1", { str: "CUSTOM1" }), "First level CUSTOM1 (test)");
        assert.equal(localization.getEnglishString("Test", "FirstSubstitution1", { str: "CUSTOM2" }), "First level CUSTOM2 (test)");
        assert.equal(localization.getEnglishString("Test", "FirstSubstitution2", { str1: "CUSTOM1", str2: "CUSTOM2" }), "First level CUSTOM1 and CUSTOM2 (test)");
      });

      it("first level with substitution with fallback keys", () => {
        assert.equal(localization.getEnglishString("Default", ["NotExist", "FirstSubstitution1"], { str: "CUSTOM1" }), "First level CUSTOM1 (default)");
        assert.equal(localization.getEnglishString("Test", ["FirstSubstitution1", "NotExist"], { str: "CUSTOM2" }), "First level CUSTOM2 (test)");
        assert.equal(localization.getEnglishString("Test", ["NotExist", "FirstSubstitution2"], { str1: "CUSTOM1", str2: "CUSTOM2" }), "First level CUSTOM1 and CUSTOM2 (test)");
      });

      it("second level with substitution", () => {
        assert.equal(localization.getEnglishString("Default", "SecondSubstitution.Test1", { varA: "Variable1", varB: "Variable2" }), "Substitute Variable1 and Variable2 (default)");
        assert.equal(localization.getEnglishString("Default", "SecondSubstitution.Test2", { varA: "Variable1", varB: "Variable2" }), "Reverse substitute Variable2 and Variable1 (default)");
        assert.equal(localization.getEnglishString("Test", "SecondSubstitution.Test1", { varA: "Variable1", varB: "Variable2" }), "Substitute Variable1 and Variable2 (test)");
        assert.equal(localization.getEnglishString("Test", "SecondSubstitution.Test2", { varA: "Variable1", varB: "Variable2" }), "Reverse substitute Variable2 and Variable1 (test)");
      });

      it("second level with substitution with fallback keys", () => {
        assert.equal(localization.getEnglishString("Default", ["NotExist", "SecondSubstitution.Test1"], { varA: "Variable1", varB: "Variable2" }), "Substitute Variable1 and Variable2 (default)");
        assert.equal(localization.getEnglishString("Test", ["SecondSubstitution.Test2", "NotExist"], { varA: "Variable1", varB: "Variable2" }), "Reverse substitute Variable2 and Variable1 (test)");
      });

      it("first level missing key doesn't find a value", () => {
        assert.equal(localization.getEnglishString("Default", "MissingKeyString"), "MissingKeyString");
        assert.equal(localization.getEnglishString("Test", "MissingKeyString"), "MissingKeyString");
      });

      it("second level missing key doesn't find a value", () => {
        assert.equal(localization.getEnglishString("Test", "SecondTrivial.MissingString"), "SecondTrivial.MissingString");
        assert.equal(localization.getEnglishString("Test", "MissingKeyObject.MissingString"), "MissingKeyObject.MissingString");
      });
    });

    describe("Given Namespace with German default language returns English strings", () => {

      it("first level with no substitution", () => {
        assert.equal(germanLocalization.getEnglishString("Default", "FirstTrivial"), "First level string (default)");
        assert.equal(germanLocalization.getEnglishString("Test", "FirstTrivial"), "First level string (test)");
      });

      it("first level with no substitution with fallback keys", () => {
        assert.equal(germanLocalization.getEnglishString("Default", ["FirstTrivial", "NotExist"]), "First level string (default)");
        assert.equal(germanLocalization.getEnglishString("Test", ["NotExist", "FirstTrivial"]), "First level string (test)");
      });

      it("second level with no substitution", () => {
        assert.equal(germanLocalization.getEnglishString("Default", "SecondTrivial.Test1"), "Second level string 1 (default)");
        assert.equal(germanLocalization.getEnglishString("Default", "SecondTrivial.Test2"), "Second level string 2 (default)");
        assert.equal(germanLocalization.getEnglishString("Test", "SecondTrivial.Test1"), "Second level string 1 (test)");
        assert.equal(germanLocalization.getEnglishString("Test", "SecondTrivial.Test2"), "Second level string 2 (test)");
      });

      it("second level with no substitution with fallback keys", () => {
        assert.equal(germanLocalization.getEnglishString("Default", ["NotExist", "SecondTrivial.Test1"]), "Second level string 1 (default)");
        assert.equal(germanLocalization.getEnglishString("Test", ["SecondTrivial.Test2", "NotExist"]), "Second level string 2 (test)");
      });

      it("first level with substitution", () => {
        assert.equal(germanLocalization.getEnglishString("Default", "FirstSubstitution1", { str: "CUSTOM1" }), "First level CUSTOM1 (default)");
        assert.equal(germanLocalization.getEnglishString("Default", "FirstSubstitution1", { str: "CUSTOM2" }), "First level CUSTOM2 (default)");
        assert.equal(germanLocalization.getEnglishString("Default", "FirstSubstitution2", { str1: "CUSTOM1", str2: "CUSTOM2" }), "First level CUSTOM1 and CUSTOM2 (default)");
        assert.equal(germanLocalization.getEnglishString("Test", "FirstSubstitution1", { str: "CUSTOM1" }), "First level CUSTOM1 (test)");
        assert.equal(germanLocalization.getEnglishString("Test", "FirstSubstitution1", { str: "CUSTOM2" }), "First level CUSTOM2 (test)");
        assert.equal(germanLocalization.getEnglishString("Test", "FirstSubstitution2", { str1: "CUSTOM1", str2: "CUSTOM2" }), "First level CUSTOM1 and CUSTOM2 (test)");
      });

      it("first level with substitution with fallback keys", () => {
        assert.equal(germanLocalization.getEnglishString("Default", ["NotExist", "FirstSubstitution1"], { str: "CUSTOM1" }), "First level CUSTOM1 (default)");
        assert.equal(germanLocalization.getEnglishString("Test", ["FirstSubstitution1", "NotExist"], { str: "CUSTOM2" }), "First level CUSTOM2 (test)");
        assert.equal(germanLocalization.getEnglishString("Test", ["NotExist", "FirstSubstitution2"], { str1: "CUSTOM1", str2: "CUSTOM2" }), "First level CUSTOM1 and CUSTOM2 (test)");
      });

      it("second level with substitution", () => {
        assert.equal(germanLocalization.getEnglishString("Default", "SecondSubstitution.Test1", { varA: "Variable1", varB: "Variable2" }), "Substitute Variable1 and Variable2 (default)");
        assert.equal(germanLocalization.getEnglishString("Default", "SecondSubstitution.Test2", { varA: "Variable1", varB: "Variable2" }), "Reverse substitute Variable2 and Variable1 (default)");
        assert.equal(germanLocalization.getEnglishString("Test", "SecondSubstitution.Test1", { varA: "Variable1", varB: "Variable2" }), "Substitute Variable1 and Variable2 (test)");
        assert.equal(germanLocalization.getEnglishString("Test", "SecondSubstitution.Test2", { varA: "Variable1", varB: "Variable2" }), "Reverse substitute Variable2 and Variable1 (test)");
      });

      it("second level with substitution with fallback keys", () => {
        assert.equal(germanLocalization.getEnglishString("Default", ["NotExist", "SecondSubstitution.Test1"], { varA: "Variable1", varB: "Variable2" }), "Substitute Variable1 and Variable2 (default)");
        assert.equal(germanLocalization.getEnglishString("Test", ["SecondSubstitution.Test2", "NotExist"], { varA: "Variable1", varB: "Variable2" }), "Reverse substitute Variable2 and Variable1 (test)");
      });

      it("first level missing key doesn't find a value", () => {
        assert.equal(germanLocalization.getEnglishString("Default", "MissingKeyString"), "MissingKeyString");
        assert.equal(germanLocalization.getEnglishString("Test", "MissingKeyString"), "MissingKeyString");
      });

      it("second level missing key doesn't find a value", () => {
        assert.equal(germanLocalization.getEnglishString("Test", "SecondTrivial.MissingString"), "SecondTrivial.MissingString");
        assert.equal(germanLocalization.getEnglishString("Test", "MissingKeyObject.MissingString"), "MissingKeyObject.MissingString");
      });
    });

    describe("Nonexisting Namespace", () => {

      it("first level fails", () => {
        assert.equal(localization.getEnglishString("Nonexisting", "FirstTrivial"), "FirstTrivial");
        assert.equal(localization.getEnglishString("Nonexisting", "MissingKeyString"), "MissingKeyString");
      });

      it("second level fails", () => {
        assert.equal(localization.getEnglishString("Nonexisting", "SecondTrivial.Test1"), "SecondTrivial.Test1");
        assert.equal(localization.getEnglishString("Nonexisting", "Missing.String"), "Missing.String");
      });

      it("empty string namespace is treated as default namespace", () => {
        assert.equal(localization.getEnglishString("", "FirstTrivial"), "First level string (default)");
        assert.equal(localization.getEnglishString("", "SecondTrivial.Test1"), "Second level string 1 (default)");
      });
    });

    // Test a few options to make sure they get passed through correctly
    describe("With Options", () => {

      it("returnDetails throws error", () => {
        assert.throws(() => {
          localization.getEnglishString("Default", "X", { returnDetails: true });
        }, "Translation key must map to a string, but the given options will result in an object");
      });

      it("returnObjects throws error", () => {
        assert.throws(() => {
          localization.getEnglishString("Default", "X", { returnObjects: true });
        }, "Translation key must map to a string, but the given options will result in an object");
      });

      it("returnDetails and returnObjects throws error", () => {
        assert.throws(() => {
          localization.getEnglishString("Default", "X", { returnDetails: true, returnObjects: true });
        }, "Translation key must map to a string, but the given options will result in an object");
      });

      it("default value", () => {
        assert.equal(localization.getEnglishString("Default", "Missing", { defaultValue: "default" }), "default");
      });

      it("english takes priority over fallback language", () => {
        assert.equal(germanLocalization.getEnglishString("Default", "OnlyEnglish", { fallbackLng: "de" }), "Hello");
      });

      // White box test
      it("given namespace overrides namespace translation option", () => {
        assert.equal(localization.getEnglishString("Default", "FirstTrivial", { ns: "Test" }), "First level string (default)");
        assert.equal(localization.getEnglishString("Default", "FirstSubstitution1", { str: "CUSTOM1", ns: "Test" }), "First level CUSTOM1 (default)");
      });
    });

  });

  // Returned promises never have anything of substance, being only empty or resolving to null...
  // describe("#getNamespacePromise", () => {
  // });

  describe("#getLanguageList", () => {
    let languages: readonly string[];

    it("english language list includes en and en-US", async () => {
      localization = new ITwinLocalization();
      await localization.initialize([]);

      languages = localization.getLanguageList();
      assert.isTrue(languages.includes("en-US"));
      assert.isTrue(languages.includes("en"));
    });

    it("when non-english language is set as default, that language and english are included in langauge list", async () => {
      germanLocalization = new ITwinLocalization({ initOptions: { lng: "de" } });
      await germanLocalization.initialize([]);

      languages = germanLocalization.getLanguageList();
      assert.isTrue(languages.includes("en"));
      assert.isTrue(languages.includes("de"));
    });
  });

  describe("#changeLanguage", () => {

    it("change from english to another language", async () => {
      localization = new ITwinLocalization();
      await localization.initialize(["Default"]);

      assert.equal(localization.getLocalizedString("FirstTrivial"), "First level string (default)"); // english
      await localization.changeLanguage("de");
      assert.equal(localization.getLocalizedString("FirstTrivial"), "First level string (default german)"); // german
    });

    it("change from another language to english", async () => {
      localization = new ITwinLocalization({ initOptions: { lng: "de" } });
      await localization.initialize(["Default"]);

      assert.equal(localization.getLocalizedString("FirstTrivial"), "First level string (default german)"); // german
      await localization.changeLanguage("en");
      assert.equal(localization.getLocalizedString("FirstTrivial"), "First level string (default)"); // english
    });
  });

  describe("#registerNamespace", () => {
    let itwinLocalization: ITwinLocalization;

    beforeEach(async () => {
      itwinLocalization = new ITwinLocalization();
    });

    it("can read from namespace after it is registered", async () => {
      await itwinLocalization.initialize([]);

      await itwinLocalization.registerNamespace("Test");

      assert.isTrue(itwinLocalization.i18next.hasLoadedNamespace("Test"));
      assert.equal(itwinLocalization.getLocalizedString("Test:FirstTrivial"), "First level string (test)");
    });

    it("zero initial, register one", async () => {
      await itwinLocalization.initialize([]);

      await itwinLocalization.registerNamespace("test1");

      assert.isTrue(itwinLocalization.i18next.hasLoadedNamespace("test1"));
    });

    it("zero initial, register two", async () => {
      await itwinLocalization.initialize([]);

      await itwinLocalization.registerNamespace("test1");
      await itwinLocalization.registerNamespace("test2");

      assert.isTrue(itwinLocalization.i18next.hasLoadedNamespace("test1"));
      assert.isTrue(itwinLocalization.i18next.hasLoadedNamespace("test2"));
    });

    it("one initial, register one", async () => {
      await itwinLocalization.initialize(["initial1"]);

      await itwinLocalization.registerNamespace("test1");

      assert.isTrue(itwinLocalization.i18next.hasLoadedNamespace("test1"));
      assert.isTrue(itwinLocalization.i18next.hasLoadedNamespace("initial1"));
    });

    it("one initial, register two", async () => {
      await itwinLocalization.initialize(["initial1"]);

      await itwinLocalization.registerNamespace("test1");
      await itwinLocalization.registerNamespace("test2");

      assert.isTrue(itwinLocalization.i18next.hasLoadedNamespace("test1"));
      assert.isTrue(itwinLocalization.i18next.hasLoadedNamespace("test2"));
      assert.isTrue(itwinLocalization.i18next.hasLoadedNamespace("initial1"));
    });

    it("two initial, register one", async () => {
      await itwinLocalization.initialize(["initial1", "initial2"]);

      await itwinLocalization.registerNamespace("test1");

      assert.isTrue(itwinLocalization.i18next.hasLoadedNamespace("test1"));
      assert.isTrue(itwinLocalization.i18next.hasLoadedNamespace("initial1"));
      assert.isTrue(itwinLocalization.i18next.hasLoadedNamespace("initial2"));
    });

    it("two initial, register two", async () => {
      await itwinLocalization.initialize(["initial1", "initial2"]);

      await itwinLocalization.registerNamespace("test1");
      await itwinLocalization.registerNamespace("test2");

      assert.isTrue(itwinLocalization.i18next.hasLoadedNamespace("test1"));
      assert.isTrue(itwinLocalization.i18next.hasLoadedNamespace("initial1"));
      assert.isTrue(itwinLocalization.i18next.hasLoadedNamespace("initial2"));
    });

    it("register duplicate namespaces", async () => {
      await itwinLocalization.initialize([]);

      await itwinLocalization.registerNamespace("Test");
      await itwinLocalization.registerNamespace("Test");

      assert.isTrue(itwinLocalization.i18next.hasLoadedNamespace("Test"));
      assert.equal(itwinLocalization.getLocalizedString("Test:FirstTrivial"), "First level string (test)");
    });

    it("register duplicate namespace of initial namespace doesn't break anything", async () => {
      await itwinLocalization.initialize(["Test"]);

      await itwinLocalization.registerNamespace("Test");

      assert.isTrue(itwinLocalization.i18next.hasLoadedNamespace("Test"));
      assert.equal(itwinLocalization.getLocalizedString("Test:FirstTrivial"), "First level string (test)");
    });
  });

  // unregisterNamespace() isn't used and basically does nothing
  // describe("#unregisterNamespace", () => {
  // });

});
