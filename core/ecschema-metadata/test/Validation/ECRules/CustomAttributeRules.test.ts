/*---------------------------------------------------------------------------------------------
* Copyright (c) 2019 Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/

import { expect } from "chai";

import { SchemaContext } from "../../../src/Context";
import { ECClassModifier } from "../../../src/ECObjects";
import { MutableClass } from "../../../src/Metadata/Class";
import { CustomAttributeClass } from "../../../src/Metadata/CustomAttributeClass";
import { EntityClass } from "../../../src/Metadata/EntityClass";
import { MutableSchema, Schema } from "../../../src/Metadata/Schema";
import { DiagnosticCategory, DiagnosticType } from "../../../src/Validation/Diagnostic";
import * as Rules from "../../../src/Validation/ECRules";

describe("CustomAttribute Rules Tests", () => {
  let schema: Schema;
  let context: SchemaContext;
  let caSchema: Schema;

  function addCA(modifier: ECClassModifier) {
    const testCA = new CustomAttributeClass(caSchema, "TestCA", modifier);
    (caSchema as MutableSchema).addItem(testCA);
  }

  beforeEach(async () => {
    context = new SchemaContext();
    schema = new Schema(context, "TestSchema", 1, 0, 0);
    caSchema = new Schema(context, "TestCASchema", 1, 0, 0);
    await (schema as MutableSchema).addReference(caSchema);
  });

  describe("CustomAttributeNotOfConcreteClass tests", () => {
    it("CustomAttribute is abstract, rule violated", async () => {
      addCA(ECClassModifier.Abstract);
      const testEntity = new EntityClass(schema, "TestEntity");
      (testEntity as unknown as MutableClass).addCustomAttribute({ className: "TestCASchema.TestCA" });

      const result = await Rules.customAttributeNotOfConcreteClass(testEntity, testEntity.customAttributes!.get("TestCASchema.TestCA")!);

      let resultHasEntries = false;
      for await (const diagnostic of result!) {
        resultHasEntries = true;
        expect(diagnostic).to.not.be.undefined;
        expect(diagnostic!.ecDefinition).to.equal(testEntity);
        expect(diagnostic!.messageArgs).to.eql([testEntity.fullName, "TestCASchema.TestCA"]);
        expect(diagnostic!.category).to.equal(DiagnosticCategory.Error);
        expect(diagnostic!.code).to.equal(Rules.DiagnosticCodes.CustomAttributeNotOfConcreteClass);
        expect(diagnostic!.diagnosticType).to.equal(DiagnosticType.CustomAttributeContainer);
      }
      expect(resultHasEntries, "expected rule to return an AsyncIterable with entries.").to.be.true;
    });

    it("CustomAttribute is concrete, rule passes", async () => {
      addCA(ECClassModifier.None);
      const testEntity = new EntityClass(schema, "TestEntity");
      (testEntity as unknown as MutableClass).addCustomAttribute({ className: "TestCASchema.TestCA" });

      const result = await Rules.customAttributeNotOfConcreteClass(testEntity, testEntity.customAttributes!.get("TestCASchema.TestCA")!);

      for await (const _diagnostic of result!) {
        expect(false, "Rule should have passed").to.be.true;
      }
    });
  });
});
