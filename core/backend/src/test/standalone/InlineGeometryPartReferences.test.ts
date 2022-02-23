/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import { expect } from "chai";
import { Guid, Id64 } from "@itwin/core-bentley";
import { IModel } from "@itwin/core-common";
import { GenericSchema, PhysicalModel, PhysicalPartition, SnapshotDb, SubjectOwnsPartitionElements } from "../../core-backend";
import { IModelTestUtils } from "../IModelTestUtils";

describe.only("DgnDb.inlineGeometryPartReferences", () => {
  let imodel: SnapshotDb;
  let modelId: string;

  beforeEach(() => {
    imodel = SnapshotDb.createEmpty(IModelTestUtils.prepareOutputFile("InlineGeomParts", `${Guid.createValue()}.bim`), {
      rootSubject: { name: "InlineGeomParts", description: "InlineGeomParts" },
    });

    GenericSchema.registerSchema();
    const partitionId = imodel.elements.insertElement({
      classFullName: PhysicalPartition.classFullName,
      model: IModel.repositoryModelId,
      parent: new SubjectOwnsPartitionElements(IModel.rootSubjectId),
      code: PhysicalPartition.createCode(imodel, IModel.rootSubjectId, `PhysicalPartition_${Guid.createValue()}`),
    });

    expect(Id64.isValidId64(partitionId)).to.be.true;
    const model = imodel.models.createModel({
      classFullName: PhysicalModel.classFullName,
      modeledElement: { id: partitionId },
    });

    expect(model).instanceOf(PhysicalModel);

    modelId = imodel.models.insertModel(model.toJSON());
    expect(Id64.isValidId64(modelId)).to.be.true;
  });

  afterEach(() => {
    imodel.close();
  });

  it("inlines and deletes unique parts", () => {
  });

  it("ignores non-unique parts", () => {
  });

  it("applies part transform", () => {
  });

  it("inlines multiple references in a single element", () => {
  });

  it("resets element symbology", () => {
  });

  it("has no effect if inlining fails", () => {
  });
});
