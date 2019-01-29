/*---------------------------------------------------------------------------------------------
* Copyright (c) 2019 Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/

import { expect } from "chai";

import { SchemaContext } from "../../../src/Context";
import { ECClass } from "../../../src/Metadata/Class";
import { MutableSchema, Schema } from "../../../src/Metadata/Schema";
import * as Rules from "../../../src/Validation/BisRules";
import { DiagnosticCategory, DiagnosticCode, DiagnosticType } from "../../../src/Validation/Diagnostic";

describe("Schema Rule Tests", () => {

  describe("schemaXmlVersionMustBeTheLatest Tests", () => {
    // TODO: Re-implement when rule can be fully written
    it.skip("EC XML version is latest, rule passes.", async () => {
      const schema  = new Schema(new SchemaContext(), "TestSchema", 1, 0, 0);

      const result = await Rules.schemaXmlVersionMustBeTheLatest(schema);

      for await (const _diagnostic of result!) {
        expect(false, "Rule should have passed").to.be.true;
      }
    });

    // TODO: Re-implement when rule can be fully written
    it.skip("EC XML version less than latest, rule violated.", async () => {
      const schema  = new Schema(new SchemaContext(), "TestSchema", 1, 0, 0);

      const result = await Rules.schemaXmlVersionMustBeTheLatest(schema);

      expect(result).not.undefined;
      let resultHasEntries = false;
      for await (const diagnostic of result!) {
        resultHasEntries = true;
        expect(diagnostic).to.not.be.undefined;
        expect(diagnostic!.ecDefinition).to.equal(schema);
        expect(diagnostic!.messageArgs).to.eql(["3.1.0"]);
        expect(diagnostic!.category).to.equal(DiagnosticCategory.Error);
        expect(diagnostic!.code).to.equal(DiagnosticCode.SchemaXmlVersionMustBeTheLatest);
        expect(diagnostic!.key).to.equal(DiagnosticCode[DiagnosticCode.SchemaXmlVersionMustBeTheLatest]);
        expect(diagnostic!.diagnosticType).to.equal(DiagnosticType.Schema);
      }
      expect(resultHasEntries, "expected rule to return an AsyncIterable with entries.").to.be.true;
    });
  });

  describe("schemaMustNotReferenceOldStandardSchemas Tests", () => {
    it("No standard schema references, rule passes.", async () => {
      const context = new SchemaContext();
      const schema  = new Schema(context, "TestSchema", 1, 0, 0);
      const mutable = schema as MutableSchema;
      mutable.addReferenceSync(new Schema(context, "NotStandardSchema", 1, 0, 0));

      const result = await Rules.schemaMustNotReferenceOldStandardSchemas(schema);

      for await (const _diagnostic of result!) {
        expect(false, "Rule should have passed").to.be.true;
      }
    });

    it("Standard references exist, rule violated.", async () => {
      const context = new SchemaContext();
      const schema  = new Schema(context, "TestSchema", 1, 0, 0);
      const mutable = schema as MutableSchema;
      for (const name of Rules.oldStandardSchemaNames) {
        const ref = new Schema(context, name, 1, 0, 0);
        mutable.addReferenceSync(ref);
      }
      const result = await Rules.schemaMustNotReferenceOldStandardSchemas(schema);

      expect(result).not.undefined;
      let resultHasEntries = false;
      let nameIndex = 0;
      for await (const diagnostic of result!) {
        resultHasEntries = true;
        expect(diagnostic).to.not.be.undefined;
        expect(diagnostic!.ecDefinition).to.equal(schema);
        expect(diagnostic!.messageArgs).to.eql([schema.schemaKey.toString(), Rules.oldStandardSchemaNames[nameIndex]]);
        expect(diagnostic!.category).to.equal(DiagnosticCategory.Error);
        expect(diagnostic!.code).to.equal(DiagnosticCode.SchemaReferencesOldStandardSchema);
        expect(diagnostic!.key).to.equal(DiagnosticCode[DiagnosticCode.SchemaReferencesOldStandardSchema]);
        expect(diagnostic!.diagnosticType).to.equal(DiagnosticType.Schema);
        nameIndex++;
      }
      expect(resultHasEntries, "expected rule to return an AsyncIterable with entries.").to.be.true;
    });
  });

  describe("schemaWithDynamicInNameMustHaveDynamicSchemaCA Tests", () => {
    it("Dynamic not in the name, rule passes.", async () => {
      const schema  = new Schema(new SchemaContext(), "TestSchema", 1, 0, 0);

      const result = await Rules.schemaWithDynamicInNameMustHaveDynamicSchemaCA(schema);

      for await (const _diagnostic of result!) {
        expect(false, "Rule should have passed").to.be.true;
      }
    });

    it("Dynamic (mixed-case) in the name,  DynamicSchema attribute not applied, rule violated.", async () => {
      const schema  = new Schema(new SchemaContext(), "TestDynamicSchema", 1, 0, 0);
      (schema as MutableSchema).addCustomAttribute({ className: "CoreCustomAttributes.TestAttribute" });

      const result = await Rules.schemaWithDynamicInNameMustHaveDynamicSchemaCA(schema);

      expect(result).not.undefined;
      let resultHasEntries = false;
      for await (const diagnostic of result!) {
        resultHasEntries = true;
        expect(diagnostic).to.not.be.undefined;
        expect(diagnostic!.ecDefinition).to.equal(schema);
        expect(diagnostic!.messageArgs).to.eql([schema.schemaKey.toString()]);
        expect(diagnostic!.category).to.equal(DiagnosticCategory.Error);
        expect(diagnostic!.code).to.equal(DiagnosticCode.SchemaWithDynamicInNameMustHaveDynamicSchemaCA);
        expect(diagnostic!.key).to.equal(DiagnosticCode[DiagnosticCode.SchemaWithDynamicInNameMustHaveDynamicSchemaCA]);
        expect(diagnostic!.diagnosticType).to.equal(DiagnosticType.Schema);
      }
      expect(resultHasEntries, "expected rule to return an AsyncIterable with entries.").to.be.true;
    });

    it("Dynamic (upper-case) in the name, DynamicSchema attribute not applied, rule violated.", async () => {
      const schema  = new Schema(new SchemaContext(), "TestDYNAMICSchema", 1, 0, 0);
      (schema as MutableSchema).addCustomAttribute({ className: "CoreCustomAttributes.TestAttribute" });

      const result = await Rules.schemaWithDynamicInNameMustHaveDynamicSchemaCA(schema);

      expect(result).not.undefined;
      let resultHasEntries = false;
      for await (const diagnostic of result!) {
        resultHasEntries = true;
        expect(diagnostic).to.not.be.undefined;
        expect(diagnostic!.ecDefinition).to.equal(schema);
        expect(diagnostic!.messageArgs).to.eql([schema.schemaKey.toString()]);
        expect(diagnostic!.category).to.equal(DiagnosticCategory.Error);
        expect(diagnostic!.code).to.equal(DiagnosticCode.SchemaWithDynamicInNameMustHaveDynamicSchemaCA);
        expect(diagnostic!.key).to.equal(DiagnosticCode[DiagnosticCode.SchemaWithDynamicInNameMustHaveDynamicSchemaCA]);
        expect(diagnostic!.diagnosticType).to.equal(DiagnosticType.Schema);
      }
      expect(resultHasEntries, "expected rule to return an AsyncIterable with entries.").to.be.true;
    });

    it("Dynamic in the name, DynamicSchema attribute applied, rule passes.", async () => {
      const schema  = new Schema(new SchemaContext(), "TestDynamicSchema", 1, 0, 0);
      (schema as MutableSchema).addCustomAttribute({ className: "CoreCustomAttributes.DynamicSchema" });
      const result = await Rules.schemaWithDynamicInNameMustHaveDynamicSchemaCA(schema);

      for await (const _diagnostic of result!) {
        expect(false, "Rule should have passed").to.be.true;
      }
    });
  });

  describe("SchemaClassDisplayLabelMustBeUnique Tests", () => {

    class TestClass extends ECClass {
      constructor(schema: Schema, name: string, label: string) {
        super(schema, name);
        this._label = label;
      }
    }

    it("Display labels are unique, rule passes.", async () => {
      const schema  = new Schema(new SchemaContext(), "TestSchema", 1, 0, 0);
      const mutable = schema as MutableSchema;
      mutable.addItem(new TestClass(schema, "TestEntityA", "LabelA"));
      mutable.addItem(new TestClass(schema, "TestEntityB", "LabelB"));

      const result = await Rules.schemaClassDisplayLabelMustBeUnique(schema);

      for await (const _diagnostic of result!) {
        expect(false, "Rule should have passed").to.be.true;
      }
    });

    it("Duplicate display labels, rule violated.", async () => {
      const schema  = new Schema(new SchemaContext(), "TestSchema", 1, 0, 0);
      const mutable = schema as MutableSchema;
      mutable.addItem(new TestClass(schema, "TestEntityA", "LabelA"));
      mutable.addItem(new TestClass(schema, "TestEntityB", "LabelA"));
      mutable.addItem(new TestClass(schema, "TestEntityC", "LabelA"));

      const result = await Rules.schemaClassDisplayLabelMustBeUnique(schema);

      expect(result).not.undefined;
      let resultHasEntries = false;
      let index = 0;
      for await (const diagnostic of result!) {
        resultHasEntries = true;
        expect(diagnostic).to.not.be.undefined;
        expect(diagnostic!.ecDefinition).to.equal(schema);
        if (index === 0)
          expect(diagnostic!.messageArgs).to.eql(["TestSchema.TestEntityB", "TestSchema.TestEntityA", "LabelA"]);
        else
          expect(diagnostic!.messageArgs).to.eql(["TestSchema.TestEntityC", "TestSchema.TestEntityA", "LabelA"]);
        expect(diagnostic!.category).to.equal(DiagnosticCategory.Error);
        expect(diagnostic!.code).to.equal(DiagnosticCode.SchemaClassDisplayLabelMustBeUnique);
        expect(diagnostic!.key).to.equal(DiagnosticCode[DiagnosticCode.SchemaClassDisplayLabelMustBeUnique]);
        expect(diagnostic!.diagnosticType).to.equal(DiagnosticType.Schema);
        index++;
      }
      expect(resultHasEntries, "expected rule to return an AsyncIterable with entries.").to.be.true;
    });
  });
});
