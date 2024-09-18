/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/

import { beforeEach, describe, expect, it } from "vitest";
import { DelayedPromiseWithProps, ECClassModifier, EntityClass,
  RelationshipClass, Schema, SchemaContext, schemaItemTypeToString,
} from "@itwin/ecschema-metadata";
import * as Rules from "../../../Validation/ECRules";
import { DiagnosticCategory, DiagnosticType } from "../../../Validation/Diagnostic";

/* eslint-disable deprecation/deprecation */

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

    expect(result).not.toBeUndefined();
    let resultHasEntries = false;
    for await (const diagnostic of result) {
      resultHasEntries = true;
      expect(diagnostic.ecDefinition).toBe(entityClass);
      expect(diagnostic.messageArgs).toEqual([entityClass.fullName, baseClass.fullName]);
      expect(diagnostic.category).toBe(DiagnosticCategory.Error);
      expect(diagnostic.code).toBe(Rules.DiagnosticCodes.BaseClassIsSealed);
      expect(diagnostic.diagnosticType).toBe(DiagnosticType.SchemaItem);
    }
    expect(resultHasEntries, "expected rule to return an AsyncIterable with entries.").toBe(true);
  });

  it("BaseClassIsSealed, base is not sealed, rule passes.", async () => {
    const baseClass = new EntityClass(schema, "TestBase");
    const entityClass = new EntityClass(schema, "TestClass");
    entityClass.baseClass = new DelayedPromiseWithProps(baseClass.key, async () => baseClass);

    const result = Rules.baseClassIsSealed(entityClass);
    for await (const _diagnostic of result) {
      expect(false, "Rule should have passed").toBe(true);
    }
  });

  it("BaseClassIsSealed, no base class, rule passes.", async () => {
    const entityClass = new EntityClass(schema, "TestClass");

    const result = Rules.baseClassIsSealed(entityClass);
    for await (const _diagnostic of result) {
      expect(false, "Rule should have passed").toBe(true);
    }
  });

  it("BaseClassIsOfDifferentType, rule violated.", async () => {
    const baseClass = new RelationshipClass(schema, "TestBase");
    const entityClass = new EntityClass(schema, "TestClass");
    entityClass.baseClass = new DelayedPromiseWithProps(baseClass.key, async () => baseClass);
    const baseType = schemaItemTypeToString(baseClass.schemaItemType);

    const result = Rules.baseClassIsOfDifferentType(entityClass);
    expect(result).not.toBeUndefined();
    let resultHasEntries = false;
    for await (const diagnostic of result) {
      resultHasEntries = true;
      expect(diagnostic.ecDefinition).toBe(entityClass);
      expect(diagnostic.messageArgs).toEqual([entityClass.fullName, baseClass.fullName, baseType]);
      expect(diagnostic.category).toBe(DiagnosticCategory.Error);
      expect(diagnostic.code).toBe(Rules.DiagnosticCodes.BaseClassOfDifferentType);
      expect(diagnostic.diagnosticType).toBe(DiagnosticType.SchemaItem);
    }
    expect(resultHasEntries, "expected rule to return an AsyncIterable with entries.").toBe(true);
  });

  it("BaseClassIsOfDifferentType, same type, rule passes.", async () => {
    const baseClass = new EntityClass(schema, "TestBase");
    const entityClass = new EntityClass(schema, "TestClass");
    entityClass.baseClass = new DelayedPromiseWithProps(baseClass.key, async () => baseClass);

    const result = Rules.baseClassIsOfDifferentType(entityClass);
    for await (const _diagnostic of result) {
      expect(false, "Rule should have passed").toBe(true);
    }
  });

  it("BaseClassIsOfDifferentType, no base class, rule passes.", async () => {
    const entityClass = new EntityClass(schema, "TestClass");

    const result = Rules.baseClassIsOfDifferentType(entityClass);
    for await (const _diagnostic of result) {
      expect(false, "Rule should have passed").toBe(true);
    }
  });
});
