/*---------------------------------------------------------------------------------------------
* Copyright (c) 2019 Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/

import { expect } from "chai";
import { Schema } from "../../../src/Metadata/Schema";
import * as Rules from "../../../src/Validation/BisRules";
import { DiagnosticCategory, DiagnosticType } from "../../../src/Validation/Diagnostic";
import { DelayedPromiseWithProps } from "../../../src/DelayedPromise";
import { CustomAttributeClass } from "../../../src/Metadata/CustomAttributeClass";
import { SchemaContext } from "../../../src/Context";

describe("CustomAttributeClass Rule Tests", () => {
  let schema: Schema;

  beforeEach(async () => {
    schema = new Schema(new SchemaContext(), "TestSchema", 1, 0, 0);
  });

  describe("CustomAttributeClassCannotHaveBaseClasses tests", () => {
    it("CustomAttributeClass has base class, rule violated.", async () => {
      const baseCA = new CustomAttributeClass(schema, "BaseStruct");
      const caClass = new CustomAttributeClass(schema, "TestStruct");
      caClass.baseClass = new DelayedPromiseWithProps(baseCA.key, async () => baseCA);

      const result = await Rules.customAttributeClassCannotHaveBaseClasses(caClass);

      let resultHasEntries = false;
      for await (const diagnostic of result!) {
        resultHasEntries = true;
        expect(diagnostic).to.not.be.undefined;
        expect(diagnostic!.ecDefinition).to.equal(caClass);
        expect(diagnostic!.messageArgs).to.eql([caClass.fullName]);
        expect(diagnostic!.category).to.equal(DiagnosticCategory.Error);
        expect(diagnostic!.code).to.equal(Rules.DiagnosticCodes.CustomAttributeClassCannotHaveBaseClasses);
        expect(diagnostic!.diagnosticType).to.equal(DiagnosticType.SchemaItem);
      }
      expect(resultHasEntries, "expected rule to return an AsyncIterable with entries.").to.be.true;
    });

    it("CustomAttributeClass has no base class, rule passes.", async () => {
      const caClass = new CustomAttributeClass(schema, "TestStruct");

      const result = await Rules.customAttributeClassCannotHaveBaseClasses(caClass);

      for await (const _diagnostic of result!) {
        expect(false, "Rule should have passed").to.be.true;
      }
    });
  });
});
