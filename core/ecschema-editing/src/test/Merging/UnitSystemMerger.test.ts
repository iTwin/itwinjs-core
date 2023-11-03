/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import { Schema, SchemaContext, UnitSystem } from "@itwin/ecschema-metadata";
import { SchemaMerger } from "../../Merging/SchemaMerger";
import { expect } from "chai";

describe("Unit system merger tests", () => {
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

  describe("Unit system missing tests", () => {
    it("should merge missing unit system", async () => {
      const sourceSchema = await Schema.fromJson({
        ...sourceJson,
        items: {
          testUnitSystem: {
            schemaItemType: "UnitSystem",
            name: "IMPERIAL",
            label: "Imperial",
          },
        },
      }, sourceContext);

      const targetSchema = await Schema.fromJson({
        ...targetJson,
      }, targetContext);

      const merger = new SchemaMerger();
      const mergedSchema = await merger.merge(targetSchema, sourceSchema);
      const mergedUnitSystem = await mergedSchema.getItem<UnitSystem>("testUnitSystem");
      const sourceUnitSystem = await sourceSchema.getItem<UnitSystem>("testUnitSystem");
      expect(mergedUnitSystem!.toJSON()).to.deep.equal(sourceUnitSystem!.toJSON());
    });

  });
});
