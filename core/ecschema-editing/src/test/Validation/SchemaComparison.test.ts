/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import { Schema, SchemaContext } from "@itwin/ecschema-metadata";
import { AnyDiagnostic, ISchemaChanges, ISchemaCompareReporter, SchemaChanges, SchemaCompareCodes, SchemaComparer } from "../../ecschema-editing";
import { expect } from "chai";

class TestSchemaCompareReporter implements ISchemaCompareReporter {
  public changes: SchemaChanges[] = [];
  public report(schemaChanges: ISchemaChanges): void {
    this.changes.push(schemaChanges as SchemaChanges);
  }
}

function findDiagnostic(diagnostics: AnyDiagnostic[], code: string, fullNameA: string, fullNameB?: string, propertyName?: string) {
  return diagnostics.find((diagnostic) => {
    if (propertyName !== undefined) {
      return diagnostic.code === code
        && diagnostic.messageArgs!.at(0) === propertyName
        && diagnostic.messageArgs!.at(1).toLowerCase() === fullNameA.toLowerCase()
        && diagnostic.messageArgs!.at(2).toLowerCase() === fullNameB!.toLowerCase();
    }
    if (fullNameB !== undefined) {
      return diagnostic.code === code
        && diagnostic.messageArgs!.at(0).fullName.toLowerCase() === fullNameA.toLowerCase()
        && diagnostic.messageArgs!.at(1).fullName.toLowerCase() === fullNameB.toLowerCase();
    }
    return diagnostic.code === code
      && diagnostic.messageArgs!.at(0).fullName.toLowerCase() === fullNameA.toLowerCase();
  });
}

