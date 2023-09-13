/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import { Schema, SchemaContext, Unit, UnitSystem } from "@itwin/ecschema-metadata";
import { SchemaMerger } from "../../Merging/SchemaMerger";
import { expect } from "chai";

describe.only("Unit merger tests", () => {
    let sourceContext: SchemaContext;
    let targetContext: SchemaContext;

    const sourceJson = {
        $schema: "https://dev.bentley.com/json_schemas/ec/32/ecschema",
        name: "SourceSchema",
        version: "1.2.3",
        alias: "source",
    };
    const targetJson = {
        $schema: "https://dev.bentley.com/json_schemas/ec/32/ecschema",
        name: "TargetSchema",
        version: "1.0.0",
        alias: "target",
    };
    const referenceJson = {
        $schema: "https://dev.bentley.com/json_schemas/ec/32/ecschema",
        name: "ReferenceSchema",
        version: "1.2.0",
        alias: "reference",
    }

    beforeEach(() => {
        targetContext = new SchemaContext();
        sourceContext = new SchemaContext();
    });

    describe("Unit missing tests", () => {
        it("should merge missing unit", async () => {
            const sourceSchema = await Schema.fromJson({
                ...sourceJson,
                items: {
                    testUnitSystem: {
                        schemaItemType: "UnitSystem",
                        name: "IMPERIAL",
                        label: "Imperial",
                    },
                    testPhenomenon: {
                        schemaItemType: "Phenomenon",
                        name: "AREA",
                        label: "Area",
                        description: "Area description",
                        definition: "Units.LENGTH(2)",
                    },
                    testUnit: {
                        schemaItemType: "Unit",
                        label: "Millimeter",
                        description: "A unit defining the millimeter metric unit of length",
                        phenomenon: "SourceSchema.testPhenomenon",
                        unitSystem: "SourceSchema.testUnitSystem",
                        definition: "[MILLI]*Units.MM",
                        numerator: 5,
                        denominator: 1,
                        offset: 4,
                    },
                },
            }, sourceContext);

            const targetSchema = await Schema.fromJson({
                ...targetJson,
            }, targetContext);

            const testUnit = {
                schemaItemType: "Unit",
                label: "Millimeter",
                description: "A unit defining the millimeter metric unit of length",
                phenomenon: "TargetSchema.testPhenomenon",
                unitSystem: "TargetSchema.testUnitSystem",
                definition: "[MILLI]*Units.MM",
                numerator: 5,
                denominator: 1,
                offset: 4,
            }

            const merger = new SchemaMerger();
            const mergedSchema = await merger.merge(targetSchema, sourceSchema);
            const mergedUnit = await mergedSchema.getItem<Unit>("testUnit");

            expect(mergedUnit?.toJSON()).deep.eq(testUnit);
        })

        it("should merge missing unit with referenced schema", async () => {
            const referenceSchema = await Schema.fromJson({
                ...referenceJson,
                items: {
                    testUnitSystem: {
                        schemaItemType: "UnitSystem",
                        name: "IMPERIAL",
                        label: "Imperial",
                    },
                    testPhenomenon: {
                        schemaItemType: "Phenomenon",
                        name: "AREA",
                        label: "Area",
                        description: "Area description",
                        definition: "Units.LENGTH(2)",
                    },
                },
            }, sourceContext);

            const sourceSchema = await Schema.fromJson({
                ...sourceJson,
                references: [
                    {
                        name: "ReferenceSchema",
                        version: "1.2.0",
                    },
                ],
                items: {
                    testUnit: {
                        schemaItemType: "Unit",
                        label: "Millimeter",
                        description: "A unit defining the millimeter metric unit of length",
                        phenomenon: "ReferenceSchema.testPhenomenon",
                        unitSystem: "ReferenceSchema.testUnitSystem",
                        definition: "[MILLI]*Units.MM",
                        numerator: 5,
                        denominator: 1,
                        offset: 4,
                    },
                },
            }, sourceContext);

            const targetSchema = await Schema.fromJson({
                ...targetJson,
            }, targetContext);

            const merger = new SchemaMerger();
            const mergedSchema = await merger.merge(targetSchema, sourceSchema);

            const sourceUnit = await sourceSchema.getItem<Unit>("testUnit");
            const mergedUnit = await mergedSchema.getItem<Unit>("testUnit");

            expect(mergedUnit?.toJSON()).deep.eq(sourceUnit?.toJSON());
        })

        it.only("should merge missing unit with different references for phenomenon and unit system", async () => {
            const referenceSchema = await Schema.fromJson({
                ...referenceJson,
                items: {
                    testPhenomenon: {
                        schemaItemType: "Phenomenon",
                        name: "AREA",
                        label: "Area",
                        description: "Area description",
                        definition: "Units.LENGTH(2)",
                    },
                },
            }, sourceContext);

            const sourceSchema = await Schema.fromJson({
                ...sourceJson,
                references: [
                    {
                        name: "ReferenceSchema",
                        version: "1.2.0",
                    },
                ],
                items: {
                    testUnitSystem: {
                        schemaItemType: "UnitSystem",
                        name: "IMPERIAL",
                        label: "Imperial",
                    },
                    testUnit: {
                        schemaItemType: "Unit",
                        label: "Millimeter",
                        description: "A unit defining the millimeter metric unit of length",
                        phenomenon: "ReferenceSchema.testPhenomenon",
                        unitSystem: "SourceSchema.testUnitSystem",
                        definition: "[MILLI]*Units.MM",
                        numerator: 5,
                        denominator: 1,
                        offset: 4,
                    },
                },
            }, sourceContext);

            const targetSchema = await Schema.fromJson({
                ...targetJson,
            }, targetContext);

            const merger = new SchemaMerger();
            const mergedSchema = await merger.merge(targetSchema, sourceSchema);
            const mergedUnit = await mergedSchema.getItem<Unit>("testUnit");

            expect(mergedUnit?.toJSON().phenomenon).deep.eq("ReferenceSchema.testPhenomenon");
            expect(mergedUnit?.toJSON().unitSystem).deep.eq("TargetSchema.testUnitSystem");

        })
    })
    describe("Unit delta tests", ()=> {

    })
})