/*---------------------------------------------------------------------------------------------
* Copyright (c) 2019 Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/

import { expect } from "chai";
import { MutableClass, ECClass } from "../../../src/Metadata/Class";
import { Schema, MutableSchema } from "../../../src/Metadata/Schema";
import * as Rules from "../../../src/Validation/BisRules";
import { DiagnosticCategory, DiagnosticType } from "../../../src/Validation/Diagnostic";
import { EntityClass } from "../../../src/Metadata/EntityClass";
import { PrimitiveType } from "../../../src/ECObjects";
import { CustomAttribute } from "../../../src/Metadata/CustomAttribute";
import { SchemaContext } from "../../../src/Context";

describe("Property Rule Tests", () => {
  let schema: Schema;
  let testClass: EntityClass;

  beforeEach(async () => {
    schema = new Schema(new SchemaContext(), "TestSchema", 1, 0, 0);
    const mutable = schema as MutableSchema;
    testClass = await mutable.createEntityClass("TestClass");
  });

  describe("PropertyShouldNotBeOfTypeLong tests", () => {
    it("Property of type Long, rule violated.", async () => {
      const property = await (testClass as ECClass as MutableClass).createPrimitiveProperty("TestProperty", PrimitiveType.Long);

      const result = await Rules.propertyShouldNotBeOfTypeLong(property);

      let resultHasEntries = false;
      for await (const diagnostic of result!) {
        resultHasEntries = true;
        expect(diagnostic).to.not.be.undefined;
        expect(diagnostic!.ecDefinition).to.equal(property);
        expect(diagnostic!.messageArgs).to.eql([testClass.fullName, property.name]);
        expect(diagnostic!.category).to.equal(DiagnosticCategory.Error);
        expect(diagnostic!.code).to.equal(Rules.DiagnosticCodes.PropertyShouldNotBeOfTypeLong);
        expect(diagnostic!.diagnosticType).to.equal(DiagnosticType.Property);
      }
      expect(resultHasEntries, "expected rule to return an AsyncIterable with entries.").to.be.true;
    });

    it("Property not of type Long, rule passes.", async () => {
      const property = await (testClass as ECClass as MutableClass).createPrimitiveProperty("TestProperty", PrimitiveType.String);

      const result = await Rules.propertyShouldNotBeOfTypeLong(property);

      for await (const _diagnostic of result!) {
        expect(false, "Rule should have passed").to.be.true;
      }
    });
  });

  describe("PropertyHasInvalidExtendedType tests", () => {
    it("Property has invalid extendedType, rule violated.", async () => {
      const property = await (testClass as ECClass as MutableClass).createPrimitiveProperty("TestProperty", PrimitiveType.Long);
      // tslint:disable-next-line:no-string-literal
      property!["_extendedTypeName"] = "UnsupportedTypeName";

      const result = await Rules.propertyHasInvalidExtendedType(property);

      let resultHasEntries = false;
      for await (const diagnostic of result!) {
        resultHasEntries = true;
        expect(diagnostic).to.not.be.undefined;
        expect(diagnostic!.ecDefinition).to.equal(property);
        expect(diagnostic!.messageArgs).to.eql([testClass.fullName, property.name, "UnsupportedTypeName"]);
        expect(diagnostic!.category).to.equal(DiagnosticCategory.Error);
        expect(diagnostic!.code).to.equal(Rules.DiagnosticCodes.PropertyHasInvalidExtendedType);
        expect(diagnostic!.diagnosticType).to.equal(DiagnosticType.Property);
      }
      expect(resultHasEntries, "expected rule to return an AsyncIterable with entries.").to.be.true;
    });

    it("Property has BeGuid extendedType, rule passes.", async () => {
      const property = await (testClass as ECClass as MutableClass).createPrimitiveProperty("TestProperty", PrimitiveType.String);
      // tslint:disable-next-line:no-string-literal
      property!["_extendedTypeName"] = "BeGuid";

      const result = await Rules.propertyShouldNotBeOfTypeLong(property);

      for await (const _diagnostic of result!) {
        expect(false, "Rule should have passed").to.be.true;
      }
    });

    it("Property has GeometryStream extendedType, rule passes.", async () => {
      const property = await (testClass as ECClass as MutableClass).createPrimitiveProperty("TestProperty", PrimitiveType.String);
      // tslint:disable-next-line:no-string-literal
      property!["_extendedTypeName"] = "GeometryStream";

      const result = await Rules.propertyShouldNotBeOfTypeLong(property);

      for await (const _diagnostic of result!) {
        expect(false, "Rule should have passed").to.be.true;
      }
    });

    it("Property has Json extendedType, rule passes.", async () => {
      const property = await (testClass as ECClass as MutableClass).createPrimitiveProperty("TestProperty", PrimitiveType.String);
      // tslint:disable-next-line:no-string-literal
      property!["_extendedTypeName"] = "Json";

      const result = await Rules.propertyShouldNotBeOfTypeLong(property);

      for await (const _diagnostic of result!) {
        expect(false, "Rule should have passed").to.be.true;
      }
    });
  });

  describe("PropertyMustNotUseCustomHandledPropertyRestriction tests", () => {
    it("Property has bis:CustomHandledProperty, class missing bis:ClassHasHandler, rule fails.", async () => {
      const property = await (testClass as ECClass as MutableClass).createPrimitiveProperty("TestProperty", PrimitiveType.String);
      const propertyCAMap = new Map<string, CustomAttribute>();
      propertyCAMap.set("CustomHandledProperty", { className: "CustomHandledProperty" });
      // tslint:disable-next-line:no-string-literal
      property!["_customAttributes"] = propertyCAMap;

      const result = await Rules.propertyMustNotUseCustomHandledPropertyRestriction(property);

      let resultHasEntries = false;
      for await (const diagnostic of result!) {
        resultHasEntries = true;
        expect(diagnostic).to.not.be.undefined;
        expect(diagnostic!.ecDefinition).to.equal(property);
        expect(diagnostic!.messageArgs).to.eql([testClass.fullName, property.name]);
        expect(diagnostic!.category).to.equal(DiagnosticCategory.Error);
        expect(diagnostic!.code).to.equal(Rules.DiagnosticCodes.PropertyMustNotUseCustomHandledPropertyRestriction);
        expect(diagnostic!.diagnosticType).to.equal(DiagnosticType.Property);
      }
      expect(resultHasEntries, "expected rule to return an AsyncIterable with entries.").to.be.true;
    });

    it("Property has bis:CustomHandledProperty, class has bis:ClassHasHandler, rule fails.", async () => {
      const property = await (testClass as ECClass as MutableClass).createPrimitiveProperty("TestProperty", PrimitiveType.String);
      const propertyCAMap = new Map<string, CustomAttribute>();
      propertyCAMap.set("CustomHandledProperty", { className: "CustomHandledProperty" });
      const classCAMap = new Map<string, CustomAttribute>();
      classCAMap.set("ClassHasHandler", { className: "ClassHasHandler" });
      // tslint:disable-next-line:no-string-literal
      property!["_customAttributes"] = propertyCAMap;
      // tslint:disable-next-line:no-string-literal
      testClass!["_customAttributes"] = classCAMap;

      const result = await Rules.propertyMustNotUseCustomHandledPropertyRestriction(property);

      for await (const _diagnostic of result!) {
        expect(false, "Rule should have passed").to.be.true;
      }
    });

    it("Property does not have bis:CustomHandledProperty, rule passes.", async () => {
      const property = await (testClass as ECClass as MutableClass).createPrimitiveProperty("TestProperty", PrimitiveType.String);
      const propertyCAMap = new Map<string, CustomAttribute>();
      propertyCAMap.set("TestAttribute", { className: "TestAttribute" });
      // tslint:disable-next-line:no-string-literal
      property!["_customAttributes"] = propertyCAMap;

      const result = await Rules.propertyMustNotUseCustomHandledPropertyRestriction(property);

      for await (const _diagnostic of result!) {
        expect(false, "Rule should have passed").to.be.true;
      }
    });

    it("Property has no CustomAttributes, rule passes.", async () => {
      const property = await (testClass as ECClass as MutableClass).createPrimitiveProperty("TestProperty", PrimitiveType.String);

      const result = await Rules.propertyMustNotUseCustomHandledPropertyRestriction(property);

      for await (const _diagnostic of result!) {
        expect(false, "Rule should have passed").to.be.true;
      }
    });
  });
});
