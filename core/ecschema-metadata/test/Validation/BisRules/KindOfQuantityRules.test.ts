/*---------------------------------------------------------------------------------------------
* Copyright (c) 2019 Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/

import { expect } from "chai";
import { Schema } from "../../../src/Metadata/Schema";
import * as Rules from "../../../src/Validation/BisRules";
import { DiagnosticCategory, DiagnosticType } from "../../../src/Validation/Diagnostic";
import { KindOfQuantity } from "../../../src/Metadata/KindOfQuantity";
import { createSchemaJsonWithItems } from "../../TestUtils/DeserializationHelpers";
import { TestSchemaLocater } from "../../TestUtils/FormatTestHelper";
import { SchemaContext } from "../../../src/Context";

function createSchemaJson(koq: any) {
  return createSchemaJsonWithItems({
    TestKindOfQuantity: {
      schemaItemType: "KindOfQuantity",
      ...koq,
    },
  }, {
      references: [
        {
          name: "Formats",
          version: "1.0.0",
        },
      ],
    });
}

describe("KindOfQuantity Rule Tests", () => {
  let context: SchemaContext;
  let schema: Schema;

  const baseJson = {
    schemaItemType: "KindOfQuantity",
    name: "TestKindOfQuantity",
    label: "SomeDisplayLabel",
    description: "A really long description...",
  };

  beforeEach(() => {
    schema = new Schema(new SchemaContext(), "TestSchema", 1, 2, 3);
    context = new SchemaContext();
    context.addLocater(new TestSchemaLocater());
  });

  describe("KOQMustNotUseUnitlessRatios tests", () => {
    it("KindOfQuantity has 'PERCENTAGE' phenomenon, rule violated.", async () => {
      const koqProps = {
        ...baseJson,
        relativeError: 1.234,
        persistenceUnit: "Formats.PERCENT",
        presentationUnits: [
          "Formats.PERCENT",
        ],
      };
      schema = await Schema.fromJson(createSchemaJson(koqProps), context);
      const testKoq = await schema.getItem<KindOfQuantity>(koqProps.name) as KindOfQuantity;

      const result = await Rules.koqMustNotUseUnitlessRatios(testKoq);

      let resultHasEntries = false;
      for await (const diagnostic of result!) {
        resultHasEntries = true;
        expect(diagnostic).to.not.be.undefined;
        expect(diagnostic!.ecDefinition).to.equal(testKoq);
        expect(diagnostic!.messageArgs).to.eql([testKoq.fullName]);
        expect(diagnostic!.category).to.equal(DiagnosticCategory.Error);
        expect(diagnostic!.code).to.equal(Rules.DiagnosticCodes.KOQMustNotUseUnitlessRatios);
        expect(diagnostic!.diagnosticType).to.equal(DiagnosticType.SchemaItem);
      }
      expect(resultHasEntries, "expected rule to return an AsyncIterable with entries.").to.be.true;
    });

    it("KindOfQuantity does not have 'PERCENTAGE' phenomenon, rule passes.", async () => {
      const koqProps = {
        ...baseJson,
        relativeError: 1.234,
        persistenceUnit: "Formats.IN",
        presentationUnits: [
          "Formats.IN",
        ],
      };
      schema = await Schema.fromJson(createSchemaJson(koqProps), context);
      const testKoq = await schema.getItem<KindOfQuantity>(koqProps.name) as KindOfQuantity;

      const result = await Rules.koqMustNotUseUnitlessRatios(testKoq);

      for await (const _diagnostic of result!) {
        expect(false, "Rule should have passed").to.be.true;
      }
    });
  });

  describe("KOQMustUseSIUnitForPersistenceUnit tests", () => {
    it("KindOfQuantity does not have an 'SI' persistence unit, rule violated.", async () => {
      const koqProps = {
        ...baseJson,
        relativeError: 1.234,
        persistenceUnit: "Formats.IN",
        presentationUnits: [
          "Formats.IN",
        ],
      };
      schema = await Schema.fromJson(createSchemaJson(koqProps), context);
      const testKoq = await schema.getItem<KindOfQuantity>(koqProps.name) as KindOfQuantity;

      const result = await Rules.koqMustUseSIUnitForPersistenceUnit(testKoq);

      let resultHasEntries = false;
      for await (const diagnostic of result!) {
        resultHasEntries = true;
        expect(diagnostic).to.not.be.undefined;
        expect(diagnostic!.ecDefinition).to.equal(testKoq);
        expect(diagnostic!.messageArgs).to.eql([testKoq.fullName, "Formats.USCustom"]);
        expect(diagnostic!.category).to.equal(DiagnosticCategory.Error);
        expect(diagnostic!.code).to.equal(Rules.DiagnosticCodes.KOQMustUseSIUnitForPersistenceUnit);
        expect(diagnostic!.diagnosticType).to.equal(DiagnosticType.SchemaItem);
      }
      expect(resultHasEntries, "expected rule to return an AsyncIterable with entries.").to.be.true;
    });

    it("KindOfQuantity does have an 'SI' persistence unit, rule passes.", async () => {
      const koqProps = {
        ...baseJson,
        relativeError: 1.234,
        persistenceUnit: "Formats.M",
        presentationUnits: [
          "Formats.IN",
        ],
      };
      schema = await Schema.fromJson(createSchemaJson(koqProps), context);
      const testKoq = await schema.getItem<KindOfQuantity>(koqProps.name) as KindOfQuantity;

      const result = await Rules.koqMustUseSIUnitForPersistenceUnit(testKoq);

      for await (const _diagnostic of result!) {
        expect(false, "Rule should have passed").to.be.true;
      }
    });
  });
});
