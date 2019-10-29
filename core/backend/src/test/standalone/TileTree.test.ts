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

function scaleProjectExtents(db: IModelDb, scale: number): Range3d {
  const range = db.projectExtents.clone();
  range.scaleAboutCenterInPlace(scale);
  db.updateProjectExtents(range);
  db.saveChanges();
  return range.clone();
}

describe("purgeTileTrees", () => {
  it("should update after purge when project extents change", async () => {
    const db = createIModel();
    const modelId = insertPhysicalModel(db);

    // The "_1-" holds the flag saying to use the project extents as the range of the tile tree.
    const treeId = "5_1-" + modelId;
    const context = new BackendRequestContext();
    let tree = await db.tiles.requestTileTreeProps(context, treeId);
    expect(tree).not.to.be.undefined;
    expect(tree.id).to.equal(treeId);

    let range = Range3d.fromJSON(tree.rootTile.range);
    expect(range.isNull).to.be.false;
    expect(range.isAlmostEqual(defaultExtents)).to.be.true;
    expect(tree.rootTile.contentRange).to.be.undefined;
    expect(tree.rootTile.isLeaf).to.be.true;

    // Change the project extents - nothing should change - we haven't yet purged our model's tile tree.
    let newExtents = scaleProjectExtents(db, 2.0);

    tree = await db.tiles.requestTileTreeProps(context, treeId);
    expect(tree).not.to.be.undefined;
    expect(tree.id).to.equal(treeId);

    range = Range3d.fromJSON(tree.rootTile.range);
    expect(range.isNull).to.be.false;
    expect(range.isAlmostEqual(defaultExtents)).to.be.true;
    expect(range.isAlmostEqual(newExtents)).to.be.false;
    expect(tree.rootTile.contentRange).to.be.undefined;
    expect(tree.rootTile.isLeaf).to.be.true;

    // Purge tile trees for a specific (non-existent) model - still nothing should change for our model.
    db.nativeDb.purgeTileTrees(["0x123abc"]);

    tree = await db.tiles.requestTileTreeProps(context, treeId);
    expect(tree).not.to.be.undefined;
    expect(tree.id).to.equal(treeId);

    range = Range3d.fromJSON(tree.rootTile.range);
    expect(range.isNull).to.be.false;
    expect(range.isAlmostEqual(defaultExtents)).to.be.true;
    expect(range.isAlmostEqual(newExtents)).to.be.false;
    expect(tree.rootTile.contentRange).to.be.undefined;
    expect(tree.rootTile.isLeaf).to.be.true;

    // Purge tile trees for our model - now we should get updated tile tree props.
    db.nativeDb.purgeTileTrees([modelId]);

    tree = await db.tiles.requestTileTreeProps(context, treeId);
    expect(tree).not.to.be.undefined;
    expect(tree.id).to.equal(treeId);

    range = Range3d.fromJSON(tree.rootTile.range);
    expect(range.isNull).to.be.false;
    expect(range.isAlmostEqual(defaultExtents)).to.be.false;
    expect(range.isAlmostEqual(newExtents)).to.be.true;
    expect(tree.rootTile.contentRange).to.be.undefined;
    expect(tree.rootTile.isLeaf).to.be.true;

    // Change extents again and purge tile trees for all loaded models (by passing `undefined` for model Ids).
    newExtents = scaleProjectExtents(db, 0.75);
    db.nativeDb.purgeTileTrees(undefined);

    tree = await db.tiles.requestTileTreeProps(context, treeId);
    expect(tree).not.to.be.undefined;
    expect(tree.id).to.equal(treeId);

    range = Range3d.fromJSON(tree.rootTile.range);
    expect(range.isNull).to.be.false;
    expect(range.isAlmostEqual(defaultExtents)).to.be.false;
    expect(range.isAlmostEqual(newExtents)).to.be.true;
    expect(tree.rootTile.contentRange).to.be.undefined;
    expect(tree.rootTile.isLeaf).to.be.true;
  });
});
