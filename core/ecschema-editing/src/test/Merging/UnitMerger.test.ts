/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import { Schema, SchemaContext, UnitSystem } from "@itwin/ecschema-metadata";
import { SchemaMerger } from "../../Merging/SchemaMerger";
import { expect } from "chai";

describe("Unit merger tests", () => {
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
                    TestUnit: {
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

            const merger = new SchemaMerger();
            const mergedSchema = await merger.merge(targetSchema, sourceSchema);
        })
    })
})