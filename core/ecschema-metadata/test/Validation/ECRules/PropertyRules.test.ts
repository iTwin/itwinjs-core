/*---------------------------------------------------------------------------------------------
* Copyright (c) 2019 Bentley Systems, Incorporated. All rights reserved.
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
import { Unit } from "../../../src/Metadata/Unit";
import { DiagnosticCategory, DiagnosticType } from "../../../src/Validation/Diagnostic";
import * as Rules from "../../../src/Validation/ECRules";

describe("PropertyRule tests", () => {
  let schema: Schema;
  let context: SchemaContext;
  let testClass: EntityClass;
  let testBaseClass: EntityClass;
  let testKindOfQuantity: KindOfQuantity;
  let testBaseKindOfQuantity: KindOfQuantity;

  beforeEach(async () => {
    context = new SchemaContext();
    schema = new Schema(context, "TestSchema", 1, 0, 0);
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

    const result = await Rules.incompatibleValueTypePropertyOverride(testClass.properties![0] as PrimitiveProperty);

    let resultHasEntries = false;
    for await (const diagnostic of result!) {
      resultHasEntries = true;
      expect(diagnostic).to.not.be.undefined;
      expect(diagnostic!.ecDefinition).to.equal(testClass.properties![0]);
      expect(diagnostic!.messageArgs).to.eql([testClass.fullName, "TestProperty", testBaseClass.fullName, "string", "int"]);
      expect(diagnostic!.category).to.equal(DiagnosticCategory.Error);
      expect(diagnostic!.code).to.equal(Rules.DiagnosticCodes.IncompatibleValueTypePropertyOverride);
      expect(diagnostic!.diagnosticType).to.equal(DiagnosticType.Property);
    }
    expect(resultHasEntries, "expected rule to return an AsyncIterable with entries.").to.be.true;
  });

  it("IncompatibleValueTypePropertyOverride, multiple base classes, rule violated.", async () => {
    const rootBaseClass = new EntityClass(schema, "RootBaseClass");
    await (rootBaseClass as ECClass as MutableClass).createPrimitiveProperty("TestProperty", PrimitiveType.String);
    await (testClass as ECClass as MutableClass).createPrimitiveProperty("TestProperty", PrimitiveType.Integer);
    testBaseClass.baseClass = new DelayedPromiseWithProps(rootBaseClass.key, async () => rootBaseClass);

    const result = await Rules.incompatibleValueTypePropertyOverride(testClass.properties![0] as PrimitiveProperty);

    let resultHasEntries = false;
    for await (const diagnostic of result!) {
      resultHasEntries = true;
      expect(diagnostic).to.not.be.undefined;
      expect(diagnostic!.ecDefinition).to.equal(testClass.properties![0]);
      expect(diagnostic!.messageArgs).to.eql([testClass.fullName, "TestProperty", rootBaseClass.fullName, "string", "int"]);
      expect(diagnostic!.category).to.equal(DiagnosticCategory.Error);
      expect(diagnostic!.code).to.equal(Rules.DiagnosticCodes.IncompatibleValueTypePropertyOverride);
      expect(diagnostic!.diagnosticType).to.equal(DiagnosticType.Property);
    }
    expect(resultHasEntries, "expected rule to return an AsyncIterable with entries.").to.be.true;
  });

  it("IncompatibleValueTypePropertyOverride, different property types, rule passes.", async () => {
    await (testBaseClass as ECClass as MutableClass).createPrimitiveArrayProperty("TestProperty", PrimitiveType.String);
    await (testClass as ECClass as MutableClass).createPrimitiveProperty("TestProperty", PrimitiveType.Integer);

    const result = await Rules.incompatibleValueTypePropertyOverride(testClass.properties![0] as PrimitiveProperty);

    for await (const _diagnostic of result!) {
      expect(false, "Rule should have passed").to.be.true;
    }
  });

  it("IncompatibleValueTypePropertyOverride, same value types, rule passes.", async () => {
    await (testBaseClass as ECClass as MutableClass).createPrimitiveProperty("TestProperty", PrimitiveType.String);
    await (testClass as ECClass as MutableClass).createPrimitiveProperty("TestProperty", PrimitiveType.String);

    const result = await Rules.incompatibleValueTypePropertyOverride(testClass.properties![0] as PrimitiveProperty);

    for await (const _diagnostic of result!) {
      expect(false, "Rule should have passed").to.be.true;
    }
  });

  it("IncompatibleValueTypePropertyOverride, same array value types, rule passes.", async () => {
    await (testBaseClass as ECClass as MutableClass).createPrimitiveArrayProperty("TestProperty", PrimitiveType.String);
    await (testClass as ECClass as MutableClass).createPrimitiveArrayProperty("TestProperty", PrimitiveType.String);

    const result = await Rules.incompatibleValueTypePropertyOverride(testClass.properties![0] as PrimitiveProperty);

    for await (const _diagnostic of result!) {
      expect(false, "Rule should have passed").to.be.true;
    }
  });

  it("IncompatibleValueTypePropertyOverride, non-primitive type, rule passes.", async () => {
    await (testBaseClass as ECClass as MutableClass).createStructProperty("TestProperty", new StructClass(schema, "TestStruct"));
    await (testClass as ECClass as MutableClass).createStructProperty("TestProperty", new StructClass(schema, "TestStruct"));

    const result = await Rules.incompatibleValueTypePropertyOverride(testClass.properties![0] as PrimitiveProperty);

    for await (const _diagnostic of result!) {
      expect(false, "Rule should have passed").to.be.true;
    }
  });

  it("IncompatibleValueTypePropertyOverride, no base class, rule passes.", async () => {
    const entityClass = new EntityClass(new Schema(new SchemaContext(), "TestSchema", 1, 2, 3), "TestEntity");
    await (entityClass as ECClass as MutableClass).createPrimitiveProperty("TestProperty", PrimitiveType.Integer);

    const result = await Rules.incompatibleValueTypePropertyOverride(entityClass.properties![0] as PrimitiveProperty);

    for await (const _diagnostic of result!) {
      expect(false, "Rule should have passed").to.be.true;
    }
  });

  it("IncompatibleTypePropertyOverride, rule violated.", async () => {
    await (testBaseClass as ECClass as MutableClass).createPrimitiveArrayProperty("TestProperty", PrimitiveType.String);
    await (testClass as ECClass as MutableClass).createPrimitiveProperty("TestProperty", PrimitiveType.Integer);

    const result = await Rules.incompatibleTypePropertyOverride(testClass.properties![0] as PrimitiveProperty);

    let resultHasEntries = false;
    for await (const diagnostic of result!) {
      resultHasEntries = true;
      expect(diagnostic).to.not.be.undefined;
      expect(diagnostic!.ecDefinition).to.equal(testClass.properties![0]);
      expect(diagnostic!.messageArgs).to.eql([testClass.fullName, "TestProperty", testBaseClass.fullName, "PrimitiveArrayProperty", "PrimitiveProperty"]);
      expect(diagnostic!.category).to.equal(DiagnosticCategory.Error);
      expect(diagnostic!.code).to.equal(Rules.DiagnosticCodes.IncompatibleTypePropertyOverride);
      expect(diagnostic!.diagnosticType).to.equal(DiagnosticType.Property);
    }
    expect(resultHasEntries, "expected rule to return an AsyncIterable with entries.").to.be.true;
  });

  it("IncompatibleTypePropertyOverride, multiple base classes, rule violated.", async () => {
    const rootBaseClass = new EntityClass(schema, "RootBaseClass");
    await (rootBaseClass as ECClass as MutableClass).createPrimitiveArrayProperty("TestProperty", PrimitiveType.String);
    await (testClass as ECClass as MutableClass).createPrimitiveProperty("TestProperty", PrimitiveType.String);
    testBaseClass.baseClass = new DelayedPromiseWithProps(rootBaseClass.key, async () => rootBaseClass);

    const result = await Rules.incompatibleTypePropertyOverride(testClass.properties![0] as PrimitiveProperty);

    let resultHasEntries = false;
    for await (const diagnostic of result!) {
      resultHasEntries = true;
      expect(diagnostic).to.not.be.undefined;
      expect(diagnostic!.ecDefinition).to.equal(testClass.properties![0]);
      expect(diagnostic!.messageArgs).to.eql([testClass.fullName, "TestProperty", rootBaseClass.fullName, "PrimitiveArrayProperty", "PrimitiveProperty"]);
      expect(diagnostic!.category).to.equal(DiagnosticCategory.Error);
      expect(diagnostic!.code).to.equal(Rules.DiagnosticCodes.IncompatibleTypePropertyOverride);
      expect(diagnostic!.diagnosticType).to.equal(DiagnosticType.Property);
    }
    expect(resultHasEntries, "expected rule to return an AsyncIterable with entries.").to.be.true;
  });

  it("IncompatibleTypePropertyOverride, types compatible, rule passes.", async () => {
    await (testBaseClass as ECClass as MutableClass).createPrimitiveProperty("TestProperty", PrimitiveType.String);
    // different value type, but THIS rule should still pass
    await (testClass as ECClass as MutableClass).createPrimitiveProperty("TestProperty", PrimitiveType.Integer);

    const result = await Rules.incompatibleTypePropertyOverride(testClass.properties![0] as PrimitiveProperty);

    for await (const _diagnostic of result!) {
      expect(false, "Rule should have passed").to.be.true;
    }
  });

  it("IncompatibleTypePropertyOverride, no base class, rule passes.", async () => {
    const entityClass = new EntityClass(new Schema(new SchemaContext(), "TestSchema", 1, 2, 3), "TestEntity");
    await (entityClass as ECClass as MutableClass).createPrimitiveProperty("TestProperty", PrimitiveType.Integer);

    const result = await Rules.incompatibleTypePropertyOverride(entityClass.properties![0] as PrimitiveProperty);

    for await (const _diagnostic of result!) {
      expect(false, "Rule should have passed").to.be.true;
    }
  });

  it("IncompatibleUnitPropertyOverride, rule violated.", async () => {
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
    baseProperty.deserialize(basePropJson);

    const childProperty = testClass.properties![0];
    childProperty.deserialize(childPropJson);

    const baseUnit = new Unit(schema, "BaseTestUnit");
    testBaseKindOfQuantity.persistenceUnit = new DelayedPromiseWithProps(baseUnit.key, async () => baseUnit);

    const childUnit = new Unit(schema, "TestUnit");
    testKindOfQuantity.persistenceUnit = new DelayedPromiseWithProps(childUnit.key, async () => childUnit);

    const result = await Rules.incompatibleUnitPropertyOverride(testClass.properties![0] as PrimitiveProperty);

    let resultHasEntries = false;
    for await (const diagnostic of result!) {
      resultHasEntries = true;
      expect(diagnostic).to.not.be.undefined;
      expect(diagnostic!.ecDefinition).to.equal(testClass.properties![0]);
      expect(diagnostic!.messageArgs).to.eql([
        testClass.fullName, "TestProperty", testBaseClass.fullName,
        testBaseKindOfQuantity.fullName, baseUnit.fullName, childUnit.fullName, testKindOfQuantity.fullName,
      ]);
      expect(diagnostic!.category).to.equal(DiagnosticCategory.Error);
      expect(diagnostic!.code).to.equal(Rules.DiagnosticCodes.IncompatibleUnitPropertyOverride);
      expect(diagnostic!.diagnosticType).to.equal(DiagnosticType.Property);
    }
    expect(resultHasEntries, "expected rule to return an AsyncIterable with entries.").to.be.true;
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
    baseProperty.deserialize(basePropJson);

    const childProperty = testClass.properties![0];
    childProperty.deserialize(childPropJson);

    const baseUnit = new Unit(schema, "BaseTestUnit");
    testBaseKindOfQuantity.persistenceUnit = new DelayedPromiseWithProps(baseUnit.key, async () => baseUnit);

    const childUnit = new Unit(schema, "TestUnit");
    testKindOfQuantity.persistenceUnit = new DelayedPromiseWithProps(childUnit.key, async () => childUnit);

    const result = await Rules.incompatibleUnitPropertyOverride(testClass.properties![0] as PrimitiveProperty);

    let resultHasEntries = false;
    for await (const diagnostic of result!) {
      resultHasEntries = true;
      expect(diagnostic).to.not.be.undefined;
      expect(diagnostic!.ecDefinition).to.equal(testClass.properties![0]);
      expect(diagnostic!.messageArgs).to.eql([
        testClass.fullName, "TestProperty", rootBaseClass.fullName,
        testBaseKindOfQuantity.fullName, baseUnit.fullName, childUnit.fullName, testKindOfQuantity.fullName,
      ]);
      expect(diagnostic!.category).to.equal(DiagnosticCategory.Error);
      expect(diagnostic!.code).to.equal(Rules.DiagnosticCodes.IncompatibleUnitPropertyOverride);
      expect(diagnostic!.diagnosticType).to.equal(DiagnosticType.Property);
    }
    expect(resultHasEntries, "expected rule to return an AsyncIterable with entries.").to.be.true;
  });

  it("IncompatibleUnitPropertyOverride, compatible units, rule passes.", async () => {
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
    baseProperty.deserialize(basePropJson);

    const childProperty = testClass.properties![0];
    childProperty.deserialize(childPropJson);

    const baseUnit = new Unit(schema, "TestUnit");
    testBaseKindOfQuantity.persistenceUnit = new DelayedPromiseWithProps(baseUnit.key, async () => baseUnit);

    const childUnit = new Unit(schema, "TestUnit");
    testKindOfQuantity.persistenceUnit = new DelayedPromiseWithProps(childUnit.key, async () => childUnit);

    const result = await Rules.incompatibleUnitPropertyOverride(testClass.properties![0] as PrimitiveProperty);

    for await (const _diagnostic of result!) {
      expect(false, "Rule should have passed").to.be.true;
    }
  });

  it("IncompatibleUnitPropertyOverride, no base unit, rule passes.", async () => {
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
    baseProperty.deserialize(basePropJson);

    const childProperty = testClass.properties![0];
    childProperty.deserialize(childPropJson);

    const childUnit = new Unit(schema, "TestUnit");
    testKindOfQuantity.persistenceUnit = new DelayedPromiseWithProps(childUnit.key, async () => childUnit);

    const result = await Rules.incompatibleUnitPropertyOverride(testClass.properties![0] as PrimitiveProperty);

    for await (const _diagnostic of result!) {
      expect(false, "Rule should have passed").to.be.true;
    }
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
    baseProperty.deserialize(basePropJson);

    const childProperty = testClass.properties![0];
    childProperty.deserialize(childPropJson);

    const result = await Rules.incompatibleUnitPropertyOverride(testClass.properties![0] as PrimitiveProperty);

    for await (const _diagnostic of result!) {
      expect(false, "Rule should have passed").to.be.true;
    }
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
    baseProperty.deserialize(basePropJson);

    const childProperty = testClass.properties![0];
    childProperty.deserialize(childPropJson);

    const baseUnit = new Unit(schema, "TestUnit");
    testBaseKindOfQuantity.persistenceUnit = new DelayedPromiseWithProps(baseUnit.key, async () => baseUnit);

    const childUnit = new Unit(schema, "TestUnit");
    testKindOfQuantity.persistenceUnit = new DelayedPromiseWithProps(childUnit.key, async () => childUnit);

    const result = await Rules.incompatibleUnitPropertyOverride(testClass.properties![0] as PrimitiveProperty);

    for await (const _diagnostic of result!) {
      expect(false, "Rule should have passed").to.be.true;
    }
  });
});
