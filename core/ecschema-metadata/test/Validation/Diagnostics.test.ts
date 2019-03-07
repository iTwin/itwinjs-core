/*---------------------------------------------------------------------------------------------
* Copyright (c) 2019 Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/

import { expect } from "chai";
import * as Diagnostics from "../../src/Validation/Diagnostic";

describe("Diagnostics tests", () => {

  function invalidCodeMsg(code: string) {
    return `Diagnostic code ${code} is invalid. Expected the format <ruleSetName>:<number>.`;
  }

  beforeEach(async () => {
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
    const newClass = Diagnostics.createSchemaDiagnosticClass("TestRuleSet:100", "Test Message", Diagnostics.DiagnosticCategory.Message);
    expect(newClass.prototype.diagnosticType).to.equal(Diagnostics.DiagnosticType.Schema);
    expect(newClass.prototype.code).to.equal("TestRuleSet:100");
    expect(newClass.prototype.category).to.equal(Diagnostics.DiagnosticCategory.Message);
    expect(newClass.prototype.messageText).to.equal("Test Message");
  });

  it("createSchemaDiagnosticClass, invalid code, throws", () => {
    let code = "InvalidCode";
    expect(() => Diagnostics.createSchemaDiagnosticClass(code, "Test Message", Diagnostics.DiagnosticCategory.Error)).to.throw(Error, invalidCodeMsg(code));

    code = "Invalid:NotNumber";
    expect(() => Diagnostics.createSchemaDiagnosticClass(code, "Test Message", Diagnostics.DiagnosticCategory.Error)).to.throw(Error, invalidCodeMsg(code));
  });

  it("createSchemaItemDiagnosticClass, class created properly", async () => {
    const newClass = Diagnostics.createSchemaItemDiagnosticClass("TestRuleSet:100", "Test Message", Diagnostics.DiagnosticCategory.Message);
    expect(newClass.prototype.diagnosticType).to.equal(Diagnostics.DiagnosticType.SchemaItem);
    expect(newClass.prototype.code).to.equal("TestRuleSet:100");
    expect(newClass.prototype.category).to.equal(Diagnostics.DiagnosticCategory.Message);
    expect(newClass.prototype.messageText).to.equal("Test Message");
  });

  it("createSchemaItemDiagnosticClass, invalid code, throws", () => {
    let code = "InvalidCode";
    expect(() => Diagnostics.createSchemaItemDiagnosticClass(code, "Test Message", Diagnostics.DiagnosticCategory.Error)).to.throw(Error, invalidCodeMsg(code));

    code = "Invalid:NotNumber";
    expect(() => Diagnostics.createSchemaItemDiagnosticClass(code, "Test Message", Diagnostics.DiagnosticCategory.Error)).to.throw(Error, invalidCodeMsg(code));
  });

  it("createClassDiagnosticClass, class created properly", async () => {
    const newClass = Diagnostics.createClassDiagnosticClass("TestRuleSet:100", "Test Message", Diagnostics.DiagnosticCategory.Message);
    expect(newClass.prototype.diagnosticType).to.equal(Diagnostics.DiagnosticType.SchemaItem);
    expect(newClass.prototype.code).to.equal("TestRuleSet:100");
    expect(newClass.prototype.category).to.equal(Diagnostics.DiagnosticCategory.Message);
    expect(newClass.prototype.messageText).to.equal("Test Message");
  });

  it("createClassDiagnosticClass, invalid code, throws", () => {
    let code = "InvalidCode";
    expect(() => Diagnostics.createClassDiagnosticClass(code, "Test Message", Diagnostics.DiagnosticCategory.Error)).to.throw(Error, invalidCodeMsg(code));

    code = "Invalid:NotNumber";
    expect(() => Diagnostics.createClassDiagnosticClass(code, "Test Message", Diagnostics.DiagnosticCategory.Error)).to.throw(Error, invalidCodeMsg(code));
  });

  it("createPropertyDiagnosticClass, class created properly", async () => {
    const newClass = Diagnostics.createPropertyDiagnosticClass("TestRuleSet:100", "Test Message", Diagnostics.DiagnosticCategory.Warning);
    expect(newClass.prototype.diagnosticType).to.equal(Diagnostics.DiagnosticType.Property);
    expect(newClass.prototype.code).to.equal("TestRuleSet:100");
    expect(newClass.prototype.category).to.equal(Diagnostics.DiagnosticCategory.Warning);
    expect(newClass.prototype.messageText).to.equal("Test Message");
  });

  it("createPropertyDiagnosticClass, invalid code, throws", () => {
    let code = "InvalidCode";
    expect(() => Diagnostics.createPropertyDiagnosticClass(code, "Test Message", Diagnostics.DiagnosticCategory.Error)).to.throw(Error, invalidCodeMsg(code));

    code = "Invalid:NotNumber";
    expect(() => Diagnostics.createPropertyDiagnosticClass(code, "Test Message", Diagnostics.DiagnosticCategory.Error)).to.throw(Error, invalidCodeMsg(code));
  });

  it("createRelationshipConstraintDiagnosticClass, class created properly", async () => {
    const newClass = Diagnostics.createRelationshipConstraintDiagnosticClass("TestRuleSet:100", "Test Message", Diagnostics.DiagnosticCategory.Error);
    expect(newClass.prototype.diagnosticType).to.equal(Diagnostics.DiagnosticType.RelationshipConstraint);
    expect(newClass.prototype.code).to.equal("TestRuleSet:100");
    expect(newClass.prototype.category).to.equal(Diagnostics.DiagnosticCategory.Error);
    expect(newClass.prototype.messageText).to.equal("Test Message");
  });

  it("createRelationshipConstraintDiagnosticClass, invalid code, throws", () => {
    let code = "InvalidCode";
    expect(() => Diagnostics.createRelationshipConstraintDiagnosticClass(code, "Test Message", Diagnostics.DiagnosticCategory.Error)).to.throw(Error, invalidCodeMsg(code));

    code = "Invalid:NotNumber";
    expect(() => Diagnostics.createRelationshipConstraintDiagnosticClass(code, "Test Message", Diagnostics.DiagnosticCategory.Error)).to.throw(Error, invalidCodeMsg(code));
  });

  it("createCustomAttributeContainerDiagnosticClass, class created properly", async () => {
    const newClass = Diagnostics.createCustomAttributeContainerDiagnosticClass("TestRuleSet:100", "Test Message", Diagnostics.DiagnosticCategory.Error);
    expect(newClass.prototype.diagnosticType).to.equal(Diagnostics.DiagnosticType.CustomAttributeContainer);
    expect(newClass.prototype.code).to.equal("TestRuleSet:100");
    expect(newClass.prototype.category).to.equal(Diagnostics.DiagnosticCategory.Error);
    expect(newClass.prototype.messageText).to.equal("Test Message");
  });

  it("createCustomAttributeContainerDiagnosticClass, invalid code, throws", () => {
    let code = "InvalidCode";
    expect(() => Diagnostics.createCustomAttributeContainerDiagnosticClass(code, "Test Message", Diagnostics.DiagnosticCategory.Error)).to.throw(Error, invalidCodeMsg(code));

    code = "Invalid:NotNumber";
    expect(() => Diagnostics.createCustomAttributeContainerDiagnosticClass(code, "Test Message", Diagnostics.DiagnosticCategory.Error)).to.throw(Error, invalidCodeMsg(code));
  });
});
