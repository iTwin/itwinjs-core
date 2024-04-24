/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import { ConflictCode, SchemaDifferenceConflict } from "../../Differencing/SchemaConflicts";
import { ECClass, PrimitiveType, Property, Schema, SchemaContext } from "@itwin/ecschema-metadata";
import { AnySchemaDifference, SchemaDifference, SchemaDifferences, SchemaOtherTypes } from "../../Differencing/SchemaDifference";
import { expect } from "chai";
import { SchemaMerger } from "../../ecschema-editing";
import "chai-as-promised";
/* eslint-disable @typescript-eslint/naming-convention */

describe("Difference Conflict Resolving", () => {

  it("Conflicting property name", async () => {
    const schemaHeader = {
      $schema: "https://dev.bentley.com/json_schemas/ec/32/ecschema",
      name: "ConflictSchema",
      version: "1.0.0",
      alias: "conflict",
    };

    const sourceContext = new SchemaContext();
    const sourceSchema = await Schema.fromJson({
      ...schemaHeader,
      items: {
        DummyEntity: {
          schemaItemType: "EntityClass",
        },
        ConflictingPropertyEntity: {
          schemaItemType: "EntityClass",
          properties: [
            {
              name: "MyProperty",
              type: "PrimitiveProperty",
              typeName: "boolean",
            },
          ],
        },
      },
    }, sourceContext);

    const targetContext = new SchemaContext();
    const targetSchema = await Schema.fromJson({
      ...schemaHeader,
      items: {
        ConflictingPropertyEntity: {
          schemaItemType: "EntityClass",
          properties: [
            {
              name: "MyProperty",
              type: "PrimitiveProperty",
              typeName: "string",
            },
          ],
        },
      },
    }, targetContext);

    await Schema.fromJson({
      $schema: "https://dev.bentley.com/json_schemas/ec/32/ecschema",
      name: "ECv3ConversionAttributes",
      version: "1.0.0",
      alias: "conv",
      items: {
        RenamedPropertiesMapping: {
          schemaItemType: "CustomAttributeClass",
          appliesTo: "AnyProperty",
          properties: [
            {
              name: "propertyMapping",
              type: "PrimitiveProperty",
              typeName: "string",
            },
          ],
        },
      },
    }, targetContext);

    const differences = await SchemaDifference.fromSchemas(targetSchema, sourceSchema);
    expect(differences.conflicts).has.lengthOf(1, "Unexpected conflict count.");

    const [propertyConflict] = differences.conflicts!;
    expect(propertyConflict.code).equals(ConflictCode.ConflictingPropertyName, "Unexpected conflict code");

    const className = propertyConflict.itemName!;
    const propertyName = propertyConflict.path!;
    const newPropertyName = `${propertyName}_1`;

    const sourceClass = await sourceSchema.getItem(className) as ECClass;
    const sourceProperty = await sourceClass.getProperty(propertyName) as Property;
    const sourcePropertyJson = sourceProperty.toJSON();

    function containsConversionAttributeSchema() {
      return differences.changes && differences.changes.find((entry) => {
        return entry.changeType === "add"
          && entry.schemaType === SchemaOtherTypes.SchemaReference
          && entry.difference.name === "ECv3ConversionAttributes";
      });
    }

    // Check if the differences already contain a reference to the ECv3ConversionAttributes
    // This could alternatively added to the conflict resolutions as well.
    if(!containsConversionAttributeSchema()) {
      differences.changes && differences.changes.push({
        changeType: "add",
        schemaType: SchemaOtherTypes.SchemaReference,
        difference: {
          name: "ECv3ConversionAttributes",
          version: "1.0.0",
        },
      });
    }

    resolveConflict(differences, propertyConflict,
      // Add the property with a new name. This requires to serialize the source property
      // to get the complete property JSON but override the property name.
      {
        changeType: "add",
        schemaType: SchemaOtherTypes.Property,
        itemName: className,
        path: newPropertyName,
        difference: {
          ...sourcePropertyJson,
          name: newPropertyName,
        },
      },

      // Apply RenamedPropertiesMapping to the property
      {
        changeType: "add",
        schemaType: SchemaOtherTypes.CustomAttributeInstance,
        appliedTo: "Property",
        itemName: className,
        path: newPropertyName,
        difference: {
          className: "ECv3ConversionAttributes.RenamedPropertiesMapping",
          propertyMapping: `${propertyConflict.path}|${newPropertyName}`,
        },
      },
    );

    const merger = new SchemaMerger(targetContext);
    const mergedSchema = await merger.merge(differences);

    await expect(mergedSchema.getReference("ECv3ConversionAttributes")).to.be.eventually.not.undefined;

    await expect(mergedSchema.getItem("ConflictingPropertyEntity")).to.be.eventually.fulfilled.then(async (item: ECClass) => {
      await expect(item.getProperty(propertyName)).to.be.eventually.fulfilled;
      await expect(item.getProperty(newPropertyName)).to.be.eventually.fulfilled.then((property: Property) => {
        expect(property.propertyType).equals(PrimitiveType.Boolean);
        expect(property.customAttributes).is.not.undefined;
        const renameCa = property.customAttributes?.get("ECv3ConversionAttributes.RenamedPropertiesMapping");
        expect(renameCa).deep.equals({
          className: "ECv3ConversionAttributes.RenamedPropertiesMapping",
          propertyMapping: "MyProperty|MyProperty_1",
        });
      });
    });
  });

  function resolveConflict(differences: SchemaDifferences, conflict: SchemaDifferenceConflict, ...resolutions: AnySchemaDifference[]) {
    // Apply conflict resolutions - simplified logic, just added, no validation
    for(const resolution of resolutions) {
      differences.changes!.push(resolution);
    }

    // Eventually remove conflict entry
    const conflictIndex = differences.conflicts!.indexOf(conflict);
    differences.conflicts!.splice(conflictIndex, 1);
  }
});
