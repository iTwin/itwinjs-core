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
  let imodel: SnapshotDb;
  let originalEnv: any;

  let repositoryLinkId: Id64String;
  let jobSubjectId: Id64String;
  let childSubject: Id64String;
  let definitionModelId: Id64String;
  let spatialCategoryId: Id64String;
  let drawingCategoryId: Id64String;
  let documentListModelId: Id64String;
  let drawingModelId: Id64String;
  let drawingGraphicId1: Id64String;
  let physicalModelId: Id64String;
  let physicalObjectId1: Id64String;
  let physicalObjectId2: Id64String;
  let physicalObjectId3: Id64String;

  before(async () => {
    originalEnv = { ...process.env };

    IModelTestUtils.registerTestBimSchema();
  });

  after(() => {
    process.env = originalEnv;
  });

  beforeEach(async () => {
    imodel = IModelTestUtils.createSnapshotFromSeed(IModelTestUtils.prepareOutputFile("IModel", "test.bim"), IModelTestUtils.resolveAssetFile("test.bim"));
    const schemaPathname = path.join(KnownTestLocations.assetsDir, "TestBim.ecschema.xml");
    await imodel.importSchemas([schemaPathname]); // will throw an exception if import fails

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

    repositoryLinkId = IModelTestUtils.insertRepositoryLink(imodel, "test link", "foo", "bar");
    jobSubjectId = IModelTestUtils.createJobSubjectElement(imodel, "Job").insert();

    childSubject = Subject.insert(imodel, jobSubjectId, "Child Subject");

    definitionModelId = DefinitionModel.insert(imodel, jobSubjectId, "Definition");
    spatialCategoryId = SpatialCategory.insert(imodel, definitionModelId, "SpatialCategory", new SubCategoryAppearance());
    drawingCategoryId = DrawingCategory.insert(imodel, definitionModelId, "DrawingCategory", new SubCategoryAppearance());

    documentListModelId = DocumentListModel.insert(imodel, jobSubjectId, "Document");
    assert.isTrue(Id64.isValidId64(documentListModelId));
    drawingModelId = Drawing.insert(imodel, documentListModelId, "Drawing");
    const drawingGraphicProps1: GeometricElement2dProps = {
      classFullName: DrawingGraphic.classFullName,
      model: drawingModelId,
      category: drawingCategoryId,
      code: Code.createEmpty(),
      userLabel: "DrawingGraphic1",
      geom: IModelTestUtils.createRectangle(Point2d.create(1, 1)),
      placement: { origin: Point2d.create(2, 2), angle: 0 },
    };
    drawingGraphicId1 = imodel.elements.insertElement(drawingGraphicProps1);

    [, physicalModelId] = IModelTestUtils.createAndInsertPhysicalPartitionAndModel(imodel, PhysicalPartition.createCode(imodel, childSubject, "Physical"), false, childSubject);
    const elementProps: GeometricElementProps = {
      classFullName: "TestBim:TestPhysicalObject",
      model: physicalModelId,
      category: spatialCategoryId,
      code: Code.createEmpty(),
    };

    physicalObjectId1 = imodel.elements.insertElement(imodel.elements.createElement(elementProps).toJSON());
    physicalObjectId2 = imodel.elements.insertElement(imodel.elements.createElement(elementProps).toJSON());
    physicalObjectId3 = imodel.elements.insertElement(imodel.elements.createElement(elementProps).toJSON());
    ElementGroupsMembers.create(imodel, physicalObjectId1, physicalObjectId2).insert();
    ElementGroupsMembers.create(imodel, physicalObjectId1, physicalObjectId3).insert();

    assert.isTrue(doesElementExist(imodel, repositoryLinkId));
    assert.equal(imodel.elements.getElement(jobSubjectId).parent?.id, IModel.rootSubjectId);
    assert.equal(imodel.elements.getElement(definitionModelId).parent?.id, jobSubjectId);
    assert.equal(imodel.elements.getElement(spatialCategoryId).model, definitionModelId);
    assert.equal(imodel.elements.getElement(drawingCategoryId).model, definitionModelId);
    assert.equal(imodel.elements.getElement(documentListModelId).parent?.id, jobSubjectId);
    assert.equal(imodel.elements.getElement(drawingModelId).model, documentListModelId);
    assert.equal(imodel.elements.getElement(drawingGraphicId1).model, drawingModelId);
    assert.equal(imodel.elements.getElement(physicalModelId).parent?.id, childSubject);
    assert.equal(imodel.elements.getElement(physicalObjectId1).model, physicalModelId);
    assert.equal(imodel.elements.getElement(physicalObjectId2).model, physicalModelId);
    assert.equal(imodel.elements.getElement(physicalObjectId3).model, physicalModelId);
    assert.isTrue(doesGroupRelationshipExist(imodel, physicalObjectId1, physicalObjectId2));
    assert.isTrue(doesGroupRelationshipExist(imodel, physicalObjectId1, physicalObjectId3));
    assert.isTrue(doesModelExist(imodel, definitionModelId));
    assert.isTrue(doesModelExist(imodel, drawingModelId));
    assert.isTrue(doesModelExist(imodel, physicalModelId));
  });

  afterEach(() => {
    sinon.restore();
    imodel.close();
  });

  it("DFS search and deleteElementTree", () => {
    // First, check that DFS search visits elements and models in expected bottom-up order
    {
      const collector1 = new ElementTreeCollector(imodel);
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

    // Exercise the search filters
    {
      const collector2 = new SelectedElementCollector(imodel, [drawingGraphicId1, spatialCategoryId, physicalObjectId3]);
      collector2.collect(jobSubjectId);
      assert.isTrue(collector2.definitions.length === 1);
      assert.isTrue(collector2.definitions.includes(spatialCategoryId));
      assert.isTrue(collector2.elements.length === 2);
      assert.isTrue(collector2.elements.includes(drawingGraphicId1));
      assert.isTrue(collector2.elements.includes(physicalObjectId3));
    }

    // Test the deleteElementTree function
    deleteElementTree(imodel, jobSubjectId);

    assert.isTrue(doesModelExist(imodel, IModel.repositoryModelId));
    assert.isTrue(doesModelExist(imodel, IModel.dictionaryId));
    assert.isTrue(doesElementExist(imodel, repositoryLinkId), "RepositoryLink should not have been deleted, since it is not under Job Subject");
    assert.isFalse(doesElementExist(imodel, definitionModelId));
    assert.isFalse(doesElementExist(imodel, spatialCategoryId));
    assert.isFalse(doesElementExist(imodel, drawingCategoryId));
    assert.isFalse(doesElementExist(imodel, documentListModelId));
    assert.isFalse(doesElementExist(imodel, drawingModelId));
    assert.isFalse(doesElementExist(imodel, drawingGraphicId1));
    assert.isFalse(doesElementExist(imodel, physicalModelId));
    assert.isFalse(doesElementExist(imodel, physicalObjectId1));
    assert.isFalse(doesElementExist(imodel, physicalObjectId2));
    assert.isFalse(doesElementExist(imodel, physicalObjectId3));
    assert.isFalse(doesGroupRelationshipExist(imodel, physicalObjectId1, physicalObjectId2));
    assert.isFalse(doesGroupRelationshipExist(imodel, physicalObjectId1, physicalObjectId3));
    assert.isFalse(doesElementExist(imodel, jobSubjectId));
    assert.isFalse(doesModelExist(imodel, definitionModelId));
    assert.isFalse(doesModelExist(imodel, drawingModelId));
    assert.isFalse(doesModelExist(imodel, physicalModelId));
  });

  it("deleteElementSubTrees", () => {
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

    const toPrune = new Set<string>();
    toPrune.add(drawingModelId);
    toPrune.add(drawingCategoryId);
    toPrune.add(physicalObjectId3);

    deleteElementSubTrees(imodel, jobSubjectId, (elid) => toPrune.has(elid));

    assert.isTrue(doesElementExist(imodel, repositoryLinkId));
    assert.isTrue(doesElementExist(imodel, definitionModelId));
    assert.isTrue(doesElementExist(imodel, spatialCategoryId));
    assert.isFalse(doesElementExist(imodel, drawingCategoryId));
    assert.isTrue(doesElementExist(imodel, documentListModelId));
    assert.isFalse(doesElementExist(imodel, drawingModelId));
    assert.isFalse(doesElementExist(imodel, drawingGraphicId1)); // contents of drawing model should be gone
    assert.isTrue(doesElementExist(imodel, physicalModelId));
    assert.isTrue(doesElementExist(imodel, physicalObjectId1));
    assert.isTrue(doesElementExist(imodel, physicalObjectId2));
    assert.isFalse(doesElementExist(imodel, physicalObjectId3));
    assert.isTrue(doesGroupRelationshipExist(imodel, physicalObjectId1, physicalObjectId2));
    assert.isFalse(doesGroupRelationshipExist(imodel, physicalObjectId1, physicalObjectId3));
    assert.isTrue(doesElementExist(imodel, jobSubjectId));
    assert.isTrue(doesModelExist(imodel, definitionModelId));
    assert.isFalse(doesModelExist(imodel, drawingModelId));
    assert.isTrue(doesModelExist(imodel, physicalModelId));
    assert.isTrue(doesModelExist(imodel, IModel.repositoryModelId));
    assert.isTrue(doesModelExist(imodel, IModel.dictionaryId));
  });
});
