/*---------------------------------------------------------------------------------------------
* Copyright (c) 2019 Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/
import { expect } from "chai";
import {
  Guid,
  Id64,
  Id64String,
} from "@bentley/bentleyjs-core";
import {
  Range3d,
} from "@bentley/geometry-core";
import { IModel } from "@bentley/imodeljs-common";
import {
  BackendRequestContext,
  GenericSchema,
  IModelDb,
  PhysicalModel,
  PhysicalPartition,
  SubjectOwnsPartitionElements,
} from "../../imodeljs-backend";
import { IModelTestUtils } from "../IModelTestUtils";

let uniqueId = 0;

const defaultExtents = Range3d.fromJSON({
  low: { x: -500, y: -200, z: -50 },
  high: {x: 500, y: 200, z: 50 },
});

function insertPhysicalModel(db: IModelDb): Id64String {
  GenericSchema.registerSchema();

  const partitionProps = {
    classFullName: PhysicalPartition.classFullName,
    model: IModel.repositoryModelId,
    parent: new SubjectOwnsPartitionElements(IModel.rootSubjectId),
    code: PhysicalPartition.createCode(db, IModel.rootSubjectId, "PhysicalPartition_" + (++uniqueId)),
  };

  const partitionId = db.elements.insertElement(partitionProps);
  expect(Id64.isValidId64(partitionId)).to.be.true;

  const model = db.models.createModel({
    classFullName: PhysicalModel.classFullName,
    modeledElement: { id: partitionId },
  });

  expect(model instanceof PhysicalModel).to.be.true;

  const modelId = db.models.insertModel(model);
  expect(Id64.isValidId64(modelId)).to.be.true;
  return modelId;
}

function createIModel(): IModelDb {
  const props = {
    rootSubject: { name: "TileTreeTest", description: "Test purgeTileTrees" },
    client: "TileTree",
    globaleOrigin: { x: 0, y: 0 },
    projectExtents: defaultExtents,
    guid: Guid.createValue(),
  };

  const name = "Test_" + (++uniqueId) + ".bim";
  return IModelDb.createSnapshot(IModelTestUtils.prepareOutputFile("TileTree", name), props);
}

describe("purgeTileTrees", () => {
  it("should update when project extents change", async () => {
    const db = createIModel();
    const modelId = insertPhysicalModel(db);

    // The "_1-" holds the flag saying to use the project extents as the range of the tile tree.
    const treeId = "5_1-" + modelId;
    const context = new BackendRequestContext();
    const tree = await db.tiles.requestTileTreeProps(context, treeId);
    expect(tree).not.to.be.undefined;
    expect(tree.id).to.equal(treeId);

    const range = Range3d.fromJSON(tree.rootTile.range);
    expect(range.isNull).to.be.false;
    expect(range.isAlmostEqual(defaultExtents)).to.be.true;
    expect(tree.rootTile.contentRange).to.be.undefined;
    expect(tree.rootTile.isLeaf).to.be.true;
  });
});
