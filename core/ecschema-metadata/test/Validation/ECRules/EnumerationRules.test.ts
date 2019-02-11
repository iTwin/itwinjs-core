/*---------------------------------------------------------------------------------------------
* Copyright (c) 2019 Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/

import { expect } from "chai";

import { SchemaContext } from "../../../src/Context";
import { PrimitiveType } from "../../../src/ECObjects";
import { Enumeration } from "../../../src/Metadata/Enumeration";
import { Schema } from "../../../src/Metadata/Schema";
import { DiagnosticCategory, DiagnosticType } from "../../../src/Validation/Diagnostic";
import * as Rules from "../../../src/Validation/ECRules";

describe("Enumeration rule tests", () => {
  let schema: Schema;

  beforeEach(async () => {
    schema = new Schema(new SchemaContext(), "TestSchema", 1, 0, 0);
  });

  it("enumerationTypeUnsupported, rule violated.", async () => {
    const enumeration = new Enumeration(schema, "TestEnum");

    const result = await Rules.enumerationTypeUnsupported(enumeration);

    expect(result).not.undefined;
    let resultHasEntries = false;
    for await (const diagnostic of result!) {
      resultHasEntries = true;
      expect(diagnostic).to.not.be.undefined;
      expect(diagnostic!.ecDefinition).to.equal(enumeration);
      expect(diagnostic!.messageArgs).to.eql([enumeration.fullName]);
      expect(diagnostic!.category).to.equal(DiagnosticCategory.Error);
      expect(diagnostic!.code).to.equal(Rules.DiagnosticCodes.EnumerationTypeUnsupported);
      expect(diagnostic!.diagnosticType).to.equal(DiagnosticType.SchemaItem);
    }
    expect(resultHasEntries, "expected rule to return an AsyncIterable with entries.").to.be.true;
  });

  it("enumerationTypeUnsupported, string type, rule passes.", async () => {
    const enumeration = new Enumeration(schema, "TestEnum", PrimitiveType.String);

    const result = await Rules.enumerationTypeUnsupported(enumeration);

    for await (const _diagnostic of result!) {
      expect(false, "Rule should have passed").to.be.true;
    }
  });

  it("enumerationTypeUnsupported, integer type, rule passes.", async () => {
    const enumeration = new Enumeration(schema, "TestEnum", PrimitiveType.Integer);

    const result = await Rules.enumerationTypeUnsupported(enumeration);

    for await (const _diagnostic of result!) {
      expect(false, "Rule should have passed").to.be.true;
    }
  });
});
