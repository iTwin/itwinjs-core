/*---------------------------------------------------------------------------------------------
* Copyright (c) 2018 Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/

import { expect } from "chai";
import { ECObjectsStatus } from "../../src/Exception";
import * as Diagnostics from "../../src/Validation/Diagnostics";
import { Schema } from "../../src/Metadata/Schema";
import { EntityClass } from "../../src/Metadata/EntityClass";

describe("Diagnostics tests", () => {
  const validDiagnostic = { category: Diagnostics.DiagnosticCategory.Error, code: ECObjectsStatus.InvalidECJson, messageText: "message", defaultMessageText: "default message" };
  afterEach(() => {
  });

  it("isDiagnostic, valid Diagnostic, returns true", async () => {
    expect(Diagnostics.isDiagnostic(validDiagnostic)).to.be.true;
  });

  it("isDiagnostic, valid DiagnosticWithSchema, returns true", async () => {
    const diag = { ...validDiagnostic, ...{ schema: new Schema() } };
    expect(Diagnostics.isDiagnostic(diag)).to.be.true;
  });

  it("isDiagnostic, invalid Diagnostic, returns false", async () => {
    const diag = { category: Diagnostics.DiagnosticCategory.Error, code: ECObjectsStatus.InvalidECJson, messageText: "message" };
    expect(Diagnostics.isDiagnostic(diag)).to.be.false;
  });

  it("isSchemaDiagnostic, valid DiagnosticWithSchema, returns true", async () => {
    const diag = { ...validDiagnostic, ...{ schema: new Schema() } };
    expect(Diagnostics.isSchemaDiagnostic(diag)).to.be.true;
  });

  it("isSchemaDiagnostic, invalid DiagnosticWithSchema, returns false", async () => {
    const diag = validDiagnostic;
    expect(Diagnostics.isSchemaDiagnostic(diag)).to.be.false;
  });

  it("isSchemaItemDiagnostic, valid DiagnosticWithSchemaItem, returns true", async () => {
    const schema = new Schema("TestSchema", 1, 0, 0);
    const diag = { ...validDiagnostic, ...{ schema: schema, schemaItem: new EntityClass(schema, "TestEntityClass") } };
    expect(Diagnostics.isSchemaItemDiagnostic(diag)).to.be.true;
  });

  it("isSchemaItemDiagnostic, invalid DiagnosticWithSchemaItem, returns false", async () => {
    const diag = { ...validDiagnostic, ...{ schema: new Schema("TestSchema", 1, 0, 0) } };
    expect(Diagnostics.isSchemaItemDiagnostic(diag)).to.be.false;
  });

  it("isPropertyDiagnostic, valid DiagnosticWithProperty, returns true", async () => {
    const schema = new Schema("TestSchema", 1, 0, 0);
    const item = new EntityClass(schema, "TestEntityClass");
    const diag = { ...validDiagnostic, ...{ schema: schema, schemaItem: item, propertyName: "TestProperty" } };
    expect(Diagnostics.isPropertyDiagnostic(diag)).to.be.true;
  });

  it("isPropertyDiagnostic, invalid DiagnosticWithProperty, returns false", async () => {
    const schema = new Schema("TestSchema", 1, 0, 0);
    const item = new EntityClass(schema, "TestEntityClass");
    const diag = { ...validDiagnostic, ...{ schema: schema, schemaItem: item } };
    expect(Diagnostics.isPropertyDiagnostic(diag)).to.be.false;
  });

});
