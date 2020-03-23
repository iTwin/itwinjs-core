/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import { expect } from "chai";
import {
  Guid,
  Id64,
  Id64String,
} from "@bentley/bentleyjs-core";
import {
  Box,
  Point3d,
  Range3d,
  Vector3d,
  YawPitchRollAngles,
} from "@bentley/geometry-core";
import {
  Code,
  ColorDef,
  GeometricElement3dProps,
  GeometryStreamBuilder,
  IModel,
} from "@bentley/imodeljs-common";
import {
  BackendRequestContext,
  GenericSchema,
  IModelDb,
  PhysicalModel,
  PhysicalObject,
  PhysicalPartition,
  SnapshotDb,
  SpatialCategory,
  SubjectOwnsPartitionElements,
} from "../../imodeljs-backend";
import { IModelTestUtils } from "../IModelTestUtils";

let uniqueId = 0;

const defaultExtents = Range3d.fromJSON({
  low: { x: -500, y: -200, z: -50 },
  high: { x: 500, y: 200, z: 50 },
});

// Tile tree range is scaled+offset a bit.
function scaleSpatialRange(range: Range3d): Range3d {
  const loScale = 1.0001;
  const hiScale = 1.0002;
  const fLo = 0.5 * (1.0 + loScale);
  const fHi = 0.5 * (1.0 + hiScale);

  const result = new Range3d();
  range.high.interpolate(fLo, range.low, result.low);
  range.low.interpolate(fHi, range.high, result.high);

  return result;
}

// The tile tree range is equal to the scaled+skewed project extents translated to align with the origin of the model range.
function almostEqualRange(a: Range3d, b: Range3d): boolean {
  return a.diagonal().isAlmostEqual(b.diagonal());
}

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

function scaleProjectExtents(db: IModelDb, scale: number): Range3d {
  const range = db.projectExtents.clone();
  range.scaleAboutCenterInPlace(scale);
  db.updateProjectExtents(range);
  db.saveChanges();
  return scaleSpatialRange(range);
}

