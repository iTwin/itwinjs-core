/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/

import { expect } from "chai";

import { SchemaContext } from "../../../src/Context";
import { DelayedPromiseWithProps } from "../../../src/DelayedPromise";
import { PrimitiveType } from "../../../src/ECObjects";
import { ECClass, MutableClass, StructClass } from "../../../src/Metadata/Class";
import { EntityClass } from "../../../src/Metadata/EntityClass";
import { KindOfQuantity } from "../../../src/Metadata/KindOfQuantity";
import { PrimitiveProperty } from "../../../src/Metadata/Property";
import { MutableSchema, Schema } from "../../../src/Metadata/Schema";
import { DiagnosticCategory, DiagnosticType } from "../../../src/Validation/Diagnostic";
import * as Rules from "../../../src/Validation/ECRules";
import { PropertyProps } from "../../../src/Deserialization/JsonProps";

describe("PropertyRule tests", () => {
  let schema: Schema;
  let context: SchemaContext;
  let testClass: EntityClass;
  let testBaseClass: EntityClass;
  let testKindOfQuantity: KindOfQuantity;
  let testBaseKindOfQuantity: KindOfQuantity;

  beforeEach(async () => {
    context = new SchemaContext();
    schema = new Schema(context, "TestSchema", "ts", 1, 0, 0);
    const mutable = schema as MutableSchema;
    testClass = await mutable.createEntityClass("TestClass");
    testBaseClass = await mutable.createEntityClass("TestBaseClass");
    testKindOfQuantity = await mutable.createKindOfQuantity("TestKoQ");
    testBaseKindOfQuantity = await mutable.createKindOfQuantity("TestBaseKoQ");
    testClass.baseClass = new DelayedPromiseWithProps(testBaseClass.key, async () => testBaseClass);
  });

  it("IncompatibleValueTypePropertyOverride, rule violated.", async () => {
    await (testBaseClass as ECClass as MutableClass).createPrimitiveProperty("TestProperty", PrimitiveType.String);
    await (testClass as ECClass as MutableClass).createPrimitiveProperty("TestProperty", PrimitiveType.Integer);

    const results = Rules.incompatibleValueTypePropertyOverride(testClass.properties![0] as PrimitiveProperty);

    let resultHasEntries = false;
    for await (const diagnostic of results) {
      resultHasEntries = true;
      expect(diagnostic.ecDefinition).eq(testClass.properties![0]);
      expect(diagnostic.messageArgs).deep.eq([testClass.fullName, "TestProperty", testBaseClass.fullName, "string", "int"]);
      expect(diagnostic.messageText)
        .eq("The ECProperty 'TestSchema.TestClass.TestProperty' has a base property 'TestSchema.TestBaseClass.TestProperty' with a value type of string which is incompatible with the value type of int.");
      expect(diagnostic.category).eq(DiagnosticCategory.Error);
      expect(diagnostic.code).eq(Rules.DiagnosticCodes.IncompatibleValueTypePropertyOverride);
      expect(diagnostic.diagnosticType).eq(DiagnosticType.Property);
    }
    expect(resultHasEntries, "expected rule to return an AsyncIterable with entries.").true;
  });

  it("IncompatibleValueTypePropertyOverride, multiple base classes, rule violated.", async () => {
    const rootBaseClass = new EntityClass(schema, "RootBaseClass");
    await (rootBaseClass as ECClass as MutableClass).createPrimitiveProperty("TestProperty", PrimitiveType.String);
    await (testClass as ECClass as MutableClass).createPrimitiveProperty("TestProperty", PrimitiveType.Integer);
    testBaseClass.baseClass = new DelayedPromiseWithProps(rootBaseClass.key, async () => rootBaseClass);

    const results = Rules.incompatibleValueTypePropertyOverride(testClass.properties![0] as PrimitiveProperty);

    let resultHasEntries = false;
    for await (const diagnostic of results) {
      resultHasEntries = true;
      expect(diagnostic.ecDefinition).eq(testClass.properties![0]);
      expect(diagnostic.messageArgs).deep.eq([testClass.fullName, "TestProperty", rootBaseClass.fullName, "string", "int"]);
      expect(diagnostic.messageText)
        .eq("The ECProperty 'TestSchema.TestClass.TestProperty' has a base property 'TestSchema.RootBaseClass.TestProperty' with a value type of string which is incompatible with the value type of int.");
      expect(diagnostic.category).eq(DiagnosticCategory.Error);
      expect(diagnostic.code).eq(Rules.DiagnosticCodes.IncompatibleValueTypePropertyOverride);
      expect(diagnostic.diagnosticType).eq(DiagnosticType.Property);
    }
    expect(resultHasEntries, "expected rule to return an AsyncIterable with entries.").true;
  });

  it("IncompatibleValueTypePropertyOverride, different property types, rule passes.", async () => {
    await (testBaseClass as ECClass as MutableClass).createPrimitiveArrayProperty("TestProperty", PrimitiveType.String);
    await (testClass as ECClass as MutableClass).createPrimitiveProperty("TestProperty", PrimitiveType.Integer);

    const results = Rules.incompatibleValueTypePropertyOverride(testClass.properties![0] as PrimitiveProperty);
    for await (const _diagnostic of results)
      expect(false, "Rule should have passed").true;
  });

  it("IncompatibleValueTypePropertyOverride, same value types, rule passes.", async () => {
    await (testBaseClass as ECClass as MutableClass).createPrimitiveProperty("TestProperty", PrimitiveType.String);
    await (testClass as ECClass as MutableClass).createPrimitiveProperty("TestProperty", PrimitiveType.String);

    const results = Rules.incompatibleValueTypePropertyOverride(testClass.properties![0] as PrimitiveProperty);
    for await (const _diagnostic of results)
      expect(false, "Rule should have passed").true;
  });

  it("IncompatibleValueTypePropertyOverride, same array value types, rule passes.", async () => {
    await (testBaseClass as ECClass as MutableClass).createPrimitiveArrayProperty("TestProperty", PrimitiveType.String);
    await (testClass as ECClass as MutableClass).createPrimitiveArrayProperty("TestProperty", PrimitiveType.String);

    const results = Rules.incompatibleValueTypePropertyOverride(testClass.properties![0] as PrimitiveProperty);
    for await (const _diagnostic of results)
      expect(false, "Rule should have passed").true;
  });

  it("IncompatibleValueTypePropertyOverride, non-primitive type, rule passes.", async () => {
    await (testBaseClass as ECClass as MutableClass).createStructProperty("TestProperty", new StructClass(schema, "TestStruct"));
    await (testClass as ECClass as MutableClass).createStructProperty("TestProperty", new StructClass(schema, "TestStruct"));

    const results = Rules.incompatibleValueTypePropertyOverride(testClass.properties![0] as PrimitiveProperty);
    for await (const _diagnostic of results)
      expect(false, "Rule should have passed").true;
  });

  it("IncompatibleValueTypePropertyOverride, no base class, rule passes.", async () => {
    const entityClass = new EntityClass(new Schema(new SchemaContext(), "TestSchema", "ts", 1, 2, 3), "TestEntity");
    await (entityClass as ECClass as MutableClass).createPrimitiveProperty("TestProperty", PrimitiveType.Integer);

    const results = Rules.incompatibleValueTypePropertyOverride(entityClass.properties![0] as PrimitiveProperty);
    for await (const _diagnostic of results)
      expect(false, "Rule should have passed").true;
  });

  it("IncompatibleTypePropertyOverride, rule violated.", async () => {
    await (testBaseClass as ECClass as MutableClass).createPrimitiveArrayProperty("TestProperty", PrimitiveType.String);
    await (testClass as ECClass as MutableClass).createPrimitiveProperty("TestProperty", PrimitiveType.Integer);

    const results = Rules.incompatibleTypePropertyOverride(testClass.properties![0] as PrimitiveProperty);

    let resultHasEntries = false;
    for await (const diagnostic of results) {
      resultHasEntries = true;
      expect(diagnostic.ecDefinition).eq(testClass.properties![0]);
      expect(diagnostic.messageArgs).deep.eq([testClass.fullName, "TestProperty", testBaseClass.fullName, "PrimitiveArrayProperty", "PrimitiveProperty"]);
      expect(diagnostic.messageText)
        .eq(`The ECProperty '${testClass.fullName}.TestProperty' has a base property '${testBaseClass.fullName}.TestProperty' with a type of PrimitiveArrayProperty which is incompatible with the type of PrimitiveProperty.`);
      expect(diagnostic.category).eq(DiagnosticCategory.Error);
      expect(diagnostic.code).eq(Rules.DiagnosticCodes.IncompatibleTypePropertyOverride);
      expect(diagnostic.diagnosticType).eq(DiagnosticType.Property);
    }
    expect(resultHasEntries, "expected rule to return an AsyncIterable with entries.").true;
  });

  it("IncompatibleTypePropertyOverride, multiple base classes, rule violated.", async () => {
    const rootBaseClass = new EntityClass(schema, "RootBaseClass");
    await (rootBaseClass as ECClass as MutableClass).createPrimitiveArrayProperty("TestProperty", PrimitiveType.String);
    await (testClass as ECClass as MutableClass).createPrimitiveProperty("TestProperty", PrimitiveType.String);
    testBaseClass.baseClass = new DelayedPromiseWithProps(rootBaseClass.key, async () => rootBaseClass);

    const results = Rules.incompatibleTypePropertyOverride(testClass.properties![0] as PrimitiveProperty);

    let resultHasEntries = false;
    for await (const diagnostic of results) {
      resultHasEntries = true;
      expect(diagnostic.ecDefinition).eq(testClass.properties![0]);
      expect(diagnostic.messageArgs).deep.eq([testClass.fullName, "TestProperty", rootBaseClass.fullName, "PrimitiveArrayProperty", "PrimitiveProperty"]);
      expect(diagnostic.messageText)
        .eq(`The ECProperty '${testClass.fullName}.TestProperty' has a base property '${rootBaseClass.fullName}.TestProperty' with a type of PrimitiveArrayProperty which is incompatible with the type of PrimitiveProperty.`);
      expect(diagnostic.category).eq(DiagnosticCategory.Error);
      expect(diagnostic.code).eq(Rules.DiagnosticCodes.IncompatibleTypePropertyOverride);
      expect(diagnostic.diagnosticType).eq(DiagnosticType.Property);
    }
    expect(resultHasEntries, "expected rule to return an AsyncIterable with entries.").true;
  });

  it("IncompatibleTypePropertyOverride, types compatible, rule passes.", async () => {
    await (testBaseClass as ECClass as MutableClass).createPrimitiveProperty("TestProperty", PrimitiveType.String);
    // different value type, but THIS rule should still pass
    await (testClass as ECClass as MutableClass).createPrimitiveProperty("TestProperty", PrimitiveType.Integer);

    const results = Rules.incompatibleTypePropertyOverride(testClass.properties![0] as PrimitiveProperty);
    for await (const _diagnostic of results)
      expect(false, "Rule should have passed").true;
  });

  it("IncompatibleTypePropertyOverride, no base class, rule passes.", async () => {
    const entityClass = new EntityClass(new Schema(new SchemaContext(), "TestSchema", "ts", 1, 2, 3), "TestEntity");
    await (entityClass as ECClass as MutableClass).createPrimitiveProperty("TestProperty", PrimitiveType.Integer);

    const results = Rules.incompatibleTypePropertyOverride(entityClass.properties![0] as PrimitiveProperty);
    for await (const _diagnostic of results)
      expect(false, "Rule should have passed").true;
  });

  it("IncompatibleUnitPropertyOverride, rule violated.", async () => {
    await (testBaseClass as ECClass as MutableClass).createPrimitiveProperty("TestProperty", PrimitiveType.String);
    await (testClass as ECClass as MutableClass).createPrimitiveProperty("TestProperty", PrimitiveType.Integer);

    const basePropJson: PropertyProps = {
      name: "TestProperty",
      type: "PrimitiveProperty",
      kindOfQuantity: "TestSchema.TestBaseKoQ",
    };

    const childPropJson: PropertyProps = {
      name: "TestProperty",
      type: "PrimitiveProperty",
      kindOfQuantity: "TestSchema.TestKoQ",
    };

    const baseProperty = testBaseClass.properties![0];
    await baseProperty.deserialize(basePropJson);

    const childProperty = testClass.properties![0];
    await childProperty.deserialize(childPropJson);

    const baseUnit = await (schema as MutableSchema).createUnit("BaseTestUnit");
    await testBaseKindOfQuantity.deserialize({
      persistenceUnit: "TestSchema.BaseTestUnit",
      relativeError: 5,
    });

    const childUnit = await (schema as MutableSchema).createUnit("TestUnit");
    await testKindOfQuantity.deserialize({
      persistenceUnit: "TestSchema.TestUnit",
      relativeError: 4,
    });

    const results = Rules.incompatibleUnitPropertyOverride(testClass.properties![0] as PrimitiveProperty);

    let resultHasEntries = false;
    for await (const diagnostic of results) {
      resultHasEntries = true;
      expect(diagnostic.ecDefinition).eq(testClass.properties![0]);
      expect(diagnostic.messageArgs).deep.eq([
        testClass.fullName, "TestProperty", testBaseClass.fullName,
        testBaseKindOfQuantity.fullName, baseUnit.fullName, childUnit.fullName, testKindOfQuantity.fullName,
      ]);
      expect(diagnostic.messageText)
        .eq(`The ECProperty '${testClass.fullName}.TestProperty' has a base property '${testBaseClass.fullName}.TestProperty' with KindOfQuantity '${testBaseKindOfQuantity.fullName}' with persistence unit '${baseUnit.fullName}' which is not the same as the persistence unit '${childUnit.fullName}' of the provided KindOfQuantity '${testKindOfQuantity.fullName}'.`);
      expect(diagnostic.category).eq(DiagnosticCategory.Error);
      expect(diagnostic.code).eq(Rules.DiagnosticCodes.IncompatibleUnitPropertyOverride);
      expect(diagnostic.diagnosticType).eq(DiagnosticType.Property);
    }
    expect(resultHasEntries, "expected rule to return an AsyncIterable with entries.").true;
  });

  it("IncompatibleUnitPropertyOverride, multiple base classes, rule violated.", async () => {
    const rootBaseClass = new EntityClass(schema, "RootBaseClass");
    await (rootBaseClass as ECClass as MutableClass).createPrimitiveProperty("TestProperty", PrimitiveType.String);
    await (testClass as ECClass as MutableClass).createPrimitiveProperty("TestProperty", PrimitiveType.Integer);
    testBaseClass.baseClass = new DelayedPromiseWithProps(rootBaseClass.key, async () => rootBaseClass);

    const basePropJson = {
      name: "TestProperty",
      type: "PrimitiveProperty",
      kindOfQuantity: "TestSchema.TestBaseKoQ",
    };

    const childPropJson = {
      name: "TestProperty",
      type: "PrimitiveProperty",
      kindOfQuantity: "TestSchema.TestKoQ",
    };

    const baseProperty = rootBaseClass.properties![0];
    await baseProperty.deserialize(basePropJson);

    const childProperty = testClass.properties![0];
    await childProperty.deserialize(childPropJson);

    const baseUnit = await (schema as MutableSchema).createUnit("BaseTestUnit");
    await testBaseKindOfQuantity.deserialize({
      persistenceUnit: "TestSchema.BaseTestUnit",
      relativeError: 5,
    });

    const childUnit = await (schema as MutableSchema).createUnit("TestUnit");
    await testKindOfQuantity.deserialize({
      persistenceUnit: "TestSchema.TestUnit",
      relativeError: 4,
    });

    const results = Rules.incompatibleUnitPropertyOverride(testClass.properties![0] as PrimitiveProperty);

    let resultHasEntries = false;
    for await (const diagnostic of results) {
      resultHasEntries = true;
      expect(diagnostic.ecDefinition).eq(testClass.properties![0]);
      expect(diagnostic.messageArgs).deep.eq([
        testClass.fullName, "TestProperty", rootBaseClass.fullName,
        testBaseKindOfQuantity.fullName, baseUnit.fullName, childUnit.fullName, testKindOfQuantity.fullName,
      ]);
      expect(diagnostic.messageText).eq(`The ECProperty '${testClass.fullName}.TestProperty' has a base property '${rootBaseClass.fullName}.TestProperty' with KindOfQuantity '${testBaseKindOfQuantity.fullName}' with persistence unit '${baseUnit.fullName}' which is not the same as the persistence unit '${childUnit.fullName}' of the provided KindOfQuantity '${testKindOfQuantity.fullName}'.`);
      expect(diagnostic.category).eq(DiagnosticCategory.Error);
      expect(diagnostic.code).eq(Rules.DiagnosticCodes.IncompatibleUnitPropertyOverride);
      expect(diagnostic.diagnosticType).eq(DiagnosticType.Property);
    }
    expect(resultHasEntries, "expected rule to return an AsyncIterable with entries.").true;
  });

  it("IncompatibleUnitPropertyOverride, same persistence units, rule passes", async () => {
    await (testBaseClass as ECClass as MutableClass).createPrimitiveProperty("TestProperty", PrimitiveType.String);
    await (testClass as ECClass as MutableClass).createPrimitiveProperty("TestProperty", PrimitiveType.Integer);

    const basePropJson = {
      name: "TestProperty",
      type: "PrimitiveProperty",
      kindOfQuantity: "TestSchema.TestBaseKoQ",
    };

    const childPropJson = {
      name: "TestProperty",
      type: "PrimitiveProperty",
      kindOfQuantity: "TestSchema.TestKoQ",
    };

    const baseProperty = testBaseClass.properties![0];
    await baseProperty.deserialize(basePropJson);

    const childProperty = testClass.properties![0];
    await childProperty.deserialize(childPropJson);

    await (schema as MutableSchema).createUnit("TestUnit");
    await testBaseKindOfQuantity.deserialize({
      persistenceUnit: "TestSchema.TestUnit",
      relativeError: 5,
    });

    await testKindOfQuantity.deserialize({
      persistenceUnit: "TestSchema.TestUnit",
      relativeError: 4,
    });

    const results = Rules.incompatibleUnitPropertyOverride(testClass.properties![0] as PrimitiveProperty);
    for await (const _diagnostic of results)
      expect(false, `Rule should have passed, instead recieved "${_diagnostic.messageText}"`).true;
  });

  it("IncompatibleUnitPropertyOverride, no base unit, rule passes", async () => {
    await (testBaseClass as ECClass as MutableClass).createPrimitiveProperty("TestProperty", PrimitiveType.String);
    await (testClass as ECClass as MutableClass).createPrimitiveProperty("TestProperty", PrimitiveType.String);

    const basePropJson = {
      name: "TestProperty",
      type: "PrimitiveProperty",
      kindOfQuantity: "TestSchema.TestBaseKoQ",
    };

    const childPropJson = {
      name: "TestProperty",
      type: "PrimitiveProperty",
      kindOfQuantity: "TestSchema.TestKoQ",
    };

    const baseProperty = testBaseClass.properties![0];
    await baseProperty.deserialize(basePropJson);

    const childProperty = testClass.properties![0];
    await childProperty.deserialize(childPropJson);

    await (schema as MutableSchema).createUnit("TestUnit");
    await testKindOfQuantity.deserialize({
      persistenceUnit: "TestSchema.TestUnit",
      relativeError: 4,
    });

    const results = Rules.incompatibleUnitPropertyOverride(testClass.properties![0] as PrimitiveProperty);
    for await (const _diagnostic of results)
      expect(false, "Rule should have passed").true;
  });

  it("IncompatibleUnitPropertyOverride, not a KOQ, rule passes.", async () => {
    await (testBaseClass as ECClass as MutableClass).createPrimitiveProperty("TestProperty", PrimitiveType.String);
    await (testClass as ECClass as MutableClass).createPrimitiveProperty("TestProperty", PrimitiveType.String);

    const basePropJson = {
      name: "TestProperty",
      type: "PrimitiveProperty",
    };

    const childPropJson = {
      name: "TestProperty",
      type: "PrimitiveProperty",
    };

    const baseProperty = testBaseClass.properties![0];
    await baseProperty.deserialize(basePropJson);

    const childProperty = testClass.properties![0];
    await childProperty.deserialize(childPropJson);

    const results = Rules.incompatibleUnitPropertyOverride(testClass.properties![0] as PrimitiveProperty);
    for await (const _diagnostic of results)
      expect(false, "Rule should have passed").true;
  });

  it("IncompatibleUnitPropertyOverride, incompatible property types, rule passes.", async () => {
    await (testBaseClass as ECClass as MutableClass).createPrimitiveProperty("TestProperty", PrimitiveType.String);
    await (testClass as ECClass as MutableClass).createPrimitiveArrayProperty("TestProperty", PrimitiveType.Integer);

    const basePropJson = {
      name: "TestProperty",
      type: "PrimitiveProperty",
      kindOfQuantity: "TestSchema.TestBaseKoQ",
    };

    const childPropJson = {
      name: "TestProperty",
      type: "PrimitiveArrayProperty",
      kindOfQuantity: "TestSchema.TestKoQ",
    };

    const baseProperty = testBaseClass.properties![0];
    await baseProperty.deserialize(basePropJson);

    const childProperty = testClass.properties![0];
    await childProperty.deserialize(childPropJson);

    await (schema as MutableSchema).createUnit("BaseTestUnit");
    await testBaseKindOfQuantity.deserialize({
      persistenceUnit: "TestSchema.BaseTestUnit",
      relativeError: 5,
    });

    await (schema as MutableSchema).createUnit("TestUnit");
    await testKindOfQuantity.deserialize({
      persistenceUnit: "TestSchema.TestUnit",
      relativeError: 4,
    });

    const results = Rules.incompatibleUnitPropertyOverride(testClass.properties![0] as PrimitiveProperty);
    for await (const _diagnostic of results)
      expect(false, "Rule should have passed").true;
  });
});
