/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import { KindOfQuantity, Schema, SchemaContext } from "@itwin/ecschema-metadata";
import { SchemaMerger } from "../../Merging/SchemaMerger";
import { expect } from "chai";
import { MutableSchema } from "../../Editing/Mutable/MutableSchema";

/* eslint-disable @typescript-eslint/naming-convention */

describe("KindOfQuantity Merger test", () => {
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
    const testKoqItem = {
        schemaItemType: "KindOfQuantity",
        name: "TestKindOfQuantity",
        label: "TestKopDisplayLabel",
        description: "Some description...",
    };
    const validFullKoqProps = {
        ...testKoqItem,
        relativeError: 1.234,
        persistenceUnit: "Formats.IN",
        presentationUnits: [
            "Formats.DefaultReal[Formats.IN]",
        ],
    };

    beforeEach(() => {
        targetContext = new SchemaContext();
        sourceContext = new SchemaContext();
    });

    describe("KindOfQuantity missing test", () => {
        it("should merge missing KindOfQuantity item with valid props", async () => {
            const sourceSchema = await Schema.fromJson({
                ...sourceJson,
            }, sourceContext);

            const targetSchema = await Schema.fromJson({
                ...targetJson,
            }, targetContext);

            (await (sourceSchema as MutableSchema).createKindOfQuantity('testKindOfQuantity')).fromJSON(validFullKoqProps);
            const testKoq = await sourceSchema.getItem<KindOfQuantity>('testKindOfQuantity');

            const merger = new SchemaMerger();
            const mergedSchema = await merger.merge(targetSchema, sourceSchema);
            expect(mergedSchema).to.be.instanceOf(Schema);
        })
    })

})