describe("tile tree", () => {
  let db: SnapshotDb;
  let modelId: string;

  before(() => {
    const props = {
      rootSubject: { name: "TileTreeTest", description: "Test purgeTileTrees" },
      client: "TileTree",
      globaleOrigin: { x: 0, y: 0 },
      projectExtents: defaultExtents,
      guid: Guid.createValue(),
    };

    const name = "Test_" + (++uniqueId) + ".bim";
    db = SnapshotDb.createEmpty(IModelTestUtils.prepareOutputFile("TileTree", name), props);
    modelId = insertPhysicalModel(db);

    // NB: The model needs to contain at least one element with a range - otherwise tile tree will have null range.
    const geomBuilder = new GeometryStreamBuilder();
    geomBuilder.appendGeometry(Box.createDgnBox(Point3d.createZero(), Vector3d.unitX(), Vector3d.unitY(), new Point3d(0, 0, 2), 2, 2, 2, 2, true)!);
    const category = SpatialCategory.insert(db, IModel.dictionaryId, "kittycat", { color: ColorDef.white, transp: 0, invisible: false });
    const elemProps: GeometricElement3dProps = {
      classFullName: PhysicalObject.classFullName,
      model: modelId,
      category,
      code: Code.createEmpty(),
      userLabel: "blah",
      geom: geomBuilder.geometryStream,
      placement: {
        origin: Point3d.create(1, 1, 1),
        angles: YawPitchRollAngles.createDegrees(0, 0, 0),
      },
    };
    db.elements.insertElement(elemProps);
  });

  after(() => {
    if (db)
      db.close();
  });

  it("should update after changing project extents and purging", async () => {
    // "_x-" holds the flags - 0 = don't use project extents as basis of tile tree range; 1 = use them.
    let treeId = "8_0-" + modelId;
    const context = new BackendRequestContext();
    let tree = await db.tiles.requestTileTreeProps(context, treeId);
    expect(tree).not.to.be.undefined;
    expect(tree.id).to.equal(treeId);
    expect(tree.contentIdQualifier).to.be.undefined;

    const skewedDefaultExtents = scaleSpatialRange(defaultExtents);
    let range = Range3d.fromJSON(tree.rootTile.range);
    expect(almostEqualRange(range, skewedDefaultExtents)).to.be.false;

    treeId = "8_1-" + modelId;
    tree = await db.tiles.requestTileTreeProps(context, treeId);
    range = Range3d.fromJSON(tree.rootTile.range);
    expect(range.isNull).to.be.false;
    expect(almostEqualRange(range, skewedDefaultExtents)).to.be.true;
    expect(tree.contentRange).not.to.be.undefined;
    expect(tree.rootTile.contentRange).to.be.undefined;
    expect(tree.rootTile.isLeaf).to.be.false;

    expect(tree.contentIdQualifier).not.to.be.undefined;
    let prevQualifier = tree.contentIdQualifier;

    // Change the project extents - nothing should change - we haven't yet purged our model's tile tree.
    let newExtents = scaleProjectExtents(db, 2.0);

    tree = await db.tiles.requestTileTreeProps(context, treeId);
    expect(tree).not.to.be.undefined;
    expect(tree.id).to.equal(treeId);
    expect(tree.contentIdQualifier).to.equal(prevQualifier);

    range = Range3d.fromJSON(tree.rootTile.range);
    expect(range.isNull).to.be.false;
    expect(almostEqualRange(range, skewedDefaultExtents)).to.be.true;
    expect(almostEqualRange(range, newExtents)).to.be.false;
    expect(tree.contentRange).not.to.be.undefined;
    expect(tree.rootTile.contentRange).to.be.undefined;
    expect(tree.rootTile.isLeaf).to.be.false;

    // Purge tile trees for a specific (non-existent) model - still nothing should change for our model.
    db.nativeDb.purgeTileTrees(["0x123abc"]);

    tree = await db.tiles.requestTileTreeProps(context, treeId);
    expect(tree).not.to.be.undefined;
    expect(tree.id).to.equal(treeId);
    expect(tree.contentIdQualifier).to.equal(prevQualifier);

    range = Range3d.fromJSON(tree.rootTile.range);
    expect(range.isNull).to.be.false;
    expect(almostEqualRange(range, skewedDefaultExtents)).to.be.true;
    expect(almostEqualRange(range, newExtents)).to.be.false;
    expect(tree.contentRange).not.to.be.undefined;
    expect(tree.rootTile.contentRange).to.be.undefined;
    expect(tree.rootTile.isLeaf).to.be.false;

    // Purge tile trees for our model - now we should get updated tile tree props.
    db.nativeDb.purgeTileTrees([modelId]);

    tree = await db.tiles.requestTileTreeProps(context, treeId);
    expect(tree).not.to.be.undefined;
    expect(tree.id).to.equal(treeId);

    range = Range3d.fromJSON(tree.rootTile.range);
    expect(range.isNull).to.be.false;
    expect(almostEqualRange(range, skewedDefaultExtents)).to.be.false;
    expect(almostEqualRange(range, newExtents)).to.be.true;
    expect(tree.contentRange).not.to.be.undefined;
    expect(tree.rootTile.contentRange).to.be.undefined;
    expect(tree.rootTile.isLeaf).to.be.false;

    expect(tree.contentIdQualifier).not.to.equal(prevQualifier);
    expect(tree.contentIdQualifier).not.to.be.undefined;
    prevQualifier = tree.contentIdQualifier;

    // Change extents again and purge tile trees for all loaded models (by passing `undefined` for model Ids).
    newExtents = scaleProjectExtents(db, 0.75);
    db.nativeDb.purgeTileTrees(undefined);

    tree = await db.tiles.requestTileTreeProps(context, treeId);
    expect(tree).not.to.be.undefined;
    expect(tree.id).to.equal(treeId);

    range = Range3d.fromJSON(tree.rootTile.range);
    expect(range.isNull).to.be.false;
    expect(almostEqualRange(range, skewedDefaultExtents)).to.be.false;
    expect(almostEqualRange(range, newExtents)).to.be.true;
    expect(tree.contentRange).not.to.be.undefined;
    expect(tree.rootTile.contentRange).to.be.undefined;
    expect(tree.rootTile.isLeaf).to.be.false;

    expect(tree.contentIdQualifier).not.to.equal(prevQualifier);
    expect(tree.contentIdQualifier).not.to.be.undefined;
  });
});
