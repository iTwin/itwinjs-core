/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import { Constant, Schema, SchemaContext } from "@itwin/ecschema-metadata";
import { SchemaMerger } from "../../Merging/SchemaMerger";
import { expect } from "chai";

describe.only("Constant merger tests", () => {
    let targetContext: SchemaContext;
    let sourceContext: SchemaContext;

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

    describe("Constant missing tests", () => {
        it("should merge missing constant", async () => {
            const sourceSchema = await Schema.fromJson({
                ...sourceJson,
                items: {
                    testPhenomenon: {
                        schemaItemType: "Phenomenon",
                        name: "AREA",
                        label: "Area",
                        description: "Area description",
                        definition: "Units.LENGTH(2)",
                    },
                    testConstant: {
                        schemaItemType: "Constant",
                        label: "Test Constant",
                        description: "testing a constant",
                        phenomenon: "SourceSchema.testPhenomenon",
                        definition: "PI",
                        numerator: 5.5,
                        denominator: 5.1,
                    }
                },
            }, sourceContext);

            const targetSchema = await Schema.fromJson({
                ...targetJson,
                items: {
                    testPhenomenon: {
                        schemaItemType: "Phenomenon",
                        name: "AREA",
                        label: "Area",
                        description: "Area description",
                        definition: "Units.LENGTH(2)",
                    },
                },
            }, targetContext);

            const testConstant = {
                schemaItemType: "Constant",
                label: "Test Constant",
                description: "testing a constant",
                phenomenon: "TargetSchema.testPhenomenon",
                definition: "PI",
                numerator: 5.5,
                denominator: 5.1,
            }

            const merger = new SchemaMerger();
            const mergedSchema = await merger.merge(targetSchema, sourceSchema);
            const mergedConstant = await mergedSchema.getItem<Constant>("testConstant");
            const mergedConstantToJSON = mergedConstant!.toJSON(false, false);

            expect(mergedConstantToJSON).deep.eq(testConstant);

        })
    })
})