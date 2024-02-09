/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/

import { expect } from "chai";
import { EntityClass, PrimitiveProperty, RelationshipClass, RelationshipConstraint, RelationshipEnd,
  Schema, SchemaContext,
} from "@itwin/ecschema-metadata";
import { createClassDiagnosticClass, createCustomAttributeContainerDiagnosticClass, createPropertyDiagnosticClass, createRelationshipConstraintDiagnosticClass, createSchemaDiagnosticClass, createSchemaItemDiagnosticClass, DiagnosticCategory, diagnosticCategoryToString, DiagnosticType, diagnosticTypeToString } from "../../Validation/Diagnostic";

describe("Diagnostics tests", () => {
  let testSchema: Schema;

  function invalidCodeMsg(code: string) {
    return `Diagnostic code ${code} is invalid. Expected the format <ruleSetName>-<number>.`;
  }

  beforeEach(async () => {
    testSchema = new Schema(new SchemaContext(), "TestSchema", "ts", 1, 0, 0);
  });

  it("diagnosticCategoryToString, Error, proper string returned", () => {
    const result = diagnosticCategoryToString(DiagnosticCategory.Error);
    expect(result).to.equal("Error");
  });

  it("diagnosticCategoryToString, Message, proper string returned", () => {
    const result = diagnosticCategoryToString(DiagnosticCategory.Message);
    expect(result).to.equal("Message");
  });

  it("diagnosticCategoryToString, Suggestion, proper string returned", () => {
    const result = diagnosticCategoryToString(DiagnosticCategory.Suggestion);
    expect(result).to.equal("Suggestion");
  });

  it("diagnosticCategoryToString, Warning, proper string returned", () => {
    const result = diagnosticCategoryToString(DiagnosticCategory.Warning);
    expect(result).to.equal("Warning");
  });

  it("diagnosticTypeToString, CustomAttributeContainer, proper string returned", () => {
    const result = diagnosticTypeToString(DiagnosticType.CustomAttributeContainer);
    expect(result).to.equal("CustomAttributeContainer");
  });

  it("diagnosticTypeToString, None, proper string returned", () => {
    const result = diagnosticTypeToString(DiagnosticType.None);
    expect(result).to.equal("None");
  });

  it("diagnosticTypeToString, Property, proper string returned", () => {
    const result = diagnosticTypeToString(DiagnosticType.Property);
    expect(result).to.equal("Property");
  });

  it("diagnosticTypeToString, RelationshipConstraint, proper string returned", () => {
    const result = diagnosticTypeToString(DiagnosticType.RelationshipConstraint);
    expect(result).to.equal("RelationshipConstraint");
  });

  it("diagnosticTypeToString, Schema, proper string returned", () => {
    const result = diagnosticTypeToString(DiagnosticType.Schema);
    expect(result).to.equal("Schema");
  });

  it("diagnosticTypeToString, SchemaItem, proper string returned", () => {
    const result = diagnosticTypeToString(DiagnosticType.SchemaItem);
    expect(result).to.equal("SchemaItem");
  });

  it("createSchemaDiagnosticClass, class created properly", async () => {
    const newClass = createSchemaDiagnosticClass("TestRuleSet-100", "Test Message");
    expect(newClass.prototype.diagnosticType).to.equal(DiagnosticType.Schema);
    expect(newClass.prototype.code).to.equal("TestRuleSet-100");
    expect(newClass.prototype.messageText).to.equal("Test Message");
  });

  it("create Schema Diagnostic, instance created properly", async () => {
    const newClass = createSchemaDiagnosticClass("TestRuleSet-100", "Test Message");
    const instance = new newClass(testSchema, ["arg"], DiagnosticCategory.Message);

    expect(instance.schema).to.equal(testSchema);
    expect(instance.diagnosticType).to.equal(DiagnosticType.Schema);
    expect(instance.code).to.equal("TestRuleSet-100");
    expect(instance.category).to.equal(DiagnosticCategory.Message);
    expect(instance.messageText).to.equal("Test Message");
  });

  it("createSchemaDiagnosticClass, invalid code, throws", () => {
    let code = "InvalidCode";
    expect(() => createSchemaDiagnosticClass(code, "Test Message")).to.throw(Error, invalidCodeMsg(code));

    code = "Invalid:NotNumber";
    expect(() => createSchemaDiagnosticClass(code, "Test Message")).to.throw(Error, invalidCodeMsg(code));
  });

  it("createSchemaItemDiagnosticClass, class created properly", async () => {
    const newClass = createSchemaItemDiagnosticClass("TestRuleSet-100", "Test Message");
    expect(newClass.prototype.diagnosticType).to.equal(DiagnosticType.SchemaItem);
    expect(newClass.prototype.code).to.equal("TestRuleSet-100");
    expect(newClass.prototype.messageText).to.equal("Test Message");
  });

  it("create SchemaItem Diagnostic, instance created properly", async () => {
    const newClass = createSchemaItemDiagnosticClass("TestRuleSet-100", "Test Message");
    const entityClass = new EntityClass(testSchema, "TestClass");
    const instance = new newClass(entityClass, ["arg"], DiagnosticCategory.Message);

    expect(instance.schema).to.equal(testSchema);
    expect(instance.diagnosticType).to.equal(DiagnosticType.SchemaItem);
    expect(instance.code).to.equal("TestRuleSet-100");
    expect(instance.category).to.equal(DiagnosticCategory.Message);
    expect(instance.messageText).to.equal("Test Message");
  });

  it("createSchemaItemDiagnosticClass, invalid code, throws", () => {
    let code = "InvalidCode";
    expect(() => createSchemaItemDiagnosticClass(code, "Test Message")).to.throw(Error, invalidCodeMsg(code));

    code = "Invalid:NotNumber";
    expect(() => createSchemaItemDiagnosticClass(code, "Test Message")).to.throw(Error, invalidCodeMsg(code));
  });

  it("createClassDiagnosticClass, class created properly", async () => {
    const newClass = createClassDiagnosticClass("TestRuleSet-100", "Test Message");
    expect(newClass.prototype.diagnosticType).to.equal(DiagnosticType.SchemaItem);
    expect(newClass.prototype.code).to.equal("TestRuleSet-100");
    expect(newClass.prototype.messageText).to.equal("Test Message");
  });

  it("create Class Diagnostic, instance created properly", async () => {
    const newClass = createClassDiagnosticClass("TestRuleSet-100", "Test Message");
    const entityClass = new EntityClass(testSchema, "TestClass");
    const instance = new newClass(entityClass, ["arg"], DiagnosticCategory.Message);

    expect(instance.schema).to.equal(testSchema);
    expect(instance.diagnosticType).to.equal(DiagnosticType.SchemaItem);
    expect(instance.code).to.equal("TestRuleSet-100");
    expect(instance.category).to.equal(DiagnosticCategory.Message);
    expect(instance.messageText).to.equal("Test Message");
  });

  it("createClassDiagnosticClass, invalid code, throws", () => {
    let code = "InvalidCode";
    expect(() => createClassDiagnosticClass(code, "Test Message")).to.throw(Error, invalidCodeMsg(code));

    code = "Invalid:NotNumber";
    expect(() => createClassDiagnosticClass(code, "Test Message")).to.throw(Error, invalidCodeMsg(code));
  });

  it("createPropertyDiagnosticClass, class created properly", async () => {
    const newClass = createPropertyDiagnosticClass("TestRuleSet-100", "Test Message");
    expect(newClass.prototype.diagnosticType).to.equal(DiagnosticType.Property);
    expect(newClass.prototype.code).to.equal("TestRuleSet-100");
    expect(newClass.prototype.messageText).to.equal("Test Message");
  });

  it("create Property Diagnostic, instance created properly", async () => {
    const newClass = createPropertyDiagnosticClass("TestRuleSet-100", "Test Message");
    const entityClass = new EntityClass(testSchema, "TestClass");
    const property = new PrimitiveProperty(entityClass, "TestProperty");
    const instance = new newClass(property, ["arg"], DiagnosticCategory.Warning);

    expect(instance.schema).to.equal(testSchema);
    expect(instance.diagnosticType).to.equal(DiagnosticType.Property);
    expect(instance.code).to.equal("TestRuleSet-100");
    expect(instance.category).to.equal(DiagnosticCategory.Warning);
    expect(instance.messageText).to.equal("Test Message");
  });

  it("createPropertyDiagnosticClass, invalid code, throws", () => {
    let code = "InvalidCode";
    expect(() => createPropertyDiagnosticClass(code, "Test Message")).to.throw(Error, invalidCodeMsg(code));

    code = "Invalid:NotNumber";
    expect(() => createPropertyDiagnosticClass(code, "Test Message")).to.throw(Error, invalidCodeMsg(code));
  });

  it("createRelationshipConstraintDiagnosticClass, class created properly", async () => {
    const newClass = createRelationshipConstraintDiagnosticClass("TestRuleSet-100", "Test Message");
    expect(newClass.prototype.diagnosticType).to.equal(DiagnosticType.RelationshipConstraint);
    expect(newClass.prototype.code).to.equal("TestRuleSet-100");
    expect(newClass.prototype.messageText).to.equal("Test Message");
  });

  it("create RelationshipConstraint Diagnostic, instance created properly", async () => {
    const newClass = createRelationshipConstraintDiagnosticClass("TestRuleSet-100", "Test Message");
    const relationship = new RelationshipClass(testSchema, "TestRelationship");
    const constraint = new RelationshipConstraint(relationship, RelationshipEnd.Source);
    const instance = new newClass(constraint, ["arg"], DiagnosticCategory.Error);

    expect(instance.schema).to.equal(testSchema);
    expect(instance.diagnosticType).to.equal(DiagnosticType.RelationshipConstraint);
    expect(instance.code).to.equal("TestRuleSet-100");
    expect(instance.category).to.equal(DiagnosticCategory.Error);
    expect(instance.messageText).to.equal("Test Message");
  });

  it("createRelationshipConstraintDiagnosticClass, invalid code, throws", () => {
    let code = "InvalidCode";
    expect(() => createRelationshipConstraintDiagnosticClass(code, "Test Message")).to.throw(Error, invalidCodeMsg(code));

    code = "Invalid:NotNumber";
    expect(() => createRelationshipConstraintDiagnosticClass(code, "Test Message")).to.throw(Error, invalidCodeMsg(code));
  });

  it("createCustomAttributeContainerDiagnosticClass, class created properly", async () => {
    const newClass = createCustomAttributeContainerDiagnosticClass("TestRuleSet-100", "Test Message");
    expect(newClass.prototype.diagnosticType).to.equal(DiagnosticType.CustomAttributeContainer);
    expect(newClass.prototype.code).to.equal("TestRuleSet-100");
    expect(newClass.prototype.messageText).to.equal("Test Message");
  });

  it("create RelationshipConstraint Diagnostic, instance created properly", async () => {
    const newClass = createCustomAttributeContainerDiagnosticClass("TestRuleSet-100", "Test Message");
    const entityClass = new EntityClass(testSchema, "TestClass");
    const instance = new newClass(entityClass, ["arg"], DiagnosticCategory.Error);

    expect(instance.schema).to.equal(testSchema);
    expect(instance.diagnosticType).to.equal(DiagnosticType.CustomAttributeContainer);
    expect(instance.code).to.equal("TestRuleSet-100");
    expect(instance.category).to.equal(DiagnosticCategory.Error);
    expect(instance.messageText).to.equal("Test Message");
  });

  it("createCustomAttributeContainerDiagnosticClass, invalid code, throws", () => {
    let code = "InvalidCode";
    expect(() => createCustomAttributeContainerDiagnosticClass(code, "Test Message")).to.throw(Error, invalidCodeMsg(code));

    code = "Invalid:NotNumber";
    expect(() => createCustomAttributeContainerDiagnosticClass(code, "Test Message")).to.throw(Error, invalidCodeMsg(code));
  });
});
