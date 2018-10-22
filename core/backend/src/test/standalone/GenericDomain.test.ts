/*---------------------------------------------------------------------------------------------
* Copyright (c) 2018 Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/
import { assert } from "chai";
import { Guid, Id64String, Id64 } from "@bentley/bentleyjs-core";
// import { Logger, LogLevel } from "@bentley/bentleyjs-core";
import { CategoryProps, Code, GeometricElement3dProps, ElementProps, IModel, InformationPartitionElementProps } from "@bentley/imodeljs-common";
import { Generic, GroupInformationPartition, Group, GroupModel, IModelDb, PhysicalModel, PhysicalObject, PhysicalPartition, SpatialCategory } from "../../backend";
import { IModelTestUtils } from "../IModelTestUtils";

describe("Generic Domain", () => {

  before(() => {
    // Logger.initializeToConsole();
    // Logger.setLevelDefault(LogLevel.Warning);
    // Logger.setLevel("imodeljs-addon", LogLevel.Warning);
    // Logger.setLevel("imodeljs-backend", LogLevel.Warning);
    // Logger.setLevel("DgnCore", LogLevel.Warning);
    // Logger.setLevel("ECObjectsNative", LogLevel.Warning);
    // Logger.setLevel("ECDb", LogLevel.Warning);
  });

  it("should create elements from the Generic domain", async () => {
    Generic.registerSchema();
    assert.equal(Generic.name, "Generic");
    assert.isTrue(PhysicalObject.classFullName.startsWith(Generic.name));

    const iModelDb: IModelDb = IModelTestUtils.createStandaloneIModel("GenericTest.bim", {
      rootSubject: { name: "GenericTest", description: "Test of the Generic domain schema." },
      client: "Generic",
      globalOrigin: { x: 0, y: 0 },
      projectExtents: { low: { x: -500, y: -500, z: -50 }, high: { x: 500, y: 500, z: 50 } },
      guid: new Guid(true),
    });

    // Insert a SpatialCategory
    const spatialCategoryProps: CategoryProps = {
      classFullName: SpatialCategory.classFullName,
      model: IModel.dictionaryId,
      code: SpatialCategory.createCode(iModelDb, IModel.dictionaryId, "Test Spatial Category"),
      isPrivate: false,
    };
    const spatialCategoryId: Id64String = iModelDb.elements.insertElement(spatialCategoryProps);
    assert.isTrue(Id64.isValidId64(spatialCategoryId));

    // Create and populate a PhysicalModel
    const physicalPartitionProps: InformationPartitionElementProps = {
      classFullName: PhysicalPartition.classFullName,
      model: IModel.repositoryModelId,
      parent: {
        id: IModel.rootSubjectId,
        relClassName: "BisCore:SubjectOwnsPartitionElements",
      },
      code: PhysicalPartition.createCode(iModelDb, IModel.rootSubjectId, "Test Physical Model"),
    };
    const physicalPartitionId: Id64String = iModelDb.elements.insertElement(physicalPartitionProps);
    assert.isTrue(Id64.isValidId64(physicalPartitionId));
    const physicalModel: PhysicalModel = iModelDb.models.createModel({
      classFullName: PhysicalModel.classFullName,
      modeledElement: { id: physicalPartitionId },
    }) as PhysicalModel;
    const physicalModelId: Id64String = iModelDb.models.insertModel(physicalModel);
    assert.isTrue(Id64.isValidId64(physicalModelId));

    for (let i = 0; i < 3; i++) {
      const physicalObjectProps: GeometricElement3dProps = {
        classFullName: PhysicalObject.classFullName,
        model: physicalModelId,
        category: spatialCategoryId,
        code: Code.createEmpty(),
        userLabel: `${PhysicalObject.name}${i}`,
      };
      const physicalObjectId: Id64String = iModelDb.elements.insertElement(physicalObjectProps);
      assert.isTrue(Id64.isValidId64(physicalObjectId));
    }

    // Create and populate a Generic:GroupModel
    const groupPartitionProps: InformationPartitionElementProps = {
      classFullName: GroupInformationPartition.classFullName,
      model: IModel.repositoryModelId,
      parent: {
        id: IModel.rootSubjectId,
        relClassName: "BisCore:SubjectOwnsPartitionElements",
      },
      code: GroupInformationPartition.createCode(iModelDb, IModel.rootSubjectId, "Test Group Model"),
    };
    const groupPartitionId: Id64String = iModelDb.elements.insertElement(groupPartitionProps);
    assert.isTrue(Id64.isValidId64(groupPartitionId));
    const groupModel: GroupModel = iModelDb.models.createModel({
      classFullName: GroupModel.classFullName,
      modeledElement: { id: groupPartitionId },
    }) as GroupModel;
    const groupModelId: Id64String = iModelDb.models.insertModel(groupModel);
    assert.isTrue(Id64.isValidId64(groupModelId));

    for (let i = 0; i < 3; i++) {
      const groupProps: ElementProps = {
        classFullName: Group.classFullName,
        model: groupModelId,
        code: Code.createEmpty(),
        userLabel: `${Group.name}${i}`,
      };
      const groupId: Id64String = iModelDb.elements.insertElement(groupProps);
      assert.isTrue(Id64.isValidId64(groupId));
    }

    iModelDb.saveChanges("Insert Generic elements");
    iModelDb.closeStandalone();
  });
});
