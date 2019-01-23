/*---------------------------------------------------------------------------------------------
* Copyright (c) 2019 Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/

import { expect } from "chai";
import * as Rules from "../../../src/Validation/ECRules";
import { Schema } from "../../../src/Metadata/Schema";
import { EntityClass, MutableEntityClass } from "../../../src/Metadata/EntityClass";
import { DiagnosticCategory, DiagnosticCode, DiagnosticType } from "../../../src/Validation/Diagnostic";
import { DelayedPromiseWithProps } from "../../../src/DelayedPromise";
import { Mixin } from "../../../src/Metadata/Mixin";

describe("Mixin Rule Tests", () => {
  let schema: Schema;

  beforeEach(async () => {
    schema = new Schema("TestSchema", 1, 0, 0);
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

    const result = await Rules.mixinAppliedToClassMustDeriveFromConstraint(entityClass);

    for await (const _diagnostic of result!) {
      expect(false, "Rule should have passed").to.be.true;
    }
  });

  it("MixinAppliedToClassMustDeriveFromConstraint, entity class is the constraint, rule passes.", async () => {
    const entityClass = new EntityClass(schema, "TestClass");
    const mixin = new TestMixin(schema, "TestMixin", entityClass);
    (entityClass as MutableEntityClass).addMixin(mixin);

    const result = await Rules.mixinAppliedToClassMustDeriveFromConstraint(entityClass);

    for await (const _diagnostic of result!) {
      expect(false, "Rule should have passed").to.be.true;
    }
  });

  it("MixinAppliedToClassMustDeriveFromConstraint, entity has no base class and class is not the constraint, rule violated.", async () => {
    const constraintClass = new EntityClass(schema, "TestConstraint");
    const mixin = new TestMixin(schema, "TestMixin", constraintClass);
    const entityClass = new EntityClass(schema, "TestClass");
    (entityClass as MutableEntityClass).addMixin(mixin);

    const result = await Rules.mixinAppliedToClassMustDeriveFromConstraint(entityClass);

    let resultHasEntries = false;
    for await (const diagnostic of result!) {
      resultHasEntries = true;
      expect(diagnostic).to.not.be.undefined;
      expect(diagnostic!.ecDefinition).to.equal(entityClass);
      expect(diagnostic!.messageArgs).to.eql([mixin.fullName, entityClass.fullName, mixin.appliesTo!.fullName]);
      expect(diagnostic!.category).to.equal(DiagnosticCategory.Error);
      expect(diagnostic!.code).to.equal(DiagnosticCode.MixinAppliedToClassMustDeriveFromConstraint);
      expect(diagnostic!.key).to.equal(DiagnosticCode[DiagnosticCode.MixinAppliedToClassMustDeriveFromConstraint]);
      expect(diagnostic!.diagnosticType).to.equal(DiagnosticType.SchemaItem);
    }
    expect(resultHasEntries, "expected rule to return an AsyncIterable with entries.").to.be.true;
  });

  it("MixinAppliedToClassMustDeriveFromConstraint, entity base incompatible with constraint, rule violated.", async () => {
    const constraintClass = new EntityClass(schema, "TestConstraint");
    const baseClass = new EntityClass(schema, "TestBase");
    const mixin = new TestMixin(schema, "TestMixin", constraintClass);
    const entityClass = new EntityClass(schema, "TestClass");
    (entityClass as MutableEntityClass).addMixin(mixin);
    entityClass.baseClass = new DelayedPromiseWithProps(baseClass.key, async () => baseClass);

    const result = await Rules.mixinAppliedToClassMustDeriveFromConstraint(entityClass);

    let resultHasEntries = false;
    for await (const diagnostic of result!) {
      resultHasEntries = true;
      expect(diagnostic).to.not.be.undefined;
      expect(diagnostic!.ecDefinition).to.equal(entityClass);
      expect(diagnostic!.messageArgs).to.eql([mixin.fullName, entityClass.fullName, mixin.appliesTo!.fullName]);
      expect(diagnostic!.category).to.equal(DiagnosticCategory.Error);
      expect(diagnostic!.code).to.equal(DiagnosticCode.MixinAppliedToClassMustDeriveFromConstraint);
      expect(diagnostic!.key).to.equal(DiagnosticCode[DiagnosticCode.MixinAppliedToClassMustDeriveFromConstraint]);
      expect(diagnostic!.diagnosticType).to.equal(DiagnosticType.SchemaItem);
    }
    expect(resultHasEntries, "expected rule to return an AsyncIterable with entries.").to.be.true;
  });
});
