/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/

import { SnapshotDb } from "@itwin/core-backend";
import { IModelStatus } from "@itwin/core-bentley";
import { IModelError } from "@itwin/core-common";
import { ECClass, EntityClass, RelationshipClass, SchemaKey, SchemaMatchType, Unit } from "@itwin/ecschema-metadata";
import { IModelTestUtils } from "../backend/IModelTestUtils";
import { assert } from "chai";

/**
 * A general-purpose method to handle any parameter.
 * @param _data The data to process.
 */
function doSomething(_data: any): void {
  // Example implementation: log the data to the console
  // console.log(_data);
}

/** Common usage of ecschema-metadata */
describe("Metadata examples", () => {
  let iModel: SnapshotDb;

  before(async () => {
    iModel = IModelTestUtils.openSnapshotFromSeed("test.bim", { copyFilename: "metadata.bim" });
  });

  after(() => {
    iModel.close();
  });

  it("iterate entities on IModelDb", async () => {
    // __PUBLISH_EXTRACT_START__ Metadata.entitiesFromIModelDb
    // For the sake of this example, we will assume an open IModelDb is provided. See backend docs for details on how to work with imodels.
    // Get the schema context from the IModelDb
    const schemaContext = iModel.schemaContext;

    const key = new SchemaKey("BisCore", 1, 0, 0);
    const bisCore = await schemaContext.getSchema(key, SchemaMatchType.LatestReadCompatible);
    if (bisCore === undefined) {
      throw new IModelError(IModelStatus.NotFound, "BisCore schema not found.");
    }

    for (const entity of bisCore.getItems(EntityClass)) {
      // use the entity class to do something
      doSomething(entity.name);

      // Get the properties of the entity
      const properties = await entity.getProperties();
      // Iterate through each property
      for (const property of properties) {
        if (property.isPrimitive()) {
          doSomething(property.name);
        }
      }
    }
    // __PUBLISH_EXTRACT_END__
  });

  it("schema item type guard and assertion", async () => {
    const key = new SchemaKey("BisCore", 1, 0, 0);
    const bisCore = await iModel.schemaContext.getSchema(key, SchemaMatchType.LatestReadCompatible);
    if (bisCore === undefined) {
      throw new IModelError(IModelStatus.NotFound, "BisCore schema not found.");
    }

    // __PUBLISH_EXTRACT_START__ Metadata.schemaItemTypeGuard
    for (const item of bisCore.getItems()) {
      // item is of type SchemaItem
      if (EntityClass.isEntityClass(item)) {
        // item is of type EntityClass
        // count mixins on the entity class
        const mixinCount = Array.from(item.getMixinsSync()).length;
        doSomething(`Entity Class: ${item.name} with ${mixinCount} mixins`);
      } else if (Unit.isUnit(item)) {
        const unitSystem = await item.unitSystem;
        doSomething(`Unit: ${item.name} with unit system ${unitSystem?.name}`);
      } else if (RelationshipClass.isRelationshipClass(item)) {
        // item is of type RelationshipClass
        const sourceRoleLabel = item.source.roleLabel;
        if (sourceRoleLabel)
          doSomething(`Relationship Class: ${item.name} with source role label ${sourceRoleLabel}`);

        // Alternatively, you can use the assertion method, this one throws an error if the item is not a RelationshipClass
        RelationshipClass.assertIsRelationshipClass(item);
      }
    }
    // __PUBLISH_EXTRACT_END__
  });

  it("work with properties", async () => {
    // __PUBLISH_EXTRACT_START__ Metadata.properties
    const entityClass = await iModel.schemaContext.getSchemaItem("BisCore", "InformationPartitionElement", EntityClass);
    if (entityClass === undefined) {
      throw new IModelError(IModelStatus.NotFound, "item not found.");
    }

    for (const property of await entityClass.getProperties()) {
      if (property.isPrimitive()) {
        doSomething(`Primitive Property: ${property.name}, primitive type: ${property.primitiveType}`);
      }
    }

    // local properties only
    for (const property of await entityClass.getProperties(true)) {
      if (property.isStruct()) {
        doSomething(`Struct Property: ${property.name}, struct type: ${property.structClass.name}`);
      }
    }

    // Get a property by name
    const singleProperty = await entityClass.getProperty("Description");
    if (singleProperty === undefined) {
      throw new IModelError(IModelStatus.NotFound, "property not found.");
    }
    assert.isTrue(singleProperty.isPrimitive());
    // __PUBLISH_EXTRACT_END__
  });

  it.only("test -- metadata", () => {
    assert.isTrue(false);
  });

  it("work with custom attributes", async () => {
    // __PUBLISH_EXTRACT_START__ Metadata.customAttributes
    const key = new SchemaKey("BisCore", 1, 0, 0);
    const bisCore = await iModel.schemaContext.getSchema(key, SchemaMatchType.LatestReadCompatible);
    if (bisCore === undefined) {
      throw new IModelError(IModelStatus.NotFound, "BisCore schema not found.");
    }

    for (const item of bisCore.getItems()) {
      if (!ECClass.isECClass(item)) {
        continue;
      }

      if (item.customAttributes?.has("BisCore.ClassHasHandler")) {
        doSomething(`Class ${item.name} has BisCore.ClassHasHandler custom attribute`);
      }

      // Access data within a custom attribute
      if (item.customAttributes?.has("ECDbMap.ShareColumns")) {
        const customAttribute = item.customAttributes.get("ECDbMap.ShareColumns");
        if (customAttribute) {
          const maxSharedColumns = customAttribute.MaxSharedColumnsBeforeOverflow;
          if (maxSharedColumns && typeof maxSharedColumns === "number") {
            doSomething(`Class ${item.name} has MaxSharedColumnsBeforeOverflow set to ${maxSharedColumns}`);
          }
        }
      }
    }
    // __PUBLISH_EXTRACT_END__
  });

});
