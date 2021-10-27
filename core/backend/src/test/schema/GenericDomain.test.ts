/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import { assert } from "chai";
import { DbResult, Guid, Id64, Id64String } from "@itwin/core-bentley";
import {
  CategoryProps, Code, DefinitionElementProps, ElementProps, GeometricElement3dProps, IModel, PhysicalElementProps, PhysicalTypeProps,
  TypeDefinitionElementProps,
} from "@itwin/core-common";
import {
  DefinitionModel, DocumentListModel, ECSqlStatement, GenericDocument, GenericGraphicalModel3d, GenericGraphicalType2d, GenericPhysicalMaterial,
  GenericPhysicalType, GenericSchema, Graphic3d, Group, GroupModel, IModelDb, IModelJsFs, PhysicalElementIsOfPhysicalMaterial,
  PhysicalElementIsOfType, PhysicalModel, PhysicalObject, PhysicalTypeIsOfPhysicalMaterial, SnapshotDb, SpatialCategory,
} from "../../core-backend";
import { IModelTestUtils } from "../IModelTestUtils";

describe("Generic Domain", () => {

  function count(iModelDb: IModelDb, classFullName: string): number {
    return iModelDb.withPreparedStatement(`SELECT COUNT(*) FROM ${classFullName}`, (statement: ECSqlStatement): number => {
      return DbResult.BE_SQLITE_ROW === statement.step() ? statement.getValue(0).getInteger() : 0;
    });
  }

  it("should create elements from the Generic domain", async () => {
    GenericSchema.registerSchema();
    assert.isTrue(IModelJsFs.existsSync(GenericSchema.schemaFilePath));
    assert.equal(GenericSchema.schemaName, "Generic");
    assert.isTrue(PhysicalObject.classFullName.startsWith(GenericSchema.schemaName));

    const iModelDb = SnapshotDb.createEmpty(IModelTestUtils.prepareOutputFile("GenericDomain", "GenericTest.bim"), {
      rootSubject: { name: "GenericTest", description: "Test of the Generic domain schema." },
      client: "Generic",
      globalOrigin: { x: 0, y: 0 },
      projectExtents: { low: { x: -500, y: -500, z: -50 }, high: { x: 500, y: 500, z: 50 } },
      guid: Guid.createValue(),
      createClassViews: true,
    });

    // Create and populate a DefinitionModel
    const definitionModelId: Id64String = DefinitionModel.insert(iModelDb, IModel.rootSubjectId, "Test DefinitionModel");
    assert.isTrue(Id64.isValidId64(definitionModelId));

    // Insert a SpatialCategory
    const spatialCategoryProps: CategoryProps = {
      classFullName: SpatialCategory.classFullName,
      model: definitionModelId,
      code: SpatialCategory.createCode(iModelDb, definitionModelId, "Test SpatialCategory"),
    };
    const spatialCategoryId: Id64String = iModelDb.elements.insertElement(spatialCategoryProps);
    assert.isTrue(Id64.isValidId64(spatialCategoryId));

    // Insert a GenericGraphicalType2d
    const graphicalTypeProps: TypeDefinitionElementProps = {
      classFullName: GenericGraphicalType2d.classFullName,
      model: definitionModelId,
      code: Code.createEmpty(),
      userLabel: `${GenericGraphicalType2d.className}`,
    };
    const graphicalTypeId: Id64String = iModelDb.elements.insertElement(graphicalTypeProps);
    assert.isTrue(Id64.isValidId64(graphicalTypeId));

    // Insert a GenericPhysicalMaterial
    const physicalMaterialProps: DefinitionElementProps = {
      classFullName: GenericPhysicalMaterial.classFullName,
      model: definitionModelId,
      code: Code.createEmpty(),
      userLabel: `${GenericPhysicalMaterial.className}`,
    };
    const physicalMaterialId: Id64String = iModelDb.elements.insertElement(physicalMaterialProps);
    assert.isTrue(Id64.isValidId64(physicalMaterialId));

    // Insert a GenericPhysicalType
    const physicalTypeProps: PhysicalTypeProps = {
      classFullName: GenericPhysicalType.classFullName,
      model: definitionModelId,
      code: Code.createEmpty(),
      userLabel: `${GenericPhysicalType.className}`,
      physicalMaterial: new PhysicalTypeIsOfPhysicalMaterial(physicalMaterialId),
    };
    const physicalTypeId: Id64String = iModelDb.elements.insertElement(physicalTypeProps);
    assert.isTrue(Id64.isValidId64(physicalTypeId));

    // Create and populate a PhysicalModel
    const physicalModelId: Id64String = PhysicalModel.insert(iModelDb, IModel.rootSubjectId, "Test PhysicalModel");
    assert.isTrue(Id64.isValidId64(physicalModelId));

    for (let i = 0; i < 3; i++) {
      const physicalObjectProps: PhysicalElementProps = {
        classFullName: PhysicalObject.classFullName,
        model: physicalModelId,
        category: spatialCategoryId,
        code: Code.createEmpty(),
        userLabel: `${PhysicalObject.className}${i}`,
        physicalMaterial: new PhysicalElementIsOfPhysicalMaterial(physicalMaterialId),
        typeDefinition: new PhysicalElementIsOfType(physicalTypeId),
      };
      const physicalObjectId: Id64String = iModelDb.elements.insertElement(physicalObjectProps);
      assert.isTrue(Id64.isValidId64(physicalObjectId));
    }
    assert.equal(3, count(iModelDb, PhysicalObject.classFullName));

    // Create and populate a Generic:GroupModel
    const groupModelId: Id64String = GroupModel.insert(iModelDb, IModel.rootSubjectId, "Test GroupModel");
    assert.isTrue(Id64.isValidId64(groupModelId));

    for (let i = 0; i < 4; i++) {
      const groupProps: ElementProps = {
        classFullName: Group.classFullName,
        model: groupModelId,
        code: Code.createEmpty(),
        userLabel: `${Group.className}${i}`,
      };
      const groupId: Id64String = iModelDb.elements.insertElement(groupProps);
      assert.isTrue(Id64.isValidId64(groupId));
    }
    assert.equal(4, count(iModelDb, `${Group.schema.schemaName}:[${Group.className}]`)); // GROUP is a reserved word in SQL

    // Create and populate a Generic:GraphicalModel3d
    const graphicalModelId: Id64String = GenericGraphicalModel3d.insert(iModelDb, IModel.rootSubjectId, "Test GraphicalModel3d");
    assert.isTrue(Id64.isValidId64(graphicalModelId));

    for (let i = 0; i < 5; i++) {
      const graphicProps: GeometricElement3dProps = {
        classFullName: Graphic3d.classFullName,
        model: graphicalModelId,
        category: spatialCategoryId,
        code: Code.createEmpty(),
        userLabel: `${Graphic3d.className}${i}`,
      };
      const graphicId: Id64String = iModelDb.elements.insertElement(graphicProps);
      assert.isTrue(Id64.isValidId64(graphicId));
    }
    assert.equal(5, count(iModelDb, Graphic3d.classFullName));

    // Create and populate a DocumentListModel
    const documentListModelId: Id64String = DocumentListModel.insert(iModelDb, IModel.rootSubjectId, "Test DocumentListModel");
    assert.isTrue(Id64.isValidId64(documentListModelId));

    for (let i = 0; i < 2; i++) {
      const documentProps: ElementProps = {
        classFullName: GenericDocument.classFullName,
        model: documentListModelId,
        code: Code.createEmpty(),
        userLabel: `${GenericDocument.className}${i}`,
      };
      const graphicId: Id64String = iModelDb.elements.insertElement(documentProps);
      assert.isTrue(Id64.isValidId64(graphicId));
    }
    assert.equal(2, count(iModelDb, GenericDocument.classFullName));

    iModelDb.saveChanges("Insert Generic elements");
    iModelDb.close();
  });
});
