/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/

import { assert } from "chai";
import { SchemaContext } from "../Context";
import { SchemaGraphUtil } from "../Deserialization/SchemaGraphUtil";
import type { MutableSchema} from "../Metadata/Schema";
import { Schema } from "../Metadata/Schema";
import { SchemaKey } from "../SchemaKey";

describe("SchemaGraphUtil tests:", () => {
  const context = new SchemaContext();

  it("buildDependencyOrderedSchemaList succeeds", async () => {
    // Arrange
    const schemaA = new Schema(context, new SchemaKey("SchemaA", 1, 0, 0), "A");
    const schemaB = new Schema(context, new SchemaKey("SchemaB", 2, 0, 0), "B");
    const schemaC = new Schema(context, new SchemaKey("SchemaC", 3, 0, 0), "C");
    const schemaD = new Schema(context, new SchemaKey("SchemaD", 4, 0, 0), "D");
    (schemaA as MutableSchema).addReferenceSync(schemaC);
    (schemaA as MutableSchema).addReferenceSync(schemaB);
    (schemaB as MutableSchema).addReferenceSync(schemaD);
    (schemaB as MutableSchema).addReferenceSync(schemaC);
    (schemaC as MutableSchema).addReferenceSync(schemaD);

    // ensure refs in wrong order for valid test
    assert.strictEqual(schemaA.references[0].name, "SchemaC");
    assert.strictEqual(schemaA.references[1].name, "SchemaB");
    assert.strictEqual(schemaB.references[0].name, "SchemaD");
    assert.strictEqual(schemaB.references[1].name, "SchemaC");

    // Act
    const schemaList = SchemaGraphUtil.buildDependencyOrderedSchemaList(schemaA);

    // Assert
    assert.strictEqual(schemaList.length, 4);
    assert.strictEqual(schemaList[0].name, "SchemaD");
    assert.strictEqual(schemaList[1].name, "SchemaC");
    assert.strictEqual(schemaList[2].name, "SchemaB");
    assert.strictEqual(schemaList[3].name, "SchemaA");
  });

  it("buildDependencyOrderedSchemaList with same schema references, contains schema once", () => {
    // Arrange
    const importSchema = new Schema(context, new SchemaKey("SchemaA", 1, 0, 0), "A");
    const refSchema = new Schema(context, new SchemaKey("SchemaB", 1, 0, 0), "B");
    importSchema.references.push(refSchema);
    importSchema.references.push(refSchema);

    // Act
    const schemaList = SchemaGraphUtil.buildDependencyOrderedSchemaList(importSchema);

    // Assert
    assert.strictEqual(schemaList.length, 2);
  });

  it("buildDependencyOrderedSchemaList checks reference order", async () => {
    const schemaA = new Schema(context, new SchemaKey("SchemaA", 1, 1, 0), "A");
    const schemaB = new Schema(context, new SchemaKey("SchemaB", 1, 0, 1), "B");
    const schemaC = new Schema(context, new SchemaKey("SchemaC", 1, 0, 4), "C");
    const schemaD = new Schema(context, new SchemaKey("SchemaD", 1, 0, 0), "D");
    const schemaE = new Schema(context, new SchemaKey("SchemaE", 1, 0, 0), "E");

    schemaE.references.push(schemaB);
    schemaE.references.push(schemaC);
    schemaD.references.push(schemaC);
    schemaD.references.push(schemaE);

    schemaA.references.push(schemaB);
    schemaA.references.push(schemaD);
    schemaA.references.push(schemaE);

    const schemaList = SchemaGraphUtil.buildDependencyOrderedSchemaList(schemaA);

    assert.strictEqual(schemaList.length, 5);
    assert.strictEqual(schemaList[0].name, "SchemaC");
    assert.strictEqual(schemaList[1].name, "SchemaB");
    assert.strictEqual(schemaList[2].name, "SchemaE");
    assert.strictEqual(schemaList[3].name, "SchemaD");
    assert.strictEqual(schemaList[4].name, "SchemaA");
  });

  it("buildDependencyOrderedSchemaList checks schem depenedency order with complex references", async () => {
    const schBDWS = new Schema(context, new SchemaKey("BuildingDataGroupWS", 1, 1, 0), "BDWS");
    const schAecUnits = new Schema(context, new SchemaKey("AecUnits", 1, 0, 1), "AECU");
    const schArchitecturalPhysical = new Schema(context, new SchemaKey("ArchitecturalPhysical", 1, 0, 0), "ArchPhys");
    const schBisCore = new Schema(context, new SchemaKey("BisCore", 1, 0, 4), "bis");
    const schECDbMap = new Schema(context, new SchemaKey("ECDbMap", 2, 0, 0), "ecdbmap");
    const schECDbSchemaPolicies = new Schema(context, new SchemaKey("ECDbSchemaPolicies", 1, 0, 0), "ecdbpol");
    const schBuildingDataGroupBase = new Schema(context, new SchemaKey("BuildingDataGroupBase", 1, 0, 4), "bdgb");
    const schBuildingSpatial = new Schema(context, new SchemaKey("BuildingSpatial", 1, 0, 0), "spatial");
    const schSpatialComposition = new Schema(context, new SchemaKey("SpatialComposition", 1, 0, 0), "spcomp");
    const schCoreCustomAttributes = new Schema(context, new SchemaKey("CoreCustomAttributes", 1, 0, 2), "CoreCA");
    const schFormats = new Schema(context, new SchemaKey("Formats", 1, 0, 0), "f");
    const schStructuralPhysical = new Schema(context, new SchemaKey("StructuralPhysical", 1, 0, 0), "sp");
    const schUnits = new Schema(context, new SchemaKey("Units", 1, 0, 4), "u");

    schFormats.references.push(schUnits);
    schAecUnits.references.push(schFormats);
    schAecUnits.references.push(schUnits);
    schBisCore.references.push(schCoreCustomAttributes);
    schBisCore.references.push(schECDbMap);
    schBisCore.references.push(schECDbSchemaPolicies);
    schStructuralPhysical.references.push(schBisCore);
    schSpatialComposition.references.push(schAecUnits);
    schSpatialComposition.references.push(schBisCore);
    schBuildingSpatial.references.push(schBisCore);
    schBuildingSpatial.references.push(schSpatialComposition);
    schBuildingDataGroupBase.references.push(schBisCore);
    schArchitecturalPhysical.references.push(schAecUnits);
    schArchitecturalPhysical.references.push(schBisCore);
    schBDWS.references.push(schAecUnits);
    schBDWS.references.push(schArchitecturalPhysical);
    schBDWS.references.push(schBuildingDataGroupBase);
    schBDWS.references.push(schBuildingSpatial);
    schBDWS.references.push(schCoreCustomAttributes);
    schBDWS.references.push(schFormats);
    schBDWS.references.push(schSpatialComposition);
    schBDWS.references.push(schStructuralPhysical);
    schBDWS.references.push(schUnits);

    const schemaList = SchemaGraphUtil.buildDependencyOrderedSchemaList(schBDWS);

    assert.strictEqual(schemaList.length, 13);
    assert.strictEqual(schemaList[0].name, "ECDbSchemaPolicies");
    assert.strictEqual(schemaList[1].name, "ECDbMap");
    assert.strictEqual(schemaList[2].name, "CoreCustomAttributes");
    assert.strictEqual(schemaList[3].name, "BisCore");
    assert.strictEqual(schemaList[4].name, "StructuralPhysical");
    assert.strictEqual(schemaList[5].name, "BuildingDataGroupBase");
    assert.strictEqual(schemaList[6].name, "Units");
    assert.strictEqual(schemaList[7].name, "Formats");
    assert.strictEqual(schemaList[8].name, "AecUnits");
    assert.strictEqual(schemaList[9].name, "SpatialComposition");
    assert.strictEqual(schemaList[10].name, "BuildingSpatial");
    assert.strictEqual(schemaList[11].name, "ArchitecturalPhysical");
    assert.strictEqual(schemaList[12].name, "BuildingDataGroupWS");
  });
});
