/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import { assert, expect } from "chai";
import { DbResult, Id64, IModelStatus } from "@itwin/core-bentley";
import { AxisAlignedBox3d, Code, IModel, IModelError, SubCategoryAppearance } from "@itwin/core-common";
import { Range3d, Transform } from "@itwin/core-geometry";
import { EditTxn, withEditTxn } from "../../EditTxn";
import {
  _nativeDb, Category, ClassRegistry, DefinitionContainer, DefinitionGroup, DefinitionGroupGroupsDefinitions,
  DefinitionModel, DefinitionPartition, DocumentPartition, DrawingGraphic, ECSqlStatement, Element, GeometricElement2d,
  GroupInformationPartition, LinkPartition, Model, PhysicalModel, PhysicalPartition, SnapshotDb, SpatialCategory, SubCategory,
} from "../../core-backend";
import { IModelTestUtils } from "../IModelTestUtils";
import { DisableNativeAssertions, TestUtils } from "../TestUtils";
import { closeIfOpen, createIModelFromSeed, createMutableIModelTracker, expectIModelError, getIModelError, importTestBim, openReadonlySeedCopy, roundtripThroughJson } from "./IModelTestFixtures";


describe("iModel models", () => {
  let testBimReadonly: SnapshotDb;
  let compatibilityReadonly: SnapshotDb;
  const { trackMutableIModel, closeTrackedIModels } = createMutableIModelTracker();

  before(async () => {
    await TestUtils.startBackend();
    IModelTestUtils.registerTestBimSchema();

    testBimReadonly = await openReadonlySeedCopy("models-test.bim", "test.bim", { importTestBim: true });
    compatibilityReadonly = await openReadonlySeedCopy("models-CompatibilityTestSeed.bim", "CompatibilityTestSeed.bim");
  });

  after(() => {
    closeIfOpen(testBimReadonly, compatibilityReadonly);
    closeTrackedIModels();
  });

  afterEach(() => {
    closeTrackedIModels();
  });

  it("should load a known model by Id from an existing iModel", () => {
    const imodel1 = testBimReadonly;
    assert.exists(imodel1.models);
    const model2 = imodel1.models.getModel("0x1c");
    assert.exists(model2);
    const formatter = model2.getJsonProperty("formatter");
    assert.exists(formatter, "formatter should exist as json property");
    assert.equal(formatter.fmtFlags.angMode, 1, "fmtFlags");
    assert.equal(formatter.mastUnit.label, "m", "mastUnit is meters");
    roundtripThroughJson(model2);
    let model = imodel1.models.getModel(IModel.repositoryModelId);
    assert.exists(model);
    roundtripThroughJson(model);
    const code1 = new Code({ spec: "0x1d", scope: "0x1d", value: "A" });
    model = imodel1.models.getSubModel(code1);
    // By this point, we expect the submodel's class to be in the class registry *cache*
    const geomModel = ClassRegistry.getClass(PhysicalModel.classFullName, imodel1);
    assert.exists(model);
    assert.isTrue(model instanceof geomModel);
    roundtripThroughJson(model);
    const modelExtents: AxisAlignedBox3d = (model as PhysicalModel).queryExtents();

    assert.isBelow(modelExtents.low.x, modelExtents.high.x);
    assert.isBelow(modelExtents.low.y, modelExtents.high.y);
    assert.isBelow(modelExtents.low.z, modelExtents.high.z);
  });

  it("should find a tile tree for a geometric model", async () => {
    const imodel1 = testBimReadonly;
    // Note: this is an empty model.
    const tree = await imodel1.tiles.requestTileTreeProps("0x1c");
    expect(tree).not.to.be.undefined;

    expect(tree.id).to.equal("0x1c");
    expect(tree.maxTilesToSkip).to.equal(1);
    expect(tree.rootTile).not.to.be.undefined;

    // Empty model => identity transform
    const tf = Transform.fromJSON(tree.location);
    expect(tf.matrix.isIdentity).to.be.true;
    expect(tf.origin.x).to.equal(0);
    expect(tf.origin.y).to.equal(0);
    expect(tf.origin.z).to.equal(0);

    expect(tree.rootTile.contentId).to.equal("0/0/0/0/1");

    // Empty model => null range
    const range = Range3d.fromJSON(tree.rootTile.range);
    expect(range.isNull).to.be.true;

    expect(tree.rootTile.maximumSize).to.equal(0.0); // empty model => undisplayable root tile => size = 0.0
    expect(tree.rootTile.isLeaf).to.be.true; // empty model => empty tile
    expect(tree.rootTile.contentRange).to.be.undefined;
  });

  it("should throw on invalid tile requests", async () => {
    const imodel1 = testBimReadonly;
    using _r = new DisableNativeAssertions();
    let error = await getIModelError(imodel1.tiles.requestTileTreeProps("0x12345"));
    expectIModelError(IModelStatus.InvalidId, error);

    error = await getIModelError(imodel1.tiles.requestTileTreeProps("NotAValidId"));
    expectIModelError(IModelStatus.InvalidId, error);

    error = await getIModelError(imodel1.tiles.requestTileContent("0x1c", "0/0/0/0"));
    expectIModelError(IModelStatus.InvalidId, error);

    error = await getIModelError(imodel1.tiles.requestTileContent("0x12345", "0/0/0/0/1"));
    expectIModelError(IModelStatus.InvalidId, error);

    error = await getIModelError(imodel1.tiles.requestTileContent("0x1c", "V/W/X/Y/Z"));
    expectIModelError(IModelStatus.InvalidId, error);

    error = await getIModelError(imodel1.tiles.requestTileContent("0x1c", "NotAValidId"));
    expectIModelError(IModelStatus.InvalidId, error);
  });

  it("should be some categories", () => {
    const imodel1 = testBimReadonly;
    const categorySql = `SELECT ECInstanceId FROM ${Category.classFullName}`;
    // eslint-disable-next-line @typescript-eslint/no-deprecated
    imodel1.withPreparedStatement(categorySql, (categoryStatement: ECSqlStatement): void => {
      let numCategories = 0;
      while (DbResult.BE_SQLITE_ROW === categoryStatement.step()) {
        numCategories++;
        const categoryId = categoryStatement.getValue(0).getId();
        const category: Element = imodel1.elements.getElement(categoryId);
        assert.isTrue(category instanceof Category, "Should be instance of Category");

        // verify the default subcategory.
        const defaultSubCategoryId = (category as Category).myDefaultSubCategoryId();
        const defaultSubCategory: Element = imodel1.elements.getElement(defaultSubCategoryId);
        assert.isTrue(defaultSubCategory instanceof SubCategory, "defaultSubCategory should be instance of SubCategory");
        if (defaultSubCategory instanceof SubCategory) {
          assert.isTrue(defaultSubCategory.parent!.id === categoryId, "defaultSubCategory id should be prescribed value");
          assert.isTrue(defaultSubCategory.getSubCategoryName() === category.code.value, "DefaultSubcategory name should match that of Category");
          assert.isTrue(defaultSubCategory.isDefaultSubCategory, "isDefaultSubCategory should return true");
        }

        // get the subcategories
        const subCategorySql = `SELECT ECInstanceId FROM ${SubCategory.classFullName} WHERE Parent.Id=:parentId`;
        // eslint-disable-next-line @typescript-eslint/no-deprecated
        imodel1.withPreparedStatement(subCategorySql, (subCategoryStatement: ECSqlStatement): void => {
          let numSubCategories = 0;
          subCategoryStatement.bindId("parentId", categoryId);
          while (DbResult.BE_SQLITE_ROW === subCategoryStatement.step()) {
            numSubCategories++;
            const subCategoryId = subCategoryStatement.getValue(0).getId();
            const subCategory: Element = imodel1.elements.getElement(subCategoryId);
            assert.isTrue(subCategory instanceof SubCategory);
            assert.isTrue(subCategory.parent!.id === categoryId);
          }
          assert.isAtLeast(numSubCategories, 1, "Expected query to find at least one SubCategory");
        });
      }
      assert.isAtLeast(numCategories, 1, "Expected query to find some categories");
    });
  });

  it("should be some 2d elements", () => {
    const imodel2 = compatibilityReadonly;
    const sql = `SELECT ECInstanceId FROM ${DrawingGraphic.classFullName}`;
    // eslint-disable-next-line @typescript-eslint/no-deprecated
    imodel2.withPreparedStatement(sql, (statement: ECSqlStatement): void => {
      let numDrawingGraphics = 0;
      let found25: boolean = false;
      let found26: boolean = false;
      while (DbResult.BE_SQLITE_ROW === statement.step()) {
        numDrawingGraphics++;
        const drawingGraphicId = statement.getValue(0).getId();
        const drawingGraphic = imodel2.elements.getElement<GeometricElement2d>({ id: drawingGraphicId, wantGeometry: true });
        assert.exists(drawingGraphic);
        assert.isTrue(drawingGraphic.className === "DrawingGraphic", "Should be instance of DrawingGraphic");
        assert.isTrue(drawingGraphic instanceof DrawingGraphic, "Is instance of DrawingGraphic");
        assert.isTrue(drawingGraphic instanceof GeometricElement2d, "Is instance of GeometricElement2d");
        if (Id64.getLocalId(drawingGraphic.id) === 0x25) {
          found25 = true;
          assert.isTrue(drawingGraphic.placement.origin.x === 0.0);
          assert.isTrue(drawingGraphic.placement.origin.y === 0.0);
          assert.isTrue(drawingGraphic.placement.angle.radians === 0.0);
          assert.isTrue(drawingGraphic.placement.bbox.low.x === 0.0);
          assert.isTrue(drawingGraphic.placement.bbox.low.y === 0.0);
          assert.isTrue(drawingGraphic.placement.bbox.high.x === 1.0);
          assert.isTrue(drawingGraphic.placement.bbox.high.y === 1.0);
          assert.isDefined(drawingGraphic.geom);
        } else if (Id64.getLocalId(drawingGraphic.id) === 0x26) {
          found26 = true;
          assert.isTrue(drawingGraphic.placement.origin.x === 1.0);
          assert.isTrue(drawingGraphic.placement.origin.y === 1.0);
          assert.isTrue(drawingGraphic.placement.angle.radians === 0.0);
          assert.isTrue(drawingGraphic.placement.bbox.low.x === 0.0);
          assert.isTrue(drawingGraphic.placement.bbox.low.y === 0.0);
          assert.isTrue(drawingGraphic.placement.bbox.high.x === 2.0);
          assert.isTrue(drawingGraphic.placement.bbox.high.y === 2.0);
          assert.isDefined(drawingGraphic.geom);
        }
      }
      assert.isAtLeast(numDrawingGraphics, 1, "Expected query to find some DrawingGraphics");
      assert.isTrue(found25, "Expected to find a specific element");
      assert.isTrue(found26, "Expected to find a specific element");
    });
  });

  it("should be children of RootSubject", () => {
    const imodel2 = compatibilityReadonly;
    const sql = `SELECT ECInstanceId FROM ${Model.classFullName} WHERE ParentModel.Id=:parentModelId`;
    // eslint-disable-next-line @typescript-eslint/no-deprecated
    imodel2.withPreparedStatement(sql, (statement: ECSqlStatement): void => {
      statement.bindId("parentModelId", IModel.repositoryModelId);
      let numModels = 0;
      while (DbResult.BE_SQLITE_ROW === statement.step()) {
        numModels++;
        const modelId = statement.getValue(0).getId();
        const model = imodel2.models.getModel(modelId);
        assert.exists(model, "Model should exist");
        assert.isTrue(model instanceof Model);

        // should be an element with the same Id.
        const modeledElement = imodel2.elements.getElement(modelId);
        assert.exists(modeledElement, "Modeled Element should exist");

        if (model.className === "LinkModel") {
          // expect LinkModel to be accompanied by LinkPartition
          assert.isTrue(modeledElement instanceof LinkPartition);
          continue;
        } else if (model.className === "DictionaryModel") {
          assert.isTrue(modeledElement instanceof DefinitionPartition);
          continue;
        } else if (model.className === "PhysicalModel") {
          assert.isTrue(modeledElement instanceof PhysicalPartition);
          continue;
        } else if (model.className === "GroupModel") {
          assert.isTrue(modeledElement instanceof GroupInformationPartition);
          continue;
        } else if (model.className === "DocumentListModel") {
          assert.isTrue(modeledElement instanceof DocumentPartition);
          continue;
        } else if (model.className === "DefinitionModel") {
          assert.isTrue(modeledElement instanceof DefinitionPartition);
          continue;
        } else {
          assert.isTrue(false, "Expected a known model type");
        }
      }
      assert.isAtLeast(numModels, 1, "Expected query to find some Models");
    });
  });

  it("update the project extents", async () => {
    const imodel1 = trackMutableIModel(await importTestBim(createIModelFromSeed("models-project-extents.bim", "test.bim")));
    const originalExtents = imodel1.projectExtents;
    const newExtents = Range3d.create(originalExtents.low, originalExtents.high);
    newExtents.low.x -= 50;
    newExtents.low.y -= 25;
    newExtents.low.z -= 189;
    newExtents.high.x += 1087;
    newExtents.high.y += 19;
    newExtents.high.z += .001;
    await withEditTxn(imodel1, async (txn) => txn.updateProjectExtents(newExtents));

    const updatedProps = imodel1[_nativeDb].getIModelProps();
    assert.isTrue(updatedProps.hasOwnProperty("projectExtents"), "Returned property JSON object has project extents");
    const updatedExtents = Range3d.fromJSON(updatedProps.projectExtents);
    assert.isTrue(newExtents.isAlmostEqual(updatedExtents), "Project extents successfully updated in database");
  });

  it("should do CRUD on models", () => {

    const testImodel = trackMutableIModel(createIModelFromSeed("models-CRUD-CompatibilityTestSeed.bim", "CompatibilityTestSeed.bim"));
    const txn = new EditTxn(testImodel, "CRUD on models");
    txn.start();

    const [modeledElementId, newModelId] = IModelTestUtils.createAndInsertPhysicalPartitionAndModel(txn, Code.createEmpty(), true);

    const newModelPersist = testImodel.models.getModel(newModelId);

    // Check that it has the properties that we set.
    assert.equal(newModelPersist.classFullName, PhysicalModel.classFullName);
    assert.isTrue(newModelPersist.isPrivate);
    assert.deepEqual(newModelPersist.modeledElement.id, modeledElementId);

    // Update the model
    newModelPersist.isPrivate = false;
    txn.updateModel(newModelPersist.toJSON());
    //  ... and check that it updated the model in the db
    const newModelPersist2 = testImodel.models.getModel(newModelId);
    assert.isFalse(newModelPersist2.isPrivate);

    // Delete the model
    txn.deleteModel(newModelId);

    // Test insertModel error handling
    try {
      txn.insertModel({
        classFullName: DefinitionModel.classFullName,
        modeledElement: { id: "0x10000000bad" },
      });
    } catch (error: any) {
      assert.isTrue(error instanceof IModelError || error.iTwinErrorId !== undefined);
    }

    txn.end();

  });

  it("should insert DefinitionSets", () => {
    const iModelFileName: string = IModelTestUtils.prepareOutputFile("IModel", "DefinitionSets.bim");
    const iModelDb = SnapshotDb.createEmpty(iModelFileName, { rootSubject: { name: "DefinitionSets" }, createClassViews: true });
    const txn = new EditTxn(iModelDb, "definition sets");
    txn.start();
    const definitionContainerId = DefinitionContainer.insert(txn, IModel.dictionaryId, Code.createEmpty());
    assert.exists(iModelDb.elements.getElement<DefinitionContainer>(definitionContainerId));
    assert.exists(iModelDb.models.getModel<DefinitionModel>(definitionContainerId));
    const categoryId1 = SpatialCategory.insert(txn, definitionContainerId, "Category1", new SubCategoryAppearance());
    const categoryId2 = SpatialCategory.insert(txn, definitionContainerId, "Category2", new SubCategoryAppearance());
    const categoryId3 = SpatialCategory.insert(txn, definitionContainerId, "Category3", new SubCategoryAppearance());
    const definitionGroupId = DefinitionGroup.create(iModelDb, definitionContainerId, Code.createEmpty()).insert(txn);
    DefinitionGroupGroupsDefinitions.insert(txn, definitionGroupId, categoryId1);
    DefinitionGroupGroupsDefinitions.insert(txn, definitionGroupId, categoryId2);
    DefinitionGroupGroupsDefinitions.insert(txn, definitionGroupId, categoryId3);
    // eslint-disable-next-line @typescript-eslint/no-deprecated
    const numMembers = iModelDb.withPreparedStatement(`SELECT COUNT(*) FROM ${DefinitionGroupGroupsDefinitions.classFullName}`, (statement: ECSqlStatement): number => {
      return statement.step() === DbResult.BE_SQLITE_ROW ? statement.getValue(0).getInteger() : 0;
    });
    assert.equal(numMembers, 3);
    txn.end();
    iModelDb.close();
  });
});
