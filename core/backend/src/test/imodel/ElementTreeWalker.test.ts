/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import { assert } from "chai";
import * as path from "path";
import * as sinon from "sinon";
import { Id64, Id64Array, Id64String } from "@itwin/core-bentley";
import {
  Code, GeometricElement2dProps, GeometricElementProps, IModel, SubCategoryAppearance,
} from "@itwin/core-common";
import {
  Point2d,
} from "@itwin/core-geometry";
import {
  DefinitionModel, DocumentListModel, Drawing, DrawingCategory, DrawingGraphic, ElementGroupsMembers, IModelDb, Model, PhysicalPartition, SnapshotDb, SpatialCategory, Subject,
} from "../../core-backend";
import { KnownTestLocations } from "../KnownTestLocations";
import { IModelTestUtils } from "../IModelTestUtils";
import { deleteElementSubTrees, deleteElementTree, ElementTreeBottomUp, ElementTreeWalkerScope, isDefinitionModel } from "../../ElementTreeWalker";

// Test class that collects and prints the results of a bottom-up tree walk
class ElementTreeCollector extends ElementTreeBottomUp {
  public subModels: Id64Array = [];
  public definitionModels: Id64Array = [];
  public elements: Id64Array = [];
  public definitions: Id64Array = [];

  public constructor(imodel: IModelDb) { super(imodel); }

  public visitModel(model: Model, _scope: ElementTreeWalkerScope): void {
    if (isDefinitionModel(model))
      this.definitionModels.push(model.id);
    else
      this.subModels.push(model.id);
  }

  public visitElement(elid: Id64String, scope: ElementTreeWalkerScope): void {
    if (scope.inDefinitionModel)
      this.definitions.push(elid); // may be some other kind of InformationContentElement - that's OK.
    else
      this.elements.push(elid);
  }

  public collect(topElement: Id64String): void {
    this.processElementTree(topElement, ElementTreeWalkerScope.createTopScope(this._imodel, topElement));
  }
}

class SelectedElementCollector extends ElementTreeCollector {
  public constructor(imodel: IModelDb, private _elementsToReport: Id64Array) { super(imodel); }
  public override shouldExploreModel(_model: Model): boolean { return true; }
  public override shouldVisitModel(_model: Model): boolean { return false; }
  public override shouldVisitElement(elid: Id64String): boolean { return this._elementsToReport.includes(elid); }
}

function doesElementExist(imodel: IModelDb, elid: Id64String): boolean {
  return imodel.elements.tryGetElementProps(elid) !== undefined;
}

function doesModelExist(imodel: IModelDb, mid: Id64String): boolean {
  return imodel.models.tryGetModelProps(mid) !== undefined;
}

function doesGroupRelationshipExist(imodel: IModelDb, source: Id64String, target: Id64String): boolean {
  return imodel.withPreparedStatement(`select count(*) from ${ElementGroupsMembers.classFullName} where sourceecinstanceid=? and targetecinstanceid=?`, (stmt) => {
    stmt.bindId(1, source);
    stmt.bindId(2, target);
    stmt.step();
    return stmt.getValue(0).getInteger() !== 0;
  });
}

