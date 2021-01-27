/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/

import { expect } from "chai";
import { DelayedPromiseWithProps, ECClassModifier, RelationshipClass, SchemaContext, schemaItemTypeToString } from "../../../src/ecschema-metadata";
import { EntityClass } from "../../../src/Metadata/EntityClass";
import { Schema } from "../../../src/Metadata/Schema";
import { DiagnosticCategory, DiagnosticType } from "../../../src/Validation/Diagnostic";
import * as Rules from "../../../src/Validation/ECRules";

describe("ClassRule tests", () => {
  let schema: Schema;

  beforeEach(async () => {
    schema = new Schema(new SchemaContext(), "TestSchema", "ts", 1, 0, 0);
  });

  it("BaseClassIsSealed, rule violated.", async () => {
    const baseClass = new EntityClass(schema, "TestBase", ECClassModifier.Sealed);
    const entityClass = new EntityClass(schema, "TestClass");
    entityClass.baseClass = new DelayedPromiseWithProps(baseClass.key, async () => baseClass);

    const result = Rules.baseClassIsSealed(entityClass);

    expect(result).not.undefined;
    let resultHasEntries = false;
    for await (const diagnostic of result!) {
      resultHasEntries = true;
      expect(diagnostic).to.not.be.undefined;
      expect(diagnostic!.ecDefinition).to.equal(entityClass);
      expect(diagnostic!.messageArgs).to.eql([entityClass.fullName, baseClass.fullName]);
      expect(diagnostic!.category).to.equal(DiagnosticCategory.Error);
      expect(diagnostic!.code).to.equal(Rules.DiagnosticCodes.BaseClassIsSealed);
      expect(diagnostic!.diagnosticType).to.equal(DiagnosticType.SchemaItem);
    }
    expect(resultHasEntries, "expected rule to return an AsyncIterable with entries.").to.be.true;
  });

  it("BaseClassIsSealed, base is not sealed, rule passes.", async () => {
    const baseClass = new EntityClass(schema, "TestBase");
    const entityClass = new EntityClass(schema, "TestClass");
    entityClass.baseClass = new DelayedPromiseWithProps(baseClass.key, async () => baseClass);

    const result = Rules.baseClassIsSealed(entityClass);

    for await (const _diagnostic of result!) {
      expect(false, "Rule should have passed").to.be.true;
    }
  });

  it("BaseClassIsSealed, no base class, rule passes.", async () => {
    const entityClass = new EntityClass(schema, "TestClass");

    const result = Rules.baseClassIsSealed(entityClass);

    for await (const _diagnostic of result!) {
      expect(false, "Rule should have passed").to.be.true;
    }
  });

  it("BaseClassIsOfDifferentType, rule violated.", async () => {
    const baseClass = new RelationshipClass(schema, "TestBase");
    const entityClass = new EntityClass(schema, "TestClass");
    entityClass.baseClass = new DelayedPromiseWithProps(baseClass.key, async () => baseClass);
    const baseType = schemaItemTypeToString(baseClass.schemaItemType);

    const result = Rules.baseClassIsOfDifferentType(entityClass);
    expect(result).not.undefined;
    let resultHasEntries = false;
    for await (const diagnostic of result!) {
      resultHasEntries = true;
      expect(diagnostic).to.not.be.undefined;
      expect(diagnostic!.ecDefinition).to.equal(entityClass);
      expect(diagnostic!.messageArgs).to.eql([entityClass.fullName, baseClass.fullName, baseType]);
      expect(diagnostic!.category).to.equal(DiagnosticCategory.Error);
      expect(diagnostic!.code).to.equal(Rules.DiagnosticCodes.BaseClassOfDifferentType);
      expect(diagnostic!.diagnosticType).to.equal(DiagnosticType.SchemaItem);
    }
    expect(resultHasEntries, "expected rule to return an AsyncIterable with entries.").to.be.true;
  });

  it("BaseClassIsOfDifferentType, same type, rule passes.", async () => {
    const baseClass = new EntityClass(schema, "TestBase");
    const entityClass = new EntityClass(schema, "TestClass");
    entityClass.baseClass = new DelayedPromiseWithProps(baseClass.key, async () => baseClass);

    const result = Rules.baseClassIsOfDifferentType(entityClass);

    for await (const _diagnostic of result!) {
      expect(false, "Rule should have passed").to.be.true;
    }
  });

  it("BaseClassIsOfDifferentType, no base class, rule passes.", async () => {
    const entityClass = new EntityClass(schema, "TestClass");

    const result = Rules.baseClassIsOfDifferentType(entityClass);

    for await (const _diagnostic of result!) {
      expect(false, "Rule should have passed").to.be.true;
    }
  });

  it("AbstractClassWithNonAbstractBase, base class is sealed, rule violated.", async () => {
    const baseClass = new EntityClass(schema, "TestBase", ECClassModifier.Sealed);
    const entityClass = new EntityClass(schema, "TestClass", ECClassModifier.Abstract);
    entityClass.baseClass = new DelayedPromiseWithProps(baseClass.key, async () => baseClass);
    const baseType = schemaItemTypeToString(baseClass.schemaItemType);

    const result = Rules.abstractClassWithNonAbstractBase(entityClass);
    expect(result).not.undefined;
    let resultHasEntries = false;
    for await (const diagnostic of result!) {
      resultHasEntries = true;
      expect(diagnostic).to.not.be.undefined;
      expect(diagnostic!.ecDefinition).to.equal(entityClass);
      expect(diagnostic!.messageArgs).to.eql([entityClass.fullName, baseClass.fullName]);
      expect(diagnostic!.category).to.equal(DiagnosticCategory.Error);
      expect(diagnostic!.code).to.equal(Rules.DiagnosticCodes.AbstractClassWithNonAbstractBase);
      expect(diagnostic!.diagnosticType).to.equal(DiagnosticType.SchemaItem);
    }
    expect(resultHasEntries, "expected rule to return an AsyncIterable with entries.").to.be.true;
  });

  it("AbstractClassWithNonAbstractBase, base class modifier is `none`, rule violated.", async () => {
    const baseClass = new EntityClass(schema, "TestBase", ECClassModifier.None);
    const entityClass = new EntityClass(schema, "TestClass", ECClassModifier.Abstract);
    entityClass.baseClass = new DelayedPromiseWithProps(baseClass.key, async () => baseClass);

    const result = Rules.abstractClassWithNonAbstractBase(entityClass);
    expect(result).not.undefined;
    let resultHasEntries = false;
    for await (const diagnostic of result!) {
      resultHasEntries = true;
      expect(diagnostic).to.not.be.undefined;
      expect(diagnostic!.ecDefinition).to.equal(entityClass);
      expect(diagnostic!.messageArgs).to.eql([entityClass.fullName, baseClass.fullName]);
      expect(diagnostic!.category).to.equal(DiagnosticCategory.Error);
      expect(diagnostic!.code).to.equal(Rules.DiagnosticCodes.AbstractClassWithNonAbstractBase);
      expect(diagnostic!.diagnosticType).to.equal(DiagnosticType.SchemaItem);
    }
    expect(resultHasEntries, "expected rule to return an AsyncIterable with entries.").to.be.true;
  });

  it("AbstractClassWithNonAbstractBase, no base class, rule passes.", async () => {
    const entityClass = new EntityClass(schema, "TestClass", ECClassModifier.Abstract);

    const result = Rules.abstractClassWithNonAbstractBase(entityClass);

    for await (const _diagnostic of result!) {
      expect(false, "Rule should have passed").to.be.true;
    }
  });

  it("AbstractClassWithNonAbstractBase, base class is abstract, rule passes.", async () => {
    const baseClass = new EntityClass(schema, "TestBase", ECClassModifier.Abstract);
    const entityClass = new EntityClass(schema, "TestClass", ECClassModifier.Abstract);
    entityClass.baseClass = new DelayedPromiseWithProps(baseClass.key, async () => baseClass);

    const result = Rules.abstractClassWithNonAbstractBase(entityClass);

    for await (const _diagnostic of result!) {
      expect(false, "Rule should have passed").to.be.true;
    }
  });

  it("AbstractClassWithNonAbstractBase, class is not abstract, rule passes.", async () => {
    const baseClass = new EntityClass(schema, "TestBase", ECClassModifier.Sealed);
    const entityClass = new EntityClass(schema, "TestClass", ECClassModifier.None);
    entityClass.baseClass = new DelayedPromiseWithProps(baseClass.key, async () => baseClass);

    const result = Rules.abstractClassWithNonAbstractBase(entityClass);

    for await (const _diagnostic of result!) {
      expect(false, "Rule should have passed").to.be.true;
    }
  });
});
