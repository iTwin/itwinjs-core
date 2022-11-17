/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import { expect } from "chai";
import { Guid, Id64 } from "@itwin/core-bentley";
import { LineString3d, Loop, Point3d } from "@itwin/core-geometry";
import {
  AreaPattern,
  Code, ColorDef, GeometricElement3dProps, GeometryParams, GeometryPartProps, GeometryStreamBuilder, GeometryStreamIterator, IModel,
} from "@itwin/core-common";
import {
  GenericSchema, GeometricElement3d, GeometryPart, PhysicalModel, PhysicalObject, PhysicalPartition, RenderMaterialElement, SnapshotDb, SpatialCategory, SubCategory, SubjectOwnsPartitionElements,
} from "../../core-backend";
import { IModelTestUtils } from "../IModelTestUtils";

describe.only("generateElementMeshes", () => {
  let imodel: SnapshotDb;
  let modelId: string;
  let categoryId: string;

  before(() => {
    imodel = SnapshotDb.createEmpty(IModelTestUtils.prepareOutputFile("generateElementMeshes", `${Guid.createValue()}.bim`), {
      rootSubject: { name: "generateElementMeshes", description: "generateElementMeshes" },
    });

    GenericSchema.registerSchema();
    const partitionId = imodel.elements.insertElement({
      classFullName: PhysicalPartition.classFullName,
      model: IModel.repositoryModelId,
      parent: new SubjectOwnsPartitionElements(IModel.rootSubjectId),
      code: PhysicalPartition.createCode(imodel, IModel.rootSubjectId, `PhysicalPartition_${Guid.createValue()}`),
    });

    const model = imodel.models.createModel({
      classFullName: PhysicalModel.classFullName,
      modeledElement: { id: partitionId },
    });

    modelId = imodel.models.insertModel(model.toJSON());
    categoryId = SpatialCategory.insert(imodel, IModel.dictionaryId, "cat", { color: ColorDef.blue.toJSON() });
  });

  after(() => {
    imodel.close();
  });

  it("throws if source is not a geometric element", async () => {
    await expect(imodel.nativeDb.generateElementMeshes({source: "NotAnId"})).rejectedWith("Geometric element required");
  });

  it("applies element placement transform", async () => {
  });

  it("applies part reference transform", async () => {
  });

  it("produces multiple polyfaces", async () => {
  });

  it("produces a polyface", async () => {
  });

  it("ignores open curves", async () => {
  });

  it("omits normals and UVs", async () => {
  });
});