describe.only("ElementTreeWalker", () => {
  let imodel1: SnapshotDb;
  let originalEnv: any;

  before(async () => {
    originalEnv = { ...process.env };

    IModelTestUtils.registerTestBimSchema();
  });

  after(() => {
    process.env = originalEnv;
  });

  beforeEach(async () => {
    imodel1 = IModelTestUtils.createSnapshotFromSeed(IModelTestUtils.prepareOutputFile("IModel", "test.bim"), IModelTestUtils.resolveAssetFile("test.bim"));
    const schemaPathname = path.join(KnownTestLocations.assetsDir, "TestBim.ecschema.xml");
    await imodel1.importSchemas([schemaPathname]); // will throw an exception if import fails
  });

  afterEach(() => {
    sinon.restore();
    imodel1.close();
  });

  it("delete element tree with nested models", () => {

    const testImodel = imodel1;

    /*
      [RepositoryModel]
        RepositoryLink
        Job Subject
          +- DefinitionParitition  --   [DefinitionModel]
          |                               DrawingCategory
          |                               SpatialCategory
          |
          +- DocumentList         --    [DocumentListModel]
          |                               Drawing             -- [DrawingModel]
          |                                                       DrawingGraphic
          +- Child Subject
              |
              +- PhysicalPartition --   [PhysicalModel]
                                          PhysicalObject, PhysicalObject, PhysicalObject (grouped)
    */

    const repositoryLinkId = IModelTestUtils.insertRepositoryLink(testImodel, "test link", "foo", "bar");
    const jobSubjectId = IModelTestUtils.createJobSubjectElement(testImodel, "Job").insert();

    const childSubject = Subject.insert(testImodel, jobSubjectId, "Child Subject");

    const definitionModelId = DefinitionModel.insert(testImodel, jobSubjectId, "Definition");
    const spatialCategoryId = SpatialCategory.insert(testImodel, definitionModelId, "SpatialCategory", new SubCategoryAppearance());
    const drawingCategoryId = DrawingCategory.insert(testImodel, definitionModelId, "DrawingCategory", new SubCategoryAppearance());

    const documentListModelId = DocumentListModel.insert(testImodel, jobSubjectId, "Document");
    assert.isTrue(Id64.isValidId64(documentListModelId));
    const drawingModelId = Drawing.insert(testImodel, documentListModelId, "Drawing");
    const drawingGraphicProps1: GeometricElement2dProps = {
      classFullName: DrawingGraphic.classFullName,
      model: drawingModelId,
      category: drawingCategoryId,
      code: Code.createEmpty(),
      userLabel: "DrawingGraphic1",
      geom: IModelTestUtils.createRectangle(Point2d.create(1, 1)),
      placement: { origin: Point2d.create(2, 2), angle: 0 },
    };
    const drawingGraphicId1 = testImodel.elements.insertElement(drawingGraphicProps1);

    const [, physicalModelId] = IModelTestUtils.createAndInsertPhysicalPartitionAndModel(testImodel, PhysicalPartition.createCode(testImodel, childSubject, "Physical"), false, childSubject);
    const elementProps: GeometricElementProps = {
      classFullName: "TestBim:TestPhysicalObject",
      model: physicalModelId,
      category: spatialCategoryId,
      code: Code.createEmpty(),
    };

    const physicalObjectId1 = testImodel.elements.insertElement(testImodel.elements.createElement(elementProps).toJSON());
    const physicalObjectId2 = testImodel.elements.insertElement(testImodel.elements.createElement(elementProps).toJSON());
    const physicalObjectId3 = testImodel.elements.insertElement(testImodel.elements.createElement(elementProps).toJSON());
    ElementGroupsMembers.create(testImodel, physicalObjectId1, physicalObjectId2).insert();
    ElementGroupsMembers.create(testImodel, physicalObjectId1, physicalObjectId3).insert();

    assert.isTrue(doesElementExist(testImodel, repositoryLinkId));
    assert.equal(testImodel.elements.getElement(jobSubjectId).parent?.id, IModel.rootSubjectId);
    assert.equal(testImodel.elements.getElement(definitionModelId).parent?.id, jobSubjectId);
    assert.equal(testImodel.elements.getElement(spatialCategoryId).model, definitionModelId);
    assert.equal(testImodel.elements.getElement(drawingCategoryId).model, definitionModelId);
    assert.equal(testImodel.elements.getElement(documentListModelId).parent?.id, jobSubjectId);
    assert.equal(testImodel.elements.getElement(drawingModelId).model, documentListModelId);
    assert.equal(testImodel.elements.getElement(drawingGraphicId1).model, drawingModelId);
    assert.equal(testImodel.elements.getElement(physicalModelId).parent?.id, childSubject);
    assert.equal(testImodel.elements.getElement(physicalObjectId1).model, physicalModelId);
    assert.equal(testImodel.elements.getElement(physicalObjectId2).model, physicalModelId);
    assert.equal(testImodel.elements.getElement(physicalObjectId3).model, physicalModelId);
    assert.isTrue(doesGroupRelationshipExist(testImodel, physicalObjectId1, physicalObjectId2));
    assert.isTrue(doesGroupRelationshipExist(testImodel, physicalObjectId1, physicalObjectId3));
    assert.isTrue(doesModelExist(testImodel, definitionModelId));
    assert.isTrue(doesModelExist(testImodel, drawingModelId));
    assert.isTrue(doesModelExist(testImodel, physicalModelId));

    {
      const collector1 = new ElementTreeCollector(testImodel);
      collector1.collect(jobSubjectId);
      assert.isTrue(collector1.subModels.includes(physicalModelId));
      assert.isTrue(collector1.subModels.includes(drawingModelId));
      assert.isTrue(collector1.subModels.includes(documentListModelId));
      assert.isTrue(collector1.subModels.indexOf(drawingModelId) < collector1.subModels.indexOf(documentListModelId), "in bottom-up search, a child model should be visited before its parent model");
      assert.isFalse(collector1.subModels.includes(definitionModelId));
      assert.isTrue(collector1.definitionModels.includes(definitionModelId));
      assert.isTrue(collector1.definitions.includes(drawingCategoryId));
      assert.isTrue(collector1.definitions.includes(spatialCategoryId));
      assert.isFalse(collector1.elements.includes(drawingCategoryId));
      assert.isFalse(collector1.elements.includes(spatialCategoryId));
      assert.isTrue(collector1.elements.indexOf(physicalObjectId1) < collector1.elements.indexOf(physicalModelId), "in bottom-up search, an element in a model should be visited before its model's element");
      assert.isTrue(collector1.elements.indexOf(drawingGraphicId1) < collector1.elements.indexOf(drawingModelId), "in bottom-up search, an element in a model should be visited before its model's element");
      assert.isTrue(collector1.elements.indexOf(drawingModelId) < collector1.elements.indexOf(documentListModelId), "in bottom-up search, an element in a model should be visited before its model's element");
      assert.isTrue(collector1.elements.indexOf(documentListModelId) < collector1.elements.indexOf(jobSubjectId), "in bottom-up search, a child element should be visited before its parent element");
      assert.isTrue(collector1.elements.indexOf(definitionModelId) < collector1.elements.indexOf(jobSubjectId), "in bottom-up search, a child element should be visited before its parent element");
      assert.isTrue(collector1.elements.indexOf(childSubject) < collector1.elements.indexOf(jobSubjectId), "in bottom-up search, a child element should be visited before its parent element");
      assert.isTrue(collector1.elements.indexOf(physicalModelId) < collector1.elements.indexOf(childSubject), "in bottom-up search, a child element should be visited before its parent element");
    }

    {
      const collector2 = new SelectedElementCollector(testImodel, [drawingGraphicId1, spatialCategoryId, physicalObjectId3]);
      collector2.collect(jobSubjectId);
      assert.isTrue(collector2.definitions.length === 1);
      assert.isTrue(collector2.definitions.includes(spatialCategoryId));
      assert.isTrue(collector2.elements.length === 2);
      assert.isTrue(collector2.elements.includes(drawingGraphicId1));
      assert.isTrue(collector2.elements.includes(physicalObjectId3));
    }

    deleteElementTree(testImodel, jobSubjectId);

    assert.isTrue(doesElementExist(testImodel, repositoryLinkId), "RepositoryLink should not have been deleted, since it is not under Job Subject");
    assert.isFalse(doesElementExist(testImodel, definitionModelId));
    assert.isFalse(doesElementExist(testImodel, spatialCategoryId));
    assert.isFalse(doesElementExist(testImodel, drawingCategoryId));
    assert.isFalse(doesElementExist(testImodel, documentListModelId));
    assert.isFalse(doesElementExist(testImodel, drawingModelId));
    assert.isFalse(doesElementExist(testImodel, drawingGraphicId1));
    assert.isFalse(doesElementExist(testImodel, physicalModelId));
    assert.isFalse(doesElementExist(testImodel, physicalObjectId1));
    assert.isFalse(doesElementExist(testImodel, physicalObjectId2));
    assert.isFalse(doesElementExist(testImodel, physicalObjectId3));
    assert.isFalse(doesGroupRelationshipExist(testImodel, physicalObjectId1, physicalObjectId2));
    assert.isFalse(doesGroupRelationshipExist(testImodel, physicalObjectId1, physicalObjectId3));
    assert.isFalse(doesElementExist(testImodel, jobSubjectId));
    assert.isFalse(doesModelExist(testImodel, definitionModelId));
    assert.isFalse(doesModelExist(testImodel, drawingModelId));
    assert.isFalse(doesModelExist(testImodel, physicalModelId));
    assert.isTrue(doesModelExist(testImodel, IModel.repositoryModelId));
    assert.isTrue(doesModelExist(testImodel, IModel.dictionaryId));
  });

  it("delete element sub-tree with nested models", () => {

    const testImodel = imodel1;

    /*
      [RepositoryModel]
        RepositoryLink
        Job Subject
          +- DefinitionParitition  --   [DefinitionModel]
          |                               DrawingCategory                         <-- PRUNE
          |                               SpatialCategory
          |
          +- DocumentList         --    [DocumentListModel]
          |                               Drawing             -- [DrawingModel]   <-- PRUNE
          |                                                       DrawingGraphic       "
          +- Child Subject
              |
              +- PhysicalPartition --   [PhysicalModel]
                                          PhysicalObject, PhysicalObject, PhysicalObject (grouped)
                                                                                  ^-- PRUNE
    */

    const repositoryLinkId = IModelTestUtils.insertRepositoryLink(testImodel, "test link", "foo", "bar");
    const jobSubjectId = IModelTestUtils.createJobSubjectElement(testImodel, "Job").insert();

    const childSubject = Subject.insert(testImodel, jobSubjectId, "Child Subject");

    const definitionModelId = DefinitionModel.insert(testImodel, jobSubjectId, "Definition");
    const spatialCategoryId = SpatialCategory.insert(testImodel, definitionModelId, "SpatialCategory", new SubCategoryAppearance());
    const drawingCategoryId = DrawingCategory.insert(testImodel, definitionModelId, "DrawingCategory", new SubCategoryAppearance());

    const documentListModelId = DocumentListModel.insert(testImodel, jobSubjectId, "Document");
    assert.isTrue(Id64.isValidId64(documentListModelId));
    const drawingModelId = Drawing.insert(testImodel, documentListModelId, "Drawing");
    const drawingGraphicProps1: GeometricElement2dProps = {
      classFullName: DrawingGraphic.classFullName,
      model: drawingModelId,
      category: drawingCategoryId,
      code: Code.createEmpty(),
      userLabel: "DrawingGraphic1",
      geom: IModelTestUtils.createRectangle(Point2d.create(1, 1)),
      placement: { origin: Point2d.create(2, 2), angle: 0 },
    };
    const drawingGraphicId1 = testImodel.elements.insertElement(drawingGraphicProps1);

    const [, physicalModelId] = IModelTestUtils.createAndInsertPhysicalPartitionAndModel(testImodel, PhysicalPartition.createCode(testImodel, childSubject, "Physical"), false, childSubject);
    const elementProps: GeometricElementProps = {
      classFullName: "TestBim:TestPhysicalObject",
      model: physicalModelId,
      category: spatialCategoryId,
      code: Code.createEmpty(),
    };

    const physicalObjectId1 = testImodel.elements.insertElement(testImodel.elements.createElement(elementProps).toJSON());
    const physicalObjectId2 = testImodel.elements.insertElement(testImodel.elements.createElement(elementProps).toJSON());
    const physicalObjectId3 = testImodel.elements.insertElement(testImodel.elements.createElement(elementProps).toJSON());
    ElementGroupsMembers.create(testImodel, physicalObjectId1, physicalObjectId2).insert();
    ElementGroupsMembers.create(testImodel, physicalObjectId1, physicalObjectId3).insert();

    assert.isTrue(doesElementExist(testImodel, repositoryLinkId));
    assert.equal(testImodel.elements.getElement(jobSubjectId).parent?.id, IModel.rootSubjectId);
    assert.equal(testImodel.elements.getElement(definitionModelId).parent?.id, jobSubjectId);
    assert.equal(testImodel.elements.getElement(spatialCategoryId).model, definitionModelId);
    assert.equal(testImodel.elements.getElement(drawingCategoryId).model, definitionModelId);
    assert.equal(testImodel.elements.getElement(documentListModelId).parent?.id, jobSubjectId);
    assert.equal(testImodel.elements.getElement(drawingModelId).model, documentListModelId);
    assert.equal(testImodel.elements.getElement(drawingGraphicId1).model, drawingModelId);
    assert.equal(testImodel.elements.getElement(physicalModelId).parent?.id, childSubject);
    assert.equal(testImodel.elements.getElement(physicalObjectId1).model, physicalModelId);
    assert.equal(testImodel.elements.getElement(physicalObjectId2).model, physicalModelId);
    assert.equal(testImodel.elements.getElement(physicalObjectId3).model, physicalModelId);
    assert.isTrue(doesGroupRelationshipExist(testImodel, physicalObjectId1, physicalObjectId2));
    assert.isTrue(doesGroupRelationshipExist(testImodel, physicalObjectId1, physicalObjectId3));
    assert.isTrue(doesModelExist(testImodel, definitionModelId));
    assert.isTrue(doesModelExist(testImodel, drawingModelId));
    assert.isTrue(doesModelExist(testImodel, physicalModelId));

    const toPrune = new Set<string>();
    toPrune.add(drawingModelId);
    toPrune.add(drawingCategoryId);
    toPrune.add(physicalObjectId3);
    deleteElementSubTrees(testImodel, jobSubjectId, (elid) => toPrune.has(elid));

    assert.isTrue(doesElementExist(testImodel, repositoryLinkId));
    assert.isTrue(doesElementExist(testImodel, definitionModelId));
    assert.isTrue(doesElementExist(testImodel, spatialCategoryId));
    assert.isFalse(doesElementExist(testImodel, drawingCategoryId));
    assert.isTrue(doesElementExist(testImodel, documentListModelId));
    assert.isFalse(doesElementExist(testImodel, drawingModelId));
    assert.isFalse(doesElementExist(testImodel, drawingGraphicId1)); // contents of drawing model should be gone
    assert.isTrue(doesElementExist(testImodel, physicalModelId));
    assert.isTrue(doesElementExist(testImodel, physicalObjectId1));
    assert.isTrue(doesElementExist(testImodel, physicalObjectId2));
    assert.isFalse(doesElementExist(testImodel, physicalObjectId3));
    assert.isTrue(doesGroupRelationshipExist(testImodel, physicalObjectId1, physicalObjectId2));
    assert.isFalse(doesGroupRelationshipExist(testImodel, physicalObjectId1, physicalObjectId3));
    assert.isTrue(doesElementExist(testImodel, jobSubjectId));
    assert.isTrue(doesModelExist(testImodel, definitionModelId));
    assert.isFalse(doesModelExist(testImodel, drawingModelId));
    assert.isTrue(doesModelExist(testImodel, physicalModelId));
    assert.isTrue(doesModelExist(testImodel, IModel.repositoryModelId));
    assert.isTrue(doesModelExist(testImodel, IModel.dictionaryId));
  });
});