describe("Schema comparison tests for comparing schemas with different names", () => {
  let reporter: TestSchemaCompareReporter;
  let contextA: SchemaContext;
  let contextB: SchemaContext;

  const dummyRefOneJson = {
    $schema: "https://dev.bentley.com/json_schemas/ec/32/ecschema",
    name: "DummyReferenceOne",
    version: "01.00.01",
    alias: "dumRefOne",
  };

  const dummyRefTwoJson = {
    $schema: "https://dev.bentley.com/json_schemas/ec/32/ecschema",
    name: "DummyReferenceTwo",
    version: "01.00.02",
    alias: "dumRefTwo",
  };

  const schemaAJson = {
    $schema: "https://dev.bentley.com/json_schemas/ec/32/ecschema",
    name: "SchemaA",
    version: "1.2.3",
    alias: "a",
    label: "labelA",
    description: "descriptionA",
  };

  const schemaBJson = {
    $schema: "https://dev.bentley.com/json_schemas/ec/32/ecschema",
    name: "SchemaB",
    version: "1.2.3",
    alias: "b",
    label: "labelB",
    description: "descriptionB",
  };

  beforeEach(async () => {
    reporter = new TestSchemaCompareReporter();
    contextA = new SchemaContext();
    contextB = new SchemaContext();
  });

  describe("SchemaItem comparisons cases", () => {
    describe("Constant comparisons cases", () => {
      const items = {
        testPhenomenon: {
          schemaItemType: "Phenomenon",
          definition: "testPhenomenon",
        },
      };

      it("should not report constant delta when the phenomenon class has the same name and is defined in comparable schemas", async () => {
        const schemaA = await Schema.fromJson({
          ...schemaAJson,
          items: {
            ...items,
            testConstant: {
              schemaItemType: "Constant",
              phenomenon: "SchemaA.testPhenomenon",
              definition: "test",
            },
          },
        }, contextA);

        const schemaB = await Schema.fromJson({
          ...schemaBJson,
          items: {
            ...items,
            testConstant: {
              schemaItemType: "Constant",
              phenomenon: "SchemaB.testPhenomenon",
              definition: "test",
            },
          },
        }, contextB);

        const comparer = new SchemaComparer(reporter);
        await comparer.compareSchemas(schemaA, schemaB);
        expect(findDiagnostic(reporter.changes[0].allDiagnostics, SchemaCompareCodes.ConstantDelta, "SchemaA.testPhenomenon", "SchemaB.testPhenomenon", "phenomenon")).to.be.undefined;
      });

      it("should report constant delta for phenomenon with the same name but defined in a referenced schema", async () => {
        await Schema.fromJson({
          ...dummyRefTwoJson,
          items: {
            ...items,
          },
        }, contextB);

        const schemaA = await Schema.fromJson({
          ...schemaAJson,
          items: {
            ...items,
            testConstant: {
              schemaItemType: "Constant",
              phenomenon: "SchemaA.testPhenomenon",
              definition: "test",
            },
          },
        }, contextA);

        const schemaB = await Schema.fromJson({
          ...schemaBJson,
          references: [
            {
              name: "DummyReferenceTwo",
              version: "01.00.02",
            },
          ],
          items: {
            testConstant: {
              schemaItemType: "Constant",
              phenomenon: "DummyReferenceTwo.testPhenomenon",
              definition: "test",
            },
          },
        }, contextB);

        const comparer = new SchemaComparer(reporter);
        await comparer.compareSchemas(schemaA, schemaB);
        expect(findDiagnostic(reporter.changes[0].allDiagnostics, SchemaCompareCodes.ConstantDelta, "SchemaA.testPhenomenon", "DummyReferenceTwo.testPhenomenon", "phenomenon")).to.be.not.undefined;
      });
    });

    describe("Unit comparisons cases", () => {
      const items = {
        testUnitSystem: {
          schemaItemType: "UnitSystem",
        },
        testPhenomenon: {
          schemaItemType: "Phenomenon",
          definition: "testPhenomenon",
        },
      };

      it("should not report unit delta when the phenomenon and unitSystem classes have the same names and are defined in comparable schemas", async () => {
        const schemaA = await Schema.fromJson({
          ...schemaAJson,
          items: {
            ...items,
            testUnit: {
              schemaItemType: "Unit",
              unitSystem: "SchemaA.testUnitSystem",
              phenomenon: "SchemaA.testPhenomenon",
              definition: "test",
            },
          },
        }, contextA);

        const schemaB = await Schema.fromJson({
          ...schemaBJson,
          items: {
            ...items,
            testUnit: {
              schemaItemType: "Unit",
              unitSystem: "SchemaB.testUnitSystem",
              phenomenon: "SchemaB.testPhenomenon",
              definition: "test",
            },
          },
        }, contextB);

        const comparer = new SchemaComparer(reporter);
        await comparer.compareSchemas(schemaA, schemaB);
        expect(findDiagnostic(reporter.changes[0].allDiagnostics, SchemaCompareCodes.UnitDelta, "SchemaA.testPhenomenon", "SchemaB.testPhenomenon", "phenomenon")).to.be.undefined;
        expect(findDiagnostic(reporter.changes[0].allDiagnostics, SchemaCompareCodes.UnitDelta, "SchemaA.testUnitSystem", "SchemaB.testUnitSystem", "unitSystem")).to.be.undefined;
      });

      it("should report unit delta for phenomenon and unitSystem with the same names but defined in a referenced schema", async () => {
        await Schema.fromJson({
          ...dummyRefTwoJson,
          items: {
            ...items,
          },
        }, contextB);

        const schemaA = await Schema.fromJson({
          ...schemaAJson,
          items: {
            ...items,
            testUnit: {
              schemaItemType: "Unit",
              unitSystem: "SchemaA.testUnitSystem",
              phenomenon: "SchemaA.testPhenomenon",
              definition: "test",
            },
          },
        }, contextA);

        const schemaB = await Schema.fromJson({
          ...schemaBJson,
          references: [
            {
              name: "DummyReferenceTwo",
              version: "01.00.02",
            },
          ],
          items: {
            testUnit: {
              schemaItemType: "Unit",
              unitSystem: "DummyReferenceTwo.testUnitSystem",
              phenomenon: "DummyReferenceTwo.testPhenomenon",
              definition: "test",
            },
          },
        }, contextB);

        const comparer = new SchemaComparer(reporter);
        await comparer.compareSchemas(schemaA, schemaB);
        expect(findDiagnostic(reporter.changes[0].allDiagnostics, SchemaCompareCodes.UnitDelta, "SchemaA.testPhenomenon", "DummyReferenceTwo.testPhenomenon", "phenomenon")).to.be.not.undefined;
        expect(findDiagnostic(reporter.changes[0].allDiagnostics, SchemaCompareCodes.UnitDelta, "SchemaA.testUnitSystem", "DummyReferenceTwo.testUnitSystem", "unitSystem")).to.be.not.undefined;
      });
    });

    describe("InvertedUnit comparisons cases", () => {
      const items = {
        testUnitSystem: {
          schemaItemType: "UnitSystem",
        },
        testPhenomenon: {
          schemaItemType: "Phenomenon",
          definition: "testPhenomenon",
        },
      };

      it("should not report invertedUnit delta when the invertsUnit and unitSystem classes have the same names and are defined in comparable schemas", async () => {
        const schemaA = await Schema.fromJson({
          ...schemaAJson,
          items: {
            ...items,
            testUnit: {
              schemaItemType: "Unit",
              unitSystem: "SchemaA.testUnitSystem",
              phenomenon: "SchemaA.testPhenomenon",
              definition: "test",
            },
            testInvertedUnit: {
              schemaItemType: "InvertedUnit",
              invertsUnit: "SchemaA.testUnit",
              unitSystem: "SchemaA.testUnitSystem",
            },
          },
        }, contextA);

        const schemaB = await Schema.fromJson({
          ...schemaBJson,
          items: {
            ...items,
            testUnit: {
              schemaItemType: "Unit",
              unitSystem: "SchemaB.testUnitSystem",
              phenomenon: "SchemaB.testPhenomenon",
              definition: "test",
            },
            testInvertedUnit: {
              schemaItemType: "InvertedUnit",
              invertsUnit: "SchemaB.testUnit",
              unitSystem: "SchemaB.testUnitSystem",
            },
          },
        }, contextB);

        const comparer = new SchemaComparer(reporter);
        await comparer.compareSchemas(schemaA, schemaB);
        expect(findDiagnostic(reporter.changes[0].allDiagnostics, SchemaCompareCodes.InvertedUnitDelta, "SchemaA.testUnit", "SchemaB.testUnit", "invertsUnit")).to.be.undefined;
        expect(findDiagnostic(reporter.changes[0].allDiagnostics, SchemaCompareCodes.InvertedUnitDelta, "SchemaA.testUnitSystem", "SchemaB.testUnitSystem", "unitSystem")).to.be.undefined;
      });

      it("should report invertedUnit delta for unitSystem and invertsUnit with the same names but defined in a referenced schema", async () => {
        await Schema.fromJson({
          ...dummyRefTwoJson,
          items: {
            ...items,
            testUnit: {
              schemaItemType: "Unit",
              unitSystem: "DummyReferenceTwo.testUnitSystem",
              phenomenon: "DummyReferenceTwo.testPhenomenon",
              definition: "test",
            },
          },
        }, contextB);

        const schemaA = await Schema.fromJson({
          ...schemaAJson,
          items: {
            ...items,
            testUnit: {
              schemaItemType: "Unit",
              unitSystem: "SchemaA.testUnitSystem",
              phenomenon: "SchemaA.testPhenomenon",
              definition: "test",
            },
            testInvertedUnit: {
              schemaItemType: "InvertedUnit",
              invertsUnit: "SchemaA.testUnit",
              unitSystem: "SchemaA.testUnitSystem",
            },
          },
        }, contextA);

        const schemaB = await Schema.fromJson({
          ...schemaBJson,
          references: [
            {
              name: "DummyReferenceTwo",
              version: "01.00.02",
            },
          ],
          items: {
            testInvertedUnit: {
              schemaItemType: "InvertedUnit",
              invertsUnit: "DummyReferenceTwo.testUnit",
              unitSystem: "DummyReferenceTwo.testUnitSystem",
            },
          },
        }, contextB);

        const comparer = new SchemaComparer(reporter);
        await comparer.compareSchemas(schemaA, schemaB);
        expect(findDiagnostic(reporter.changes[0].allDiagnostics, SchemaCompareCodes.InvertedUnitDelta, "SchemaA.testUnit", "DummyReferenceTwo.testUnit", "invertsUnit")).to.be.not.undefined;
        expect(findDiagnostic(reporter.changes[0].allDiagnostics, SchemaCompareCodes.InvertedUnitDelta, "SchemaA.testUnitSystem", "DummyReferenceTwo.testUnitSystem", "unitSystem")).to.be.not.undefined;
      });
    });

    describe("KindOfQuantity comparisons cases", () => {
      const items = {
        testUnitSystem: {
          schemaItemType: "UnitSystem",
        },
        testPhenomenon: {
          schemaItemType: "Phenomenon",
          definition: "TestPhenomenon",
        },
        testFormat: {
          schemaItemType: "Format",
          type: "Decimal",
          precision: 6,
          formatTraits: [
            "KeepSingleZero",
            "KeepDecimalPoint",
            "ShowUnitLabel",
          ],
          decimalSeparator: ",",
          thousandSeparator: " ",
        },
      };

      it("should not report kindOfQuantity delta when the presentationFormats and persistenceUnit have the same names and are defined in comparable schemas", async () => {
        const schemaA = await Schema.fromJson({
          ...schemaAJson,
          items: {
            ...items,
            testUnit: {
              schemaItemType: "Unit",
              unitSystem: "SchemaA.testUnitSystem",
              phenomenon: "SchemaA.testPhenomenon",
              definition: "test",
            },
            testKoq: {
              schemaItemType: "KindOfQuantity",
              relativeError: 0.0028,
              persistenceUnit: "SchemaA.testUnit",
              presentationUnits: [
                "SchemaA.testFormat(4)[SchemaA.testUnit|undefined]",
              ],
            },
          },
        }, contextA);

        const schemaB = await Schema.fromJson({
          ...schemaBJson,
          items: {
            ...items,
            testUnit: {
              schemaItemType: "Unit",
              unitSystem: "SchemaB.testUnitSystem",
              phenomenon: "SchemaB.testPhenomenon",
              definition: "test",
            },
            testKoq: {
              schemaItemType: "KindOfQuantity",
              relativeError: 0.0028,
              persistenceUnit: "SchemaB.testUnit",
              presentationUnits: [
                "SchemaB.testFormat(4)[SchemaB.testUnit|undefined]",
              ],
            },
          },
        }, contextB);

        const comparer = new SchemaComparer(reporter);
        await comparer.compareSchemas(schemaA, schemaB);
        expect(findDiagnostic(reporter.changes[0].allDiagnostics, SchemaCompareCodes.KoqDelta, "SchemaA.testUnit", "SchemaB.testUnit", "persistenceUnit")).to.be.undefined;
        expect(findDiagnostic(reporter.changes[0].allDiagnostics, SchemaCompareCodes.PresentationUnitMissing, "SchemaA.testFormat(4)[SchemaA.testUnit|undefined]")).to.be.undefined;
      });

      it("should report presentation unit missing when the presentationFormats have the same names but different precision", async () => {
        const schemaA = await Schema.fromJson({
          ...schemaAJson,
          items: {
            ...items,
            testUnit: {
              schemaItemType: "Unit",
              unitSystem: "SchemaA.testUnitSystem",
              phenomenon: "SchemaA.testPhenomenon",
              definition: "test",
            },
            testKoq: {
              schemaItemType: "KindOfQuantity",
              relativeError: 0.0028,
              persistenceUnit: "SchemaA.testUnit",
              presentationUnits: [
                "SchemaA.testFormat(4)[SchemaA.testUnit|undefined]",
              ],
            },
          },
        }, contextA);

        const schemaB = await Schema.fromJson({
          ...schemaBJson,
          items: {
            ...items,
            testUnit: {
              schemaItemType: "Unit",
              unitSystem: "SchemaB.testUnitSystem",
              phenomenon: "SchemaB.testPhenomenon",
              definition: "test",
            },
            testKoq: {
              schemaItemType: "KindOfQuantity",
              relativeError: 0.0028,
              persistenceUnit: "SchemaB.testUnit",
              presentationUnits: [
                "SchemaB.testFormat(3)[SchemaB.testUnit|undefined]",
              ],
            },
          },
        }, contextB);

        const comparer = new SchemaComparer(reporter);
        await comparer.compareSchemas(schemaA, schemaB);
        expect(findDiagnostic(reporter.changes[0].allDiagnostics, SchemaCompareCodes.PresentationUnitMissing, "SchemaA.testFormat(4)[SchemaA.testUnit|undefined]")).to.be.not.undefined;
      });

      it("should report presentation unit missing when the presentationFormats have the same names but different labels", async () => {
        const schemaA = await Schema.fromJson({
          ...schemaAJson,
          items: {
            ...items,
            testUnit: {
              schemaItemType: "Unit",
              unitSystem: "SchemaA.testUnitSystem",
              phenomenon: "SchemaA.testPhenomenon",
              definition: "test",
            },
            testKoq: {
              schemaItemType: "KindOfQuantity",
              relativeError: 0.0028,
              persistenceUnit: "SchemaA.testUnit",
              presentationUnits: [
                "SchemaA.testFormat(4)[SchemaA.testUnit|test]",
              ],
            },
          },
        }, contextA);

        const schemaB = await Schema.fromJson({
          ...schemaBJson,
          items: {
            ...items,
            testUnit: {
              schemaItemType: "Unit",
              unitSystem: "SchemaB.testUnitSystem",
              phenomenon: "SchemaB.testPhenomenon",
              definition: "test",
            },
            testKoq: {
              schemaItemType: "KindOfQuantity",
              relativeError: 0.0028,
              persistenceUnit: "SchemaB.testUnit",
              presentationUnits: [
                "SchemaB.testFormat(4)[SchemaB.testUnit|undefined]",
              ],
            },
          },
        }, contextB);

        const comparer = new SchemaComparer(reporter);
        await comparer.compareSchemas(schemaA, schemaB);
        expect(findDiagnostic(reporter.changes[0].allDiagnostics, SchemaCompareCodes.PresentationUnitMissing, "SchemaA.testFormat(4)[SchemaA.testUnit|test]")).to.be.not.undefined;
      });

      it("should report kindOfQuantity delta for presentationFormats and persistenceUnit with the same names but defined in a referenced schema", async () => {
        await Schema.fromJson({
          ...dummyRefTwoJson,
          items: {
            ...items,
            testUnit: {
              schemaItemType: "Unit",
              unitSystem: "DummyReferenceTwo.testUnitSystem",
              phenomenon: "DummyReferenceTwo.testPhenomenon",
              definition: "test",
            },
          },
        }, contextB);

        const schemaA = await Schema.fromJson({
          ...schemaAJson,
          items: {
            ...items,
            testUnit: {
              schemaItemType: "Unit",
              unitSystem: "SchemaA.testUnitSystem",
              phenomenon: "SchemaA.testPhenomenon",
              definition: "test",
            },
            testKoq: {
              schemaItemType: "KindOfQuantity",
              relativeError: 0.0028,
              persistenceUnit: "SchemaA.testUnit",
              presentationUnits: [
                "SchemaA.testFormat(4)[SchemaA.testUnit|undefined]",
              ],
            },
          },
        }, contextA);

        const schemaB = await Schema.fromJson({
          ...schemaBJson,
          references: [
            {
              name: "DummyReferenceTwo",
              version: "01.00.02",
            },
          ],
          items: {
            testKoq: {
              schemaItemType: "KindOfQuantity",
              relativeError: 0.0028,
              persistenceUnit: "DummyReferenceTwo.testUnit",
              presentationUnits: [
                "DummyReferenceTwo.testFormat(4)[DummyReferenceTwo.testUnit|undefined]",
              ],
            },
          },
        }, contextB);

        const comparer = new SchemaComparer(reporter);
        await comparer.compareSchemas(schemaA, schemaB);
        expect(findDiagnostic(reporter.changes[0].allDiagnostics, SchemaCompareCodes.KoqDelta, "SchemaA.testUnit", "DummyReferenceTwo.testUnit", "persistenceUnit")).to.be.not.undefined;
        expect(findDiagnostic(reporter.changes[0].allDiagnostics, SchemaCompareCodes.PresentationUnitMissing, "SchemaA.testFormat(4)[SchemaA.testUnit|undefined]")).to.be.not.undefined;
      });
    });

    describe("Format comparisons cases", () => {
      function getItems(schemaName: string) {
        return {
          testUnitSystem: {
            schemaItemType: "UnitSystem",
          },
          testPhenomenon: {
            schemaItemType: "Phenomenon",
            definition: "TestPhenomenon",
          },
          ft: {
            schemaItemType: "Unit",
            phenomenon: `${schemaName}.testPhenomenon`,
            unitSystem: `${schemaName}.testUnitSystem`,
            definition: "IN",
          },
          in: {
            schemaItemType: "Unit",
            phenomenon: `${schemaName}.testPhenomenon`,
            unitSystem: `${schemaName}.testUnitSystem`,
            definition: "MM",
          },
        };
      }

      it("should not report Format delta when the unit classes have the same names and are defined in comparable schemas", async () => {
        const schemaA = await Schema.fromJson({
          ...schemaAJson,
          items: {
            ...getItems("SchemaA"),
            testFormat: {
              schemaItemType: "Format",
              type: "Fractional",
              precision: 8,
              formatTraits: [
                "KeepSingleZero",
                "KeepDecimalPoint",
                "ShowUnitLabel",
              ],
              decimalSeparator: ",",
              thousandSeparator: ".",
              uomSeparator: "",
              composite: {
                spacer: "",
                units: [
                  {
                    name: "SchemaA.ft",
                    label: "'",
                  },
                  {
                    name: "SchemaA.in",
                    label: "\"",
                  },
                ],
              },
            },
          },
        }, contextA);

        const schemaB = await Schema.fromJson({
          ...schemaBJson,
          items: {
            ...getItems("SchemaB"),
            testFormat: {
              schemaItemType: "Format",
              type: "Fractional",
              precision: 8,
              formatTraits: [
                "KeepSingleZero",
                "KeepDecimalPoint",
                "ShowUnitLabel",
              ],
              decimalSeparator: ",",
              thousandSeparator: ".",
              uomSeparator: "",
              composite: {
                spacer: "",
                units: [
                  {
                    name: "SchemaB.ft",
                    label: "'",
                  },
                  {
                    name: "SchemaB.in",
                    label: "\"",
                  },
                ],
              },
            },
          },
        }, contextB);

        const comparer = new SchemaComparer(reporter);
        await comparer.compareSchemas(schemaA, schemaB);

        expect(findDiagnostic(reporter.changes[0].allDiagnostics, SchemaCompareCodes.FormatUnitMissing, "SchemaA.FT")).to.be.undefined;
        expect(findDiagnostic(reporter.changes[0].allDiagnostics, SchemaCompareCodes.FormatUnitMissing, "SchemaA.IN")).to.be.undefined;
      });

      it("should report format delta for units with the same names but defined in a referenced schema", async () => {
        await Schema.fromJson({
          ...dummyRefTwoJson,
          items: {
            ...getItems("DummyReferenceTwo"),
          },
        }, contextB);

        const schemaA = await Schema.fromJson({
          ...schemaAJson,
          items: {
            ...getItems("SchemaA"),
            testFormat: {
              schemaItemType: "Format",
              type: "Fractional",
              precision: 8,
              formatTraits: [
                "KeepSingleZero",
                "KeepDecimalPoint",
                "ShowUnitLabel",
              ],
              decimalSeparator: ",",
              thousandSeparator: ".",
              uomSeparator: "",
              composite: {
                spacer: "",
                units: [
                  {
                    name: "SchemaA.ft",
                    label: "'",
                  },
                  {
                    name: "SchemaA.in",
                    label: "\"",
                  },
                ],
              },
            },
          },
        }, contextA);

        const schemaB = await Schema.fromJson({
          ...schemaBJson,
          references: [
            {
              name: "DummyReferenceTwo",
              version: "01.00.02",
            },
          ],
          items: {
            testFormat: {
              schemaItemType: "Format",
              type: "Fractional",
              precision: 8,
              formatTraits: [
                "KeepSingleZero",
                "KeepDecimalPoint",
                "ShowUnitLabel",
              ],
              decimalSeparator: ",",
              thousandSeparator: ".",
              uomSeparator: "",
              composite: {
                spacer: "",
                units: [
                  {
                    name: "DummyReferenceTwo.ft",
                    label: "'",
                  },
                  {
                    name: "DummyReferenceTwo.in",
                    label: "\"",
                  },
                ],
              },
            },
          },
        }, contextB);

        const comparer = new SchemaComparer(reporter);
        await comparer.compareSchemas(schemaA, schemaB);
        expect(findDiagnostic(reporter.changes[0].allDiagnostics, SchemaCompareCodes.FormatUnitMissing, "SchemaA.FT")).to.be.not.undefined;
        expect(findDiagnostic(reporter.changes[0].allDiagnostics, SchemaCompareCodes.FormatUnitMissing, "SchemaA.IN")).to.be.not.undefined;
      });
    });
  });

  describe("Class comparisons cases", () => {
    describe("Entity Class comparisons cases", () => {
      it("should not report baseClass delta when the base class has the same name and is defined in comparable schemas", async () => {
        const schemaA = await Schema.fromJson({
          ...schemaAJson,
          items: {
            testBaseClass: {
              schemaItemType: "EntityClass",
            },
            testEntityClass: {
              schemaItemType: "EntityClass",
              baseClass: "SchemaA.testBaseClass",
            },
          },
        }, contextA);

        const schemaB = await Schema.fromJson({
          ...schemaBJson,
          items: {
            testBaseClass: {
              schemaItemType: "EntityClass",
            },
            testEntityClass: {
              schemaItemType: "EntityClass",
              baseClass: "SchemaB.testBaseClass",
            },
          },
        }, contextB);

        const comparer = new SchemaComparer(reporter);
        await comparer.compareSchemas(schemaA, schemaB);
        expect(findDiagnostic(reporter.changes[0].allDiagnostics, SchemaCompareCodes.BaseClassDelta, "SchemaA.testBaseClass", "SchemaB.testBaseClass")).to.be.undefined;
      });

      it("should report baseClass delta when base class has different full name", async () => {
        const schemaA = await Schema.fromJson({
          ...schemaAJson,
          items: {
            testBaseClassA: {
              schemaItemType: "EntityClass",
            },
            testEntityClass: {
              schemaItemType: "EntityClass",
              baseClass: "SchemaA.testBaseClassA",
            },
          },
        }, contextA);

        const schemaB = await Schema.fromJson({
          ...schemaBJson,
          items: {
            testBaseClassB: {
              schemaItemType: "EntityClass",
            },
            testEntityClass: {
              schemaItemType: "EntityClass",
              baseClass: "SchemaB.testBaseClassB",
            },
          },
        }, contextB);

        const comparer = new SchemaComparer(reporter);
        await comparer.compareSchemas(schemaA, schemaB);
        expect(findDiagnostic(reporter.changes[0].allDiagnostics, SchemaCompareCodes.BaseClassDelta, "SchemaA.testBaseClassA", "SchemaB.testBaseClassB")).to.be.not.undefined;
      });

      it("should report baseClass delta for baseClass with the same name but defined in a referenced schema", async () => {
        await Schema.fromJson({
          ...dummyRefTwoJson,
          items: {
            testBaseClass: {
              schemaItemType: "EntityClass",
            },
          },
        }, contextB);

        const schemaA = await Schema.fromJson({
          ...schemaAJson,
          items: {
            testBaseClass: {
              schemaItemType: "EntityClass",
            },
            testEntityClass: {
              schemaItemType: "EntityClass",
              baseClass: "SchemaA.testBaseClass",
            },
          },
        }, contextA);

        const schemaB = await Schema.fromJson({
          ...schemaBJson,
          references: [
            {
              name: "DummyReferenceTwo",
              version: "01.00.02",
            },
          ],
          items: {
            testEntityClass: {
              schemaItemType: "EntityClass",
              baseClass: "DummyReferenceTwo.testBaseClass",
            },
          },
        }, contextB);

        const comparer = new SchemaComparer(reporter);
        await comparer.compareSchemas(schemaA, schemaB);
        expect(findDiagnostic(reporter.changes[0].allDiagnostics, SchemaCompareCodes.BaseClassDelta, "SchemaA.testBaseClass", "DummyReferenceTwo.testBaseClass")).to.be.not.undefined;
      });

      it("should not report baseClass delta if the full names are the same, even though the schema containing the definition classA has a different name ", async () => {
        const schemaA = await Schema.fromJson({
          ...schemaAJson,
          items: {
            testBaseClass: {
              schemaItemType: "EntityClass",
            },
            testEntityClass: {
              schemaItemType: "EntityClass",
              baseClass: "SchemaA.testBaseClass",
            },
          },
        }, contextA);

        const schemaB = await Schema.fromJson({
          ...schemaBJson,
          references: [
            {
              name: "SchemaA",
              version: "1.2.3",
            },
          ],
          items: {
            testEntityClass: {
              schemaItemType: "EntityClass",
              baseClass: "SchemaA.testBaseClass",
            },
          },

        }, contextA);
        const comparer = new SchemaComparer(reporter);
        await comparer.compareSchemas(schemaA, schemaB);
        expect(findDiagnostic(reporter.changes[0].allDiagnostics, SchemaCompareCodes.BaseClassDelta, "SchemaA.testBaseClass", "SchemaA.testBaseClass")).to.be.undefined;
      });
    });

    describe("Mixin comparisons cases", () => {
      it("should not report Mixin delta when appliesTo has the same name and is defined in comparable schemas", async () => {
        const schemaA = await Schema.fromJson({
          ...schemaAJson,
          items: {
            testEntity: {
              schemaItemType: "EntityClass",
            },
            testMixin: {
              schemaItemType: "Mixin",
              appliesTo: "SchemaA.testEntity",
            },
            testMixin2: {
              schemaItemType: "Mixin",
              appliesTo: "SchemaA.testEntity",
            },
          },
        }, contextA);

        const schemaB = await Schema.fromJson({
          ...schemaBJson,
          items: {
            testEntity: {
              schemaItemType: "EntityClass",
            },
            testEntity2: {
              schemaItemType: "EntityClass",
            },
            testMixin: {
              schemaItemType: "Mixin",
              appliesTo: "SchemaB.testEntity",
            },
            testMixin2: {
              schemaItemType: "Mixin",
              appliesTo: "SchemaB.testEntity2",
            },
          },
        }, contextB);

        const comparer = new SchemaComparer(reporter);
        await comparer.compareSchemas(schemaA, schemaB);
        expect(findDiagnostic(reporter.changes[0].allDiagnostics, SchemaCompareCodes.MixinDelta, "SchemaA.testEntity", "SchemaB.testEntity", "appliesTo")).to.be.undefined;
        expect(findDiagnostic(reporter.changes[0].allDiagnostics, SchemaCompareCodes.MixinDelta, "SchemaA.testEntity", "SchemaB.testEntity2", "appliesTo")).to.be.not.undefined;
      });

      it("should report Mixin delta for appliesTo with the same name but defined in a referenced schema", async () => {
        await Schema.fromJson({
          ...dummyRefTwoJson,
          items: {
            testEntity: {
              schemaItemType: "EntityClass",
            },
          },
        }, contextB);

        const schemaA = await Schema.fromJson({
          ...schemaAJson,
          items: {
            testEntity: {
              schemaItemType: "EntityClass",
            },
            testMixin: {
              schemaItemType: "Mixin",
              appliesTo: "SchemaA.testEntity",
            },
          },
        }, contextA);

        const schemaB = await Schema.fromJson({
          ...schemaBJson,
          references: [
            {
              name: "DummyReferenceTwo",
              version: "01.00.02",
            },
          ],
          items: {
            testMixin: {
              schemaItemType: "Mixin",
              appliesTo: "DummyReferenceTwo.testEntity",
            },
          },
        }, contextB);

        const comparer = new SchemaComparer(reporter);
        await comparer.compareSchemas(schemaA, schemaB);
        expect(findDiagnostic(reporter.changes[0].allDiagnostics, SchemaCompareCodes.MixinDelta, "SchemaA.testEntity", "DummyReferenceTwo.testEntity", "appliesTo")).to.be.not.undefined;
      });
    });

    describe("Relationship Class comparisons cases", () => {
      it("should not report Relationship Constraint delta when abstract constraint has the same name and is defined in comparable schemas", async () => {
        const schemaA = await Schema.fromJson({
          ...schemaAJson,
          items: {
            sourceEntity: {
              schemaItemType: "EntityClass",
            },
            targetEntity: {
              schemaItemType: "EntityClass",
            },
            testRelationship: {
              schemaItemType: "RelationshipClass",
              strength: "Referencing",
              strengthDirection: "Forward",
              source: {
                multiplicity: "(0..*)",
                polymorphic: true,
                roleLabel: "refers to",
                abstractConstraint: "SchemaA.sourceEntity",
                constraintClasses: [
                  "SchemaA.sourceEntity",
                ],
              },
              target: {
                multiplicity: "(0..*)",
                roleLabel: "is referenced by",
                polymorphic: true,
                abstractConstraint: "SchemaA.targetEntity",
                constraintClasses: [
                  "SchemaA.targetEntity",
                ],
              },
            },
          },
        }, contextA);

        const schemaB = await Schema.fromJson({
          ...schemaBJson,
          items: {
            sourceEntity: {
              schemaItemType: "EntityClass",
            },
            targetEntity: {
              schemaItemType: "EntityClass",
            },
            testRelationship: {
              schemaItemType: "RelationshipClass",
              strength: "Referencing",
              strengthDirection: "Forward",
              source: {
                multiplicity: "(0..*)",
                polymorphic: true,
                roleLabel: "refers to",
                abstractConstraint: "SchemaB.sourceEntity",
                constraintClasses: [
                  "SchemaB.sourceEntity",
                ],
              },
              target: {
                multiplicity: "(0..*)",
                roleLabel: "is referenced by",
                polymorphic: true,
                abstractConstraint: "SchemaB.targetEntity",
                constraintClasses: [
                  "SchemaB.targetEntity",
                ],
              },
            },
          },
        }, contextB);

        const comparer = new SchemaComparer(reporter);
        await comparer.compareSchemas(schemaA, schemaB);
        expect(findDiagnostic(reporter.changes[0].allDiagnostics, SchemaCompareCodes.RelationshipConstraintDelta, "SchemaA.sourceEntity", "SchemaB.sourceEntity", "abstractConstraint")).to.be.undefined;
        expect(findDiagnostic(reporter.changes[0].allDiagnostics, SchemaCompareCodes.RelationshipConstraintDelta, "SchemaA.targetEntity", "SchemaB.targetEntity", "abstractConstraint")).to.be.undefined;
        expect(findDiagnostic(reporter.changes[0].allDiagnostics, SchemaCompareCodes.RelationshipConstraintClassMissing, "SchemaA.sourceEntity")).to.be.undefined;
        expect(findDiagnostic(reporter.changes[0].allDiagnostics, SchemaCompareCodes.RelationshipConstraintClassMissing, "SchemaA.targetEntity")).to.be.undefined;
      });

      it("should report Relationship Constraint delta for abstract constraint with the same name but defined in a referenced schema", async () => {
        await Schema.fromJson({
          ...dummyRefTwoJson,
          items: {
            sourceEntity: {
              schemaItemType: "EntityClass",
            },
            targetEntity: {
              schemaItemType: "EntityClass",
            },
          },
        }, contextB);

        const schemaA = await Schema.fromJson({
          ...schemaAJson,
          items: {
            sourceEntity: {
              schemaItemType: "EntityClass",
            },
            targetEntity: {
              schemaItemType: "EntityClass",
            },
            testRelationship: {
              schemaItemType: "RelationshipClass",
              strength: "Referencing",
              strengthDirection: "Forward",
              source: {
                multiplicity: "(0..*)",
                polymorphic: true,
                roleLabel: "refers to",
                abstractConstraint: "SchemaA.sourceEntity",
                constraintClasses: [
                  "SchemaA.sourceEntity",
                ],
              },
              target: {
                multiplicity: "(0..*)",
                roleLabel: "is referenced by",
                polymorphic: true,
                abstractConstraint: "SchemaA.targetEntity",
                constraintClasses: [
                  "SchemaA.targetEntity",
                ],
              },
            },
          },
        }, contextA);

        const schemaB = await Schema.fromJson({
          ...schemaBJson,
          references: [
            {
              name: "DummyReferenceTwo",
              version: "01.00.02",
            },
          ],
          items: {
            testRelationship: {
              schemaItemType: "RelationshipClass",
              strength: "Referencing",
              strengthDirection: "Forward",
              source: {
                multiplicity: "(0..*)",
                polymorphic: true,
                roleLabel: "refers to",
                abstractConstraint: "DummyReferenceTwo.sourceEntity",
                constraintClasses: [
                  "DummyReferenceTwo.sourceEntity",
                ],
              },
              target: {
                multiplicity: "(0..*)",
                roleLabel: "is referenced by",
                polymorphic: true,
                abstractConstraint: "DummyReferenceTwo.targetEntity",
                constraintClasses: [
                  "DummyReferenceTwo.targetEntity",
                ],
              },
            },
          },
        }, contextB);

        const comparer = new SchemaComparer(reporter);
        await comparer.compareSchemas(schemaA, schemaB);
        expect(findDiagnostic(reporter.changes[0].allDiagnostics, SchemaCompareCodes.RelationshipConstraintDelta, "SchemaA.sourceEntity", "DummyReferenceTwo.sourceEntity", "abstractConstraint")).to.be.not.undefined;
        expect(findDiagnostic(reporter.changes[0].allDiagnostics, SchemaCompareCodes.RelationshipConstraintDelta, "SchemaA.targetEntity", "DummyReferenceTwo.targetEntity", "abstractConstraint")).to.be.not.undefined;
        expect(findDiagnostic(reporter.changes[0].allDiagnostics, SchemaCompareCodes.RelationshipConstraintClassMissing, "SchemaA.sourceEntity")).to.be.not.undefined;
        expect(findDiagnostic(reporter.changes[0].allDiagnostics, SchemaCompareCodes.RelationshipConstraintClassMissing, "SchemaA.targetEntity")).to.be.not.undefined;
      });
    });
  });

  describe("Property comparison cases", ()=> {
    function items(schemaName: string) {
      return {
        testUnitSystem: {
          schemaItemType: "UnitSystem",
        },
        testPhenomenon: {
          schemaItemType: "Phenomenon",
          definition: "TestPhenomenon",
        },
        testUnit: {
          schemaItemType: "Unit",
          unitSystem: `${schemaName}.testUnitSystem`,
          phenomenon: `${schemaName}.testPhenomenon`,
          definition: "test",
        },
        testKoq: {
          schemaItemType: "KindOfQuantity",
          relativeError: 0.0028,
          persistenceUnit: `${schemaName}.testUnit`,
        },
      };
    }

    it("should not report property delta when the category class has the same name and is defined in comparable schemas", async ()=> {
      const schemaA = await Schema.fromJson({
        ...schemaAJson,
        items: {
          testCategory: {
            schemaItemType: "PropertyCategory",
            type: "string",
            priority: 1,
          },
          testEntityClass: {
            schemaItemType: "EntityClass",
            properties: [
              {
                name: "testProperty",
                type: "PrimitiveArrayProperty",
                typeName: "string",
                category: "SchemaA.testCategory",
              },
            ],
          },
        },
      }, contextA);

      const schemaB = await Schema.fromJson({
        ...schemaBJson,
        items: {
          testCategory: {
            schemaItemType: "PropertyCategory",
            type: "string",
            priority: 1,
          },
          testEntityClass: {
            schemaItemType: "EntityClass",
            properties: [
              {
                name: "testProperty",
                type: "PrimitiveArrayProperty",
                typeName: "string",
                category: "SchemaB.testCategory",
              },
            ],
          },
        },
      }, contextB);

      const comparer = new SchemaComparer(reporter);
      await comparer.compareSchemas(schemaA, schemaB);
      expect(findDiagnostic(reporter.changes[0].allDiagnostics, SchemaCompareCodes.PropertyDelta, "SchemaA.testCategory", "SchemaB.testCategory", "category")).to.be.undefined;
    });

    it("should not report property delta when the kind of quantity class has the same name and is defined in comparable schemas", async ()=> {
      const schemaA = await Schema.fromJson({
        ...schemaAJson,
        items: {
          ...items("SchemaA"),
          testEntityClass: {
            schemaItemType: "EntityClass",
            properties: [
              {
                name: "testProperty",
                type: "PrimitiveArrayProperty",
                typeName: "int",
                kindOfQuantity: "SchemaA.testKoq",
              },
            ],
          },
        },
      }, contextA);

      const schemaB = await Schema.fromJson({
        ...schemaBJson,
        items: {
          ...items("SchemaB"),
          testEntityClass: {
            schemaItemType: "EntityClass",
            properties: [
              {
                name: "testProperty",
                type: "PrimitiveArrayProperty",
                typeName: "int",
                kindOfQuantity: "SchemaB.testKoq",
              },
            ],
          },
        },
      }, contextB);

      const comparer = new SchemaComparer(reporter);
      await comparer.compareSchemas(schemaA, schemaB);
      expect(findDiagnostic(reporter.changes[0].allDiagnostics, SchemaCompareCodes.PropertyDelta, "SchemaA.testKoq", "SchemaB.testKoq", "kindOfQuantity")).to.be.undefined;
    });

    it("should report property delta for category with the same name but defined in a referenced schema", async ()=> {
      await Schema.fromJson({
        ...dummyRefOneJson,
        items: {
          testCategory: {
            schemaItemType: "PropertyCategory",
            type: "int",
            priority: 1,
          },
        },
      }, contextA);

      const schemaA = await Schema.fromJson({
        ...schemaAJson,
        references: [
          {
            name: "DummyReferenceOne",
            version: "01.00.01",
          },
        ],
        items: {
          testStructClass: {
            schemaItemType: "StructClass",
            properties: [
              {
                name: "testProperty",
                type: "PrimitiveProperty",
                typeName: "int",
                category: "DummyReferenceOne.testCategory",
              },
            ],
          },
        },
      }, contextA);

      const schemaB = await Schema.fromJson({
        ...schemaBJson,
        items: {
          testCategory: {
            schemaItemType: "PropertyCategory",
            type: "string",
            priority: 1,
          },
          testStructClass: {
            schemaItemType: "StructClass",
            properties: [
              {
                name: "testProperty",
                type: "PrimitiveProperty",
                typeName: "int",
                category: "SchemaB.testCategory",
              },
            ],
          },
        },
      }, contextB);

      const comparer = new SchemaComparer(reporter);
      await comparer.compareSchemas(schemaA, schemaB);
      expect(findDiagnostic(reporter.changes[0].allDiagnostics, SchemaCompareCodes.PropertyDelta, "DummyReferenceOne.testCategory", "SchemaB.testCategory", "category")).to.be.not.undefined;
    });

    it("should report property delta for kind of quantity with the same name but defined in a referenced schema", async ()=> {
      await Schema.fromJson({
        ...dummyRefOneJson,
        items: {
          ...items("DummyReferenceOne"),
        },
      }, contextA);

      const schemaA = await Schema.fromJson({
        ...schemaAJson,
        references: [
          {
            name: "DummyReferenceOne",
            version: "01.00.01",
          },
        ],
        items: {
          testStructClass: {
            schemaItemType: "StructClass",
            properties: [
              {
                name: "testProperty",
                type: "PrimitiveProperty",
                typeName: "int",
                kindOfQuantity: "DummyReferenceOne.testKoq",
              },
            ],
          },
        },
      }, contextA);

      const schemaB = await Schema.fromJson({
        ...schemaBJson,
        items: {
          ...items("SchemaB"),
          testStructClass: {
            schemaItemType: "StructClass",
            properties: [
              {
                name: "testProperty",
                type: "PrimitiveProperty",
                typeName: "int",
                kindOfQuantity: "SchemaB.testKoq",
              },
            ],
          },
        },
      }, contextB);

      const comparer = new SchemaComparer(reporter);
      await comparer.compareSchemas(schemaA, schemaB);
      expect(findDiagnostic(reporter.changes[0].allDiagnostics, SchemaCompareCodes.PropertyDelta, "DummyReferenceOne.testKoq", "SchemaB.testKoq", "kindOfQuantity")).to.be.not.undefined;
    });
  });

  describe("Custom Attribute comparison cases", ()=> {
    const items = {
      testCA: {
        schemaItemType: "CustomAttributeClass",
        appliesTo: "Any",
        properties: [
          {
            name: "testProperty",
            type: "PrimitiveProperty",
            typeName: "int",
          },
        ],
      },
    };

    it("should not report custom attribute missing when CA class has the same name and is defined in comparable schemas", async ()=> {
      const schemaA = await Schema.fromJson({
        ...schemaAJson,
        items: {
          ...items,
          testEntityClass: {
            schemaItemType: "EntityClass",
            customAttributes: [
              {
                testProperty: 5,
                className: "SchemaA.testCA",
              },
            ],
          },
        },
      }, contextA);

      const schemaB = await Schema.fromJson({
        ...schemaBJson,
        items: {
          ...items,
          testEntityClass: {
            schemaItemType: "EntityClass",
            customAttributes: [
              {
                testProperty: 5,
                className: "SchemaB.testCA",
              },
            ],
          },
        },
      }, contextB);

      const comparer = new SchemaComparer(reporter);
      await comparer.compareSchemas(schemaA, schemaB);
      expect(reporter.changes[0].allDiagnostics.find((d) => d.code === SchemaCompareCodes.CustomAttributeInstanceClassMissing && d.messageArgs!.at(0).className === "SchemaA.testCA")).to.be.undefined;
    });

    it("should report custom attribute missing for CA with the same name but defined in a referenced schema", async ()=> {
      await Schema.fromJson({
        ...dummyRefOneJson,
        items: {
          ...items,
        },
      }, contextA);

      const schemaA = await Schema.fromJson({
        ...schemaAJson,
        references: [
          {
            name: "DummyReferenceOne",
            version: "01.00.01",
          },
        ],
        items: {
          testStructClass: {
            schemaItemType: "StructClass",
            properties: [
              {
                name: "testProperty",
                type: "PrimitiveProperty",
                typeName: "int",
                customAttributes: [
                  {
                    testProperty: 10,
                    className: "DummyReferenceOne.testCA",
                  },
                ],
              },
            ],
          },
        },
      }, contextA);

      const schemaB = await Schema.fromJson({
        ...schemaBJson,
        items: {
          ...items,
          testStructClass: {
            schemaItemType: "StructClass",
            properties: [
              {
                name: "testProperty",
                type: "PrimitiveProperty",
                typeName: "int",
                customAttributes: [
                  {
                    testProperty: 10,
                    className: "SchemaB.testCA",
                  },
                ],
              },
            ],
          },
        },
      }, contextB);

      const comparer = new SchemaComparer(reporter);
      await comparer.compareSchemas(schemaA, schemaB);
      expect(reporter.changes[0].allDiagnostics.find((d) => d.code === SchemaCompareCodes.CustomAttributeInstanceClassMissing && d.messageArgs!.at(0).className === "DummyReferenceOne.testCA")).to.be.not.undefined;
    });
  });

  /**
     * Linear draft schema examples
     */
  describe("Struct Class comparisons", () => {
    it("should not report property delta for typeName of the property with same name and is defined in schemas being compared", async () => {
      const schemaA = await Schema.fromJson({
        ...schemaAJson,
        items: {
          inSpan: {
            schemaItemType: "StructClass",
            description: "Linear draft InSpan Class",
            properties: [
              {
                name: "Address",
                type: "StructProperty",
                typeName: "SchemaA.inSpanAddress",
              },
            ],
          },
          inSpanAddress: {
            schemaItemType: "StructClass",
            description: "Linear draft InSpanAddress Class",
          },
        },
      }, contextA);

      const schemaB = await Schema.fromJson({
        ...schemaBJson,
        items: {
          inSpan: {
            schemaItemType: "StructClass",
            description: "Linear draft InSpan Class",
            properties: [
              {
                name: "Address",
                type: "StructProperty",
                typeName: "SchemaB.inSpanAddress",
              },
            ],
          },
          inSpanAddress: {
            schemaItemType: "StructClass",
            description: "Linear draft InSpanAddress Class",
          },
        },
      }, contextB);

      const comparer = new SchemaComparer(reporter);
      await comparer.compareSchemas(schemaA, schemaB);
      expect(findDiagnostic(reporter.changes[0].allDiagnostics, "SC-106", "SchemaA.inSpanAddress", "SchemaB.inSpanAddress", "structClass")).to.be.undefined;
    });

    it("should report property delta for typeName of the property with different name", async () => {
      const schemaA = await Schema.fromJson({
        ...schemaAJson,
        items: {
          inSpan: {
            schemaItemType: "StructClass",
            description: "Linear draft InSpan Class",
            properties: [
              {
                name: "Address",
                type: "StructProperty",
                typeName: "SchemaA.inSpanAddressA",
              },
            ],
          },
          inSpanAddressA: {
            schemaItemType: "StructClass",
            description: "Linear draft InSpanAddress Class A",
          },
        },
      }, contextA);

      const schemaB = await Schema.fromJson({
        ...schemaBJson,
        items: {
          inSpan: {
            schemaItemType: "StructClass",
            description: "Linear draft InSpan Class",
            properties: [
              {
                name: "Address",
                type: "StructProperty",
                typeName: "SchemaB.inSpanAddressB",
              },
            ],
          },
          inSpanAddressB: {
            schemaItemType: "StructClass",
            description: "Linear draft InSpanAddress Class B",
          },
        },
      }, contextB);

      const comparer = new SchemaComparer(reporter);
      await comparer.compareSchemas(schemaA, schemaB);
      expect(findDiagnostic(reporter.changes[0].allDiagnostics, "SC-106", "SchemaA.inSpanAddressA", "SchemaB.inSpanAddressB", "structClass")).to.be.not.undefined;
    });

    it("should report property delta for typeName of the property with the same name but defined in a referenced schema", async () => {
      const _dummyRefOne = await Schema.fromJson({
        ...dummyRefOneJson,
        items: {
          inSpanAddress: {
            schemaItemType: "StructClass",
            label: "In span address Ref",
            description: "Linear draft InSpanAddress Class Ref",
          },
        },
      }, contextA);

      const schemaA = await Schema.fromJson({
        ...schemaAJson,
        references: [
          {
            name: "DummyReferenceOne",
            version: "01.00.01",
          },
        ],
        items: {
          inSpan: {
            schemaItemType: "StructClass",
            description: "Linear draft InSpan Class",
            properties: [
              {
                name: "Address",
                type: "StructProperty",
                typeName: "DummyReferenceOne.inSpanAddress",
              },
            ],
          },
        },
      }, contextA);

      const schemaB = await Schema.fromJson({
        ...schemaBJson,
        items: {
          inSpan: {
            schemaItemType: "StructClass",
            description: "Linear draft InSpan Class",
            properties: [
              {
                name: "Address",
                type: "StructProperty",
                typeName: "SchemaB.inSpanAddress",
              },
            ],
          },
          inSpanAddress: {
            schemaItemType: "StructClass",
            description: "Linear draft InSpanAddress Class",
          },
        },
      }, contextB);

      const comparer = new SchemaComparer(reporter);
      await comparer.compareSchemas(schemaA, schemaB);
      expect(findDiagnostic(reporter.changes[0].allDiagnostics, "SC-106", "DummyReferenceOne.inSpanAddress", "SchemaB.inSpanAddress", "structClass")).to.be.not.undefined;
    });
  });
});
