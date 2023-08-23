import { Schema, SchemaContext } from "@itwin/ecschema-metadata";
import { expect } from "chai";
import { SchemaMerger } from "../../Merging/SchemaMerger";
import { SchemaChanges } from "../../ecschema-editing";

describe("Enumeration Merger Tests", async () => {
    const sourceJson = {
        $schema: "https://dev.bentley.com/json_schemas/ec/32/ecschema",
        name: "sourceSchema",
        version: "1.2.3",
        alias: "sc",
        items: {
            sourceEnum: {
                schemaItemType: "Enumeration",
                type: "int",
                enumerators: [
                    {
                        name: "ZeroValue",
                        value: 0,
                    },
                    {
                        name: "OneValue",
                        value: 1,
                    },
                ],
            }
        }
    }

    const targetJson = {
        $schema: "https://dev.bentley.com/json_schemas/ec/32/ecschema",
        name: "targetSchema",
        version: "1.2.3",
        alias: "sc",
        items: {}
    }

    const sourceSchemaContext = new SchemaContext();
    const sourceSchema = await Schema.fromJson(sourceJson, sourceSchemaContext);

    const targetSchemaContext = new SchemaContext();
    const targetSchema = await Schema.fromJson(targetJson, targetSchemaContext);

  
    it.only("should create a source schema and target schema", async () => {
        expect(Schema.isSchema(sourceSchema)).to.be.equals(true);
        expect(Schema.isSchema(targetSchema)).to.be.equals(true);
    })

    it.only("should return schema changes list", async ()=> {
        const schema = await (new SchemaMerger()).merge(targetSchema, sourceSchema);
        expect(schema).to.be.equal(sourceSchema);
    })

})
