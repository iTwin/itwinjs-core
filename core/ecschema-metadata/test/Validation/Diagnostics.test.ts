/*---------------------------------------------------------------------------------------------
* Copyright (c) 2019 Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/

import { expect } from "chai";
import * as Diagnostics from "../../src/Validation/Diagnostic";

describe("createClassDiagnostic tests", () => {

  beforeEach(async () => {
  });

  it("createSchemaDiagnosticClass, class created properly", async () => {
    const newClass = Diagnostics.createSchemaDiagnosticClass(Diagnostics.DiagnosticCode.BaseClassIsSealed, "Test Message", Diagnostics.DiagnosticCategory.Message);
    expect(newClass.prototype.diagnosticType).to.equal(Diagnostics.DiagnosticType.Schema);
    expect(newClass.prototype.code).to.equal(Diagnostics.DiagnosticCode.BaseClassIsSealed);
    expect(newClass.prototype.key).to.equal(Diagnostics.DiagnosticCode[Diagnostics.DiagnosticCode.BaseClassIsSealed]);
    expect(newClass.prototype.category).to.equal(Diagnostics.DiagnosticCategory.Message);
    expect(newClass.prototype.messageText).to.equal("Test Message");
  });

  it("createSchemaItemDiagnosticClass, class created properly", async () => {
    const newClass = Diagnostics.createSchemaItemDiagnosticClass(Diagnostics.DiagnosticCode.BaseClassIsSealed, "Test Message", Diagnostics.DiagnosticCategory.Message);
    expect(newClass.prototype.diagnosticType).to.equal(Diagnostics.DiagnosticType.SchemaItem);
    expect(newClass.prototype.code).to.equal(Diagnostics.DiagnosticCode.BaseClassIsSealed);
    expect(newClass.prototype.key).to.equal(Diagnostics.DiagnosticCode[Diagnostics.DiagnosticCode.BaseClassIsSealed]);
    expect(newClass.prototype.category).to.equal(Diagnostics.DiagnosticCategory.Message);
    expect(newClass.prototype.messageText).to.equal("Test Message");
  });

  it("createClassDiagnosticClass, class created properly", async () => {
    const newClass = Diagnostics.createClassDiagnosticClass(Diagnostics.DiagnosticCode.BaseClassIsSealed, "Test Message", Diagnostics.DiagnosticCategory.Message);
    expect(newClass.prototype.diagnosticType).to.equal(Diagnostics.DiagnosticType.SchemaItem);
    expect(newClass.prototype.code).to.equal(Diagnostics.DiagnosticCode.BaseClassIsSealed);
    expect(newClass.prototype.key).to.equal(Diagnostics.DiagnosticCode[Diagnostics.DiagnosticCode.BaseClassIsSealed]);
    expect(newClass.prototype.category).to.equal(Diagnostics.DiagnosticCategory.Message);
    expect(newClass.prototype.messageText).to.equal("Test Message");
  });

  it("createPropertyDiagnosticClass, class created properly", async () => {
    const newClass = Diagnostics.createPropertyDiagnosticClass(Diagnostics.DiagnosticCode.BaseClassIsSealed, "Test Message", Diagnostics.DiagnosticCategory.Warning);
    expect(newClass.prototype.diagnosticType).to.equal(Diagnostics.DiagnosticType.Property);
    expect(newClass.prototype.code).to.equal(Diagnostics.DiagnosticCode.BaseClassIsSealed);
    expect(newClass.prototype.key).to.equal(Diagnostics.DiagnosticCode[Diagnostics.DiagnosticCode.BaseClassIsSealed]);
    expect(newClass.prototype.category).to.equal(Diagnostics.DiagnosticCategory.Warning);
    expect(newClass.prototype.messageText).to.equal("Test Message");
  });

  it("createRelationshipConstraintDiagnosticClass, class created properly", async () => {
    const newClass = Diagnostics.createRelationshipConstraintDiagnosticClass(Diagnostics.DiagnosticCode.BaseClassIsSealed, "Test Message", Diagnostics.DiagnosticCategory.Error);
    expect(newClass.prototype.diagnosticType).to.equal(Diagnostics.DiagnosticType.RelationshipConstraint);
    expect(newClass.prototype.code).to.equal(Diagnostics.DiagnosticCode.BaseClassIsSealed);
    expect(newClass.prototype.key).to.equal(Diagnostics.DiagnosticCode[Diagnostics.DiagnosticCode.BaseClassIsSealed]);
    expect(newClass.prototype.category).to.equal(Diagnostics.DiagnosticCategory.Error);
    expect(newClass.prototype.messageText).to.equal("Test Message");
  });

  it("createCustomAttributeContainerDiagnosticClass, class created properly", async () => {
    const newClass = Diagnostics.createCustomAttributeContainerDiagnosticClass(Diagnostics.DiagnosticCode.BaseClassIsSealed, "Test Message", Diagnostics.DiagnosticCategory.Error);
    expect(newClass.prototype.diagnosticType).to.equal(Diagnostics.DiagnosticType.CustomAttributeContainer);
    expect(newClass.prototype.code).to.equal(Diagnostics.DiagnosticCode.BaseClassIsSealed);
    expect(newClass.prototype.key).to.equal(Diagnostics.DiagnosticCode[Diagnostics.DiagnosticCode.BaseClassIsSealed]);
    expect(newClass.prototype.category).to.equal(Diagnostics.DiagnosticCategory.Error);
    expect(newClass.prototype.messageText).to.equal("Test Message");
  });
});
