/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/

import { beforeEach, describe, expect, it } from "vitest";
import { DelayedPromiseWithProps, EntityClass, Mixin, Schema, SchemaContext } from "@itwin/ecschema-metadata";
import { MutableEntityClass } from "../../../Editing/Mutable/MutableEntityClass";
import { DiagnosticCategory, DiagnosticType } from "../../../Validation/Diagnostic";
import * as Rules from "../../../Validation/ECRules";

/* eslint-disable deprecation/deprecation */

describe("Mixin Rule Tests", () => {
  let schema: Schema;

  beforeEach(async () => {
    schema = new Schema(new SchemaContext(), "TestSchema", "ts", 1, 0, 0);
  });

  class TestMixin extends Mixin {
    constructor(testSchema: Schema, name: string, appliesTo: EntityClass) {
      super(testSchema, name);
      this._appliesTo = new DelayedPromiseWithProps(appliesTo.key, async () => appliesTo);
    }
  }

  it("MixinAppliedToClassMustDeriveFromConstraint, entity derives from constraint, rule passes.", async () => {
    const constraintClass = new EntityClass(schema, "TestConstraint");
    const mixin = new TestMixin(schema, "TestMixin", constraintClass);
    const entityClass = new EntityClass(schema, "TestClass");
    (entityClass as MutableEntityClass).addMixin(mixin);
    entityClass.baseClass = new DelayedPromiseWithProps(constraintClass.key, async () => constraintClass);

    const result = Rules.mixinAppliedToClassMustDeriveFromConstraint(entityClass);
    for await (const _diagnostic of result) {
      expect(false, "Rule should have passed").toBe(true);
    }
  });

  it("MixinAppliedToClassMustDeriveFromConstraint, entity class is the constraint, rule passes.", async () => {
    const entityClass = new EntityClass(schema, "TestClass");
    const mixin = new TestMixin(schema, "TestMixin", entityClass);
    (entityClass as MutableEntityClass).addMixin(mixin);

    const result = Rules.mixinAppliedToClassMustDeriveFromConstraint(entityClass);
    for await (const _diagnostic of result) {
      expect(false, "Rule should have passed").toBe(true);
    }
  });

  it("MixinAppliedToClassMustDeriveFromConstraint, entity has no base class and class is not the constraint, rule violated.", async () => {
    const constraintClass = new EntityClass(schema, "TestConstraint");
    const mixin = new TestMixin(schema, "TestMixin", constraintClass);
    const entityClass = new EntityClass(schema, "TestClass");
    (entityClass as MutableEntityClass).addMixin(mixin);

    const result = Rules.mixinAppliedToClassMustDeriveFromConstraint(entityClass);

    let resultHasEntries = false;
    for await (const diagnostic of result) {
      resultHasEntries = true;
      expect(diagnostic.ecDefinition).toBe(entityClass);
      expect(diagnostic.messageArgs).toEqual([mixin.fullName, entityClass.fullName, mixin.appliesTo!.fullName]);
      expect(diagnostic.category).toBe(DiagnosticCategory.Error);
      expect(diagnostic.code).toBe(Rules.DiagnosticCodes.MixinAppliedToClassMustDeriveFromConstraint);
      expect(diagnostic.diagnosticType).toBe(DiagnosticType.SchemaItem);
    }
    expect(resultHasEntries, "expected rule to return an AsyncIterable with entries.").toBe(true);
  });

  it("MixinAppliedToClassMustDeriveFromConstraint, entity base incompatible with constraint, rule violated.", async () => {
    const constraintClass = new EntityClass(schema, "TestConstraint");
    const baseClass = new EntityClass(schema, "TestBase");
    const mixin = new TestMixin(schema, "TestMixin", constraintClass);
    const entityClass = new EntityClass(schema, "TestClass");
    (entityClass as MutableEntityClass).addMixin(mixin);
    entityClass.baseClass = new DelayedPromiseWithProps(baseClass.key, async () => baseClass);

    const result = Rules.mixinAppliedToClassMustDeriveFromConstraint(entityClass);

    let resultHasEntries = false;
    for await (const diagnostic of result) {
      resultHasEntries = true;
      expect(diagnostic.ecDefinition).toBe(entityClass);
      expect(diagnostic.messageArgs).toEqual([mixin.fullName, entityClass.fullName, mixin.appliesTo!.fullName]);
      expect(diagnostic.category).toBe(DiagnosticCategory.Error);
      expect(diagnostic.code).toBe(Rules.DiagnosticCodes.MixinAppliedToClassMustDeriveFromConstraint);
      expect(diagnostic.diagnosticType).toBe(DiagnosticType.SchemaItem);
    }
    expect(resultHasEntries, "expected rule to return an AsyncIterable with entries.").toBe(true);
  });
});
