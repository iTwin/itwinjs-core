/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/

import { expect } from "chai";
import { Enumeration, PrimitiveType, Schema, SchemaContext } from "@itwin/ecschema-metadata";
import * as Rules from "../../../Validation/ECRules";
import { DiagnosticCategory, DiagnosticType } from "../../../Validation/Diagnostic";

/* eslint-disable deprecation/deprecation */

describe("Enumeration rule tests", () => {
  let schema: Schema;

  beforeEach(async () => {
    schema = new Schema(new SchemaContext(), "TestSchema", "ts", 1, 0, 0);
  });

  it("enumerationTypeUnsupported, rule violated.", async () => {
    const enumeration = new Enumeration(schema, "TestEnum");

    const result = Rules.enumerationTypeUnsupported(enumeration);

    expect(result).not.undefined;
    let resultHasEntries = false;
    for await (const diagnostic of result) {
      resultHasEntries = true;
      expect(diagnostic.ecDefinition).to.equal(enumeration);
      expect(diagnostic.messageArgs).to.eql([enumeration.fullName]);
      expect(diagnostic.category).to.equal(DiagnosticCategory.Error);
      expect(diagnostic.code).to.equal(Rules.DiagnosticCodes.EnumerationTypeUnsupported);
      expect(diagnostic.diagnosticType).to.equal(DiagnosticType.SchemaItem);
    }
    expect(resultHasEntries, "expected rule to return an AsyncIterable with entries.").to.be.true;
  });

  it("enumerationTypeUnsupported, string type, rule passes.", async () => {
    const enumeration = new Enumeration(schema, "TestEnum", PrimitiveType.String);

    const result = Rules.enumerationTypeUnsupported(enumeration);
    for await (const _diagnostic of result) {
      expect(false, "Rule should have passed").to.be.true;
    }
  });

  it("enumerationTypeUnsupported, integer type, rule passes.", async () => {
    const enumeration = new Enumeration(schema, "TestEnum", PrimitiveType.Integer);

    const result = Rules.enumerationTypeUnsupported(enumeration);
    for await (const _diagnostic of result) {
      expect(false, "Rule should have passed").to.be.true;
    }
  });
});
