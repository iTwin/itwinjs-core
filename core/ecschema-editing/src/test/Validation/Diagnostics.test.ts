/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/

import { expect } from "chai";
import { EntityClass, PrimitiveProperty, RelationshipClass, RelationshipConstraint, RelationshipEnd,
  Schema, SchemaContext,
} from "@itwin/ecschema-metadata";
import * as Diagnostics from "../../Validation/Diagnostic";

describe("Diagnostics tests", () => {
  let testSchema: Schema;

  function invalidCodeMsg(code: string) {
    return `Diagnostic code ${code} is invalid. Expected the format <ruleSetName>-<number>.`;
  }

  beforeEach(async () => {
    testSchema = new Schema(new SchemaContext(), "TestSchema", "ts", 1, 0, 0);
  });

  it("diagnosticCategoryToString, Error, proper string returned", () => {
    const result = Diagnostics.diagnosticCategoryToString(Diagnostics.DiagnosticCategory.Error);
    expect(result).to.equal("Error");
  });

  it("diagnosticCategoryToString, Message, proper string returned", () => {
    const result = Diagnostics.diagnosticCategoryToString(Diagnostics.DiagnosticCategory.Message);
    expect(result).to.equal("Message");
  });

  it("diagnosticCategoryToString, Suggestion, proper string returned", () => {
    const result = Diagnostics.diagnosticCategoryToString(Diagnostics.DiagnosticCategory.Suggestion);
    expect(result).to.equal("Suggestion");
  });

  it("diagnosticCategoryToString, Warning, proper string returned", () => {
    const result = Diagnostics.diagnosticCategoryToString(Diagnostics.DiagnosticCategory.Warning);
    expect(result).to.equal("Warning");
  });

  it("diagnosticTypeToString, CustomAttributeContainer, proper string returned", () => {
    const result = Diagnostics.diagnosticTypeToString(Diagnostics.DiagnosticType.CustomAttributeContainer);
    expect(result).to.equal("CustomAttributeContainer");
  });

  it("diagnosticTypeToString, None, proper string returned", () => {
    const result = Diagnostics.diagnosticTypeToString(Diagnostics.DiagnosticType.None);
    expect(result).to.equal("None");
  });

  it("diagnosticTypeToString, Property, proper string returned", () => {
    const result = Diagnostics.diagnosticTypeToString(Diagnostics.DiagnosticType.Property);
    expect(result).to.equal("Property");
  });

  it("diagnosticTypeToString, RelationshipConstraint, proper string returned", () => {
    const result = Diagnostics.diagnosticTypeToString(Diagnostics.DiagnosticType.RelationshipConstraint);
    expect(result).to.equal("RelationshipConstraint");
  });

  it("diagnosticTypeToString, Schema, proper string returned", () => {
    const result = Diagnostics.diagnosticTypeToString(Diagnostics.DiagnosticType.Schema);
    expect(result).to.equal("Schema");
  });

  it("diagnosticTypeToString, SchemaItem, proper string returned", () => {
    const result = Diagnostics.diagnosticTypeToString(Diagnostics.DiagnosticType.SchemaItem);
    expect(result).to.equal("SchemaItem");
  });

  it("createSchemaDiagnosticClass, class created properly", async () => {
    const newClass = Diagnostics.createSchemaDiagnosticClass("TestRuleSet-100", "Test Message");
    expect(newClass.prototype.diagnosticType).to.equal(Diagnostics.DiagnosticType.Schema);
    expect(newClass.prototype.code).to.equal("TestRuleSet-100");
    expect(newClass.prototype.messageText).to.equal("Test Message");
  });

  it("create Schema Diagnostic, instance created properly", async () => {
    const newClass = Diagnostics.createSchemaDiagnosticClass("TestRuleSet-100", "Test Message");
    const instance = new newClass(testSchema, ["arg"], Diagnostics.DiagnosticCategory.Message);

    expect(instance.schema).to.equal(testSchema);
    expect(instance.diagnosticType).to.equal(Diagnostics.DiagnosticType.Schema);
    expect(instance.code).to.equal("TestRuleSet-100");
    expect(instance.category).to.equal(Diagnostics.DiagnosticCategory.Message);
    expect(instance.messageText).to.equal("Test Message");
  });

  it("createSchemaDiagnosticClass, invalid code, throws", () => {
    let code = "InvalidCode";
    expect(() => Diagnostics.createSchemaDiagnosticClass(code, "Test Message")).to.throw(Error, invalidCodeMsg(code));

    code = "Invalid:NotNumber";
    expect(() => Diagnostics.createSchemaDiagnosticClass(code, "Test Message")).to.throw(Error, invalidCodeMsg(code));
  });

  it("createSchemaItemDiagnosticClass, class created properly", async () => {
    const newClass = Diagnostics.createSchemaItemDiagnosticClass("TestRuleSet-100", "Test Message");
    expect(newClass.prototype.diagnosticType).to.equal(Diagnostics.DiagnosticType.SchemaItem);
    expect(newClass.prototype.code).to.equal("TestRuleSet-100");
    expect(newClass.prototype.messageText).to.equal("Test Message");
  });

  it("create SchemaItem Diagnostic, instance created properly", async () => {
    const newClass = Diagnostics.createSchemaItemDiagnosticClass("TestRuleSet-100", "Test Message");
    const entityClass = new EntityClass(testSchema, "TestClass");
    const instance = new newClass(entityClass, ["arg"], Diagnostics.DiagnosticCategory.Message);

    expect(instance.schema).to.equal(testSchema);
    expect(instance.diagnosticType).to.equal(Diagnostics.DiagnosticType.SchemaItem);
    expect(instance.code).to.equal("TestRuleSet-100");
    expect(instance.category).to.equal(Diagnostics.DiagnosticCategory.Message);
    expect(instance.messageText).to.equal("Test Message");
  });

  it("createSchemaItemDiagnosticClass, invalid code, throws", () => {
    let code = "InvalidCode";
    expect(() => Diagnostics.createSchemaItemDiagnosticClass(code, "Test Message")).to.throw(Error, invalidCodeMsg(code));

    code = "Invalid:NotNumber";
    expect(() => Diagnostics.createSchemaItemDiagnosticClass(code, "Test Message")).to.throw(Error, invalidCodeMsg(code));
  });

  it("createClassDiagnosticClass, class created properly", async () => {
    const newClass = Diagnostics.createClassDiagnosticClass("TestRuleSet-100", "Test Message");
    expect(newClass.prototype.diagnosticType).to.equal(Diagnostics.DiagnosticType.SchemaItem);
    expect(newClass.prototype.code).to.equal("TestRuleSet-100");
    expect(newClass.prototype.messageText).to.equal("Test Message");
  });

  it("create Class Diagnostic, instance created properly", async () => {
    const newClass = Diagnostics.createClassDiagnosticClass("TestRuleSet-100", "Test Message");
    const entityClass = new EntityClass(testSchema, "TestClass");
    const instance = new newClass(entityClass, ["arg"], Diagnostics.DiagnosticCategory.Message);

    expect(instance.schema).to.equal(testSchema);
    expect(instance.diagnosticType).to.equal(Diagnostics.DiagnosticType.SchemaItem);
    expect(instance.code).to.equal("TestRuleSet-100");
    expect(instance.category).to.equal(Diagnostics.DiagnosticCategory.Message);
    expect(instance.messageText).to.equal("Test Message");
  });

  it("createClassDiagnosticClass, invalid code, throws", () => {
    let code = "InvalidCode";
    expect(() => Diagnostics.createClassDiagnosticClass(code, "Test Message")).to.throw(Error, invalidCodeMsg(code));

    code = "Invalid:NotNumber";
    expect(() => Diagnostics.createClassDiagnosticClass(code, "Test Message")).to.throw(Error, invalidCodeMsg(code));
  });

  it("createPropertyDiagnosticClass, class created properly", async () => {
    const newClass = Diagnostics.createPropertyDiagnosticClass("TestRuleSet-100", "Test Message");
    expect(newClass.prototype.diagnosticType).to.equal(Diagnostics.DiagnosticType.Property);
    expect(newClass.prototype.code).to.equal("TestRuleSet-100");
    expect(newClass.prototype.messageText).to.equal("Test Message");
  });

  it("create Property Diagnostic, instance created properly", async () => {
    const newClass = Diagnostics.createPropertyDiagnosticClass("TestRuleSet-100", "Test Message");
    const entityClass = new EntityClass(testSchema, "TestClass");
    const property = new PrimitiveProperty(entityClass, "TestProperty");
    const instance = new newClass(property, ["arg"], Diagnostics.DiagnosticCategory.Warning);

    expect(instance.schema).to.equal(testSchema);
    expect(instance.diagnosticType).to.equal(Diagnostics.DiagnosticType.Property);
    expect(instance.code).to.equal("TestRuleSet-100");
    expect(instance.category).to.equal(Diagnostics.DiagnosticCategory.Warning);
    expect(instance.messageText).to.equal("Test Message");
  });

  it("createPropertyDiagnosticClass, invalid code, throws", () => {
    let code = "InvalidCode";
    expect(() => Diagnostics.createPropertyDiagnosticClass(code, "Test Message")).to.throw(Error, invalidCodeMsg(code));

    code = "Invalid:NotNumber";
    expect(() => Diagnostics.createPropertyDiagnosticClass(code, "Test Message")).to.throw(Error, invalidCodeMsg(code));
  });

  it("createRelationshipConstraintDiagnosticClass, class created properly", async () => {
    const newClass = Diagnostics.createRelationshipConstraintDiagnosticClass("TestRuleSet-100", "Test Message");
    expect(newClass.prototype.diagnosticType).to.equal(Diagnostics.DiagnosticType.RelationshipConstraint);
    expect(newClass.prototype.code).to.equal("TestRuleSet-100");
    expect(newClass.prototype.messageText).to.equal("Test Message");
  });

  it("create RelationshipConstraint Diagnostic, instance created properly", async () => {
    const newClass = Diagnostics.createRelationshipConstraintDiagnosticClass("TestRuleSet-100", "Test Message");
    const relationship = new RelationshipClass(testSchema, "TestRelationship");
    const constraint = new RelationshipConstraint(relationship, RelationshipEnd.Source);
    const instance = new newClass(constraint, ["arg"], Diagnostics.DiagnosticCategory.Error);

    expect(instance.schema).to.equal(testSchema);
    expect(instance.diagnosticType).to.equal(Diagnostics.DiagnosticType.RelationshipConstraint);
    expect(instance.code).to.equal("TestRuleSet-100");
    expect(instance.category).to.equal(Diagnostics.DiagnosticCategory.Error);
    expect(instance.messageText).to.equal("Test Message");
  });

  it("createRelationshipConstraintDiagnosticClass, invalid code, throws", () => {
    let code = "InvalidCode";
    expect(() => Diagnostics.createRelationshipConstraintDiagnosticClass(code, "Test Message")).to.throw(Error, invalidCodeMsg(code));

    code = "Invalid:NotNumber";
    expect(() => Diagnostics.createRelationshipConstraintDiagnosticClass(code, "Test Message")).to.throw(Error, invalidCodeMsg(code));
  });

  it("createCustomAttributeContainerDiagnosticClass, class created properly", async () => {
    const newClass = Diagnostics.createCustomAttributeContainerDiagnosticClass("TestRuleSet-100", "Test Message");
    expect(newClass.prototype.diagnosticType).to.equal(Diagnostics.DiagnosticType.CustomAttributeContainer);
    expect(newClass.prototype.code).to.equal("TestRuleSet-100");
    expect(newClass.prototype.messageText).to.equal("Test Message");
  });

  it("create RelationshipConstraint Diagnostic, instance created properly", async () => {
    const newClass = Diagnostics.createCustomAttributeContainerDiagnosticClass("TestRuleSet-100", "Test Message");
    const entityClass = new EntityClass(testSchema, "TestClass");
    const instance = new newClass(entityClass, ["arg"], Diagnostics.DiagnosticCategory.Error);

    expect(instance.schema).to.equal(testSchema);
    expect(instance.diagnosticType).to.equal(Diagnostics.DiagnosticType.CustomAttributeContainer);
    expect(instance.code).to.equal("TestRuleSet-100");
    expect(instance.category).to.equal(Diagnostics.DiagnosticCategory.Error);
    expect(instance.messageText).to.equal("Test Message");
  });

  it("createCustomAttributeContainerDiagnosticClass, invalid code, throws", () => {
    let code = "InvalidCode";
    expect(() => Diagnostics.createCustomAttributeContainerDiagnosticClass(code, "Test Message")).to.throw(Error, invalidCodeMsg(code));

    code = "Invalid:NotNumber";
    expect(() => Diagnostics.createCustomAttributeContainerDiagnosticClass(code, "Test Message")).to.throw(Error, invalidCodeMsg(code));
  });
});
